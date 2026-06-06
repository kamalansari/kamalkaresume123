import { useEffect, useRef, useState } from "react";
export const AI_ASSISTANT_OPEN_EVENT = "ai-assistant:open";
import { Sparkles, X, Send, Loader2, Wand2, PenLine, Target, FileText, ListChecks, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { authFetch } from "@/lib/authFetch";
import type { ResumeData } from "../types";

type Msg = { role: "user" | "assistant"; content: string };

const QUICK_ACTIONS = [
  { label: "Rewrite", icon: PenLine, prompt: "Review my experience bullets and rewrite the weakest ones using strong action verbs + measurable outcomes." },
  { label: "ATS Optimize", icon: Target, prompt: "Tell me the top 3 ATS improvements I should make right now, in priority order." },
  { label: "Improve Summary", icon: FileText, prompt: "Rewrite my summary to be more impactful, concise, and recruiter-friendly. Keep it under 4 lines." },
  { label: "Generate Skills", icon: ListChecks, prompt: "Based on my experience and target JD, list 8–12 ATS-friendly skills I should add." },
];

export function AiAssistantDock({ data, atsScore }: { data: ResumeData; atsScore?: number }) {
  const [open, setOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  // Allow external triggers (e.g. mobile bottom nav) to open the menu.
  useEffect(() => {
    const handler = () => { setOpen(false); setMenuOpen(true); };
    window.addEventListener(AI_ASSISTANT_OPEN_EVENT, handler);
    return () => window.removeEventListener(AI_ASSISTANT_OPEN_EVENT, handler);
  }, []);


  const send = async (text: string) => {
    const content = text.trim();
    if (!content || loading) return;
    const next: Msg[] = [...messages, { role: "user", content }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const r = await authFetch("/api/nova-chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          messages: next,
          resume: {
            name: data.name,
            headline: data.headline,
            summary: data.summary,
            skills: data.skills,
            experience: data.experience?.map(e => ({ title: e.title, company: e.company, date: e.date, bullets: e.bullets })),
            education: data.education?.map(e => ({ degree: e.degree, school: e.school, date: e.date })),
          },
          jobDescription: data.jobDescription,
          atsScore,
        }),
      });
      const j = (await r.json()) as { reply?: string };
      setMessages(m => [...m, { role: "assistant", content: j.reply || "Sorry, I couldn't generate a reply." }]);
    } catch {
      setMessages(m => [...m, { role: "assistant", content: "Something went wrong. Please try again." }]);
    } finally {
      setLoading(false);
    }
  };

  const runAction = (prompt: string) => {
    setMenuOpen(false);
    setOpen(true);
    send(prompt);
  };

  return (
    <>
      {/* Floating quick-action menu */}
      <div
        className={cn(
          "no-print fixed z-40 transition-all duration-200",
          "bottom-[5.5rem] right-5 md:bottom-20 md:right-6",
          "w-[min(240px,calc(100vw-2.5rem))] origin-bottom-right",
          menuOpen && !open ? "scale-100 opacity-100" : "pointer-events-none scale-95 opacity-0",
        )}
        aria-hidden={!(menuOpen && !open)}
      >
        <div className="overflow-hidden rounded-2xl border border-border bg-card p-1.5 shadow-[var(--shadow-elegant)]">
          {QUICK_ACTIONS.map(a => {
            const Icon = a.icon;
            return (
              <button
                key={a.label}
                type="button"
                onClick={() => runAction(a.prompt)}
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm font-medium text-foreground transition hover:bg-secondary"
              >
                <Icon className="h-4 w-4 text-primary" />
                {a.label}
              </button>
            );
          })}
          <div className="my-1 border-t border-border" />
          <button
            type="button"
            onClick={() => { setMenuOpen(false); setOpen(true); }}
            className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-medium text-muted-foreground transition hover:bg-secondary hover:text-foreground"
          >
            <Wand2 className="h-3.5 w-3.5" />
            Open chat
          </button>
        </div>
      </div>

      {/* Floating AI Assistant pill */}
      <button
        type="button"
        onClick={() => {
          if (open) { setOpen(false); return; }
          setMenuOpen(o => !o);
        }}
        aria-label={open ? "Close AI assistant" : "AI Assistant"}
        aria-expanded={menuOpen || open}
        className={cn(
          "no-print fixed bottom-24 right-5 z-40 md:bottom-6 md:right-6",
          "hidden lg:inline-flex",
          "items-center gap-2 rounded-full pl-3.5 pr-4 py-2.5",
          "bg-gradient-to-br from-primary to-[var(--primary-glow,var(--primary))] text-primary-foreground",
          "shadow-[var(--shadow-elegant)] transition-all hover:scale-[1.03] active:scale-95",
          "text-sm font-semibold",
        )}
      >
        {open ? <X className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
        <span>AI Assistant</span>
        {!open && (
          <ChevronUp
            className={cn(
              "h-3.5 w-3.5 transition-transform",
              menuOpen ? "rotate-180" : "rotate-0",
            )}
          />
        )}
      </button>

      {/* Dock */}
      <div
        className={cn(
          "no-print fixed z-40 transition-all duration-200",
          "bottom-44 right-5 md:bottom-24 md:right-6",
          "w-[min(380px,calc(100vw-2.5rem))] origin-bottom-right",
          open ? "scale-100 opacity-100" : "pointer-events-none scale-95 opacity-0",
        )}
        aria-hidden={!open}
      >
        <div className="flex h-[min(520px,70vh)] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-elegant)]">
          {/* Header */}
          <div className="flex items-center gap-2 border-b bg-gradient-to-br from-secondary to-card px-4 py-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-primary to-[var(--primary-glow,var(--primary))] text-primary-foreground shadow-sm">
              <Sparkles className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold leading-tight">Nova</div>
              <div className="text-[11px] text-muted-foreground">Your AI resume coach</div>
            </div>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setOpen(false)} aria-label="Close">
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Messages */}
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto px-4 py-3 space-y-3"
            role="log"
            aria-live="polite"
            aria-relevant="additions text"
            aria-busy={loading}
            aria-label="Nova conversation"
          >
            {messages.length === 0 && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Hi! I'll review your resume, rewrite weak sections, and help you beat the ATS. Try a quick action:
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_ACTIONS.map(a => (
                    <button
                      key={a.label}
                      onClick={() => send(a.prompt)}
                      className="inline-flex items-center gap-1 rounded-full border border-border bg-secondary/60 px-2.5 py-1 text-[11px] font-medium text-foreground transition hover:bg-secondary hover:border-primary/40"
                    >
                      <Wand2 className="h-3 w-3" />
                      {a.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((m, i) => (
              <div
                key={i}
                className={cn(
                  "max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap",
                  m.role === "user"
                    ? "ml-auto bg-primary text-primary-foreground rounded-br-md"
                    : "mr-auto bg-secondary text-foreground rounded-bl-md nova-md",
                )}
              >
                {m.content}
              </div>
            ))}
            {loading && (
              <div
                role="status"
                aria-live="polite"
                className="mr-auto inline-flex items-center gap-2 rounded-2xl rounded-bl-md bg-secondary px-3 py-2 text-sm text-muted-foreground"
              >
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                <span>Nova is thinking…</span>
              </div>
            )}
          </div>

          {/* Composer */}
          <form
            onSubmit={(e) => { e.preventDefault(); send(input); }}
            className="flex items-center gap-2 border-t bg-card p-2.5"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask Nova anything…"
              className="flex-1 rounded-full border border-border bg-background px-3.5 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              disabled={loading}
            />
            <Button type="submit" size="icon" className="h-9 w-9 rounded-full" disabled={loading || !input.trim()} aria-label="Send">
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </div>
    </>
  );
}
