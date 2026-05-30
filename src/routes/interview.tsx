import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Mic, Loader2, Sparkles, RotateCcw, Send, History } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { defaultBrief, targetBriefStore } from "@/lib/targetBriefStore";
import { readinessStore, type InterviewAttempt } from "@/lib/readinessStore";
import { authFetch } from "@/lib/authFetch";

export const Route = createFileRoute("/interview")({
  head: () => ({
    meta: [
      { title: "Mock Interview — ResumeForge" },
      { name: "description", content: "AI-driven DSA, system design and behavioral mock interviews with rubric-based scoring and feedback." },
    ],
  }),
  component: InterviewPage,
});

type Round = "dsa" | "system_design" | "behavioral";
type Difficulty = "easy" | "medium" | "hard";
type ScoreResult = { rubric: { label: string; score: number; note?: string }[]; overall: number; feedback: string };

const ROUNDS: { id: Round; label: string; blurb: string }[] = [
  { id: "dsa", label: "DSA / Coding", blurb: "Algorithms & data structures." },
  { id: "system_design", label: "System Design", blurb: "Architecture, scale, tradeoffs." },
  { id: "behavioral", label: "Behavioral", blurb: "STAR stories & soft skills." },
];

function InterviewPage() {
  const [brief, setBrief] = useState(defaultBrief);
  const [round, setRound] = useState<Round>("dsa");
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [scoring, setScoring] = useState(false);
  const [result, setResult] = useState<ScoreResult | null>(null);
  const [history, setHistory] = useState<InterviewAttempt[]>([]);

  useEffect(() => {
    setBrief(targetBriefStore.get());
    setHistory(readinessStore.attempts());
  }, []);

  const previousQuestions = useMemo(
    () => history.filter(h => h.round === round).slice(0, 5).map(h => h.question.slice(0, 120)),
    [history, round],
  );

  const generateQ = async () => {
    setLoading(true);
    setResult(null);
    setAnswer("");
    try {
      const r = await authFetch("/api/interview-question", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ round, role: brief.role || "Software Engineer", level: brief.level, difficulty, previousQuestions }),
      });
      if (!r.ok) throw new Error(await r.text());
      const data = (await r.json()) as { question: string };
      setQuestion(data.question);
    } catch (e) {
      toast.error(e instanceof Error ? e.message.slice(0, 120) : "Failed to fetch question");
    } finally {
      setLoading(false);
    }
  };

  const submit = async () => {
    if (!question || !answer.trim()) return toast.error("Write an answer first");
    setScoring(true);
    try {
      const r = await authFetch("/api/interview-score", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ round, question, answer, role: brief.role || "Software Engineer" }),
      });
      if (!r.ok) throw new Error(await r.text());
      const data = (await r.json()) as ScoreResult;
      setResult(data);
      readinessStore.recordAttempt({ round, score: data.overall, rubric: data.rubric, question, answer, feedback: data.feedback });
      setHistory(readinessStore.attempts());
      toast.success(`Scored: ${data.overall}/100`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message.slice(0, 120) : "Failed to score");
    } finally {
      setScoring(false);
    }
  };

  const reset = () => { setQuestion(""); setAnswer(""); setResult(null); };

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-6">
      <header className="flex items-center gap-3">
        <Mic className="h-5 w-5 text-primary" />
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Mock Interview</h1>
          <p className="text-sm text-muted-foreground">Practice role-targeted rounds. Each attempt scores into your readiness dashboard.</p>
        </div>
      </header>

      <div className="flex flex-wrap gap-2 items-center">
        {ROUNDS.map(r => (
          <button key={r.id} onClick={() => { setRound(r.id); reset(); }}
            className={`px-3 py-2 rounded-lg border text-left ${round === r.id ? "border-primary bg-primary/5" : "border-border hover:bg-accent"}`}>
            <div className="text-sm font-medium">{r.label}</div>
            <div className="text-xs text-muted-foreground">{r.blurb}</div>
          </button>
        ))}
        <div className="ml-auto flex items-center gap-1.5">
          {(["easy", "medium", "hard"] as Difficulty[]).map(d => (
            <button key={d} onClick={() => setDifficulty(d)}
              className={`px-2.5 py-1 text-xs rounded border capitalize ${difficulty === d ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-accent"}`}>{d}</button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl border border-border bg-card p-5 min-h-[280px]">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Question</h2>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={generateQ} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {question ? "New question" : "Generate"}
              </Button>
              {question && <Button size="sm" variant="ghost" onClick={reset}><RotateCcw className="h-4 w-4" /></Button>}
            </div>
          </div>
          {!question ? (
            <p className="text-sm text-muted-foreground mt-4">
              {brief.role ? `Targeting "${brief.role}" (${brief.level}).` : "Tip: set your target role on the dashboard for sharper questions."}
              <br />Click <strong>Generate</strong> to begin.
            </p>
          ) : (
            <p className="mt-3 text-sm whitespace-pre-wrap leading-relaxed">{question}</p>
          )}
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="font-semibold">Your answer</h2>
          <Textarea rows={12} className="mt-2 font-mono text-xs" value={answer}
            onChange={e => setAnswer(e.target.value)}
            placeholder={round === "dsa" ? "Walk through approach, then code…" : round === "system_design" ? "Requirements → high-level → data → scale → tradeoffs…" : "Situation → Task → Action → Result…"} />
          <div className="mt-3 flex justify-end">
            <Button onClick={submit} disabled={scoring || !question || !answer.trim()}>
              {scoring ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Submit for scoring
            </Button>
          </div>
        </div>
      </div>

      {result && (
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-end gap-3">
            <div className="text-4xl font-bold tabular-nums">{result.overall}</div>
            <div className="text-sm text-muted-foreground pb-1">/ 100</div>
          </div>
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {result.rubric.map((r, i) => (
              <div key={i} className="rounded border border-border p-3">
                <div className="flex justify-between items-center text-sm"><span className="font-medium">{r.label}</span><span className="tabular-nums">{r.score}/20</span></div>
                <div className="mt-1 h-1.5 rounded bg-muted overflow-hidden"><div className="h-full bg-primary" style={{ width: `${(r.score / 20) * 100}%` }} /></div>
                {r.note && <div className="mt-1.5 text-xs text-muted-foreground">{r.note}</div>}
              </div>
            ))}
          </div>
          {result.feedback && (
            <div className="mt-4 rounded bg-muted/40 p-3 text-sm leading-relaxed whitespace-pre-wrap">{result.feedback}</div>
          )}
        </div>
      )}

      {history.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-2"><History className="h-4 w-4 text-muted-foreground" /><h2 className="font-semibold">Recent attempts</h2></div>
          <div className="mt-3 divide-y divide-border">
            {history.slice(0, 6).map(h => (
              <div key={h.id} className="py-2 flex items-center justify-between gap-3 text-sm">
                <div className="min-w-0">
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">{h.round.replace("_", " ")}</div>
                  <div className="truncate">{h.question.slice(0, 100)}</div>
                </div>
                <div className="text-base font-semibold tabular-nums">{h.score}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}