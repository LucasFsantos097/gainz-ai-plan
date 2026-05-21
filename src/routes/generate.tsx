import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, ArrowRight, Crown, Loader2, Sparkles } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/hooks/use-auth";
import { generateWorkout, getProfile, type Anamnesis } from "@/lib/workouts.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/generate")({
  component: GeneratePage,
  head: () => ({ meta: [{ title: "Anamnese · FitPlan AI" }] }),
});

type FormState = Partial<Anamnesis>;

const defaultState: FormState = {
  sex: "Masculino",
  frequency: "4x",
  timeAvailable: "60 minutos",
  goals: ["Hipertrofia"],
  hasRoutine: "Sim, porém pouco",
  emphasis: [],
  smokeDrink: "",
  diseases: "",
  bonePathology: "",
  surgeries: "",
  medications: "",
  familyCardiac: "",
  cholesterol: "",
  glycemia: "",
  bloodPressure: "",
  waterIntake: "",
  sleepHours: "",
  headaches: "",
  jointPainDaily: "",
  jointPainTraining: "",
  feelBadTraining: "Não treino",
  professionals: [],
  routine: "",
};

const GOALS = ["Hipertrofia", "Perda de peso", "Qualidade de vida", "Correção postural", "Melhora cardiorrespiratória"] as const;
const MUSCLES = ["Glúteo", "Isquiotibiais", "Quadríceps", "Ombro", "Bíceps", "Tríceps", "Peito", "Costas", "Panturrilha", "Não tenho nenhum específico"];
const PROFESSIONALS = ["Nutricionista", "Médico", "Fisioterapeuta", "Psicólogo", "Nenhum"];
const STEP_TITLES = ["Identificação", "Treino", "Saúde Geral", "Indicadores", "Dores & Acompanhamento", "Rotina"];

