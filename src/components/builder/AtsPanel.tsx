import { useMemo, useRef, useState } from "react";
import { Sparkles, Loader2, Pencil, Send, CheckCircle2, XCircle, X, Wand2, ChevronRight, Trash2, Mic, ArrowUpRight, Briefcase, Lightbulb, Gauge, MessageSquareText, ChevronDown, SpellCheck, Target, UserCheck } from "lucide-react";
import ReactMarkdown from "react-markdown";
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

type SectionIssue = { label: string; pass: boolean; hint?: string };
type SectionGroup = { id: string; label: string; issues: SectionIssue[] };

function buildSectionGroups(data: ResumeData, score: ReturnType<typeof computeScore>): SectionGroup[] {
  const text = (v: unknown) => (typeof v === "string" ? v : v == null ? "" : String(v));
  const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;
  const hasNum = (s: string) => /\d/.test(s);
  const actionVerbs = /\b(led|built|shipped|launched|designed|drove|grew|reduced|improved|owned|managed|created|delivered|scaled|architected|implemented|optimized|developed|automated|analy[sz]ed)\b/i;

  const summary = text(data.summary);
  const exp = Array.isArray(data.experience) ? data.experience : [];
  const edu = Array.isArray(data.education) ? data.education : [];
  const skills = text(data.skills);
  const totalBullets = exp.reduce((n, e) => n + text(e.bullets).split("\n").filter(Boolean).length, 0);
  const expText = exp.map(e => text(e.bullets)).join(" ");

  const personal: SectionIssue[] = [
    { label: "Full name provided", pass: !!text(data.name).trim() },
    { label: "Professional headline", pass: !!text(data.headline).trim() },
    { label: "Email address", pass: /@/.test(text(data.email)) },
    { label: "Phone number", pass: /\d{6,}/.test(text(data.phone).replace(/\D/g, "")) },
    { label: "Location", pass: !!text(data.location).trim() },
    { label: "Profile links (LinkedIn / portfolio)", pass: !!text(data.links).trim() },
  ];

  const summaryIssues: SectionIssue[] = [
    { label: "Summary present", pass: !!summary.trim(), hint: "Write a 2–4 line professional summary." },
    { label: "At least 20 words", pass: words(summary) >= 20, hint: `Current: ${words(summary)} words.` },
    { label: "Mentions a target role", pass: !!text(data.headline) && summary.toLowerCase().includes(text(data.headline).split(/\s+/)[0]?.toLowerCase() ?? ""), hint: "Reference your target role in the summary." },
    { label: "No first-person pronouns", pass: !/\b(i|me|my|we)\b/i.test(summary), hint: "Use third-person voice." },
  ];

  const experienceIssues: SectionIssue[] = [
    { label: "At least one role listed", pass: exp.length > 0 },
    { label: "Job titles filled", pass: exp.length > 0 && exp.every(e => !!text(e.title).trim()) },
    { label: "Company names filled", pass: exp.length > 0 && exp.every(e => !!text(e.company).trim()) },
    { label: "Dates on every role", pass: exp.length > 0 && exp.every(e => !!text(e.date).trim()) },
    { label: "3+ accomplishment bullets", pass: totalBullets >= 3, hint: `Current: ${totalBullets} bullets.` },
    { label: "Strong action verbs", pass: actionVerbs.test(expText), hint: "Start bullets with verbs like Led, Built, Shipped." },
    { label: "Quantified impact (numbers)", pass: hasNum(expText), hint: "Add %, $, or counts to your bullets." },
  ];

  const educationIssues: SectionIssue[] = [
    { label: "At least one entry", pass: edu.length > 0 },
    { label: "Degree filled", pass: edu.length > 0 && edu.every(e => !!text(e.degree).trim()) },
    { label: "School / university filled", pass: edu.length > 0 && edu.every(e => !!text(e.school).trim()) },
  ];

  const skillsIssues: SectionIssue[] = [
    { label: "Skills section present", pass: !!skills.trim() },
    { label: "5+ skills listed", pass: skills.split(/[,\n|]/).map(s => s.trim()).filter(Boolean).length >= 5 },
    { label: "Skills grouped by category", pass: /[:|]/.test(skills), hint: "Use 'Category: skill, skill' format." },
  ];

  const allText = [data.name, data.headline, data.summary, skills, expText, data.extraKeywords ?? ""].join(" ").toLowerCase();
  const TOOL_KEYWORDS = ["excel", "sql", "python", "power bi", "tableau", "javascript", "react", "node", "aws", "git", "docker", "figma", "java", "linux"];
  const toolsHit = TOOL_KEYWORDS.filter(k => allText.includes(k));
  const toolsIssues: SectionIssue[] = [
    { label: "Lists technical tools", pass: toolsHit.length >= 1 },
    { label: "3+ tools / technologies", pass: toolsHit.length >= 3, hint: toolsHit.length ? `Detected: ${toolsHit.slice(0, 5).join(", ")}` : "Add tools like Excel, SQL, Python, etc." },
  ];

  const wc = words([data.name, data.headline, data.summary, skills, expText].join(" "));
  const overall: SectionIssue[] = [
    ...score.checks.map(c => ({ label: c.label, pass: c.pass, hint: c.hint })),
    { label: "Concise length (250–800 words)", pass: wc >= 250 && wc <= 800, hint: `Current: ${wc} words.` },
  ];

  return [
    { id: "summary", label: "Professional Summary", issues: summaryIssues },
    { id: "education", label: "Education", issues: educationIssues },
    { id: "experience", label: "Work Experience", issues: experienceIssues },
    { id: "overall", label: "Over All Resume", issues: overall },
    { id: "personal", label: "Personal Details", issues: personal },
    { id: "skills", label: "Skills", issues: skillsIssues },
    { id: "tools", label: "Tools & Technologies", issues: toolsIssues },
  ];
}

