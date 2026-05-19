import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Sparkles, Crown } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/use-auth";
import { generateWorkout, getProfile, type WorkoutInputType } from "@/lib/workouts.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/generate")({
  component: GeneratePage,
  head: () => ({ meta: [{ title: "Gerar treino · FitPlan AI" }] }),
});

function GeneratePage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const generateFn = useServerFn(generateWorkout);
  const getProfileFn = useServerFn(getProfile);

  const [profile, setProfile] = useState<{ used: number; limit: number; isPremium: boolean } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<WorkoutInputType>({
    goal: "Hipertrofia",
    level: "Intermediario",
    daysPerWeek: 4,
    equipment: "Academia completa",
    age: 28,
    sex: "Masculino",
  });

  useEffect(() => {
    if (!authLoading && !user) {
      navigate({ to: "/login" });
    }
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (user) {
      getProfileFn().then((p) =>
        setProfile({ used: p.used, limit: p.limit, isPremium: p.isPremium }),
      ).catch(() => {});
    }
  }, [user, getProfileFn]);

  const limitReached = profile && !profile.isPremium && profile.used >= profile.limit;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (limitReached) {
      toast.error("Limite de treinos grátis atingido. Faça upgrade!");
      return;
    }
    setSubmitting(true);
    try {
      const res = await generateFn({ data: form });
      if (!res.ok) {
        if (res.error === "limit_reached") {
          toast.error("Limite de treinos grátis atingido.");
          setProfile({ used: res.used, limit: res.limit, isPremium: false });
        } else if (res.error === "rate_limit") {
          toast.error("Muitas requisições. Tente novamente em instantes.");
        } else if (res.error === "credits") {
          toast.error("Créditos de IA esgotados.");
        } else {
          toast.error("Falha ao gerar treino. Tente novamente.");
        }
        return;
      }
      navigate({ to: "/workout/$id", params: { id: res.workoutId } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading || !user) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader />
        <div className="flex justify-center pt-32">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <div className="container mx-auto max-w-2xl px-4 py-12">
        <div className="mb-8">
          <h1 className="font-display text-4xl font-bold tracking-tight">Monte seu plano</h1>
          <p className="mt-2 text-muted-foreground">Responda as perguntas e a IA gera um treino completo.</p>
        </div>

        {profile && !profile.isPremium && (
          <div className="mb-6 rounded-lg border border-border bg-card px-4 py-3 text-sm">
            <span className="text-muted-foreground">Treinos usados: </span>
            <span className="font-semibold text-primary">{profile.used}/{profile.limit}</span>
          </div>
        )}

        {limitReached && (
          <PremiumBanner />
        )}

        <form onSubmit={onSubmit} className="space-y-6 rounded-2xl border border-border bg-card p-6 md:p-8">
          <Field label="Objetivo">
            <Select value={form.goal} onValueChange={(v) => setForm({ ...form, goal: v as WorkoutInputType["goal"] })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Hipertrofia">Hipertrofia</SelectItem>
                <SelectItem value="Emagrecimento">Emagrecimento</SelectItem>
                <SelectItem value="Condicionamento">Condicionamento</SelectItem>
                <SelectItem value="Forca">Força</SelectItem>
              </SelectContent>
            </Select>
          </Field>

          <Field label="Nível">
            <Select value={form.level} onValueChange={(v) => setForm({ ...form, level: v as WorkoutInputType["level"] })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Iniciante">Iniciante</SelectItem>
                <SelectItem value="Intermediario">Intermediário</SelectItem>
                <SelectItem value="Avancado">Avançado</SelectItem>
              </SelectContent>
            </Select>
          </Field>

          <Field label="Dias disponíveis por semana">
            <div className="grid grid-cols-4 gap-2">
              {[2, 3, 4, 5].map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setForm({ ...form, daysPerWeek: d })}
                  className={`h-12 rounded-md border font-display text-lg font-semibold transition-all ${
                    form.daysPerWeek === d
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-secondary text-foreground hover:border-primary/40"
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Equipamentos">
            <Select value={form.equipment} onValueChange={(v) => setForm({ ...form, equipment: v as WorkoutInputType["equipment"] })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Academia completa">Academia completa</SelectItem>
                <SelectItem value="Halteres em casa">Halteres em casa</SelectItem>
                <SelectItem value="Sem equipamento">Sem equipamento</SelectItem>
              </SelectContent>
            </Select>
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Idade">
              <Input
                type="number" min={12} max={99} value={form.age}
                onChange={(e) => setForm({ ...form, age: parseInt(e.target.value) || 0 })}
              />
            </Field>
            <Field label="Sexo">
              <Select value={form.sex} onValueChange={(v) => setForm({ ...form, sex: v as WorkoutInputType["sex"] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Masculino">Masculino</SelectItem>
                  <SelectItem value="Feminino">Feminino</SelectItem>
                  <SelectItem value="Outro">Outro</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>

          <Button
            type="submit"
            disabled={submitting || !!limitReached}
            className="w-full h-14 text-base font-semibold neon-glow"
            size="lg"
          >
            {submitting ? (
              <><Loader2 className="h-5 w-5 animate-spin" /> Gerando seu treino...</>
            ) : (
              <><Sparkles className="h-5 w-5" /> Gerar Treino</>
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">{label}</Label>
      {children}
    </div>
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
          <p className="mt-1 text-sm text-muted-foreground">
            Você atingiu o limite de 3 treinos grátis. Treinos ilimitados, histórico completo e novos modelos.
          </p>
          <Button size="sm" className="mt-4 font-semibold" disabled>
            Upgrade em breve
          </Button>
        </div>
      </div>
    </div>
  );
}
