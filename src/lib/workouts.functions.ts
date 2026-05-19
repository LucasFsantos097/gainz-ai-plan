import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const FREE_LIMIT = 3;

const WorkoutInput = z.object({
  goal: z.enum(["Hipertrofia", "Emagrecimento", "Condicionamento", "Forca"]),
  level: z.enum(["Iniciante", "Intermediario", "Avancado"]),
  daysPerWeek: z.number().int().min(2).max(5),
  equipment: z.enum(["Academia completa", "Halteres em casa", "Sem equipamento"]),
  age: z.number().int().min(12).max(99),
  sex: z.enum(["Masculino", "Feminino", "Outro"]),
});

export type WorkoutInputType = z.infer<typeof WorkoutInput>;

export type Exercise = {
  name: string;
  sets: string;
  reps: string;
  tip: string;
};

export type WorkoutDay = {
  day: string;
  focus: string;
  exercises: Exercise[];
};

export type WorkoutPlan = {
  title: string;
  summary: string;
  days: WorkoutDay[];
};

export const generateWorkout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => WorkoutInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Check limit
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_premium, workouts_generated")
      .eq("id", userId)
      .maybeSingle();

    const isPremium = profile?.is_premium ?? false;
    const generated = profile?.workouts_generated ?? 0;

    if (!isPremium && generated >= FREE_LIMIT) {
      return {
        ok: false as const,
        error: "limit_reached" as const,
        used: generated,
        limit: FREE_LIMIT,
      };
    }

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) {
      return { ok: false as const, error: "missing_key" as const };
    }

    const systemPrompt = `Voce e um personal trainer especialista. Gere um plano de treino COMPLETO e personalizado em portugues do Brasil. Retorne APENAS JSON valido seguindo EXATAMENTE este schema:
{
  "title": "string curto",
  "summary": "1-2 frases motivacionais e descrevendo o plano",
  "days": [
    {
      "day": "Dia 1",
      "focus": "ex: Peito e Triceps",
      "exercises": [
        { "name": "Supino reto", "sets": "4", "reps": "8-12", "tip": "Mantenha as escapulas retraidas..." }
      ]
    }
  ]
}
Gere EXATAMENTE o numero de dias solicitado. Cada dia deve ter 5-7 exercicios. As dicas devem ser tecnicas e praticas. NAO inclua texto fora do JSON.`;

    const userPrompt = `Objetivo: ${data.goal}
Nivel: ${data.level}
Dias por semana: ${data.daysPerWeek}
Equipamentos: ${data.equipment}
Idade: ${data.age}
Sexo: ${data.sex}

Gere um plano de treino otimizado considerando o nivel e o equipamento disponivel.`;

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (resp.status === 429) {
      return { ok: false as const, error: "rate_limit" as const };
    }
    if (resp.status === 402) {
      return { ok: false as const, error: "credits" as const };
    }
    if (!resp.ok) {
      const txt = await resp.text();
      console.error("AI gateway error:", resp.status, txt);
      return { ok: false as const, error: "ai_failed" as const };
    }

    const json = await resp.json();
    const content = json?.choices?.[0]?.message?.content;
    if (!content) {
      return { ok: false as const, error: "empty_response" as const };
    }

    let plan: WorkoutPlan;
    try {
      plan = JSON.parse(content);
    } catch {
      console.error("Failed to parse plan:", content);
      return { ok: false as const, error: "parse_failed" as const };
    }

    // Persist workout + increment counter
    const { data: inserted, error: insertErr } = await supabase
      .from("workouts")
      .insert({
        user_id: userId,
        goal: data.goal,
        level: data.level,
        days_per_week: data.daysPerWeek,
        equipment: data.equipment,
        age: data.age,
        sex: data.sex,
        plan: plan as never,
      })
      .select("id")
      .single();

    if (insertErr || !inserted) {
      console.error("Insert workout failed:", insertErr);
      return { ok: false as const, error: "save_failed" as const };
    }

    await supabase
      .from("profiles")
      .update({ workouts_generated: generated + 1 })
      .eq("id", userId);

    return {
      ok: true as const,
      workoutId: inserted.id,
      plan,
      used: generated + 1,
      limit: FREE_LIMIT,
      isPremium,
    };
  });

export const getProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data } = await supabase
      .from("profiles")
      .select("is_premium, workouts_generated, email")
      .eq("id", userId)
      .maybeSingle();
    return {
      isPremium: data?.is_premium ?? false,
      used: data?.workouts_generated ?? 0,
      limit: FREE_LIMIT,
      email: data?.email ?? null,
    };
  });

export const getWorkout = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("workouts")
      .select("*")
      .eq("id", data.id)
      .eq("user_id", userId)
      .maybeSingle();
    if (error || !row) return { ok: false as const };
    return { ok: true as const, workout: row };
  });

export const listWorkouts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data } = await supabase
      .from("workouts")
      .select("id, goal, level, days_per_week, equipment, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);
    return { workouts: data ?? [] };
  });
