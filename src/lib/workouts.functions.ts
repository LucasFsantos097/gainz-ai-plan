import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const FREE_LIMIT = 500;

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

    const systemPrompt = `Você é um personal trainer especialista e fisiologista do exercício com mais de 10 anos de experiência. Após analisar uma anamnese COMPLETA, gere uma periodização de treino profissional de 8 a 10 semanas em português do Brasil.

Estruture o programa em FASES claras:
- Adaptação (semanas 1-2): foco em técnica, amplitude de movimento, baixa intensidade, aprendizado motor
- Base/Volume (semanas 3-5): aumento progressivo de volume, 3-4 séries por exercício, repetições moderadas
- Força/Intensificação (semanas 6-7): cargas mais altas, 4-5 séries, repetições menores (4-8), técnicas avançadas
- Deload (semana 8 ou última): redução de 40-50% do volume, mesmos exercícios, foco em recuperação

REGRAS OBRIGATÓRIAS DE CONTEÚDO — NÃO NEGOCIÁVEIS:
- Cada sessão DEVE ter EXATAMENTE entre 6 e 8 exercícios. NUNCA gere menos de 6. Conte os exercícios antes de finalizar cada dia.
- Sempre incluir 1-2 exercícios compostos principais (agachamento, supino, levantamento terra, remada, desenvolvimento, etc.)
- Sempre incluir exercícios isoladores complementares após os compostos
- Séries: mínimo 3, máximo 5 por exercício (variar conforme a fase)
- Repetições: variar conforme objetivo e fase (ex: hipertrofia 8-12, força 4-6, resistência 15-20)
- Descanso obrigatório em cada exercício (ex: "60s", "90s", "2min")
- Dica técnica específica e útil para cada exercício (nunca genérica)
- Tempo estimado da sessão deve respeitar o tempo disponível informado
- Na semana de deload, reduzir séries para 2-3 e aumentar descanso

ORDEM DOS EXERCÍCIOS DENTRO DE CADA SESSÃO — REGRA CRÍTICA:
- Os exercícios DEVEM ser agrupados por músculo: termine TODOS os exercícios de um grupamento antes de passar para o próximo
- Sequência obrigatória: exercício composto do grupamento principal → exercícios acessórios do MESMO grupamento → SOMENTE DEPOIS passar para o próximo grupamento
- EXEMPLO CORRETO para Peito + Tríceps: Supino reto → Supino inclinado → Crucifixo polia → Pullover → Tríceps corda → Tríceps francês
- EXEMPLO ERRADO (NUNCA FAÇA): Supino reto → Tríceps corda → Supino inclinado → Tríceps francês (misturar grupamentos é proibido)
- Para dias de perna: Agachamento → Leg press → Cadeira extensora → DEPOIS Mesa flexora → Stiff → DEPOIS Glúteo isolado → DEPOIS Panturrilha

ORDEM DOS DIAS NA SEMANA — BASEADA NO SEXO DO ALUNO:
- Se o aluno for FEMININO: a semana DEVE OBRIGATORIAMENTE começar com treino de INFERIOR (Glúteo, Posterior, Quadríceps). NUNCA comece a semana feminina com Peito, Ombro ou Tríceps.
  Exemplo 4x feminino: Dia 1=Glúteo+Posterior / Dia 2=Quadríceps+Panturrilha / Dia 3=Costas+Bíceps / Dia 4=Peito+Ombro+Tríceps
  Exemplo 3x feminino: Dia 1=Glúteo+Posterior / Dia 2=Quadríceps+Abdômen / Dia 3=Superior completo
- Se o aluno for MASCULINO: comece pelo grupamento de maior ênfase declarada na anamnese, ou Peito+Tríceps se não houver ênfase específica

DIVISÕES RECOMENDADAS POR FREQUÊNCIA:
- 2x: Full Body A / Full Body B
- 3x: ABC — feminino: Inferior A / Inferior B / Superior; masculino: Peito+Tríceps / Costas+Bíceps / Pernas+Ombro
- 4x: feminino: Glúteo+Post / Quad+Pant / Costas+Bíceps / Peito+Ombro+Tríceps; masculino: Upper A / Lower / Upper B / Lower
- 5x: ABCDE com dia extra dedicado ao grupamento de ênfase
- 6x: PPL (Push/Pull/Legs) x2 — feminino inicia pela semana Legs

REGRAS DE SEGURANÇA E PERSONALIZAÇÃO:
- Se houver lesão ou dor articular relatada: substituir exercícios que agravem a região e EXPLICAR o motivo na dica
- Se houver cirurgia prévia: evitar exercícios de alto impacto na região operada
- Se passou mal no treino: incluir observação sobre monitoramento de frequência cardíaca
- Se tem hipertensão ou histórico familiar cardíaco: evitar Valsalva, priorizar exercícios controlados
- Enfatizar musculaturas pedidas sem negligenciar grupos antagonistas
- Adaptar complexidade dos exercícios ao nível do aluno (iniciante = exercícios básicos; avançado = variações e técnicas)
- O título e o summary DEVEM citar o nome do aluno, o sexo e mencionar aspectos específicos da anamnese dele

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
          "day": "Dia 1",
          "focus": "Peito e Tríceps",
          "estimatedMinutes": 55,
          "exercises": [
            {"name": "Supino reto", "sets": "3", "reps": "10-12", "rest": "60s", "tip": "Escápulas retraídas..."}
          ]
        }
      ]
    }
  ]
}

Gere TODAS as semanas (8 a 10) com TODOS os dias da frequência semanal. Não inclua nada fora do JSON.`;

    const goalsList = data.goals.join(", ");
    const emphasisList = data.emphasis.length ? data.emphasis.join(", ") : "Nenhuma específica";
    const profList = data.professionals.length ? data.professionals.join(", ") : "Nenhum";

    const age = data.birthDate ? Math.floor((Date.now() - new Date(data.birthDate).getTime()) / (365.25 * 24 * 60 * 60 * 1000)) : null;
    const level = data.hasRoutine === "Não" ? "Iniciante (nunca treinou)" : data.hasRoutine === "Sim, porém pouco" ? "Intermediário (treina com pouca regularidade)" : "Avançado (treino regular consistente)";
    const hasHealthRestrictions = [data.diseases, data.bonePathology, data.surgeries, data.jointPainDaily, data.jointPainTraining].some(v => v && v.trim().length > 0);

    const userPrompt = `ANAMNESE COMPLETA DO ALUNO — LEIA COM ATENÇÃO ANTES DE GERAR

[Identificação]
Nome: ${data.fullName}
Idade: ${age ? `${age} anos` : "Não calculada"} (nascido em ${data.birthDate})
Sexo: ${data.sex}

[Perfil de Treino]
Nível atual: ${level}
Frequência desejada: ${data.frequency} por semana
Tempo disponível por sessão: ${data.timeAvailable}
Objetivo(s) principal(is): ${goalsList}
Ênfase em musculatura específica: ${emphasisList}

[Saúde — ATENÇÃO REDOBRADA SE HOUVER RESTRIÇÕES]
${hasHealthRestrictions ? "⚠️ ESTE ALUNO POSSUI RESTRIÇÕES DE SAÚDE — adapte os exercícios conforme abaixo:" : "✅ Sem restrições de saúde relatadas"}
Doenças: ${data.diseases || "Nenhuma"}
Patologia óssea/estrutural: ${data.bonePathology || "Nenhuma"}
Cirurgias prévias: ${data.surgeries || "Nenhuma"}
Medicamentos em uso: ${data.medications || "Nenhum"}
Fumo/Álcool: ${data.smokeDrink || "Não relatado"}
Histórico familiar cardiopatas: ${data.familyCardiac || "Não relatado"}

[Indicadores de Saúde]
Colesterol: ${data.cholesterol || "Não informado"}
Glicemia: ${data.glycemia || "Não informado"}
Pressão arterial: ${data.bloodPressure || "Não informado"}
Hidratação (água/dia): ${data.waterIntake || "Não informado"}
Qualidade do sono: ${data.sleepHours || "Não informado"}
Dores de cabeça recorrentes: ${data.headaches || "Não"}

[Dores e Limitações — CRÍTICO PARA SELEÇÃO DE EXERCÍCIOS]
Dor articular fora do treino: ${data.jointPainDaily || "Não relatada"}
Dor articular durante treino: ${data.jointPainTraining || "Não relatada"}
Passa mal durante treino: ${data.feelBadTraining}
Profissionais de saúde que acompanham: ${profList}

[Rotina de Vida]
${data.routine || "Não detalhada pelo aluno"}

INSTRUÇÕES FINAIS:
- Gere periodização completa de 8 a 10 semanas com TODAS as semanas detalhadas
- Cada sessão deve ter OBRIGATORIAMENTE 6 a 8 exercícios
- Inclua DELOAD obrigatório na última ou penúltima semana
- Personalize o título e o summary citando ${data.fullName} e seus objetivos específicos
- Se houver qualquer restrição de saúde, mencione as adaptações feitas no summary`;

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
