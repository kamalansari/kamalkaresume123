import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { Mail, Copy, Download, Loader2, Sparkles, FileText, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { resumeStore, type SavedResume } from "@/components/builder/resumeStore";
import type { ResumeData } from "@/components/builder/types";
import { splitBulletLines } from "@/lib/resumeText";
import { generateCoverLetter, generateCoverLetterVariations } from "@/lib/coverLetter.functions";

export const Route = createFileRoute("/cover-letter")({
  head: () => ({
    meta: [
      { title: "Cover Letter Generator — ResumeForge" },
      { name: "description", content: "Generate tailored cover letters from your resume and any job description in seconds." },
    ],
  }),
  component: CoverLetterPage,
});

function resumeToPlainText(r: ResumeData): string {
  const lines: string[] = [];
  lines.push(r.name || "");
  if (r.headline) lines.push(r.headline);
  const contact = [r.email, r.phone, r.location, r.links].filter(Boolean).join(" • ");
  if (contact) lines.push(contact);
  if (r.summary) lines.push("", "SUMMARY", r.summary);
  if (r.experience?.length) {
    lines.push("", "EXPERIENCE");
    for (const e of r.experience) {
      lines.push(`${e.title || ""} — ${e.company || ""} (${e.date || ""})`);
      for (const b of splitBulletLines(e.bullets)) lines.push(`- ${b}`);
    }
  }
  if (r.projects?.length) {
    lines.push("", "PROJECTS");
    for (const p of r.projects) {
      lines.push(`${p.name || ""} ${p.link ? `(${p.link})` : ""} ${p.date || ""}`.trim());
      for (const b of splitBulletLines(p.bullets)) lines.push(`- ${b}`);
    }
  }
  if (r.education?.length) {
    lines.push("", "EDUCATION");
    for (const ed of r.education as Array<Record<string, unknown>>) {
      lines.push([ed.degree, ed.school, ed.date, ed.location].filter(Boolean).join(" — "));
    }
  }
  if (r.skills) lines.push("", "SKILLS", r.skills);
  if (r.certifications?.length) {
    lines.push("", "CERTIFICATIONS");
    for (const c of r.certifications as Array<Record<string, unknown>>) {
      lines.push([c.name, c.issuer, c.date].filter(Boolean).join(" — "));
    }
  }
  return lines.filter((l) => l !== undefined).join("\n").trim();
}

interface Variation {
  tone: string;
  letter: string;
  matches: string[];
  error?: string;
}

function MatchesList({ matches }: { matches: string[] }) {
  if (!matches || matches.length === 0) return null;
  return (
    <div className="rounded-md border bg-muted/30 p-3 space-y-2">
      <div className="flex items-center gap-2 text-sm font-medium">
        <CheckCircle2 className="h-4 w-4 text-primary" />
        Why this matches
      </div>
      <ul className="space-y-1.5 text-sm text-muted-foreground">
        {matches.map((m, i) => (
          <li key={i} className="flex gap-2">
            <span className="text-primary mt-0.5">•</span>
            <span>{m}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function CoverLetterPage() {
  const generate = useServerFn(generateCoverLetter);
  const generateVariations = useServerFn(generateCoverLetterVariations);
  const [resumes, setResumes] = useState<SavedResume[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [jobDescription, setJobDescription] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [company, setCompany] = useState("");
  const [hiringManager, setHiringManager] = useState("");
  const [tone, setTone] = useState<"professional" | "friendly" | "enthusiastic" | "concise" | "confident">("professional");
  const [length, setLength] = useState<"short" | "medium" | "long">("medium");
  const [letter, setLetter] = useState("");
  const [matches, setMatches] = useState<string[]>([]);
  const [variations, setVariations] = useState<Variation[]>([]);
  const [activeVariation, setActiveVariation] = useState(0);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"single" | "variations">("single");

  useEffect(() => {
    const list = resumeStore.list();
    setResumes(list);
    const primary = resumeStore.getPrimaryId();
    setSelectedId(primary || list[0]?.id || "");
  }, []);

  const selectedResume = useMemo(
    () => resumes.find((r) => r.id === selectedId),
    [resumes, selectedId],
  );

  const validateInputs = () => {
    if (!selectedResume) {
      toast.error("Pick a resume first. Create one in the Builder.");
      return false;
    }
    if (jobDescription.trim().length < 20) {
      toast.error("Paste a job description (at least 20 characters).");
      return false;
    }
    return true;
  };

  const onGenerate = async () => {
    if (!validateInputs()) return;
    setLoading(true);
    setLetter("");
    setMatches([]);
    setMode("single");
    try {
      const resumeText = resumeToPlainText(selectedResume!.data);
      const res = await generate({
        data: {
          resumeText,
          jobDescription: jobDescription.trim(),
          jobTitle: jobTitle.trim(),
          company: company.trim(),
          hiringManager: hiringManager.trim(),
          tone,
          length,
        },
      });
      setLetter(res.letter);
      setMatches(res.matches ?? []);
      toast.success("Cover letter ready");
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Failed to generate.");
    } finally {
      setLoading(false);
    }
  };

  const onGenerateVariations = async () => {
    if (!validateInputs()) return;
    setLoading(true);
    setLetter("");
    setVariations([]);
    setMode("variations");
    try {
      const resumeText = resumeToPlainText(selectedResume!.data);
      const res = await generateVariations({
        data: {
          resumeText,
          jobDescription: jobDescription.trim(),
          jobTitle: jobTitle.trim(),
          company: company.trim(),
          hiringManager: hiringManager.trim(),
          length,
        },
      });
      setVariations(res.variations);
      setActiveVariation(0);
      toast.success("3 variations generated");
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Failed to generate variations.");
    } finally {
      setLoading(false);
    }
  };

  const onCopy = async (text: string) => {
    if (!text) return;
    await navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  const onDownload = (text: string, suffix: string) => {
    if (!text) return;
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const safe = (company || jobTitle || "cover-letter").replace(/[^a-z0-9-_]+/gi, "-").toLowerCase();
    a.href = url;
    a.download = `${safe}-${suffix}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const toneLabel = (t: string) => {
    switch (t) {
      case "professional": return "Formal";
      case "friendly": return "Friendly";
      case "confident": return "Confident";
      default: return t.charAt(0).toUpperCase() + t.slice(1);
    }
  };

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-2">
        <Mail className="h-5 w-5 text-primary" />
        <h1 className="text-3xl font-semibold tracking-tight">Cover Letter</h1>
      </div>
      <p className="text-muted-foreground -mt-4">
        Generate tailored cover letters from your resume and a job description.
      </p>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Resume</Label>
            {resumes.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No saved resumes found. Create one in the Builder first.
              </p>
            ) : (
              <Select value={selectedId} onValueChange={setSelectedId}>
                <SelectTrigger><SelectValue placeholder="Pick a resume" /></SelectTrigger>
                <SelectContent>
                  {resumes.map((r) => (
                    <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="cl-title">Job title</Label>
              <Input id="cl-title" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} placeholder="Senior Product Designer" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cl-company">Company</Label>
              <Input id="cl-company" value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Acme Inc." />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="cl-hm">Hiring manager (optional)</Label>
            <Input id="cl-hm" value={hiringManager} onChange={(e) => setHiringManager(e.target.value)} placeholder="Jane Doe" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Tone</Label>
              <Select value={tone} onValueChange={(v) => setTone(v as typeof tone)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="professional">Professional</SelectItem>
                  <SelectItem value="friendly">Friendly</SelectItem>
                  <SelectItem value="enthusiastic">Enthusiastic</SelectItem>
                  <SelectItem value="concise">Concise</SelectItem>
                  <SelectItem value="confident">Confident</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Length</Label>
              <Select value={length} onValueChange={(v) => setLength(v as typeof length)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="short">Short</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="long">Long</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="cl-jd">Job description</Label>
            <Textarea
              id="cl-jd"
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              placeholder="Paste the full job description here…"
              className="min-h-[220px]"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Button onClick={onGenerate} disabled={loading} className="w-full">
              {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
              {loading ? "Generating…" : "Generate cover letter"}
            </Button>
            <Button onClick={onGenerateVariations} disabled={loading} variant="outline" className="w-full">
              {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileText className="h-4 w-4 mr-2" />}
              {loading ? "Generating…" : "Generate 3 variations (Formal, Friendly, Confident)"}
            </Button>
          </div>
        </div>

        <div className="space-y-3">
          {mode === "variations" && variations.length > 0 ? (
            <>
              <div className="flex items-center justify-between">
                <Label>Variations</Label>
              </div>
              <div className="flex gap-1">
                {variations.map((v, i) => (
                  <button
                    key={v.tone}
                    onClick={() => setActiveVariation(i)}
                    className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                      i === activeVariation
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted hover:bg-muted/80"
                    }`}
                  >
                    {toneLabel(v.tone)}
                  </button>
                ))}
              </div>
              <div className="space-y-2">
                {variations.map((v, i) => (
                  <div key={v.tone} className={i === activeVariation ? "block" : "hidden"}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-muted-foreground">{toneLabel(v.tone)}</span>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => onCopy(v.letter)} disabled={!v.letter}>
                          <Copy className="h-4 w-4 mr-1" /> Copy
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => onDownload(v.letter, v.tone)} disabled={!v.letter}>
                          <Download className="h-4 w-4 mr-1" /> Download
                        </Button>
                      </div>
                    </div>
                    <Textarea
                      value={v.letter}
                      readOnly
                      placeholder={`${toneLabel(v.tone)} variation will appear here…`}
                      className="min-h-[420px] font-serif leading-relaxed"
                    />
                    <div className="mt-3">
                      <MatchesList matches={v.matches} />
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <Label>Result</Label>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => onCopy(letter)} disabled={!letter}>
                    <Copy className="h-4 w-4 mr-1" /> Copy
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => onDownload(letter, tone)} disabled={!letter}>
                    <Download className="h-4 w-4 mr-1" /> Download
                  </Button>
                </div>
              </div>
              <Textarea
                value={letter}
                onChange={(e) => setLetter(e.target.value)}
                placeholder="Your tailored cover letter will appear here. You can edit it before copying."
                className="min-h-[420px] font-serif leading-relaxed"
              />
              <MatchesList matches={matches} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

