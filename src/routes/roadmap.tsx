import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Map as MapIcon, Loader2, Sparkles, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { defaultBrief, targetBriefStore } from "@/lib/targetBriefStore";
import { readinessStore } from "@/lib/readinessStore";
import { resumeStore } from "@/components/builder/resumeStore";
import { computeScore } from "@/components/builder/atsScore";
import { authFetch } from "@/lib/authFetch";

export const Route = createFileRoute("/roadmap")({
  head: () => ({
    meta: [
      { title: "Prep Roadmap — ResumeForge" },
      { name: "description", content: "AI-generated week-by-week career prep plan based on your target role, timeline, and current readiness gaps." },
    ],
  }),
  component: RoadmapPage,
});

type Week = { week: number; theme: string; goals: string[]; actions: string[]; deliverable: string };
type RoadmapResp = { weeks?: Week[]; dailyHabits?: string[] };

function RoadmapPage() {
  const [brief, setBrief] = useState(defaultBrief);
  const [readiness, setReadiness] = useState({ resume: 0, coding: 0, design: 0, communication: 0 });
  const [busy, setBusy] = useState(false);
  const [plan, setPlan] = useState<RoadmapResp | null>(null);

  useEffect(() => {
    setBrief(targetBriefStore.get());
    const primary = resumeStore.getPrimary() ?? resumeStore.list()[0];
    const draft = resumeStore.getDraft();
    const data = primary?.data ?? draft;
    const score = data ? computeScore(data).score : 0;
    setReadiness(readinessStore.aggregate(score));
  }, []);

  const generate = async () => {
    if (!brief.role) return toast.error("Set a target role on the dashboard first");
    setBusy(true);
    try {
      const r = await authFetch("/api/roadmap", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          role: brief.role,
          level: brief.level,
          timelineWeeks: brief.timelineWeeks,
          focus: brief.focus,
          readiness,
        }),
      });
      if (!r.ok) throw new Error(await r.text());
      const data = (await r.json()) as RoadmapResp;
      setPlan(data);
    } catch (e) {
      toast.error(e instanceof Error ? e.message.slice(0, 120) : "Failed to generate plan");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-6">
      <header className="flex items-center gap-3">
        <MapIcon className="h-5 w-5 text-primary" />
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Prep Roadmap</h1>
          <p className="text-sm text-muted-foreground">Week-by-week plan that prioritizes your weakest readiness tracks.</p>
        </div>
      </header>

      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm">
            <div className="flex items-center gap-1.5 font-medium"><Target className="h-3.5 w-3.5 text-primary" /> {brief.role || "No target role set"}</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {brief.role ? `${brief.level} · ${brief.timelineWeeks} weeks · ${brief.salaryMin}–${brief.salaryMax} LPA` : <Link to="/dashboard" className="underline">Set your target →</Link>}
            </div>
          </div>
          <Button onClick={generate} disabled={busy || !brief.role}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {plan ? "Regenerate plan" : "Generate plan"}
          </Button>
        </div>
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          {([
            ["Resume", readiness.resume],
            ["Coding", readiness.coding],
            ["Design", readiness.design],
            ["Comms", readiness.communication],
          ] as const).map(([l, v]) => (
            <div key={l} className="rounded border border-border p-2">
              <div className="flex justify-between"><span>{l}</span><span className="tabular-nums font-medium">{v}</span></div>
              <div className="mt-1 h-1 rounded bg-muted overflow-hidden"><div className="h-full bg-primary" style={{ width: `${v}%` }} /></div>
            </div>
          ))}
        </div>
      </div>

      {plan?.dailyHabits && plan.dailyHabits.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="font-semibold">Daily habits</h2>
          <ul className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
            {plan.dailyHabits.map((h, i) => (
              <li key={i} className="rounded border border-border px-3 py-1.5 bg-muted/30">{h}</li>
            ))}
          </ul>
        </div>
      )}

      {plan?.weeks && plan.weeks.length > 0 && (
        <div className="space-y-3">
          {plan.weeks.map(w => (
            <div key={w.week} className="rounded-xl border border-border bg-card p-5">
              <div className="flex flex-wrap items-baseline gap-3">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">Week {w.week}</div>
                <h3 className="font-semibold">{w.theme}</h3>
              </div>
              <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Goals</div>
                  <ul className="mt-1 list-disc list-inside text-muted-foreground space-y-0.5">
                    {w.goals.map((g, i) => <li key={i}>{g}</li>)}
                  </ul>
                </div>
                <div>
                  <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Actions</div>
                  <ul className="mt-1 list-disc list-inside space-y-0.5">
                    {w.actions.map((a, i) => <li key={i}>{a}</li>)}
                  </ul>
                </div>
                <div>
                  <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Deliverable</div>
                  <div className="mt-1 rounded border border-primary/30 bg-primary/5 px-3 py-2 text-foreground">{w.deliverable}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {!plan && !busy && (
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Generate your first plan to see weekly themes, actions, and deliverables.
        </div>
      )}
    </div>
  );
}