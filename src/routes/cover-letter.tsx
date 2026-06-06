import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { Mail, Copy, Download, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { resumeStore, type SavedResume } from "@/components/builder/resumeStore";
import type { ResumeData } from "@/components/builder/types";
import { splitBulletLines } from "@/lib/resumeText";
import { generateCoverLetter } from "@/lib/coverLetter.functions";

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

function CoverLetterPage() {
  const generate = useServerFn(generateCoverLetter);
  const [resumes, setResumes] = useState<SavedResume[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [jobDescription, setJobDescription] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [company, setCompany] = useState("");
  const [hiringManager, setHiringManager] = useState("");
  const [tone, setTone] = useState<"professional" | "friendly" | "enthusiastic" | "concise">("professional");
  const [length, setLength] = useState<"short" | "medium" | "long">("medium");
  const [letter, setLetter] = useState("");
  const [loading, setLoading] = useState(false);

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

  const onGenerate = async () => {
    if (!selectedResume) {
      toast.error("Pick a resume first. Create one in the Builder.");
      return;
    }
    if (jobDescription.trim().length < 20) {
      toast.error("Paste a job description (at least 20 characters).");
      return;
    }
    setLoading(true);
    setLetter("");
    try {
      const resumeText = resumeToPlainText(selectedResume.data);
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
      toast.success("Cover letter ready");
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Failed to generate.");
    } finally {
      setLoading(false);
    }
  };

  const onCopy = async () => {
    if (!letter) return;
    await navigator.clipboard.writeText(letter);
    toast.success("Copied to clipboard");
  };

  const onDownload = () => {
    if (!letter) return;
    const blob = new Blob([letter], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const safe = (company || jobTitle || "cover-letter").replace(/[^a-z0-9-_]+/gi, "-").toLowerCase();
    a.href = url;
    a.download = `${safe}-cover-letter.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
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

          <Button onClick={onGenerate} disabled={loading} className="w-full">
            {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
            {loading ? "Generating…" : "Generate cover letter"}
          </Button>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Result</Label>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={onCopy} disabled={!letter}>
                <Copy className="h-4 w-4 mr-1" /> Copy
              </Button>
              <Button size="sm" variant="outline" onClick={onDownload} disabled={!letter}>
                <Download className="h-4 w-4 mr-1" /> Download
              </Button>
            </div>
          </div>
          <Textarea
            value={letter}
            onChange={(e) => setLetter(e.target.value)}
            placeholder="Your tailored cover letter will appear here. You can edit it before copying."
            className="min-h-[520px] font-serif leading-relaxed"
          />
        </div>
      </div>
    </div>
  );
}
