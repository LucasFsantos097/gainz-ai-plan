import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const FREE_LIMIT = 3;

const AnamnesisSchema = z.object({
  // Step 1 — Identificação
  fullName: z.string().min(1).max(120),
  birthDate: z.string().min(1).max(20),
  phone: z.string().min(1).max(40),
  email: z.string().email().max(160),
  sex: z.enum(["Feminino", "Masculino"]),
  // Step 2 — Treino
  frequency: z.enum(["2x", "3x", "4x", "5x", "6x"]),
  timeAvailable: z.string().min(1).max(80),
  goals: z.array(z.enum([
    "Hipertrofia",
    "Perda de peso",
    "Qualidade de vida",
    "Correção postural",
    "Melhora cardiorrespiratória",
  ])).min(1).max(2),
  hasRoutine: z.enum(["Sim", "Sim, porém pouco", "Não"]),
  emphasis: z.array(z.string().max(40)).max(10),
  // Step 3 — Saúde Geral
  smokeDrink: z.string().max(500),
  diseases: z.string().max(500),
  bonePathology: z.string().max(500),
  surgeries: z.string().max(500),
  medications: z.string().max(500),
  familyCardiac: z.string().max(500),
  // Step 4 — Indicadores
  cholesterol: z.string().max(120),
  glycemia: z.string().max(120),
  bloodPressure: z.string().max(120),
  waterIntake: z.string().max(120),
  sleepHours: z.string().max(120),
  headaches: z.string().max(300),
  // Step 5 — Dores
  jointPainDaily: z.string().max(500),
  jointPainTraining: z.string().max(500),
  feelBadTraining: z.enum(["Sim", "Não", "Não treino"]),
  professionals: z.array(z.string().max(40)).max(10),
  // Step 6 — Rotina
  routine: z.string().max(2000),
});

export type Anamnesis = z.infer<typeof AnamnesisSchema>;

export type Exercise = {
  name: string;
  sets: string;
  reps: string;
  rest: string;
  tip: string;
};

export type WorkoutDay = {
  day: string;
  focus: string;
  estimatedMinutes: number;
  exercises: Exercise[];
};

export type WorkoutWeek = {
  weekNumber: number;
  phase: string;
  days: WorkoutDay[];
};

export type Phase = {
  name: string;
  weekRange: string;
  description: string;
};

export type WorkoutPlan = {
  title: string;
  summary: string;
  totalWeeks: number;
  sessionMinutes: number;
  phases: Phase[];
  weeks: WorkoutWeek[];
};

