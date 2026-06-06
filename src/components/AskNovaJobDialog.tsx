import { useEffect, useMemo, useRef, useState } from "react";
import { Sparkles, Send, Loader2, X, ChevronDown, FileText, Briefcase } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { authFetch } from "@/lib/authFetch";
import { resumeStore } from "@/components/builder/resumeStore";
import { defaultResume } from "@/components/builder/types";
import type { JobRow } from "@/lib/jobs.functions";
import type { MatchBreakdown } from "@/lib/jobMatch";
import { describeLevel } from "@/lib/jobMatch";

type Msg = { role: "user" | "assistant"; content: string };

const QUICK_PROMPTS = [
  { label: "Explain my match", prompt: "Explain my match score for this job in plain English — my biggest strengths and the top gaps I should address." },
  { label: "Tailor 5 bullets", prompt: "Rewrite 5 of my resume bullets so they're tailored to this job. Weave in the job's key skills and keywords naturally, and use measurable outcomes." },
  { label: "Rewrite my summary", prompt: "Rewrite my resume summary in 2-3 lines so it positions me directly for this role." },
  { label: "Should I apply?", prompt: "Give me an honest fit check for this job: should I apply, and if so, how should I position myself?" },
];

export function AskNovaJobDialog({
  open,
  onOpenChange,
  job,
  breakdown,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  job: JobRow;
  breakdown: MatchBreakdown;
}) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const autoSentRef = useRef(false);

  useEffect(() => {
    if (!open) {
      setMessages([]);
      setInput("");
      autoSentRef.current = false;
    }
  }, [open]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  const send = async (text: string) => {
    const content = text.trim();
    if (!content || loading) return;
    const next: Msg[] = [...messages, { role: "user", content }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const r = resumeStore.getPrimary()?.data ?? resumeStore.getDraft() ?? defaultResume;
      const res = await authFetch("/api/nova-job-chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          messages: next,
          job: {
            title: job.title,
            company: job.company_name,
            location: job.location,
            isRemote: job.is_remote,
            source: job.source,
            skills: job.skills ?? [],
            description: job.description ?? "",
            salary:
              job.salary_min || job.salary_max
                ? `${job.salary_min ?? ""}${job.salary_max ? ` - ${job.salary_max}` : ""}`
                : "Not disclosed",
          },
          resume: {
            name: r.name,
            headline: r.headline,
            summary: r.summary,
            skills: r.skills,
            experience: r.experience?.map((e) => ({
              title: e.title,
              company: e.company,
              date: e.date,
              bullets: e.bullets,
            })),
          },
          match: {
            score: breakdown.score,
            matchedSkills: breakdown.skills.matched,
            missingSkills: breakdown.skills.missing,
            matchedKeywords: breakdown.keywords.matched,
            jobLevel: describeLevel(breakdown.seniority.jobLevel),
            resumeLevel: describeLevel(breakdown.seniority.resumeLevel),
            seniorityNote: breakdown.seniority.note,
            titleNote: breakdown.title.note,
          },
        }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        setMessages((m) => [
          ...m,
          { role: "assistant", content: j.error || "Something went wrong. Please try again." },
        ]);
        return;
      }
      const j = (await res.json()) as { reply?: string };
      setMessages((m) => [
        ...m,
        { role: "assistant", content: j.reply || "Sorry, I couldn't generate a reply." },
      ]);
    } catch {
      setMessages((m) => [
        ...m,
        { role: "assistant", content: "Network error. Please try again." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  // Auto-send the "Explain my match" prompt when the dialog opens.
  useEffect(() => {
    if (open && !autoSentRef.current) {
      autoSentRef.current = true;
      void send(QUICK_PROMPTS[0].prompt);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 gap-0 max-w-xl w-[calc(100vw-1.5rem)] h-[min(640px,90vh)] flex flex-col overflow-hidden">
        <DialogHeader className="px-4 py-3 border-b bg-gradient-to-br from-secondary to-card">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-gradient-to-br from-primary to-[var(--primary-glow,var(--primary))] text-primary-foreground flex items-center justify-center shrink-0">
              <Sparkles className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0 text-left">
              <DialogTitle className="text-sm leading-tight">Ask Nova about this job</DialogTitle>
              <p className="text-[11px] text-muted-foreground truncate">
                {job.title} · {job.company_name ?? "Confidential"}
              </p>
            </div>
            <button
              onClick={() => onOpenChange(false)}
              className="rounded-md p-1 hover:bg-muted text-muted-foreground"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </DialogHeader>

        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto px-4 py-3 space-y-3"
          role="log"
          aria-live="polite"
        >
          <AnalysisPanel job={job} breakdown={breakdown} />
          {messages.length === 0 && !loading && (
            <p className="text-sm text-muted-foreground">
              I'll explain your match for <strong>{job.title}</strong> and tailor bullet points to this role.
            </p>
          )}
          {messages.map((m, i) => (
            <div
              key={i}
              className={cn(
                "max-w-[88%] rounded-2xl px-3 py-2 text-sm leading-relaxed",
                m.role === "user"
                  ? "ml-auto bg-primary text-primary-foreground rounded-br-md whitespace-pre-wrap"
                  : "mr-auto bg-secondary text-foreground rounded-bl-md prose prose-sm dark:prose-invert max-w-none prose-p:my-2 prose-ul:my-2 prose-li:my-0.5",
              )}
            >
              {m.role === "assistant" ? <ReactMarkdown>{m.content}</ReactMarkdown> : m.content}
            </div>
          ))}
          {loading && (
            <div className="mr-auto inline-flex items-center gap-2 rounded-2xl rounded-bl-md bg-secondary px-3 py-2 text-sm text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Nova is thinking…
            </div>
          )}
        </div>

        {/* Quick prompts */}
        <div className="flex flex-wrap gap-1.5 px-3 pt-2 border-t bg-card">
          {QUICK_PROMPTS.map((q) => (
            <button
              key={q.label}
              onClick={() => send(q.prompt)}
              disabled={loading}
              className="inline-flex items-center gap-1 rounded-full border border-border bg-secondary/60 px-2.5 py-1 text-[11px] font-medium text-foreground transition hover:bg-secondary hover:border-primary/40 disabled:opacity-50"
            >
              <Sparkles className="h-3 w-3 text-primary" />
              {q.label}
            </button>
          ))}
        </div>

        {/* Composer */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="flex items-center gap-2 border-t bg-card p-2.5"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask Nova about this job…"
            disabled={loading}
            className="flex-1 rounded-full border border-border bg-background px-3.5 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Message Nova"
          />
          <Button type="submit" size="icon" className="h-9 w-9 rounded-full" disabled={loading || !input.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AnalysisPanel({ job, breakdown }: { job: JobRow; breakdown: MatchBreakdown }) {
  const [open, setOpen] = useState(true);
  const resume = useMemo(
    () => resumeStore.getPrimary()?.data ?? resumeStore.getDraft() ?? defaultResume,
    [],
  );
  const resumeSkills = useMemo(
    () =>
      (resume.skills ?? "")
        .split(/[,|;·\n/]+/)
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 20),
    [resume.skills],
  );
  const experiences = (resume.experience ?? []).slice(0, 4);
  const jobSkills = (job.skills ?? []).slice(0, 20);
  const jdSnippet = (job.description ?? "").replace(/\s+/g, " ").slice(0, 320);

  return (
    <details
      open={open}
      onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}
      className="rounded-lg border bg-muted/30"
    >
      <summary className="list-none cursor-pointer select-none px-3 py-2 flex items-center gap-2 text-xs font-medium">
        <Sparkles className="h-3.5 w-3.5 text-primary" />
        What Nova analyzed to compute your {breakdown.score}% match
        <ChevronDown className={cn("h-3.5 w-3.5 ml-auto transition-transform", open && "rotate-180")} />
      </summary>

      <div className="px-3 pb-3 space-y-3 text-[11px]">
        {/* Job side */}
        <section>
          <h4 className="flex items-center gap-1.5 text-xs font-semibold text-foreground mb-1.5">
            <Briefcase className="h-3 w-3" /> Job requirements used
          </h4>
          <div className="space-y-1.5">
            <Row label="Title">{job.title}</Row>
            <Row label="Detected seniority">{describeLevel(breakdown.seniority.jobLevel)}</Row>
            {jobSkills.length > 0 && (
              <Row label="Listed skills">
                <ChipList items={jobSkills} />
              </Row>
            )}
            {jdSnippet && (
              <Row label="Description used">
                <span className="text-muted-foreground italic line-clamp-3">"{jdSnippet}{job.description && job.description.length > 320 ? "…" : ""}"</span>
              </Row>
            )}
          </div>
        </section>

        {/* Resume side */}
        <section>
          <h4 className="flex items-center gap-1.5 text-xs font-semibold text-foreground mb-1.5">
            <FileText className="h-3 w-3" /> Your resume sections used
          </h4>
          <div className="space-y-1.5">
            {resume.headline && <Row label="Headline">{resume.headline}</Row>}
            {resume.summary && (
              <Row label="Summary">
                <span className="text-muted-foreground line-clamp-2">{resume.summary}</span>
              </Row>
            )}
            {resumeSkills.length > 0 && (
              <Row label="Skills">
                <ChipList items={resumeSkills} />
              </Row>
            )}
            {experiences.length > 0 && (
              <Row label={`Experience (${experiences.length})`}>
                <ul className="space-y-0.5">
                  {experiences.map((e, i) => (
                    <li key={i} className="text-muted-foreground">
                      <span className="text-foreground font-medium">{e.title || "Role"}</span>
                      {e.company && <> @ {e.company}</>}
                      {e.date && <span className="opacity-70"> · {e.date}</span>}
                    </li>
                  ))}
                </ul>
              </Row>
            )}
            <Row label="Detected seniority">{describeLevel(breakdown.seniority.resumeLevel)} ({resumeSkills.length ? "from skills + " : ""}experience dates)</Row>
          </div>
        </section>

        {/* What overlapped */}
        <section>
          <h4 className="text-xs font-semibold text-foreground mb-1.5">What overlapped</h4>
          <div className="space-y-1.5">
            <Row label={`Matched skills (${breakdown.skills.matched.length})`}>
              {breakdown.skills.matched.length > 0 ? (
                <ChipList items={breakdown.skills.matched} tone="emerald" />
              ) : (
                <span className="text-muted-foreground">None</span>
              )}
            </Row>
            <Row label={`Missing skills (${breakdown.skills.missing.length})`}>
              {breakdown.skills.missing.length > 0 ? (
                <ChipList items={breakdown.skills.missing} tone="rose" />
              ) : (
                <span className="text-muted-foreground">None</span>
              )}
            </Row>
            <Row label={`Matched keywords (${breakdown.keywords.matched.length})`}>
              {breakdown.keywords.matched.length > 0 ? (
                <ChipList items={breakdown.keywords.matched.slice(0, 12)} />
              ) : (
                <span className="text-muted-foreground">None</span>
              )}
            </Row>
            <Row label="Title alignment">
              <span className="text-muted-foreground">{breakdown.title.note}</span>
            </Row>
          </div>
        </section>

        {/* Score math */}
        <section className="rounded-md border bg-background/60 p-2">
          <h4 className="text-xs font-semibold text-foreground mb-1">Score math</h4>
          <ul className="space-y-0.5 text-muted-foreground">
            <li>Skills overlap: <span className="text-foreground font-medium">{breakdown.skills.earned}/{breakdown.skills.weight}</span></li>
            <li>Keyword overlap: <span className="text-foreground font-medium">{breakdown.keywords.earned}/{breakdown.keywords.weight}</span></li>
            <li>Seniority fit: <span className="text-foreground font-medium">{breakdown.seniority.earned}/{breakdown.seniority.weight}</span></li>
            <li>Title alignment: <span className="text-foreground font-medium">{breakdown.title.earned}/{breakdown.title.weight}</span></li>
            <li className="pt-1 border-t mt-1">
              Total: <span className="text-foreground font-semibold">{breakdown.score}/100</span>
            </li>
          </ul>
        </section>
      </div>
    </details>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[110px_1fr] gap-2">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function ChipList({ items, tone }: { items: string[]; tone?: "emerald" | "rose" }) {
  const cls =
    tone === "emerald"
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
      : tone === "rose"
      ? "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300"
      : "border-border bg-background text-foreground/80";
  return (
    <div className="flex flex-wrap gap-1">
      {items.map((s, i) => (
        <span key={i} className={cn("inline-flex px-1.5 py-0.5 rounded border text-[10px]", cls)}>
          {s}
        </span>
      ))}
    </div>
  );
}

