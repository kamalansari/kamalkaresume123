import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { ArrowRight, Check } from "lucide-react";

type Tpl = {
  id: string;
  name: string;
  tag: string;
  accent: string;
  layout: "classic" | "modern" | "compact" | "executive";
};

const TEMPLATES: Tpl[] = [
  { id: "atlas", name: "Atlas", tag: "Most popular", accent: "oklch(0.45 0.14 256)", layout: "classic" },
  { id: "vertex", name: "Vertex", tag: "Tech & Engineering", accent: "oklch(0.55 0.15 180)", layout: "modern" },
  { id: "prism", name: "Prism", tag: "Compact one-page", accent: "oklch(0.6 0.18 30)", layout: "compact" },
  { id: "regent", name: "Regent", tag: "Executive", accent: "oklch(0.35 0.06 280)", layout: "executive" },
];

export function TemplatePreviews() {
  return (
    <section id="templates" className="mx-auto max-w-7xl px-6 py-24">
      <div className="flex items-end justify-between gap-6 flex-wrap mb-10">
        <div className="max-w-2xl">
          <p className="text-xs uppercase tracking-widest text-[var(--navy-light)] font-semibold">Templates</p>
          <h2 className="mt-3 font-display text-4xl md:text-5xl font-bold tracking-tight">Recruiter-ready, ATS-safe.</h2>
          <p className="mt-4 text-muted-foreground text-lg">Every template is single-column, parser-friendly, and tuned for clarity.</p>
        </div>
        <Link to="/builder">
          <Button variant="outline">Browse all <ArrowRight /></Button>
        </Link>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {TEMPLATES.map((t, i) => (
          <TemplateCard key={t.id} tpl={t} delay={i * 80} />
        ))}
      </div>
    </section>
  );
}

function TemplateCard({ tpl, delay }: { tpl: Tpl; delay: number }) {
  return (
    <div
      className="group relative rounded-2xl border border-border bg-card/70 backdrop-blur-xl p-3 transition-all hover:-translate-y-1 hover:shadow-[var(--shadow-elegant)] hover:border-[var(--navy-light)]"
      style={{ animation: `fade-in 0.6s ease-out ${delay}ms both` }}
    >
      <div className="relative overflow-hidden rounded-xl border border-border bg-[var(--paper)] aspect-[8.5/11]">
        <div aria-hidden className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: `radial-gradient(60% 50% at 50% 0%, color-mix(in oklab, ${tpl.accent} 30%, transparent), transparent 70%)` }} />
        <MiniResume layout={tpl.layout} accent={tpl.accent} />
        <div className="absolute top-2 left-2 text-[10px] font-medium px-2 py-0.5 rounded-full bg-background/80 backdrop-blur border border-border text-foreground">
          {tpl.tag}
        </div>
      </div>
      <div className="flex items-center justify-between px-1 pt-3 pb-1">
        <div>
          <div className="font-display font-semibold">{tpl.name}</div>
          <div className="text-xs text-muted-foreground flex items-center gap-1"><Check className="h-3 w-3 text-[var(--navy-light)]" /> ATS-tested</div>
        </div>
        <Link to="/builder">
          <Button variant="ghost" size="sm">Use</Button>
        </Link>
      </div>
    </div>
  );
}

function MiniResume({ layout, accent }: { layout: Tpl["layout"]; accent: string }) {
  const bar = (w: string, op = 1) => (
    <div className="rounded-sm" style={{ height: 4, width: w, background: `color-mix(in oklab, ${accent} ${op * 100}%, transparent)` }} />
  );
  const line = (w: string) => <div className="rounded-sm bg-[oklch(0.85_0.01_250)]" style={{ height: 3, width: w }} />;

  if (layout === "executive") {
    return (
      <div className="absolute inset-0 p-4 flex flex-col gap-2">
        <div className="flex items-center gap-2 pb-2 border-b" style={{ borderColor: accent }}>
          <div className="h-8 w-8 rounded-full" style={{ background: accent }} />
          <div className="flex-1 space-y-1">{bar("60%")}{line("40%")}</div>
        </div>
        {[...Array(4)].map((_, i) => (
          <div key={i} className="space-y-1">
            {bar("35%", 0.8)}
            {line("90%")}{line("80%")}{line("70%")}
          </div>
        ))}
      </div>
    );
  }
  if (layout === "modern") {
    return (
      <div className="absolute inset-0 flex">
        <div className="w-1/3 p-3 space-y-2" style={{ background: `color-mix(in oklab, ${accent} 12%, transparent)` }}>
          <div className="h-10 w-10 rounded-full" style={{ background: accent }} />
          {bar("80%", 0.7)}{line("70%")}{line("60%")}
          <div className="h-2" />
          {bar("60%", 0.7)}{line("80%")}{line("70%")}{line("50%")}
        </div>
        <div className="flex-1 p-3 space-y-2">
          {bar("70%")}{line("90%")}{line("85%")}
          <div className="h-1" />
          {bar("50%", 0.8)}{line("90%")}{line("80%")}{line("70%")}
          <div className="h-1" />
          {bar("50%", 0.8)}{line("85%")}{line("75%")}
        </div>
      </div>
    );
  }
  if (layout === "compact") {
    return (
      <div className="absolute inset-0 p-4 space-y-1.5">
        <div className="text-center space-y-1 pb-2 border-b border-[oklch(0.85_0.01_250)]">
          <div className="mx-auto" style={{ height: 5, width: "50%", background: accent, borderRadius: 2 }} />
          <div className="mx-auto" style={{ height: 2, width: "70%", background: "oklch(0.7 0.02 250)", borderRadius: 2 }} />
        </div>
        {[...Array(6)].map((_, i) => (
          <div key={i} className="flex gap-2 items-start">
            <div className="mt-1 h-1 w-1 rounded-full" style={{ background: accent }} />
            <div className="flex-1 space-y-1">{line(i % 2 ? "85%" : "95%")}{line("70%")}</div>
          </div>
        ))}
      </div>
    );
  }
  // classic
  return (
    <div className="absolute inset-0 p-4 space-y-2">
      <div className="text-center space-y-1 pb-2 border-b border-[oklch(0.85_0.01_250)]">
        <div className="mx-auto" style={{ height: 6, width: "55%", background: accent, borderRadius: 2 }} />
        <div className="mx-auto" style={{ height: 3, width: "75%", background: "oklch(0.7 0.02 250)", borderRadius: 2 }} />
      </div>
      {[...Array(3)].map((_, i) => (
        <div key={i} className="space-y-1">
          {bar("40%", 0.9)}
          <div className="flex justify-between">{line("50%")}{line("20%")}</div>
          {line("90%")}{line("85%")}{line("75%")}
        </div>
      ))}
    </div>
  );
}