function ScoreRing({ value }: { value: number }) {
  const size = 120;
  const stroke = 10;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (Math.max(0, Math.min(100, value)) / 100) * c;
  const color = value >= 75 ? "#10b981" : value >= 50 ? "#f59e0b" : "#ef4444";
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="#e5e7eb" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none"
          strokeLinecap="round" strokeDasharray={c} strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 400ms ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex items-baseline justify-center pt-[42px]">
        <span className="font-display text-3xl font-bold leading-none">{value}</span>
        <span className="text-xs text-muted-foreground ml-0.5">%</span>
      </div>
    </div>
  );
}

function ResumeScoreView({ data, score }: { data: ResumeData; score: ReturnType<typeof computeScore> }) {
  const groups = useMemo(() => buildSectionGroups(data, score), [data, score]);
  const totals = groups.reduce(
    (acc, g) => {
      for (const i of g.issues) { if (i.pass) acc.pass++; else acc.fail++; }
      return acc;
    },
    { pass: 0, fail: 0 },
  );
  const value = score.score;
  const strength = value >= 75 ? "STRONG RESUME" : value >= 50 ? "SOLID START" : "NEEDS WORK";
  const tone = value >= 75 ? "bg-emerald-50 border-emerald-200" : value >= 50 ? "bg-amber-50 border-amber-200" : "bg-rose-50 border-rose-200";
  const accent = value >= 75 ? "text-emerald-700" : value >= 50 ? "text-amber-700" : "text-rose-700";

  return (
    <>
      {/* Hero card with circular score */}
      <div className={cn("rounded-xl border p-4", tone)}>
        <div className="flex items-center gap-4">
          <ScoreRing value={value} />
          <div className="flex-1 min-w-0">
            <div className={cn("text-xs font-bold tracking-widest", accent)}>{strength}</div>
            <p className="mt-1 text-sm text-foreground/80 leading-snug">
              {totals.fail > 0
                ? <>Fix <span className="font-semibold">{totals.fail}</span> remaining issue{totals.fail === 1 ? "" : "s"} to perfect your resume.</>
                : <>Every check passes — your resume is polished.</>}
            </p>
            <div className="mt-3 relative h-1.5 rounded-full bg-white/70 overflow-hidden">
              <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${value}%`, background: "linear-gradient(90deg,#10b981,#059669)" }} />
            </div>
            <div className="mt-1 flex justify-between text-[10px] text-muted-foreground tabular-nums">
              <span>0</span><span>50</span><span>75</span><span>100</span>
            </div>
          </div>
        </div>
      </div>

      {/* OPTIMIZE list */}
      <div className="space-y-2">
        <div className="text-[11px] font-semibold tracking-widest text-muted-foreground px-1">OPTIMIZE</div>
        {groups.map(g => {
          const pass = g.issues.filter(i => i.pass).length;
          const fail = g.issues.length - pass;
          return <SectionRow key={g.id} group={g} pass={pass} fail={fail} />;
        })}
      </div>
    </>
  );
}

function SectionRow({ group, pass, fail }: { group: SectionGroup; pass: number; fail: number }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-secondary/40 transition-colors"
      >
        <span className="flex-1 font-medium text-sm">{group.label}</span>
        <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 text-[11px] font-semibold">
          <CheckCircle2 className="h-3 w-3" /> {pass}
        </span>
        {fail > 0 && (
          <span className="inline-flex items-center gap-1 rounded-md bg-rose-50 text-rose-700 border border-rose-200 px-1.5 py-0.5 text-[11px] font-semibold">
            <XCircle className="h-3 w-3" /> {fail}
          </span>
        )}
        <ChevronRight className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-90")} />
      </button>
      {open && (
        <ul className="border-t border-border divide-y divide-border/70">
          {group.issues.map(i => (
            <li key={i.label} className="flex gap-2.5 px-4 py-2 text-sm">
              {i.pass
                ? <CheckCircle2 className="h-4 w-4 mt-0.5 text-emerald-600 shrink-0" />
                : <XCircle className="h-4 w-4 mt-0.5 text-rose-500 shrink-0" />}
              <div className="min-w-0">
                <div className={i.pass ? "text-foreground/80" : "font-medium"}>{i.label}</div>
                {!i.pass && i.hint && <div className="text-xs text-muted-foreground">{i.hint}</div>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
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

type NovaAction = { label: string; icon: "open" | "jobs" | "recs"; onActivate: () => void };
type NovaMessage = {
  role: "user" | "assistant";
  content: string;
  actions?: NovaAction[];
};

const INITIAL_NOVA: NovaMessage[] = [
  {
    role: "assistant",
    content:
      "Hi! I'm **Nova** — your AI Resume Assistant.\n\nI can:\n- Review your resume and flag weaknesses\n- Suggest concrete improvements\n- Fix grammar and tighten phrasing\n- Optimize ATS keywords against your target JD\n- Rewrite bullets as achievements with measurable impact\n- Share recruiter-focused recommendations\n\nWhat would you like to start with?",
  },
];

function NovaChatView({ data }: { data: ResumeData }) {
  const [msgs, setMsgs] = useState<NovaMessage[]>(INITIAL_NOVA);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [listening, setListening] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    requestAnimationFrame(() => {
      const el = scrollRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    });
  };

  const appendAssistant = (content: string, actions?: NovaAction[]) => {
    setMsgs(m => [...m, { role: "assistant", content, actions }]);
    scrollToBottom();
  };

  const openMyResume = () => {
    const el = typeof document !== "undefined" ? document.getElementById("resume-preview") : null;
    if (el) { el.scrollIntoView({ behavior: "smooth", block: "start" }); toast.success("Opened your resume"); }
    else if (typeof window !== "undefined") { window.location.assign("/builder"); }
  };
  const goToJobs = () => {
    if (typeof window !== "undefined") window.location.assign("/jobs");
  };
  const goToRecommendations = () => {
    if (typeof window !== "undefined") window.location.assign("/dashboard");
  };

  const replyWithCanned = (intent: "score" | "feedback" | "tailor" | "jobs" | "recs" | "open") => {
    if (intent === "score") {
      const s = computeScore(data);
      const pct = Math.round(s.coverage * 100);
      const overall = s.score;
      appendAssistant(
        `Your current ATS score is **${pct}%** and your overall resume score is **${overall}/100**.\n\nWould you like to review and improve your score with AI suggestions?`,
        [{ label: "Open My Resume", icon: "open", onActivate: openMyResume }],
      );
      return;
    }
    if (intent === "feedback") {
      const s = computeScore(data);
      const failing = s.checks.filter(c => !c.pass).slice(0, 3);
      const lines = failing.length
        ? failing.map(c => `• ${c.label}${c.hint ? ` — ${c.hint}` : ""}`).join("\n")
        : "Everything looks great — no major issues detected.";
      appendAssistant(`Here are the top areas to improve right now:\n\n${lines}`, [
        { label: "Open My Resume", icon: "open", onActivate: openMyResume },
      ]);
      return;
    }
    if (intent === "tailor") {
      if (!data.jobDescription?.trim()) {
        appendAssistant("Paste a target job description in the editor and I'll tailor your resume to it.");
        return;
      }
      appendAssistant("Got it — switching to the ATS tab will let you run a one-click tailor against your pasted job description.");
      return;
    }
    if (intent === "jobs") {
      appendAssistant("You can browse personalized job matches in the Jobs tab.", [
        { label: "Find matching jobs for me", icon: "jobs", onActivate: goToJobs },
      ]);
      return;
    }
    if (intent === "recs") {
      appendAssistant("You can browse personalized job recommendations in the Recommendations tab.", [
        { label: "Go to Recommendations", icon: "recs", onActivate: goToRecommendations },
      ]);
      return;
    }
    if (intent === "open") {
      appendAssistant("Opening your resume now.", [
        { label: "Open My Resume", icon: "open", onActivate: openMyResume },
      ]);
      openMyResume();
    }
  };

  const send = async (override?: string) => {
    const text = (override ?? input).trim();
    if (!text || sending) return;
    setMsgs(m => [...m, { role: "user", content: text }]);
    setInput("");
    scrollToBottom();

    // Lightweight intent routing — keeps key features working without an API round-trip.
    const t = text.toLowerCase();
    if (/score/.test(t)) return replyWithCanned("score");
    if (/feedback|review|improve|suggest/.test(t)) return replyWithCanned("feedback");
    if (/tailor|customi[sz]e|optimi[sz]e/.test(t)) return replyWithCanned("tailor");
    if (/job|match|hiring|role/.test(t)) return replyWithCanned("jobs");
    if (/recommend/.test(t)) return replyWithCanned("recs");
    if (/open|show.*resume|preview/.test(t)) return replyWithCanned("open");

    setSending(true);
    try {
      const res = await fetch("/api/nova-chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          messages: [...msgs, { role: "user", content: text }],
          resume: { headline: data.headline, summary: data.summary, skills: data.skills },
          jobDescription: data.jobDescription,
        }),
      });
      if (res.status === 429) { toast.error("Rate limit hit."); return; }
      if (res.status === 402) { toast.error("AI credits exhausted."); return; }
      if (!res.ok) {
        // Graceful fallback so the panel always feels alive.
        appendAssistant("I'm having trouble reaching the server right now, but here are a few things I can help with:", [
          { label: "Open My Resume", icon: "open", onActivate: openMyResume },
          { label: "Find matching jobs for me", icon: "jobs", onActivate: goToJobs },
          { label: "Go to Recommendations", icon: "recs", onActivate: goToRecommendations },
        ]);
        return;
      }
      const out = (await res.json()) as { reply?: string };
      appendAssistant(out.reply || "(no reply)");
    } catch {
      appendAssistant("I'm offline at the moment. Try one of these in the meantime:", [
        { label: "Open My Resume", icon: "open", onActivate: openMyResume },
        { label: "Find matching jobs for me", icon: "jobs", onActivate: goToJobs },
        { label: "Go to Recommendations", icon: "recs", onActivate: goToRecommendations },
      ]);
    } finally {
      setSending(false);
    }
  };

  const clearChat = () => { setMsgs(INITIAL_NOVA); toast.success("Chat cleared"); };

  const toggleMic = () => {
    type SR = { new (): { lang: string; interimResults: boolean; onresult: (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void; onend: () => void; start: () => void; stop: () => void } };
    const w = typeof window !== "undefined" ? (window as unknown as { SpeechRecognition?: SR; webkitSpeechRecognition?: SR }) : undefined;
    const Ctor = w?.SpeechRecognition ?? w?.webkitSpeechRecognition;
    if (!Ctor) { toast.error("Voice input isn't supported in this browser"); return; }
    if (listening) { setListening(false); return; }
    const rec = new Ctor();
    rec.lang = "en-US";
    rec.interimResults = false;
    rec.onresult = (e) => {
      const transcript = Array.from(e.results).map(r => r[0].transcript).join(" ");
      setInput(prev => (prev ? prev + " " : "") + transcript);
    };
    rec.onend = () => setListening(false);
    rec.start();
    setListening(true);
  };

  return (
    <div className="rounded-xl border border-border bg-card flex flex-col h-[560px] overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-border">
        <div className="relative h-8 w-8 rounded-full bg-gradient-to-br from-[var(--navy-light)] to-[var(--navy-deep,#0c2340)] flex items-center justify-center text-white text-xs font-bold">
          N
          <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-card" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold leading-tight">Nova <span className="text-muted-foreground font-normal">· Your AI Copilot</span></div>
          <div className="text-[10px] uppercase tracking-widest text-emerald-600 font-semibold">● Online</div>
        </div>
        <button onClick={clearChat} className="rounded-md p-1.5 text-muted-foreground hover:text-rose-600 hover:bg-rose-50" title="Clear chat">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-auto p-3 space-y-3">
        {msgs.map((m, i) => (
          <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start gap-2")}>
            {m.role === "assistant" && (
              <div className="h-6 w-6 mt-0.5 rounded-full bg-[var(--navy-light)] text-white flex items-center justify-center text-[10px] font-bold shrink-0">N</div>
            )}
            <div className={cn("max-w-[88%] space-y-2")}>
              <div className={cn("rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap leading-relaxed",
                m.role === "user"
                  ? "bg-[var(--navy-light)] text-white rounded-br-sm"
                  : "bg-secondary text-foreground rounded-bl-sm")}>
                {m.content}
              </div>
              {m.actions?.map(a => (
                <button
                  key={a.label}
                  onClick={a.onActivate}
                  className="w-full inline-flex items-center justify-between rounded-xl bg-[var(--navy-light)] text-white px-3.5 py-2.5 text-sm font-medium hover:opacity-95"
                >
                  <span>{a.label}</span>
                  <ArrowUpRight className="h-4 w-4" />
                </button>
              ))}
            </div>
          </div>
        ))}
        {sending && (
          <div className="text-xs text-muted-foreground inline-flex items-center gap-1.5">
            <Loader2 className="h-3 w-3 animate-spin" /> Nova is thinking…
          </div>
        )}
      </div>

      {/* Quick action chips */}
      <div className="flex gap-1.5 overflow-x-auto px-2 pb-2 scrollbar-thin">
        <QuickChip icon={Gauge} label="Show my resume score" onClick={() => send("Show my resume score")} />
        <QuickChip icon={MessageSquareText} label="Give me resume feedback" onClick={() => send("Give me resume feedback")} />
        <QuickChip icon={Wand2} label="Tailor my resume" onClick={() => send("Tailor my resume")} />
        <QuickChip icon={Briefcase} label="Find jobs" onClick={() => send("Find matching jobs for me")} />
        <QuickChip icon={Lightbulb} label="Recommendations" onClick={() => send("Go to recommendations")} />
      </div>

      {/* Composer */}
      <div className="border-t border-border p-2 space-y-1.5">
        <div className="flex items-center gap-2">
          <Input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder="Ask Nova anything…"
            className="h-9 flex-1 rounded-full bg-secondary/60 border-transparent focus-visible:bg-card"
          />
          <button
            onClick={toggleMic}
            className={cn("h-9 w-9 rounded-full inline-flex items-center justify-center transition-colors",
              listening ? "bg-rose-500 text-white animate-pulse" : "text-muted-foreground hover:bg-secondary")}
            title={listening ? "Listening… click to stop" : "Voice input"}
          >
            <Mic className="h-4 w-4" />
          </button>
          <Button
            size="icon"
            onClick={() => send()}
            disabled={sending || !input.trim()}
            className="h-9 w-9 rounded-full"
            title="Send"
          >
            <Send className="h-3.5 w-3.5" />
          </Button>
        </div>
        <div className="flex items-center justify-between px-1 text-[10px] text-muted-foreground">
          <button className="inline-flex items-center gap-1 hover:text-foreground" title="Assistant mode">
            <Sparkles className="h-3 w-3" /> Assistant <ChevronDown className="h-3 w-3" />
          </button>
          <span className="uppercase tracking-widest">Press ↵ to send</span>
        </div>
      </div>
    </div>
  );
}

function QuickChip({ icon: Icon, label, onClick }: { icon: typeof Gauge; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="shrink-0 inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:border-[var(--navy-light)] hover:text-[var(--navy-light)] transition-colors"
    >
      <Icon className="h-3.5 w-3.5 opacity-80" />
      <span className="whitespace-nowrap">{label}</span>
      <ArrowUpRight className="h-3 w-3 opacity-60" />
    </button>
  );
}