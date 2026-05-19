import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Copy, Loader2, Sparkles } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { getWorkout, type WorkoutPlan } from "@/lib/workouts.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/workout/$id")({
  component: WorkoutPage,
  head: () => ({ meta: [{ title: "Seu treino · FitPlan AI" }] }),
});

function WorkoutPage() {
  const { id } = Route.useParams();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const getFn = useServerFn(getWorkout);
  const [plan, setPlan] = useState<WorkoutPlan | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/login" });
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (!user) return;
    getFn({ data: { id } })
      .then((res) => {
        if (res.ok) setPlan(res.workout.plan as unknown as WorkoutPlan);
      })
      .finally(() => setLoading(false));
  }, [user, id, getFn]);

  const copyPlan = async () => {
    if (!plan) return;
    const text = formatPlanAsText(plan);
    await navigator.clipboard.writeText(text);
    toast.success("Treino copiado!");
  };

  if (loading || authLoading) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader />
        <div className="flex justify-center pt-32">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
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

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <div className="container mx-auto max-w-4xl px-4 py-12">
        <Link to="/generate" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors">
          <ArrowLeft className="h-4 w-4" /> Novo treino
        </Link>

        <div className="mt-6 flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/5 px-3 py-1 text-xs font-medium uppercase tracking-wider text-primary">
              <Sparkles className="h-3 w-3" /> Gerado por IA
            </div>
            <h1 className="mt-3 font-display text-4xl font-bold tracking-tight md:text-5xl">{plan.title}</h1>
            <p className="mt-3 max-w-2xl text-muted-foreground">{plan.summary}</p>
          </div>
          <Button onClick={copyPlan} variant="secondary" className="shrink-0">
            <Copy className="h-4 w-4" /> Copiar
          </Button>
        </div>

        <div className="mt-10 grid gap-6 md:grid-cols-2">
          {plan.days.map((day, i) => (
            <div key={i} className="overflow-hidden rounded-2xl border border-border bg-card">
              <div className="border-b border-border bg-secondary/40 px-6 py-4">
                <div className="flex items-baseline justify-between">
                  <h2 className="font-display text-xl font-bold">{day.day}</h2>
                  <span className="text-xs uppercase tracking-wider text-primary">{day.focus}</span>
                </div>
              </div>
              <ul className="divide-y divide-border">
                {day.exercises.map((ex, j) => (
                  <li key={j} className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="font-semibold">{ex.name}</h3>
                      <div className="flex shrink-0 gap-2 text-xs">
                        <Badge>{ex.sets}× séries</Badge>
                        <Badge>{ex.reps}</Badge>
                      </div>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">{ex.tip}</p>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-md border border-primary/30 bg-primary/10 px-2 py-0.5 font-medium text-primary">
      {children}
    </span>
  );
}

function formatPlanAsText(plan: WorkoutPlan): string {
  const lines = [plan.title, "", plan.summary, ""];
  plan.days.forEach((d) => {
    lines.push(`${d.day} — ${d.focus}`);
    d.exercises.forEach((ex) => {
      lines.push(`  • ${ex.name} — ${ex.sets} séries × ${ex.reps}`);
      lines.push(`    Dica: ${ex.tip}`);
    });
    lines.push("");
  });
  return lines.join("\n");
}
