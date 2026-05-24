import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Gauge, FileText, ArrowRight, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { resumeStore, type SavedResume } from "@/components/builder/resumeStore";
import { defaultResume, type ResumeData } from "@/components/builder/types";
import { computeScore } from "@/components/builder/atsScore";
import { AtsPanel } from "@/components/builder/AtsPanel";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/ats")({
  head: () => ({
    meta: [
      { title: "ATS Checker — ResumeForge" },
      { name: "description", content: "Score any of your saved resumes against a target job description in real time." },
    ],
  }),
  component: AtsCheckerPage,
});

function AtsCheckerPage() {
  const [saved, setSaved] = useState<SavedResume[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [data, setData] = useState<ResumeData>(defaultResume);

  useEffect(() => {
    const list = resumeStore.list();
    setSaved(list);
    const primary = resumeStore.getPrimary();
    const draft = resumeStore.getDraft();
    const initial = primary ?? list[0];
    if (initial) {
      setSelectedId(initial.id);
      setData({ ...defaultResume, ...initial.data });
    } else if (draft) {
      setData({ ...defaultResume, ...draft });
    }
  }, []);

  const score = useMemo(() => computeScore(data), [data]);

  const pickResume = (id: string) => {
    const entry = resumeStore.get(id);
    if (!entry) return;
    setSelectedId(id);
    setData({ ...defaultResume, ...entry.data, jobDescription: data.jobDescription });
  };

  const refresh = () => {
    setSaved(resumeStore.list());
    toast.success("Resumes refreshed");
  };

  const persistJd = (jd: string) => {
    setData(d => ({ ...d, jobDescription: jd }));
    if (selectedId) {
      const entry = resumeStore.get(selectedId);
      if (entry) {
        resumeStore.upsert({ ...entry, data: { ...entry.data, jobDescription: jd }, updatedAt: Date.now() });
      }
    }
  };

  return (
    <div className="mx-auto max-w-[1400px] px-6 py-6">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="inline-flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
            <Gauge className="h-3.5 w-3.5 text-emerald-600" /> ATS Checker
          </div>
          <h1 className="font-display text-2xl font-bold mt-1">Score your resume against a job description</h1>
          <p className="text-sm text-muted-foreground">Pick a saved resume, paste the JD, and see instant ATS coverage.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={refresh}><RefreshCw className="h-3.5 w-3.5" /> Refresh</Button>
          <Button asChild size="sm"><Link to="/builder">Open Builder <ArrowRight className="h-3.5 w-3.5" /></Link></Button>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
        <div className="space-y-4">
          <section className="rounded-xl border border-border bg-card p-4">
            <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Choose resume</div>
            {saved.length === 0 ? (
              <div className="text-sm text-muted-foreground">
                No saved resumes yet. <Link to="/builder" className="text-[var(--navy-light)] underline">Create one →</Link>
              </div>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {saved.map(s => (
                  <button
                    key={s.id}
                    onClick={() => pickResume(s.id)}
                    className={cn(
                      "text-left rounded-lg border p-3 transition-colors",
                      selectedId === s.id
                        ? "border-[var(--navy-light)] bg-[var(--navy-light)]/5"
                        : "border-border hover:border-[var(--navy-light)]/60"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="text-sm font-medium truncate">{s.name}</span>
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-1">{new Date(s.updatedAt).toLocaleDateString()}</div>
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-xl border border-border bg-card p-4">
            <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">Job description</div>
            <Textarea
              value={data.jobDescription}
              onChange={(e) => persistJd(e.target.value)}
              placeholder="Paste the full job description here to get a keyword-match score…"
              className="min-h-[260px] font-mono text-xs"
            />
            <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
              <span>{data.jobDescription.trim().split(/\s+/).filter(Boolean).length} words</span>
              <span>
                Coverage: <span className="font-semibold text-foreground">{Math.round(score.coverage * 100)}%</span> ·
                Resume score: <span className="font-semibold text-foreground">{score.score}/100</span>
              </span>
            </div>
          </section>
        </div>

        <AtsPanel
          data={data}
          onClose={() => { /* no-op on standalone page */ }}
          onAppendBulletsToFirstExperience={() => toast.message("Open the Builder to apply bullets to your resume.")}
          onAddExtraKeywords={() => toast.message("Open the Builder to add keywords to your resume.")}
          onOneClickOptimize={() => toast.message("Open the Builder to run One-Click Optimize.")}
          optimizing={false}
        />
      </div>
    </div>
  );
}