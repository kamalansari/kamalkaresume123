import { useMemo, useState } from "react";
import { Sparkles, Loader2, Pencil, MessageCircle, Send, Gauge, CheckCircle2, XCircle, X, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { computeScore } from "./atsScore";
import type { ResumeData } from "./types";

type Tab = "resume" | "ats" | "nova";

export function AtsPanel({
  data,
  onClose,
  onAppendBulletsToFirstExperience,
  onAddExtraKeywords,
  onOneClickOptimize,
  optimizing,
}: {
  data: ResumeData;
  onClose: () => void;
  onAppendBulletsToFirstExperience: (bullets: string[]) => void;
  onAddExtraKeywords: (kw: string[]) => void;
  onOneClickOptimize: () => void;
  optimizing: boolean;
}) {
  const [tab, setTab] = useState<Tab>("ats");
  const score = useMemo(() => computeScore(data), [data]);

  const resumeScore = Math.round(
    score.checks.reduce((s, c) => s + (c.pass ? c.weight : 0), 0) -
      (score.checks.find(c => c.label.startsWith("Job description"))?.weight ?? 0) * (score.checks.find(c => c.label.startsWith("Job description"))?.pass ? 0 : 0)
  );
  const resumeMax = score.checks.filter(c => !c.label.startsWith("Job description")).reduce((s, c) => s + c.weight, 0);
  const resumePct = Math.round((score.checks.filter(c => !c.label.startsWith("Job description") && c.pass).reduce((s, c) => s + c.weight, 0) / Math.max(resumeMax, 1)) * 100);

  const atsPct = Math.round(score.coverage * 100);
  const status = atsPct >= 80 ? "Excellent" : atsPct >= 60 ? "Solid Match" : atsPct >= 40 ? "Almost There" : "Needs Work";
  const statusTone = atsPct >= 80 ? "bg-emerald-500" : atsPct >= 60 ? "bg-[var(--navy-light)]" : atsPct >= 40 ? "bg-amber-500" : "bg-rose-500";

  return (
    <aside className="no-print space-y-3 lg:sticky lg:top-20 self-start">
      {/* Tabs */}
      <div className="rounded-xl border border-border bg-card p-1 flex gap-1">
        <TabButton active={tab === "resume"} onClick={() => setTab("resume")} label="Resume Score" badge={`${resumePct}%`} tone="emerald" />
        <TabButton active={tab === "ats"} onClick={() => setTab("ats")} label="ATS Score" badge={`${atsPct}%`} tone={atsPct >= 60 ? "navy" : "rose"} />
        <TabButton active={tab === "nova"} onClick={() => setTab("nova")} label="Chat" badge="NOVA" tone="navy" iconDot />
        <button onClick={onClose} className="ml-1 rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary" title="Hide panel">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {tab === "resume" && <ResumeScoreView data={data} score={score} />}
      {tab === "ats" && (
        <AtsScoreView
          data={data}
          score={score}
          status={status}
          statusTone={statusTone}
          atsPct={atsPct}
          onAppendBulletsToFirstExperience={onAppendBulletsToFirstExperience}
          onAddExtraKeywords={onAddExtraKeywords}
          onOneClickOptimize={onOneClickOptimize}
          optimizing={optimizing}
        />
      )}
      {tab === "nova" && <NovaChatView data={data} />}
    </aside>
  );
}

function TabButton({ active, onClick, label, badge, tone, iconDot }: { active: boolean; onClick: () => void; label: string; badge: string; tone: "emerald" | "navy" | "rose"; iconDot?: boolean }) {
  const toneCls =
    tone === "emerald" ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/30"
    : tone === "rose" ? "bg-rose-500/10 text-rose-700 border-rose-500/30"
    : "bg-[var(--navy-light)]/10 text-[var(--navy-light)] border-[var(--navy-light)]/30";
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex-1 inline-flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
        active ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"
      )}
    >
      <span>{label}</span>
      <span className={cn("inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold", toneCls)}>
        {iconDot && <span className="h-1.5 w-1.5 rounded-full bg-current" />} {badge}
      </span>
    </button>
  );
}

