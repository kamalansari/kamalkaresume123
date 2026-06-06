import { authFetch } from "@/lib/authFetch";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { FlaskConical, Sparkles, Loader2, CheckCircle2, AlertCircle, ArrowRight, Printer, FileType, Download, Type, ImageIcon, FileText, Upload, X, Camera } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
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
import { extractResumeText } from "@/lib/importResume";

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
  const [jdMode, setJdMode] = useState<"text" | "image" | "pdf">("text");
  const [ocrBusy, setOcrBusy] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrStage, setOcrStage] = useState("");
  const [extracted, setExtracted] = useState<JdMeta | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const hasPrimary = typeof window !== "undefined" && !!resumeStore.getPrimaryId();

  const handleImageFile = async (file: File) => {
    const okTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (!okTypes.includes(file.type)) {
      toast.error("Unsupported file. Use JPG, PNG, or WEBP.");
      return;
    }
    if (file.size > 6 * 1024 * 1024) {
      toast.error("Image too large. Max 6MB.");
      return;
    }
    setOcrBusy(true);
    setOcrProgress(10);
    setOcrStage("Reading image…");
    try {
      const dataUrl = await fileToDataUrl(file);
      setPreviewUrl(dataUrl);
      setOcrProgress(35);
      setOcrStage("Running OCR…");
      const r = await authFetch("/api/extract-jd", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ imageDataUrl: dataUrl }),
      });
      setOcrProgress(80);
      if (!r.ok) throw new Error(await r.text());
      const data = (await r.json()) as JdMeta;
      if (!data.text || !data.text.trim()) {
        toast.error("Couldn't extract any text. Try a clearer screenshot.");
        return;
      }
      setOcrProgress(100);
      setOcrStage("Done");
      setJd(data.text);
      setExtracted(data);
      toast.success("Job description extracted from image");
    } catch (e) {
      toast.error(e instanceof Error ? e.message.slice(0, 140) : "OCR failed");
    } finally {
      setTimeout(() => { setOcrBusy(false); setOcrProgress(0); setOcrStage(""); }, 400);
    }
  };

  const handlePdfFile = async (file: File) => {
    const okPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    if (!okPdf) {
      toast.error("Unsupported file. Upload a PDF.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("PDF too large. Max 10MB.");
      return;
    }
    setOcrBusy(true);
    setOcrProgress(15);
    setOcrStage("Reading PDF…");
    try {
      const text = await extractResumeText(file);
      const trimmed = text.trim();
      if (!trimmed) {
        toast.error("No text found in PDF. It may be a scanned image — try Upload Image instead.");
        return;
      }
      setOcrProgress(55);
      setOcrStage("Analyzing JD…");
      const r = await authFetch("/api/extract-jd", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: trimmed.slice(0, 60000) }),
      });
      setOcrProgress(85);
      if (!r.ok) throw new Error(await r.text());
      const data = (await r.json()) as JdMeta;
      setOcrProgress(100);
      setJd(data.text || trimmed);
      setExtracted(data);
      toast.success("Job description extracted from PDF");
    } catch (e) {
      toast.error(e instanceof Error ? e.message.slice(0, 140) : "Couldn't read PDF");
    } finally {
      setTimeout(() => { setOcrBusy(false); setOcrProgress(0); setOcrStage(""); }, 400);
    }
  };

  const analyzePastedText = async () => {
    if (!jd.trim()) return;
    setOcrBusy(true);
    setOcrProgress(50);
    setOcrStage("Analyzing JD…");
    try {
      const r = await authFetch("/api/extract-jd", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: jd.slice(0, 60000) }),
      });
      if (!r.ok) throw new Error(await r.text());
      const data = (await r.json()) as JdMeta;
      setExtracted(data);
      toast.success("JD analyzed");
    } catch (e) {
      toast.error(e instanceof Error ? e.message.slice(0, 140) : "Analyze failed");
    } finally {
      setOcrBusy(false); setOcrProgress(0); setOcrStage("");
    }
  };

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
        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <Label>Target job description</Label>
            {extracted && (
              <button type="button" onClick={() => { setExtracted(null); setPreviewUrl(null); }} className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
                <X className="h-3 w-3" /> Clear
              </button>
            )}
          </div>

          <Tabs value={jdMode} onValueChange={(v) => setJdMode(v as typeof jdMode)}>
            <TabsList className="grid w-full grid-cols-3 h-auto">
              <TabsTrigger value="text" className="py-2"><Type className="h-3.5 w-3.5 mr-1.5" />Paste Text</TabsTrigger>
              <TabsTrigger value="image" className="py-2"><ImageIcon className="h-3.5 w-3.5 mr-1.5" />Upload Image</TabsTrigger>
              <TabsTrigger value="pdf" className="py-2"><FileText className="h-3.5 w-3.5 mr-1.5" />Upload PDF</TabsTrigger>
            </TabsList>

            <TabsContent value="text" className="mt-4">
              <Textarea rows={12} value={jd} onChange={e => setJd(e.target.value)} placeholder="Paste the full JD here..." className="font-mono text-xs" />
              {jd.trim() && !extracted && (
                <Button size="sm" variant="ghost" onClick={analyzePastedText} disabled={ocrBusy} className="mt-2">
                  {ocrBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                  Analyze JD details
                </Button>
              )}
            </TabsContent>

            <TabsContent value="image" className="mt-4 space-y-3">
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  const f = e.dataTransfer.files?.[0];
                  if (f) handleImageFile(f);
                }}
                className={`rounded-xl border-2 border-dashed transition-colors p-6 text-center cursor-pointer ${dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/40"}`}
                onClick={() => imageInputRef.current?.click()}
                role="button"
                tabIndex={0}
              >
                {previewUrl ? (
                  <img src={previewUrl} alt="JD screenshot preview" className="mx-auto max-h-48 rounded-md shadow-sm" />
                ) : (
                  <>
                    <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
                    <div className="mt-2 text-sm font-medium">Drop a job posting screenshot</div>
                    <div className="text-xs text-muted-foreground mt-0.5">JPG, PNG, WEBP · up to 6MB</div>
                  </>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2 sm:hidden">
                <Button type="button" size="lg" variant="default" onClick={() => imageInputRef.current?.click()} className="h-12">
                  <Upload className="h-4 w-4" /> Gallery
                </Button>
                <Button type="button" size="lg" variant="outline" onClick={() => cameraInputRef.current?.click()} className="h-12">
                  <Camera className="h-4 w-4" /> Camera
                </Button>
              </div>
              <input
                ref={imageInputRef}
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/webp"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageFile(f); e.currentTarget.value = ""; }}
              />
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageFile(f); e.currentTarget.value = ""; }}
              />
              {jd && (
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Extracted text (editable):</div>
                  <Textarea rows={8} value={jd} onChange={e => setJd(e.target.value)} className="font-mono text-xs" />
                </div>
              )}
            </TabsContent>

            <TabsContent value="pdf" className="mt-4 space-y-3">
              <div
                onClick={() => pdfInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files?.[0]; if (f) handlePdfFile(f); }}
                className={`rounded-xl border-2 border-dashed transition-colors p-6 text-center cursor-pointer ${dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/40"}`}
                role="button"
                tabIndex={0}
              >
                <FileText className="h-8 w-8 mx-auto text-muted-foreground" />
                <div className="mt-2 text-sm font-medium">Drop the JD PDF here</div>
                <div className="text-xs text-muted-foreground mt-0.5">PDF · up to 10MB</div>
              </div>
              <input
                ref={pdfInputRef}
                type="file"
                accept="application/pdf,.pdf"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handlePdfFile(f); e.currentTarget.value = ""; }}
              />
              {jd && (
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Extracted text (editable):</div>
                  <Textarea rows={8} value={jd} onChange={e => setJd(e.target.value)} className="font-mono text-xs" />
                </div>
              )}
            </TabsContent>
          </Tabs>

          {ocrBusy && (
            <div role="status" aria-live="polite" className="space-y-1.5">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> {ocrStage || "Processing…"}
              </div>
              <Progress value={ocrProgress} className="h-1.5" />
            </div>
          )}

          {extracted && (
            <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2.5 text-xs">
              <div className="font-medium text-foreground text-sm flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />Extracted from JD</div>
              <div className="grid grid-cols-2 gap-2">
                <Meta label="Experience" value={extracted.experience} />
                <Meta label="Location" value={extracted.location} />
                <Meta label="Industry" value={extracted.industry} />
              </div>
              {extracted.skills?.length > 0 && (
                <div>
                  <div className="text-muted-foreground mb-1">Skills</div>
                  <div className="flex flex-wrap gap-1">
                    {extracted.skills.map((s, i) => <Badge key={i} variant="secondary" className="text-[10px] font-normal">{s}</Badge>)}
                  </div>
                </div>
              )}
              {extracted.keywords?.length > 0 && (
                <div>
                  <div className="text-muted-foreground mb-1">Key keywords</div>
                  <div className="flex flex-wrap gap-1">
                    {extracted.keywords.map((s, i) => <Badge key={i} variant="outline" className="text-[10px] font-normal">{s}</Badge>)}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex items-center justify-between gap-3 pt-1">
            <div className="text-xs text-muted-foreground">Current ATS: <span className="font-semibold tabular-nums">{beforeScore}</span></div>
            <Button onClick={align} disabled={busy || ocrBusy || !jd.trim()}>
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
