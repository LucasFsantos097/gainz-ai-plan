import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Sparkles, Target, Zap } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "FitPlan AI — Treinos personalizados com IA" },
      { name: "description", content: "Gere planos de treino personalizados em segundos. Hipertrofia, emagrecimento, condicionamento — adaptados ao seu nível, sexo, idade e equipamento." },
    ],
  }),
});

function Index() {
  return (
    <div className="min-h-screen bg-background">
      <AppHeader />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 grid-bg opacity-60" />
        <div className="absolute left-1/2 top-0 -z-0 h-[600px] w-[600px] -translate-x-1/2 rounded-full bg-primary/20 blur-[120px]" />

        <div className="container relative mx-auto flex max-w-5xl flex-col items-center px-4 pb-24 pt-20 text-center md:pt-32">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/5 px-4 py-1.5 text-xs font-medium uppercase tracking-wider text-primary">
            <Sparkles className="h-3.5 w-3.5" />
            Powered by AI
          </div>

          <h1 className="font-display text-5xl font-bold leading-[0.95] tracking-tight md:text-7xl lg:text-8xl">
            Seu treino.<br />
            <span className="text-primary text-glow">Sem desculpas.</span>
          </h1>

          <p className="mt-8 max-w-2xl text-lg text-muted-foreground md:text-xl">
            Planos de treino personalizados em segundos. Hipertrofia, emagrecimento,
            condicionamento — adaptados ao seu nível, equipamento e rotina.
          </p>

          <div className="mt-10 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg" className="h-14 px-8 text-base font-semibold neon-glow">
              <Link to="/generate">
                Gerar Meu Treino
                <ArrowRight className="ml-1 h-5 w-5" />
              </Link>
            </Button>
          </div>

          <p className="mt-6 text-xs text-muted-foreground">
            3 treinos grátis · Sem cartão de crédito
          </p>
        </div>
      </section>

      {/* Features */}
      <section className="border-t border-border bg-card/30">
        <div className="container mx-auto grid max-w-5xl gap-px overflow-hidden rounded-xl border border-border bg-border md:grid-cols-3 my-16 mx-4">
          {[
            { icon: Target, title: "100% Personalizado", desc: "Cada plano considera seu objetivo, nível, idade e equipamento disponível." },
            { icon: Zap, title: "Pronto em Segundos", desc: "Nossa IA gera planos completos com séries, repetições e dicas técnicas." },
            { icon: Sparkles, title: "Histórico Salvo", desc: "Acesse, copie e reutilize todos os treinos gerados na sua conta." },
          ].map((f) => (
            <div key={f.title} className="bg-card p-8">
              <f.icon className="h-7 w-7 text-primary" strokeWidth={2.25} />
              <h3 className="mt-4 font-display text-xl font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-border py-10 text-center text-xs text-muted-foreground">
        FitPlan AI · Treine inteligente
      </footer>
    </div>
  );
}