function ResumeScoreView({ data, score }: { data: ResumeData; score: ReturnType<typeof computeScore> }) {
  return (
    <>
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Gauge className="h-4 w-4 text-emerald-600" /> RESUME SCORE
        </div>
        <div className="mt-1 flex items-baseline gap-1">
          <span className="font-display text-5xl font-bold">{score.score}</span>
          <span className="text-muted-foreground">/100</span>
        </div>
        <div className="mt-3 h-2 rounded-full bg-secondary overflow-hidden">
          <div className="h-full rounded-full" style={{ width: `${score.score}%`, background: "linear-gradient(90deg, #10b981, #059669)" }} />
        </div>
      </div>
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-3">Checks</div>
        <ul className="space-y-2.5">
          {score.checks.map(c => (
            <li key={c.label} className="flex gap-2.5 text-sm">
              {c.pass ? <CheckCircle2 className="h-4 w-4 mt-0.5 text-emerald-600 shrink-0" /> : <XCircle className="h-4 w-4 mt-0.5 text-destructive shrink-0" />}
              <div>
                <div className={c.pass ? "" : "font-medium"}>{c.label}</div>
                {!c.pass && c.hint && <div className="text-xs text-muted-foreground">{c.hint}</div>}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}

function AtsScoreView({
  data, score, status, statusTone, atsPct,
  onAppendBulletsToFirstExperience, onAddExtraKeywords, onOneClickOptimize, optimizing,
}: {
  data: ResumeData;
  score: ReturnType<typeof computeScore>;
  status: string;
  statusTone: string;
  atsPct: number;
  onAppendBulletsToFirstExperience: (bullets: string[]) => void;
  onAddExtraKeywords: (kw: string[]) => void;
  onOneClickOptimize: () => void;
  optimizing: boolean;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [generating, setGenerating] = useState(false);
  const stats = score.keywordStats;
  const matchedCount = stats.filter(s => s.matched).length;
  const missingCount = stats.length - matchedCount;

  const toggle = (k: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k); else next.add(k);
      return next;
    });
  };

  const generate = async () => {
    const keywords = Array.from(selected);
    if (keywords.length === 0) return;
    setGenerating(true);
    try {
      const res = await fetch("/api/keyword-bullets", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({
          keywords,
          headline: data.headline,
          jobTitle: data.headline,
          jobDescription: data.jobDescription,
          experience: data.experience.map(e => ({ title: e.title, company: e.company })),
        }),
      });
      if (res.status === 429) { toast.error("Rate limit hit."); return; }
      if (res.status === 402) { toast.error("AI credits exhausted."); return; }
      if (!res.ok) { toast.error("Could not generate bullets."); return; }
      const out = (await res.json()) as { bullets?: string[] };
      if (out.bullets?.length) {
        onAppendBulletsToFirstExperience(out.bullets);
        onAddExtraKeywords(keywords);
        toast.success(`Added ${out.bullets.length} bullets`);
        setSelected(new Set());
      }
    } catch { toast.error("Network error."); }
    finally { setGenerating(false); }
  };

  if (!data.jobDescription.trim()) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground">
        Paste a target job description in the editor to unlock the ATS keyword breakdown.
      </div>
    );
  }

  return (
    <>
      {/* Header card */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
          <div className="font-semibold text-sm truncate">{data.headline || "Target role"}</div>
          <div className="text-xs text-muted-foreground">JD-based</div>
        </div>
        <div className={cn("text-white p-4 flex items-center gap-3", statusTone)}>
          <div className="h-12 w-12 rounded-full bg-white text-foreground flex items-center justify-center font-display text-xl font-bold shrink-0">
            {atsPct}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold leading-tight">{status}</div>
            <div className="mt-1.5 h-1.5 rounded-full bg-white/30 overflow-hidden">
              <div className="h-full bg-white" style={{ width: `${atsPct}%` }} />
            </div>
          </div>
          <div className="flex flex-col gap-1 text-[11px] shrink-0">
            <span className="rounded-md bg-white/20 px-2 py-0.5 whitespace-nowrap">{matchedCount} matched</span>
            <span className="rounded-md bg-white/20 px-2 py-0.5 whitespace-nowrap">{missingCount} missed</span>
          </div>
        </div>
        <div className="flex items-center justify-between px-4 py-2 bg-secondary/30 text-xs">
          <span className="text-muted-foreground">Add {missingCount} more keywords</span>
        </div>
      </div>

      {/* One-click optimization */}
      <button
        onClick={onOneClickOptimize}
        disabled={optimizing}
        className="w-full rounded-xl border border-border bg-card p-3 flex items-center justify-between hover:border-[var(--navy-light)] transition-colors disabled:opacity-60"
      >
        <span className="inline-flex items-center gap-2 text-sm font-medium">
          {optimizing ? <Loader2 className="h-4 w-4 animate-spin text-[var(--navy-light)]" /> : <Wand2 className="h-4 w-4 text-rose-500" />}
          One Click ATS Optimization
        </span>
        <span className="inline-flex items-center gap-1 rounded-md bg-amber-400 text-amber-950 text-[10px] font-bold px-2 py-0.5">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-950" /> NOVA
        </span>
      </button>

      {/* Keyword table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-border">
          <span className="text-xs">Select keywords to generate bullet points:</span>
          <Button size="sm" variant="outline" className="h-7 text-xs"><Pencil className="h-3 w-3" /> Edit</Button>
        </div>
        <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2 px-3 py-1.5 text-[10px] uppercase tracking-widest text-muted-foreground font-semibold border-b border-border bg-secondary/40">
          <span>Keyword</span><span>Resume</span><span>JD</span><span></span>
        </div>
        <div className="max-h-72 overflow-auto divide-y divide-border">
          {stats.slice(0, 30).map(s => (
            <label
              key={s.keyword}
              className={cn("grid grid-cols-[1fr_auto_auto_auto] gap-2 items-center px-3 py-2 text-sm cursor-pointer hover:bg-secondary/40",
                !s.matched && "bg-rose-50/40 dark:bg-rose-950/10")}
            >
              <span className="capitalize truncate">{s.keyword}</span>
              <span className={cn("w-6 text-center font-semibold tabular-nums", s.resume === 0 ? "text-rose-600" : "text-emerald-600")}>{s.resume}</span>
              <span className="w-6 text-center text-muted-foreground tabular-nums">{s.jd}</span>
              <input
                type="checkbox"
                checked={selected.has(s.keyword)}
                onChange={() => toggle(s.keyword)}
                disabled={s.matched}
                className="h-4 w-4 accent-[var(--navy-light)] disabled:opacity-30"
              />
            </label>
          ))}
        </div>
        <button
          onClick={generate}
          disabled={generating || selected.size === 0}
          className={cn("w-full inline-flex items-center justify-center gap-2 px-3 py-3 text-sm font-medium border-t border-border transition-colors",
            selected.size === 0 ? "bg-secondary text-muted-foreground cursor-not-allowed" : "bg-[var(--navy-light)] text-white hover:opacity-95")}
        >
          {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          Generate Bullet Points{selected.size > 0 ? ` (${selected.size})` : ""}
        </button>
      </div>
    </>
  );
}

function NovaChatView({ data }: { data: ResumeData }) {
  const [msgs, setMsgs] = useState<{ role: "user" | "assistant"; content: string }[]>([
    { role: "assistant", content: "Hi! I'm NOVA. Ask me anything about tailoring this resume to your target job." },
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;
    const next = [...msgs, { role: "user" as const, content: text }];
    setMsgs(next);
    setInput("");
    setSending(true);
    try {
      const res = await fetch("/api/nova-chat", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({
          messages: next,
          resume: { headline: data.headline, summary: data.summary, skills: data.skills },
          jobDescription: data.jobDescription,
        }),
      });
      if (res.status === 429) { toast.error("Rate limit hit."); return; }
      if (res.status === 402) { toast.error("AI credits exhausted."); return; }
      if (!res.ok) { toast.error("Nova couldn't respond."); return; }
      const out = (await res.json()) as { reply?: string };
      setMsgs(m => [...m, { role: "assistant", content: out.reply || "(no reply)" }]);
    } catch { toast.error("Network error."); }
    finally { setSending(false); }
  };

  return (
    <div className="rounded-xl border border-border bg-card flex flex-col h-[520px]">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border">
        <MessageCircle className="h-4 w-4 text-[var(--navy-light)]" />
        <span className="font-semibold text-sm">NOVA · Career Coach</span>
      </div>
      <div className="flex-1 overflow-auto p-3 space-y-2.5">
        {msgs.map((m, i) => (
          <div key={i} className={cn("max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap",
            m.role === "user" ? "ml-auto bg-[var(--navy-light)] text-white" : "bg-secondary")}>
            {m.content}
          </div>
        ))}
        {sending && <div className="text-xs text-muted-foreground"><Loader2 className="inline h-3 w-3 animate-spin" /> Nova is thinking…</div>}
      </div>
      <div className="flex items-center gap-2 p-2 border-t border-border">
        <Input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") send(); }}
          placeholder="Ask Nova…"
          className="h-9"
        />
        <Button size="sm" onClick={send} disabled={sending || !input.trim()}>
          <Send className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}