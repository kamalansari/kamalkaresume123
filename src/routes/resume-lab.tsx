import { authFetch } from "@/lib/authFetch";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { FlaskConical, Sparkles, Loader2, CheckCircle2, AlertCircle, ArrowRight, Printer, FileType, Download } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { resumeStore, newId } from "@/components/builder/resumeStore";
import { defaultResume, type ResumeData, type Experience } from "@/components/builder/types";
import { computeScore } from "@/components/builder/atsScore";
import { ResumeDocument } from "@/components/builder/ResumeDocument";
import { exportDocx } from "@/components/builder/exportDocx";
import { normalizeBulletText, splitBulletLines } from "@/lib/resumeText";

export const Route = createFileRoute("/resume-lab")({
  head: () => ({
    meta: [
      { title: "Resume Lab — JD-aligned AI rewrite" },
      { name: "description", content: "Paste a job description and let AI realign your resume — headline, summary, skills, and bullets — to match what recruiters scan for." },
    ],
  }),
  component: ResumeLabPage,
});

type AlignResult = {
  headline?: string;
  summary?: string;
  skills?: string;
  experience?: { title?: string; company?: string; date?: string; bullets?: string }[];
  keywordsAdded?: string[];
  gaps?: string[];
};

function ResumeLabPage() {
  const [resume, setResume] = useState<ResumeData>(defaultResume);
  const [jd, setJd] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<AlignResult | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [tailoredName, setTailoredName] = useState("");
  const [docxBusy, setDocxBusy] = useState(false);
  const hasPrimary = typeof window !== "undefined" && !!resumeStore.getPrimaryId();

  useEffect(() => {
    const primary = resumeStore.getPrimary();
    const draft = resumeStore.getDraft();
    if (primary?.data) setResume(primary.data);
    else if (draft) setResume(draft);
  }, []);

  const beforeScore = useMemo(() => computeScore({ ...resume, jobDescription: jd }).score, [resume, jd]);
  const afterScore = useMemo(() => {
    if (!result) return null;
    const merged: ResumeData = {
      ...resume,
      headline: result.headline ?? resume.headline,
      summary: result.summary ?? resume.summary,
      skills: result.skills != null ? normalizeSkills(result.skills) : resume.skills,
      experience: mergeExperience(resume.experience, result.experience),
      jobDescription: jd,
    };
    return computeScore(merged).score;
  }, [resume, result, jd]);

  // The exact resume that the preview renders AND that downloads (PDF/DOCX)
  // use, so "what you see is what you get".
  const mergedResume: ResumeData = useMemo(() => {
    if (!result) return { ...resume, jobDescription: jd || resume.jobDescription };
    return {
      ...resume,
      headline: result.headline ?? resume.headline,
      summary: result.summary ?? resume.summary,
      skills: result.skills != null ? normalizeSkills(result.skills) : resume.skills,
      experience: mergeExperience(resume.experience, result.experience),
      jobDescription: jd || resume.jobDescription,
    };
  }, [resume, result, jd]);

  const downloadPdf = () => {
    // Print CSS hides .no-print and renders .print-area only — the
    // ResumeDocument below is wrapped in .print-area, so the PDF matches
    // the preview pixel-for-pixel.
    requestAnimationFrame(() => window.print());
  };

  const downloadDocx = async () => {
    setDocxBusy(true);
    try {
      await exportDocx(mergedResume);
      toast.success("DOCX downloaded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message.slice(0, 120) : "Export failed");
    } finally {
      setDocxBusy(false);
    }
  };

  const align = async () => {
    if (!jd.trim()) return toast.error("Paste a job description first");
    setBusy(true);
    setResult(null);
    try {
      const r = await authFetch("/api/align-resume", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          jobDescription: jd,
          resume: {
            name: resume.name,
            headline: resume.headline,
            summary: resume.summary,
            skills: resume.skills,
            experience: resume.experience.map(e => ({ title: e.title, company: e.company, date: e.date, bullets: e.bullets })),
          },
        }),
      });
      if (!r.ok) throw new Error(await r.text());
      const data = (await r.json()) as AlignResult;
      setResult(data);
      toast.success("Aligned to JD");
    } catch (e) {
      toast.error(e instanceof Error ? e.message.slice(0, 120) : "Failed to align");
    } finally {
      setBusy(false);
    }
  };

  const confirmApply = () => {
    if (!result) return;
    const merged: ResumeData = {
      ...resume,
      headline: result.headline ?? resume.headline,
      summary: result.summary ?? resume.summary,
      skills: result.skills != null ? normalizeSkills(result.skills) : resume.skills,
      experience: mergeExperience(resume.experience, result.experience),
      jobDescription: jd || resume.jobDescription,
    };
    // Never overwrite the Primary resume — always save tailored output as a NEW copy.
    const stamp = new Date().toLocaleDateString();
    const name = (tailoredName.trim() || `Tailored — ${stamp}`);
    const id = newId();
    resumeStore.upsert({ id, name, updatedAt: Date.now(), data: merged });
    resumeStore.saveDraft(merged);
    setConfirmOpen(false);
    setTailoredName("");
    toast.success(`Saved as new resume "${name}" — Primary is untouched`);
  };

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-6">
      <header className="no-print flex items-center gap-3">
        <FlaskConical className="h-5 w-5 text-primary" />
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Resume Lab</h1>
          <p className="text-sm text-muted-foreground">Paste a job description. AI rewrites your headline, summary, skills, and bullets to align — without inventing facts.</p>
        </div>
      </header>

      <div className="no-print grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl border border-border bg-card p-5">
          <Label>Target job description</Label>
          <Textarea rows={14} value={jd} onChange={e => setJd(e.target.value)} placeholder="Paste the full JD here..." className="mt-2 font-mono text-xs" />
          <div className="mt-3 flex items-center justify-between gap-3">
            <div className="text-xs text-muted-foreground">Current resume ATS: <span className="font-semibold tabular-nums">{beforeScore}</span></div>
            <Button onClick={align} disabled={busy || !jd.trim()}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Align to JD
            </Button>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 min-h-[380px]">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Rewrite preview</h2>
            {afterScore != null && (
              <div className="text-xs text-muted-foreground">After: <span className="font-semibold tabular-nums text-foreground">{afterScore}</span> <span className={`ml-1 ${afterScore >= beforeScore ? "text-emerald-600" : "text-amber-600"}`}>({afterScore - beforeScore >= 0 ? "+" : ""}{afterScore - beforeScore})</span></div>
            )}
          </div>
          {!result ? (
            <p className="text-sm text-muted-foreground mt-3">Run an alignment to preview a JD-targeted rewrite.</p>
          ) : (
            <div className="mt-3 space-y-4 text-sm">
              {result.headline && (<Field label="Headline" value={result.headline} />)}
              {result.summary && (<Field label="Summary" value={result.summary} multiline />)}
              {result.skills && (<Field label="Skills" value={result.skills} />)}
              {result.experience && result.experience.length > 0 && (
                <div>
                  <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Experience bullets</div>
                  <div className="mt-2 space-y-3">
                    {result.experience.map((e, i) => (
                      <div key={i} className="border-l-2 border-primary/40 pl-3">
                        <div className="font-medium">{e.title} · <span className="text-muted-foreground">{e.company}</span></div>
                        <ul className="mt-1 list-disc list-inside text-muted-foreground whitespace-pre-wrap">
                          {splitBulletLines(e.bullets).map((b, j) => <li key={j}>{b}</li>)}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {result.keywordsAdded && result.keywordsAdded.length > 0 && (
                  <div className="rounded border border-emerald-200/60 bg-emerald-50/40 p-3 dark:bg-emerald-950/20 dark:border-emerald-900/40">
                    <div className="flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-400"><CheckCircle2 className="h-3 w-3" /> Keywords woven in</div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {result.keywordsAdded.map(k => <span key={k} className="text-xs px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">{k}</span>)}
                    </div>
                  </div>
                )}
                {result.gaps && result.gaps.length > 0 && (
                  <div className="rounded border border-amber-200/60 bg-amber-50/40 p-3 dark:bg-amber-950/20 dark:border-amber-900/40">
                    <div className="flex items-center gap-1 text-xs font-medium text-amber-700 dark:text-amber-400"><AlertCircle className="h-3 w-3" /> Evidence gaps</div>
                    <ul className="mt-1 list-disc list-inside text-xs text-amber-800 dark:text-amber-300">
                      {result.gaps.map((g, i) => <li key={i}>{g}</li>)}
                    </ul>
                  </div>
                )}
              </div>
              <div className="flex gap-2 pt-2">
                <Button onClick={() => setConfirmOpen(true)}>Apply to my resume</Button>
                <Button variant="outline" asChild><Link to="/builder">Open builder <ArrowRight className="h-4 w-4" /></Link></Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Live resume preview — this is exactly what the PDF/DOCX downloads
          will produce. Wrapped in `.print-area` via ResumeDocument itself. */}
      <section className="space-y-3">
        <div className="no-print flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Resume preview</h2>
            <p className="text-xs text-muted-foreground">
              {result ? "Showing the JD-tailored rewrite. Downloads match this preview exactly." : "Showing your current resume. Align to JD above to tailor it."}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={downloadPdf} title="Download as PDF">
              <Printer className="h-4 w-4" /> PDF
            </Button>
            <Button size="sm" variant="outline" onClick={downloadDocx} disabled={docxBusy} title="Download as DOCX">
              {docxBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileType className="h-4 w-4" />} DOCX
            </Button>
            {result && (
              <Button size="sm" onClick={() => setConfirmOpen(true)} title="Save as a new resume in the builder">
                <Download className="h-4 w-4" /> Save to builder
              </Button>
            )}
          </div>
        </div>
        <div className="rounded-xl border border-border bg-muted/30 p-4 overflow-auto">
          <ResumeDocument data={mergedResume} />
        </div>
      </section>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Save tailored resume?</AlertDialogTitle>
            <AlertDialogDescription>
              {hasPrimary
                ? "Your Primary Resume will not be modified. The tailored rewrite will be saved as a new resume so you can review it before using it."
                : "The tailored rewrite will be saved as a new resume. Your existing resumes stay untouched."}
              {" "}ATS-friendly formatting (plain text, clean section order) is preserved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-1.5">
            <Label className="text-xs">Name this tailored version</Label>
            <Input
              value={tailoredName}
              onChange={e => setTailoredName(e.target.value)}
              placeholder={`Tailored — ${new Date().toLocaleDateString()}`}
              autoFocus
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmApply}>Save as new resume</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Field({ label, value, multiline }: { label: string; value: string; multiline?: boolean }) {
  return (
    <div>
      <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`mt-1 ${multiline ? "whitespace-pre-wrap" : ""}`}>{value}</div>
    </div>
  );
}

function mergeExperience(base: Experience[], next?: { title?: string; company?: string; date?: string; bullets?: string }[]): Experience[] {
  if (!next || !next.length) return base;
  return base.map((e, i) => ({
    ...e,
    bullets: next[i]?.bullets != null ? normalizeBulletText(next[i]!.bullets) : normalizeBulletText(e.bullets),
  }));
}

// AI sometimes returns skills as an array, as a single mashed string, or
// separated only by bullet glyphs. Normalize to a comma-separated string so
// parseSkills() in the builder splits them correctly.
function normalizeSkills(input: unknown): string {
  if (Array.isArray(input)) {
    return input.map((s) => String(s).trim()).filter(Boolean).join(", ");
  }
  if (typeof input !== "string") return "";
  const s = input.trim();
  if (!s) return "";
  if (/[,|\n]/.test(s)) return s;
  // Split on bullet glyphs / middots if present
  if (/[\u2022•·]/.test(s)) {
    return s.split(/[\u2022•·]+/).map((p) => p.trim()).filter(Boolean).join(", ");
  }
  return s;
}