function GeneratePage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const generateFn = useServerFn(generateWorkout);
  const getProfileFn = useServerFn(getProfile);

  const [profile, setProfile] = useState<{ used: number; limit: number; isPremium: boolean } | null>(null);
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>(defaultState);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/login" });
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (user) {
      getProfileFn().then((p) => setProfile({ used: p.used, limit: p.limit, isPremium: p.isPremium })).catch(() => {});
    }
  }, [user, getProfileFn]);

  const limitReached = profile && !profile.isPremium && profile.used >= profile.limit;
  const totalSteps = STEP_TITLES.length;
  const progress = ((step + 1) / totalSteps) * 100;

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));

  const validateStep = (): string | null => {
    if (step === 0) {
      if (!form.fullName?.trim()) return "Informe seu nome completo";
      if (!form.birthDate) return "Informe sua data de nascimento";
      if (!form.phone?.trim()) return "Informe seu telefone";
      if (!form.email?.trim() || !/\S+@\S+\.\S+/.test(form.email)) return "Email inválido";
    }
    if (step === 1) {
      if (!form.timeAvailable?.trim()) return "Informe o tempo disponível";
      if (!form.goals?.length) return "Selecione ao menos 1 objetivo";
      if ((form.goals?.length ?? 0) > 2) return "Selecione no máximo 2 objetivos";
    }
    return null;
  };

  const next = () => {
    const err = validateStep();
    if (err) { toast.error(err); return; }
    setStep((s) => Math.min(s + 1, totalSteps - 1));
  };
  const prev = () => setStep((s) => Math.max(s - 1, 0));

  const submit = async () => {
    const err = validateStep();
    if (err) { toast.error(err); return; }
    if (limitReached) { toast.error("Limite de treinos atingido"); return; }
    setSubmitting(true);
    try {
      const res = await generateFn({ data: form as Anamnesis });
      if (!res.ok) {
        if (res.error === "limit_reached") {
          toast.error("Limite atingido");
          setProfile({ used: res.used, limit: res.limit, isPremium: false });
        } else if (res.error === "rate_limit") toast.error("Muitas requisições, aguarde");
        else if (res.error === "credits") toast.error("Créditos de IA esgotados");
        else toast.error("Falha ao gerar. Tente novamente.");
        return;
      }
      toast.success("Periodização criada!");
      navigate({ to: "/workout/$id", params: { id: res.workoutId } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro inesperado");
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading || !user) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader />
        <div className="flex justify-center pt-32"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <div className="container mx-auto max-w-6xl px-4 py-10 md:py-14">
        <div className="mb-8">
          <h1 className="font-display text-3xl font-bold tracking-tight md:text-4xl">Anamnese Profissional</h1>
          <p className="mt-2 text-muted-foreground">A IA gera sua periodização de 8–10 semanas com base nas respostas.</p>
        </div>

        {profile && !profile.isPremium && (
          <div className="mb-6 rounded-lg border border-border bg-card px-4 py-3 text-sm">
            <span className="text-muted-foreground">Treinos usados: </span>
            <span className="font-semibold text-primary">{profile.used}/{profile.limit}</span>
          </div>
        )}

        {limitReached && <PremiumBanner />}

        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
          <div>
            <div className="mb-6">
              <div className="mb-3 flex items-center justify-between text-xs uppercase tracking-wider text-muted-foreground">
                <span>Etapa {step + 1} de {totalSteps}</span>
                <span className="text-primary font-semibold">{STEP_TITLES[step]}</span>
              </div>
              <Progress value={progress} />
            </div>

            <div className="rounded-2xl border border-border bg-card p-6 md:p-8">
              {step === 0 && <StepIdentification form={form} set={set} />}
              {step === 1 && <StepTraining form={form} set={set} />}
              {step === 2 && <StepHealth form={form} set={set} />}
              {step === 3 && <StepIndicators form={form} set={set} />}
              {step === 4 && <StepPain form={form} set={set} />}
              {step === 5 && <StepRoutine form={form} set={set} />}

              <div className="mt-8 flex items-center justify-between gap-3 border-t border-border pt-6">
                <Button type="button" variant="ghost" onClick={prev} disabled={step === 0 || submitting}>
                  <ArrowLeft className="h-4 w-4" /> Voltar
                </Button>
                {step < totalSteps - 1 ? (
                  <Button type="button" onClick={next} className="font-semibold">
                    Continuar <ArrowRight className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button type="button" onClick={submit} disabled={submitting || !!limitReached} className="font-semibold neon-glow">
                    {submitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Gerando periodização...</> : <><Sparkles className="h-4 w-4" /> Gerar Treino</>}
                  </Button>
                )}
              </div>
            </div>
          </div>

          <aside className="lg:sticky lg:top-24 lg:self-start">
            <PlanPreview form={form} />
          </aside>
        </div>
      </div>
    </div>
  );
}

function calcAge(birthDate?: string): number | null {
  if (!birthDate) return null;
  const b = new Date(birthDate);
  if (Number.isNaN(b.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--;
  return age;
}

const SPLIT_BY_FREQ: Record<string, string> = {
  "2x": "Full Body", "3x": "ABC", "4x": "Upper/Lower", "5x": "ABCDE", "6x": "Push/Pull/Legs",
};

function PlanPreview({ form }: { form: FormState }) {
  const age = calcAge(form.birthDate);
  const level = form.hasRoutine === "Sim" ? "Intermediário/Avançado" : form.hasRoutine === "Sim, porém pouco" ? "Iniciante/Intermediário" : "Iniciante";
  const split = form.frequency ? SPLIT_BY_FREQ[form.frequency] : "—";
  const goals = form.goals?.length ? form.goals.join(" + ") : "—";
  const emphasis = form.emphasis?.length ? form.emphasis.filter((m) => m !== "Não tenho nenhum específico") : [];

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-4 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <h3 className="font-display text-lg font-bold">Preview do treino</h3>
      </div>
      <p className="mb-4 text-xs text-muted-foreground">Resumo em tempo real do plano que será gerado.</p>

      <dl className="space-y-3 text-sm">
        <Row label="Aluno" value={form.fullName || "—"} />
        <Row label="Idade" value={age != null ? `${age} anos` : "—"} />
        <Row label="Sexo" value={form.sex || "—"} />
        <Row label="Nível" value={level} />
        <div className="my-3 border-t border-border" />
        <Row label="Objetivo" value={goals} />
        <Row label="Frequência" value={form.frequency || "—"} />
        <Row label="Divisão" value={split} />
        <Row label="Tempo/sessão" value={form.timeAvailable || "—"} />
        <Row label="Periodização" value="8–10 sem. (Adapt → Base → Força → Deload)" />
        {emphasis.length > 0 && (
          <div>
            <dt className="mb-1.5 text-xs uppercase tracking-wider text-muted-foreground">Ênfase</dt>
            <dd className="flex flex-wrap gap-1.5">
              {emphasis.map((m) => (
                <span key={m} className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">{m}</span>
              ))}
            </dd>
          </div>
        )}
      </dl>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-xs uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className="text-right text-sm font-medium">{value}</dd>
    </div>
  );
}


type StepProps = { form: FormState; set: <K extends keyof FormState>(k: K, v: FormState[K]) => void };

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-all ${
        active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-secondary text-foreground hover:border-primary/40"
      }`}>
      {children}
    </button>
  );
}

function StepIdentification({ form, set }: StepProps) {
  return (
    <div className="space-y-5">
      <Field label="Nome completo">
        <Input value={form.fullName ?? ""} onChange={(e) => set("fullName", e.target.value)} placeholder="Seu nome" />
      </Field>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Data de nascimento">
          <Input type="date" value={form.birthDate ?? ""} onChange={(e) => set("birthDate", e.target.value)} />
        </Field>
        <Field label="Telefone">
          <Input value={form.phone ?? ""} onChange={(e) => set("phone", e.target.value)} placeholder="(00) 00000-0000" />
        </Field>
      </div>
      <Field label="Email">
        <Input type="email" value={form.email ?? ""} onChange={(e) => set("email", e.target.value)} placeholder="voce@email.com" />
      </Field>
      <Field label="Sexo">
        <div className="flex gap-2">
          {(["Feminino", "Masculino"] as const).map((s) => (
            <Chip key={s} active={form.sex === s} onClick={() => set("sex", s)}>{s}</Chip>
          ))}
        </div>
      </Field>
    </div>
  );
}

function StepTraining({ form, set }: StepProps) {
  const toggleGoal = (g: typeof GOALS[number]) => {
    const cur = form.goals ?? [];
    if (cur.includes(g)) set("goals", cur.filter((x) => x !== g));
    else if (cur.length < 2) set("goals", [...cur, g]);
    else toast.error("Máximo 2 objetivos");
  };
  const toggleMuscle = (m: string) => {
    const cur = form.emphasis ?? [];
    set("emphasis", cur.includes(m) ? cur.filter((x) => x !== m) : [...cur, m]);
  };
  return (
    <div className="space-y-5">
      <Field label="Frequência semanal desejada">
        <div className="grid grid-cols-5 gap-2">
          {(["2x", "3x", "4x", "5x", "6x"] as const).map((f) => (
            <button key={f} type="button" onClick={() => set("frequency", f)}
              className={`h-12 rounded-md border font-display text-lg font-bold transition-all ${
                form.frequency === f ? "border-primary bg-primary text-primary-foreground" : "border-border bg-secondary hover:border-primary/40"
              }`}>{f}</button>
          ))}
        </div>
      </Field>
      <Field label="Tempo disponível para treinar" hint="Ex: 45 minutos, 1 hora">
        <Input value={form.timeAvailable ?? ""} onChange={(e) => set("timeAvailable", e.target.value)} />
      </Field>
      <Field label="Objetivo principal" hint="Selecione até 2">
        <div className="flex flex-wrap gap-2">
          {GOALS.map((g) => (
            <Chip key={g} active={form.goals?.includes(g) ?? false} onClick={() => toggleGoal(g)}>{g}</Chip>
          ))}
        </div>
      </Field>
      <Field label="Você já possui uma rotina de exercícios?">
        <div className="flex flex-wrap gap-2">
          {(["Sim", "Sim, porém pouco", "Não"] as const).map((o) => (
            <Chip key={o} active={form.hasRoutine === o} onClick={() => set("hasRoutine", o)}>{o}</Chip>
          ))}
        </div>
      </Field>
      <Field label="Ênfase em musculatura específica" hint="Pode selecionar várias">
        <div className="flex flex-wrap gap-2">
          {MUSCLES.map((m) => (
            <Chip key={m} active={form.emphasis?.includes(m) ?? false} onClick={() => toggleMuscle(m)}>{m}</Chip>
          ))}
        </div>
      </Field>
    </div>
  );
}

function StepHealth({ form, set }: StepProps) {
  return (
    <div className="space-y-5">
      <Field label="Você fuma ou ingere bebidas alcoólicas? Se sim, quanto e com que frequência?">
        <Textarea rows={2} value={form.smokeDrink ?? ""} onChange={(e) => set("smokeDrink", e.target.value)} />
      </Field>
      <Field label="Você possui algum tipo de doença? Se sim, qual?">
        <Textarea rows={2} value={form.diseases ?? ""} onChange={(e) => set("diseases", e.target.value)} />
      </Field>
      <Field label="Patologia estrutural (óssea)?">
        <Textarea rows={2} value={form.bonePathology ?? ""} onChange={(e) => set("bonePathology", e.target.value)} />
      </Field>
      <Field label="Cirurgias prévias?">
        <Textarea rows={2} value={form.surgeries ?? ""} onChange={(e) => set("surgeries", e.target.value)} />
      </Field>
      <Field label="Medicamentos (qual, quantos, horário)">
        <Textarea rows={2} value={form.medications ?? ""} onChange={(e) => set("medications", e.target.value)} />
      </Field>
      <Field label="Parentes cardiopatas na família?">
        <Textarea rows={2} value={form.familyCardiac ?? ""} onChange={(e) => set("familyCardiac", e.target.value)} />
      </Field>
    </div>
  );
}

function StepIndicators({ form, set }: StepProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Field label="Colesterol"><Input value={form.cholesterol ?? ""} onChange={(e) => set("cholesterol", e.target.value)} placeholder="Ex: 180 mg/dL" /></Field>
      <Field label="Glicemia"><Input value={form.glycemia ?? ""} onChange={(e) => set("glycemia", e.target.value)} placeholder="Ex: 90 mg/dL" /></Field>
      <Field label="Pressão arterial"><Input value={form.bloodPressure ?? ""} onChange={(e) => set("bloodPressure", e.target.value)} placeholder="Ex: 120/80" /></Field>
      <Field label="Água por dia"><Input value={form.waterIntake ?? ""} onChange={(e) => set("waterIntake", e.target.value)} placeholder="Ex: 2 litros" /></Field>
      <Field label="Horas de sono"><Input value={form.sleepHours ?? ""} onChange={(e) => set("sleepHours", e.target.value)} placeholder="Ex: 7h" /></Field>
      <Field label="Dores de cabeça recorrentes?"><Input value={form.headaches ?? ""} onChange={(e) => set("headaches", e.target.value)} placeholder="Sim/Não, frequência" /></Field>
    </div>
  );
}

function StepPain({ form, set }: StepProps) {
  const toggleProf = (p: string) => {
    const cur = form.professionals ?? [];
    set("professionals", cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p]);
  };
  return (
    <div className="space-y-5">
      <Field label="Sente dor articular no dia a dia?">
        <Textarea rows={2} value={form.jointPainDaily ?? ""} onChange={(e) => set("jointPainDaily", e.target.value)} />
      </Field>
      <Field label="Se treina, sente dor articular? Onde?">
        <Textarea rows={2} value={form.jointPainTraining ?? ""} onChange={(e) => set("jointPainTraining", e.target.value)} />
      </Field>
      <Field label="Costuma passar mal no treino?">
        <div className="flex flex-wrap gap-2">
          {(["Sim", "Não", "Não treino"] as const).map((o) => (
            <Chip key={o} active={form.feelBadTraining === o} onClick={() => set("feelBadTraining", o)}>{o}</Chip>
          ))}
        </div>
      </Field>
      <Field label="Profissionais que acompanham você" hint="Selecione todos que se aplicam">
        <div className="flex flex-wrap gap-2">
          {PROFESSIONALS.map((p) => (
            <Chip key={p} active={form.professionals?.includes(p) ?? false} onClick={() => toggleProf(p)}>{p}</Chip>
          ))}
        </div>
      </Field>
    </div>
  );
}

function StepRoutine({ form, set }: StepProps) {
  return (
    <Field label="Como está sua rotina atualmente?" hint="Descreva brevemente seu dia a dia: trabalho, estresse, alimentação, deslocamento, etc.">
      <Textarea rows={8} value={form.routine ?? ""} onChange={(e) => set("routine", e.target.value)} placeholder="Ex: Trabalho 8h sentado, acordo 6h, almoço rápido..." />
    </Field>
  );
}

function PremiumBanner() {
  return (
    <div className="mb-6 overflow-hidden rounded-2xl border border-primary/40 bg-gradient-to-br from-primary/15 to-primary/5 p-6">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Crown className="h-6 w-6" />
        </div>
        <div className="flex-1">
          <h3 className="font-display text-xl font-bold">Vire Premium</h3>
          <p className="mt-1 text-sm text-muted-foreground">Você atingiu o limite gratuito. Treinos ilimitados em breve.</p>
          <Button size="sm" className="mt-4 font-semibold" disabled>Upgrade em breve</Button>
        </div>
      </div>
    </div>
  );
}
