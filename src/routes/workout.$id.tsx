import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, CheckCircle2, Circle, Clock, Copy, Loader2, Sparkles, Trophy } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/hooks/use-auth";
import { getWorkout, toggleSession, type WorkoutPlan } from "@/lib/workouts.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/workout/$id")({
  component: WorkoutPage,
  head: () => ({ meta: [{ title: "Seu treino · FITPLAN" }] }),
});

type CompletionKey = `${number}-${number}`;

function WorkoutPage() {
  const { id } = Route.useParams();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const getFn = useServerFn(getWorkout);
  const toggleFn = useServerFn(toggleSession);

  const [plan, setPlan] = useState<WorkoutPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [completed, setCompleted] = useState<Set<CompletionKey>>(new Set());
  const [activeWeek, setActiveWeek] = useState(1);

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/login" });
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (!user) return;
    getFn({ data: { id } })
      .then((res) => {
        if (res.ok) {
          setPlan(res.workout.plan as unknown as WorkoutPlan);
          const set = new Set<CompletionKey>();
          for (const c of res.completions) set.add(`${c.week_number}-${c.day_number}`);
          setCompleted(set);
        }
      })
      .finally(() => setLoading(false));
  }, [user, id, getFn]);

  const totalSessions = useMemo(
    () => (plan?.weeks ?? []).reduce((acc, w) => acc + w.days.length, 0),
    [plan],
  );
  const doneSessions = completed.size;
  const overallPct = totalSessions ? Math.round((doneSessions / totalSessions) * 100) : 0;

  const toggle = async (week: number, day: number) => {
    const key: CompletionKey = `${week}-${day}`;
    const isDone = completed.has(key);
    const next = new Set(completed);
    if (isDone) next.delete(key); else next.add(key);
    setCompleted(next);
    const res = await toggleFn({ data: { workoutId: id, weekNumber: week, dayNumber: day, completed: !isDone } });
    if (!res.ok) {
      toast.error("Não foi possível salvar");
      setCompleted(completed);
    } else if (!isDone) {
      toast.success("Sessão concluída! 💪");
    }
  };

  const copyPlan = async () => {
    if (!plan) return;
    await navigator.clipboard.writeText(formatPlanAsText(plan));
    toast.success("Treino copiado!");
  };

  if (loading || authLoading) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader />
        <div className="flex justify-center pt-32"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader />
        <div className="container mx-auto max-w-2xl px-4 py-16 text-center">
          <p className="text-muted-foreground">Treino não encontrado.</p>
          <Button asChild className="mt-6"><Link to="/generate">Gerar novo</Link></Button>
        </div>
      </div>
    );
  }

  const currentWeek = plan.weeks?.find((w) => w.weekNumber === activeWeek) ?? plan.weeks?.[0];

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <div className="container mx-auto max-w-5xl px-4 py-10 md:py-14">
        <Link to="/generate" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors">
          <ArrowLeft className="h-4 w-4" /> Nova anamnese
        </Link>

        <div className="mt-6 flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/5 px-3 py-1 text-xs font-medium uppercase tracking-wider text-primary">
              <Sparkles className="h-3 w-3" /> Periodização gerada por IA
            </div>
            <h1 className="mt-3 font-display text-4xl font-bold tracking-tight md:text-5xl">{plan.title}</h1>
            <p className="mt-3 max-w-2xl text-muted-foreground">{plan.summary}</p>
            <div className="mt-4 flex flex-wrap gap-2 text-xs">
              <Stat>{plan.totalWeeks ?? plan.weeks?.length ?? 8} semanas</Stat>
              <Stat>~{plan.sessionMinutes ?? 60} min/sessão</Stat>
              <Stat>{totalSessions} sessões totais</Stat>
            </div>
          </div>
          <Button onClick={copyPlan} variant="secondary" className="shrink-0">
            <Copy className="h-4 w-4" /> Copiar
          </Button>
        </div>

        {/* Frequency / progress */}
        <div className="mt-8 rounded-2xl border border-border bg-card p-6">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Trophy className="h-4 w-4 text-primary" />
              <span className="font-display text-lg font-bold">Sua frequência</span>
            </div>
            <span className="text-sm font-semibold text-primary">{doneSessions}/{totalSessions} · {overallPct}%</span>
          </div>
          <Progress value={overallPct} />
        </div>

        {/* Phases */}
        {plan.phases?.length > 0 && (
          <div className="mt-8">
            <h2 className="mb-4 font-display text-2xl font-bold">Fases da periodização</h2>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
              {plan.phases.map((p, i) => (
                <div key={i} className="rounded-xl border border-border bg-card p-4">
                  <div className="flex items-baseline justify-between">
                    <span className="font-display font-bold">{p.name}</span>
                    <span className="text-xs text-primary">Sem {p.weekRange}</span>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">{p.description}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Detailed AI analysis */}
        {plan.analysis && (
          <div className="mt-8 rounded-2xl border border-primary/30 bg-primary/5 p-6">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <h2 className="font-display text-2xl font-bold">Parecer da IA</h2>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-foreground/90">{plan.analysis.overview}</p>

            {plan.analysis.anamnesisHighlights?.length > 0 && (
              <div className="mt-5">
                <h3 className="font-display text-sm font-bold uppercase tracking-wider text-primary">O que pesou na sua anamnese</h3>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-foreground/90">
                  {plan.analysis.anamnesisHighlights.map((h, i) => <li key={i}>{h}</li>)}
                </ul>
              </div>
            )}

            {plan.analysis.adaptations?.length > 0 && (
              <div className="mt-5">
                <h3 className="font-display text-sm font-bold uppercase tracking-wider text-primary">Adaptações feitas para você</h3>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-foreground/90">
                  {plan.analysis.adaptations.map((h, i) => <li key={i}>{h}</li>)}
                </ul>
              </div>
            )}

            {plan.analysis.weekly?.length > 0 && (
              <div className="mt-5">
                <h3 className="font-display text-sm font-bold uppercase tracking-wider text-primary">O que será trabalhado semana a semana</h3>
                <div className="mt-3 grid gap-2 md:grid-cols-2">
                  {plan.analysis.weekly.map((w) => (
                    <div key={w.weekNumber} className="rounded-lg border border-border bg-card p-3">
                      <div className="flex items-baseline justify-between">
                        <span className="font-display text-sm font-bold">Semana {w.weekNumber}</span>
                        <span className="text-xs text-primary">{w.focus}</span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{w.rationale}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {plan.analysis.expectedOutcomes && (
              <div className="mt-5 rounded-lg border border-border bg-background/40 p-4">
                <h3 className="font-display text-sm font-bold uppercase tracking-wider text-primary">Resultados esperados</h3>
                <p className="mt-2 text-sm text-foreground/90">{plan.analysis.expectedOutcomes}</p>
              </div>
            )}
          </div>
        )}

        {/* Week selector */}
        <div className="mt-10">
          <h2 className="mb-4 font-display text-2xl font-bold">Semanas</h2>
          <div className="mb-6 flex flex-wrap gap-2">
            {plan.weeks?.map((w) => {
              const weekDone = w.days.every((_, di) => completed.has(`${w.weekNumber}-${di + 1}`));
              const isActive = w.weekNumber === activeWeek;
              return (
                <button key={w.weekNumber} type="button" onClick={() => setActiveWeek(w.weekNumber)}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition-all ${
                    isActive ? "border-primary bg-primary text-primary-foreground"
                    : weekDone ? "border-primary/40 bg-primary/10 text-primary"
                    : "border-border bg-secondary hover:border-primary/40"
                  }`}>
                  S{w.weekNumber}
                  {weekDone && <CheckCircle2 className="h-3.5 w-3.5" />}
                </button>
              );
            })}
          </div>

          {currentWeek && (
            <div>
              <div className="mb-4 flex items-baseline justify-between">
                <h3 className="font-display text-xl font-bold">Semana {currentWeek.weekNumber}</h3>
                <span className="text-xs uppercase tracking-wider text-primary">{currentWeek.phase}</span>
              </div>
              <div className="grid gap-6 md:grid-cols-2">
                {currentWeek.days.map((day, di) => {
                  const dayNum = di + 1;
                  const key: CompletionKey = `${currentWeek.weekNumber}-${dayNum}`;
                  const isDone = completed.has(key);
                  return (
                    <div key={di} className={`overflow-hidden rounded-2xl border bg-card transition-colors ${isDone ? "border-primary/50" : "border-border"}`}>
                      <div className="border-b border-border bg-secondary/40 px-5 py-4">
                        <div className="flex items-baseline justify-between gap-3">
                          <div>
                            <h4 className="font-display text-lg font-bold">{day.day}</h4>
                            <p className="text-xs uppercase tracking-wider text-primary">{day.focus}</p>
                          </div>
                          <span className="inline-flex items-center gap-1 rounded-md bg-background/60 px-2 py-1 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" /> {day.estimatedMinutes ?? 60} min
                          </span>
                        </div>
                      </div>
                      <ul className="divide-y divide-border">
                        {day.exercises.map((ex, j) => (
                          <li key={j} className="p-4">
                            <div className="flex items-start justify-between gap-3">
                              <h5 className="font-semibold">{ex.name}</h5>
                              <div className="flex shrink-0 flex-wrap justify-end gap-1 text-[11px]">
                                <Badge>{ex.sets}× séries</Badge>
                                <Badge>{ex.reps}</Badge>
                                {ex.rest && <Badge>{ex.rest}</Badge>}
                              </div>
                            </div>
                            <p className="mt-1.5 text-sm text-muted-foreground">{ex.tip}</p>
                          </li>
                        ))}
                      </ul>
                      <div className="border-t border-border p-4">
                        <Button onClick={() => toggle(currentWeek.weekNumber, dayNum)}
                          variant={isDone ? "secondary" : "default"}
                          className="w-full font-semibold">
                          {isDone ? <><CheckCircle2 className="h-4 w-4" /> Concluído</> : <><Circle className="h-4 w-4" /> Marcar como concluído</>}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-md border border-border bg-secondary/60 px-2.5 py-1 font-medium text-foreground">{children}</span>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-md border border-primary/30 bg-primary/10 px-2 py-0.5 font-medium text-primary">{children}</span>
  );
}

function formatPlanAsText(plan: WorkoutPlan): string {
  const lines = [plan.title, "", plan.summary, "",
    `${plan.totalWeeks ?? plan.weeks?.length} semanas · ~${plan.sessionMinutes ?? 60} min/sessão`, ""];
  plan.phases?.forEach((p) => lines.push(`Fase ${p.name} (semanas ${p.weekRange}): ${p.description}`));
  lines.push("");
  plan.weeks?.forEach((w) => {
    lines.push(`=== Semana ${w.weekNumber} — ${w.phase} ===`);
    w.days.forEach((d) => {
      lines.push(`${d.day} — ${d.focus} (~${d.estimatedMinutes ?? 60} min)`);
      d.exercises.forEach((ex) => {
        lines.push(`  • ${ex.name} — ${ex.sets}× ${ex.reps}${ex.rest ? ` · descanso ${ex.rest}` : ""}`);
        lines.push(`    Dica: ${ex.tip}`);
      });
    });
    lines.push("");
  });
  return lines.join("\n");
}