export const generateWorkout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => AnamnesisSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: profile } = await supabase
      .from("profiles")
      .select("is_premium, workouts_generated")
      .eq("id", userId)
      .maybeSingle();

    const isPremium = profile?.is_premium ?? false;
    const generated = profile?.workouts_generated ?? 0;

    if (!isPremium && generated >= FREE_LIMIT) {
      return { ok: false as const, error: "limit_reached" as const, used: generated, limit: FREE_LIMIT };
    }

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) return { ok: false as const, error: "missing_key" as const };

    const systemPrompt = `Você é um personal trainer e fisiologista do exercício. Após analisar uma anamnese COMPLETA, gere uma periodização de treino de 8 a 10 semanas em português do Brasil.

Estruture o programa em FASES claras:
- Adaptação (semanas iniciais): técnica, ADM, baixa intensidade (reps 12-15)
- Base: aumento progressivo de volume (reps 10-12)
- Força/Intensificação: cargas mais altas, menores repetições (reps 6-8 para força / 8-10 para hipertrofia)
- Deload (1 semana de descarga): reduzir séries e intensidade ~40-50%

REGRAS OBRIGATÓRIAS (NÃO VIOLAR):
1. Cada sessão deve ter EXATAMENTE de 6 a 8 exercícios. NUNCA menos de 6, NUNCA mais de 8.
2. Toda sessão deve incluir 1 a 2 EXERCÍCIOS COMPOSTOS PRINCIPAIS (ex: agachamento, levantamento terra, supino, remada, desenvolvimento, barra fixa), sempre posicionados no início da sessão.
3. Séries entre 3 e 5 (números inteiros). Repetições variam por fase e objetivo: hipertrofia 8-12, força 4-6, perda de peso/resistência 12-20.
4. Descanso é OBRIGATÓRIO em CADA exercício (ex: "90s", "2min"). Compostos: 90s-3min. Isolados: 45-75s.
5. Divisão de treino conforme frequência semanal:
   - 2x = Full Body (corpo inteiro nos 2 dias)
   - 3x = ABC
   - 4x = Upper/Lower (Superior A, Inferior A, Superior B, Inferior B)
   - 5x = ABCDE
   - 6x = PPL (Push, Pull, Legs x2)
6. Se houver LESÃO, DOR ARTICULAR ou CIRURGIA relatada: SUBSTITUIR exercícios que sobrecarreguem a região afetada por variações seguras, e na "tip" do exercício substituto EXPLICITAR brevemente o motivo (ex: "Substitui agachamento livre por leg press devido ao histórico de cirurgia no joelho — menor cisalhamento").
7. Respeitar medicamentos, idade e nível detalhado.
8. Distribuir EXATAMENTE o número de dias semanais informado, respeitando a divisão da regra 5.
9. Duração estimada da sessão deve respeitar o tempo disponível informado.
10. Enfatizar musculaturas pedidas, sem ignorar grupos opostos (evitar desequilíbrios).
11. Título e summary personalizados (citar nome, idade, nível e objetivo).

Retorne APENAS JSON válido neste schema EXATO:
{
  "title": "string curta personalizada",
  "summary": "2-3 frases analisando a anamnese e descrevendo a estratégia",
  "totalWeeks": 8,
  "sessionMinutes": 60,
  "phases": [
    {"name": "Adaptação", "weekRange": "1-2", "description": "..."},
    {"name": "Base", "weekRange": "3-5", "description": "..."},
    {"name": "Força", "weekRange": "6-7", "description": "..."},
    {"name": "Deload", "weekRange": "8", "description": "..."}
  ],
  "weeks": [
    {
      "weekNumber": 1,
      "phase": "Adaptação",
      "days": [
        {
          "day": "Dia 1 - Push",
          "focus": "Peito, Ombro e Tríceps",
          "estimatedMinutes": 60,
          "exercises": [
            {"name": "Supino reto com barra", "sets": "4", "reps": "8-10", "rest": "2min", "tip": "Composto principal. Escápulas retraídas, descida controlada."}
          ]
        }
      ]
    }
  ]
}

Gere TODAS as semanas (8 a 10) com TODOS os dias da frequência semanal, cada dia com 6 a 8 exercícios (sendo 1-2 compostos no início). Não inclua nada fora do JSON.`;

    const goalsList = data.goals.join(", ");
    const emphasisList = data.emphasis.length ? data.emphasis.join(", ") : "Nenhuma específica";
    const profList = data.professionals.length ? data.professionals.join(", ") : "Nenhum";

    const userPrompt = `ANAMNESE COMPLETA DO ALUNO

[Identificação]
Nome: ${data.fullName}
Data de nascimento: ${data.birthDate}
Sexo: ${data.sex}
Telefone: ${data.phone}
Email: ${data.email}

[Treino]
Frequência desejada: ${data.frequency} por semana
Tempo disponível por sessão: ${data.timeAvailable}
Objetivo(s) principal(is): ${goalsList}
Já possui rotina de exercícios: ${data.hasRoutine}
Ênfase em musculatura: ${emphasisList}

[Saúde Geral]
Fumo/Álcool: ${data.smokeDrink || "Não informado"}
Doenças: ${data.diseases || "Nenhuma"}
Patologia óssea/estrutural: ${data.bonePathology || "Nenhuma"}
Cirurgias prévias: ${data.surgeries || "Nenhuma"}
Medicamentos: ${data.medications || "Nenhum"}
Histórico familiar cardiopatas: ${data.familyCardiac || "Não informado"}

[Indicadores]
Colesterol: ${data.cholesterol || "Não informado"}
Glicemia: ${data.glycemia || "Não informado"}
Pressão arterial: ${data.bloodPressure || "Não informado"}
Água/dia: ${data.waterIntake || "Não informado"}
Sono: ${data.sleepHours || "Não informado"}
Dores de cabeça recorrentes: ${data.headaches || "Não"}

[Dores e Acompanhamento]
Dor articular no dia a dia: ${data.jointPainDaily || "Não"}
Dor articular treinando: ${data.jointPainTraining || "Não"}
Passa mal no treino: ${data.feelBadTraining}
Profissionais que acompanham: ${profList}

[Rotina]
${data.routine || "Não detalhada"}

Crie uma periodização de 8 a 10 semanas, incluindo OBRIGATORIAMENTE uma semana de Deload, ajustada a essa anamnese.`;

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (resp.status === 429) return { ok: false as const, error: "rate_limit" as const };
    if (resp.status === 402) return { ok: false as const, error: "credits" as const };
    if (!resp.ok) {
      console.error("AI gateway error:", resp.status, await resp.text());
      return { ok: false as const, error: "ai_failed" as const };
    }

    const json = await resp.json();
    const content = json?.choices?.[0]?.message?.content;
    if (!content) return { ok: false as const, error: "empty_response" as const };

    let plan: WorkoutPlan;
    try {
      plan = JSON.parse(content);
    } catch {
      console.error("Failed to parse plan:", content);
      return { ok: false as const, error: "parse_failed" as const };
    }

    const freqNum = parseInt(data.frequency);

    const { data: inserted, error: insertErr } = await supabase
      .from("workouts")
      .insert({
        user_id: userId,
        title: plan.title,
        goal: data.goals[0],
        level: data.hasRoutine === "Não" ? "Iniciante" : data.hasRoutine === "Sim, porém pouco" ? "Intermediario" : "Avancado",
        days_per_week: freqNum,
        equipment: "Conforme anamnese",
        age: null,
        sex: data.sex,
        weeks: plan.totalWeeks ?? plan.weeks?.length ?? 8,
        anamnesis: data as never,
        plan: plan as never,
      })
      .select("id")
      .single();

    if (insertErr || !inserted) {
      console.error("Insert workout failed:", insertErr);
      return { ok: false as const, error: "save_failed" as const };
    }

    await supabase.from("profiles").update({ workouts_generated: generated + 1 }).eq("id", userId);

    return { ok: true as const, workoutId: inserted.id, used: generated + 1, limit: FREE_LIMIT, isPremium };
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

    const { data: completions } = await supabase
      .from("session_completions")
      .select("week_number, day_number, completed_at")
      .eq("workout_id", data.id);

    return { ok: true as const, workout: row, completions: completions ?? [] };
  });

export const listWorkouts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data } = await supabase
      .from("workouts")
      .select("id, title, goal, level, days_per_week, weeks, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);
    return { workouts: data ?? [] };
  });

export const toggleSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      workoutId: z.string().uuid(),
      weekNumber: z.number().int().min(1).max(20),
      dayNumber: z.number().int().min(1).max(10),
      completed: z.boolean(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (data.completed) {
      const { error } = await supabase.from("session_completions").insert({
        user_id: userId,
        workout_id: data.workoutId,
        week_number: data.weekNumber,
        day_number: data.dayNumber,
      });
      if (error && !error.message.includes("duplicate")) {
        return { ok: false as const };
      }
    } else {
      await supabase
        .from("session_completions")
        .delete()
        .eq("workout_id", data.workoutId)
        .eq("week_number", data.weekNumber)
        .eq("day_number", data.dayNumber)
        .eq("user_id", userId);
    }
    return { ok: true as const };
  });
