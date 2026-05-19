import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, Loader2, Plus } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { listWorkouts } from "@/lib/workouts.functions";

export const Route = createFileRoute("/history")({
  component: HistoryPage,
  head: () => ({ meta: [{ title: "Histórico · FitPlan AI" }] }),
});

type Item = {
  id: string;
  goal: string;
  level: string;
  days_per_week: number;
  equipment: string;
  created_at: string;
};

function HistoryPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const listFn = useServerFn(listWorkouts);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/login" });
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (!user) return;
    listFn().then((res) => {
      setItems(res.workouts as Item[]);
      setLoading(false);
    });
  }, [user, listFn]);

  if (authLoading || loading) {
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
      <div className="container mx-auto max-w-3xl px-4 py-12">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="font-display text-4xl font-bold tracking-tight">Seus treinos</h1>
            <p className="mt-2 text-muted-foreground">Todos os planos que você gerou.</p>
          </div>
          <Button asChild className="font-semibold">
            <Link to="/generate"><Plus className="h-4 w-4" /> Novo</Link>
          </Button>
        </div>

        {items.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card p-12 text-center">
            <p className="text-muted-foreground">Nenhum treino gerado ainda.</p>
            <Button asChild className="mt-6">
              <Link to="/generate">Gerar meu primeiro treino</Link>
            </Button>
          </div>
        ) : (
          <ul className="space-y-3">
            {items.map((w) => (
              <li key={w.id}>
                <Link
                  to="/workout/$id"
                  params={{ id: w.id }}
                  className="group flex items-center justify-between rounded-xl border border-border bg-card p-5 transition-all hover:border-primary/50"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-display font-semibold">{w.goal}</span>
                      <span className="text-xs text-muted-foreground">·</span>
                      <span className="text-sm text-muted-foreground">{w.level}</span>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {w.days_per_week}× por semana · {w.equipment} · {new Date(w.created_at).toLocaleDateString("pt-BR")}
                    </div>
                  </div>
                  <ArrowRight className="h-5 w-5 text-muted-foreground transition-all group-hover:text-primary group-hover:translate-x-1" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
