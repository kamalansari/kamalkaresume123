import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { FileText, Mail, Mic, Briefcase, FlaskConical, Map, Target, Save } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import { defaultBrief, targetBriefStore, type TargetBrief } from "@/lib/targetBriefStore";
import { readinessStore } from "@/lib/readinessStore";
import { resumeStore } from "@/components/builder/resumeStore";
import { computeScore } from "@/components/builder/atsScore";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Career Dashboard — ResumeForge" },
      { name: "description", content: "Set your target role, salary and timeline, and track readiness across resume, coding, design, and communication." },
    ],
  }),
  component: DashboardPage,
});

const LEVELS: TargetBrief["level"][] = ["fresher", "junior", "mid", "senior", "lead"];

const cards = [
  { to: "/builder", title: "Resume Builder", desc: "Edit your resume with live preview.", icon: FileText },
  { to: "/resume-lab", title: "Resume Lab", desc: "JD-aligned AI rewrite.", icon: FlaskConical },
  { to: "/cover-letter", title: "Cover Letter", desc: "Draft tailored cover letters.", icon: Mail },
  { to: "/interview", title: "Mock Interview", desc: "DSA, system design, behavioral.", icon: Mic },
  { to: "/roadmap", title: "Prep Roadmap", desc: "Week-by-week plan to land the role.", icon: Map },
  { to: "/jobs", title: "Jobs & Tracker", desc: "Track jobs and applications.", icon: Briefcase },
] as const;

function DashboardPage() {
  const [brief, setBrief] = useState<TargetBrief>(defaultBrief);
  const [resumeScore, setResumeScore] = useState(0);
  const [readiness, setReadiness] = useState({ resume: 0, coding: 0, design: 0, communication: 0 });

  useEffect(() => {
    setBrief(targetBriefStore.get());
    const primary = resumeStore.getPrimary() ?? resumeStore.list()[0];
    const draft = resumeStore.getDraft();
    const data = primary?.data ?? draft;
    const score = data ? computeScore(data).score : 0;
    setResumeScore(score);
    setReadiness(readinessStore.aggregate(score));
  }, []);

  const overall = useMemo(() => {
    const arr = [readiness.resume, readiness.coding, readiness.design, readiness.communication];
    const nonZero = arr.filter(n => n > 0);
    return nonZero.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0;
  }, [readiness]);

  const save = () => {
    targetBriefStore.save(brief);
    toast.success("Target brief saved");
  };

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-8">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Career Dashboard</h1>
        <p className="mt-1 text-muted-foreground">Define the role you're chasing, then track how ready you are to land it.</p>
      </header>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" />
            <h2 className="font-semibold">Target Brief</h2>
          </div>
          <p className="text-sm text-muted-foreground mt-1">All AI features use this to align suggestions, scoring and roadmap.</p>
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Target role</Label>
              <Input value={brief.role} onChange={e => setBrief({ ...brief, role: e.target.value })} placeholder="e.g. Senior Backend Engineer" />
            </div>
            <div>
              <Label>Level</Label>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {LEVELS.map(l => (
                  <button key={l} onClick={() => setBrief({ ...brief, level: l })}
                    className={`px-2.5 py-1 text-xs rounded border capitalize ${brief.level === l ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border hover:bg-accent"}`}>
                    {l}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label>Preferred location</Label>
              <Input value={brief.location} onChange={e => setBrief({ ...brief, location: e.target.value })} placeholder="e.g. Bengaluru / Remote" />
            </div>
            <div>
              <Label>Timeline: {brief.timelineWeeks} weeks</Label>
              <Slider value={[brief.timelineWeeks]} min={2} max={16} step={1}
                onValueChange={v => setBrief({ ...brief, timelineWeeks: v[0] })} className="mt-3" />
            </div>
            <div className="sm:col-span-2">
              <Label>Salary range (LPA): {brief.salaryMin} – {brief.salaryMax}</Label>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <Slider value={[brief.salaryMin]} min={0} max={80} step={1}
                  onValueChange={v => setBrief({ ...brief, salaryMin: Math.min(v[0], brief.salaryMax) })} />
                <Slider value={[brief.salaryMax]} min={0} max={100} step={1}
                  onValueChange={v => setBrief({ ...brief, salaryMax: Math.max(v[0], brief.salaryMin) })} />
              </div>
            </div>
            <div className="sm:col-span-2">
              <Label>Focus & notes</Label>
              <Textarea rows={3} value={brief.focus} onChange={e => setBrief({ ...brief, focus: e.target.value })}
                placeholder="Target companies, stack, must-haves, deal-breakers" />
            </div>
          </div>
          <Button onClick={save} className="mt-4"><Save className="h-4 w-4" /> Save brief</Button>
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="font-semibold">Readiness</h2>
          <p className="text-sm text-muted-foreground mt-1">Updated from your resume score and mock interview attempts.</p>
          <div className="mt-4 flex items-end gap-3">
            <div className="text-4xl font-bold tabular-nums">{overall}</div>
            <div className="text-sm text-muted-foreground pb-1">/ 100 overall</div>
          </div>
          <div className="mt-4 space-y-3">
            {([
              ["Resume proof", readiness.resume],
              ["Coding execution", readiness.coding],
              ["Architecture depth", readiness.design],
              ["Communication", readiness.communication],
            ] as const).map(([label, val]) => (
              <div key={label}>
                <div className="flex justify-between text-xs"><span>{label}</span><span className="tabular-nums">{val}%</span></div>
                <div className="mt-1 h-1.5 rounded bg-muted overflow-hidden">
                  <div className="h-full bg-primary transition-all" style={{ width: `${val}%` }} />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 flex gap-2 flex-wrap">
            <Link to="/interview" className="text-xs px-2.5 py-1 rounded border border-border hover:bg-accent">Improve →</Link>
            <Link to="/roadmap" className="text-xs px-2.5 py-1 rounded border border-border hover:bg-accent">Build plan →</Link>
          </div>
        </div>
      </section>

      <section>
        <h2 className="font-semibold">Career workspace</h2>
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {cards.map((c) => (
            <Link key={c.to} to={c.to} className="group rounded-xl border border-border bg-card p-4 hover:shadow-[var(--shadow-soft)] transition-shadow">
              <c.icon className="h-5 w-5 text-primary" />
              <div className="mt-3 font-medium">{c.title}</div>
              <div className="text-sm text-muted-foreground">{c.desc}</div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}