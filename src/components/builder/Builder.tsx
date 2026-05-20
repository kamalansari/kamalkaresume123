import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Download, Plus, Trash2, Gauge, CheckCircle2, XCircle } from "lucide-react";
import { defaultResume, type ResumeData, type Experience, type Education } from "./types";
import { computeScore } from "./atsScore";
import { ResumeDocument } from "./ResumeDocument";

function uid() { return Math.random().toString(36).slice(2, 9); }

export function Builder() {
  const [data, setData] = useState<ResumeData>(defaultResume);
  const score = useMemo(() => computeScore(data), [data]);

  const update = <K extends keyof ResumeData>(k: K, v: ResumeData[K]) => setData(d => ({ ...d, [k]: v }));

  const updateExp = (id: string, patch: Partial<Experience>) =>
    setData(d => ({ ...d, experience: d.experience.map(e => e.id === id ? { ...e, ...patch } : e) }));
  const addExp = () => setData(d => ({ ...d, experience: [...d.experience, { id: uid(), title: "", company: "", date: "", bullets: "" }] }));
  const removeExp = (id: string) => setData(d => ({ ...d, experience: d.experience.filter(e => e.id !== id) }));

  const updateEdu = (id: string, patch: Partial<Education>) =>
    setData(d => ({ ...d, education: d.education.map(e => e.id === id ? { ...e, ...patch } : e) }));
  const addEdu = () => setData(d => ({ ...d, education: [...d.education, { id: uid(), degree: "", school: "", date: "" }] }));
  const removeEdu = (id: string) => setData(d => ({ ...d, education: d.education.filter(e => e.id !== id) }));

  return (
    <div className="min-h-screen bg-secondary/40">
      <header className="no-print sticky top-0 z-30 backdrop-blur-md bg-background/80 border-b border-border">
        <div className="mx-auto max-w-[1600px] px-6 h-14 flex items-center justify-between">
          <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
          <div className="font-display font-semibold">ResumeForge Builder</div>
          <Button variant="hero" style={{ background: "var(--gradient-hero)" }} onClick={() => window.print()}>
            <Download /> Export PDF
          </Button>
        </div>
      </header>

      <div className="mx-auto max-w-[1600px] grid lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)_minmax(0,360px)] gap-6 px-6 py-6">
        {/* Editor */}
        <div className="no-print space-y-6">
          <Card title="Personal">
            <Grid>
              <Field label="Full name"><Input value={data.name} onChange={e => update("name", e.target.value)} /></Field>
              <Field label="Headline"><Input value={data.headline} onChange={e => update("headline", e.target.value)} /></Field>
              <Field label="Email"><Input value={data.email} onChange={e => update("email", e.target.value)} /></Field>
              <Field label="Phone"><Input value={data.phone} onChange={e => update("phone", e.target.value)} /></Field>
              <Field label="Location"><Input value={data.location} onChange={e => update("location", e.target.value)} /></Field>
              <Field label="Links"><Input value={data.links} onChange={e => update("links", e.target.value)} /></Field>
            </Grid>
          </Card>

          <Card title="Summary">
            <Textarea rows={4} value={data.summary} onChange={e => update("summary", e.target.value)} placeholder="2-3 sentences on who you are and what you do." />
          </Card>

          <Card title="Experience" action={<Button size="sm" variant="outline" onClick={addExp}><Plus /> Add</Button>}>
            <div className="space-y-4">
              {data.experience.map(e => (
                <div key={e.id} className="rounded-lg border border-border p-4 bg-background">
                  <Grid>
                    <Field label="Title"><Input value={e.title} onChange={ev => updateExp(e.id, { title: ev.target.value })} /></Field>
                    <Field label="Company"><Input value={e.company} onChange={ev => updateExp(e.id, { company: ev.target.value })} /></Field>
                    <Field label="Dates" full><Input value={e.date} onChange={ev => updateExp(e.id, { date: ev.target.value })} placeholder="2022 — Present" /></Field>
                  </Grid>
                  <div className="mt-3">
                    <Label className="text-xs text-muted-foreground">Bullets (one per line)</Label>
                    <Textarea rows={4} className="mt-1.5" value={e.bullets} onChange={ev => updateExp(e.id, { bullets: ev.target.value })} placeholder="Led redesign of checkout flow, lifting conversion 18%." />
                  </div>
                  <div className="mt-2 flex justify-end">
                    <Button size="sm" variant="ghost" onClick={() => removeExp(e.id)}><Trash2 /> Remove</Button>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card title="Education" action={<Button size="sm" variant="outline" onClick={addEdu}><Plus /> Add</Button>}>
            <div className="space-y-3">
              {data.education.map(ed => (
                <div key={ed.id} className="rounded-lg border border-border p-4 bg-background">
                  <Grid>
                    <Field label="Degree" full><Input value={ed.degree} onChange={ev => updateEdu(ed.id, { degree: ev.target.value })} /></Field>
                    <Field label="School"><Input value={ed.school} onChange={ev => updateEdu(ed.id, { school: ev.target.value })} /></Field>
                    <Field label="Date"><Input value={ed.date} onChange={ev => updateEdu(ed.id, { date: ev.target.value })} /></Field>
                  </Grid>
                  <div className="mt-2 flex justify-end">
                    <Button size="sm" variant="ghost" onClick={() => removeEdu(ed.id)}><Trash2 /> Remove</Button>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card title="Skills">
            <Textarea rows={3} value={data.skills} onChange={e => update("skills", e.target.value)} placeholder="Comma-separated skills" />
          </Card>

          <Card title="Target job description">
            <p className="text-xs text-muted-foreground mb-2">Paste the job posting to score keyword match and surface missing terms.</p>
            <Textarea rows={6} value={data.jobDescription} onChange={e => update("jobDescription", e.target.value)} placeholder="Paste the job description here..." />
          </Card>
        </div>

        {/* Preview */}
        <div className="min-w-0">
          <div className="overflow-auto rounded-xl">
            <ResumeDocument data={data} />
          </div>
        </div>

        {/* ATS panel */}
        <aside className="no-print space-y-4 lg:sticky lg:top-20 self-start">
          <div className="rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Gauge className="h-4 w-4 text-[var(--navy-light)]" /> ATS SCORE
            </div>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="font-display text-5xl font-bold">{score.score}</span>
              <span className="text-muted-foreground">/100</span>
            </div>
            <div className="mt-3 h-2 rounded-full bg-secondary overflow-hidden">
              <div className="h-full rounded-full transition-all" style={{ width: `${score.score}%`, background: "var(--gradient-accent)" }} />
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              {score.score >= 85 ? "Excellent — ready to apply." : score.score >= 65 ? "Solid. A few fixes will push it higher." : "Needs work. Tackle the items below."}
            </p>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <div className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-3">Checks</div>
            <ul className="space-y-2.5">
              {score.checks.map(c => (
                <li key={c.label} className="flex gap-2.5 text-sm">
                  {c.pass
                    ? <CheckCircle2 className="h-4 w-4 mt-0.5 text-[var(--navy-light)] shrink-0" />
                    : <XCircle className="h-4 w-4 mt-0.5 text-destructive shrink-0" />}
                  <div>
                    <div className={c.pass ? "" : "font-medium"}>{c.label}</div>
                    {!c.pass && c.hint && <div className="text-xs text-muted-foreground">{c.hint}</div>}
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {data.jobDescription && (
            <div className="rounded-xl border border-border bg-card p-5">
              <div className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-3">Keyword match · {(score.coverage * 100).toFixed(0)}%</div>
              {score.missing.length > 0 ? (
                <>
                  <div className="text-xs text-muted-foreground mb-2">Missing from your resume:</div>
                  <div className="flex flex-wrap gap-1.5">
                    {score.missing.slice(0, 20).map(k => (
                      <span key={k} className="text-xs px-2 py-1 rounded-md bg-destructive/10 text-destructive border border-destructive/20">{k}</span>
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Every keyword from the JD appears in your resume. 🎯</p>
              )}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function Card({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display font-semibold">{title}</h3>
        {action}
      </div>
      {children}
    </div>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-3">{children}</div>;
}

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={full ? "col-span-2" : ""}>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}