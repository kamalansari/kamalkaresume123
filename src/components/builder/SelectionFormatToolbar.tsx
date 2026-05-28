import { useEffect, useRef, useState } from "react";
import { Bold, Italic, Underline, List, ListOrdered, Link as LinkIcon, AlignLeft, AlignCenter, AlignRight, AlignJustify, Sparkles, Loader2, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { ResumeData } from "./types";

type Pos = { top: number; left: number } | null;

function exec(cmd: string, value?: string) {
  try {
    // execCommand is deprecated but is still the most reliable cross-browser way
    // to apply inline formatting inside a contentEditable region.
    document.execCommand(cmd, false, value);
  } catch {
    /* ignore */
  }
}

export function SelectionFormatToolbar({ data }: { data: ResumeData }) {
  const [pos, setPos] = useState<Pos>(null);
  const [busy, setBusy] = useState(false);
  const [alignOpen, setAlignOpen] = useState(false);
  const lastRangeRef = useRef<Range | null>(null);
  const barRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const update = () => {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
        setPos(null);
        return;
      }
      const range = sel.getRangeAt(0);
      const node = range.commonAncestorContainer as Node;
      const el = (node.nodeType === 1 ? (node as Element) : node.parentElement) ?? null;
      const editable = el?.closest?.("[data-preview-edit]") as HTMLElement | null;
      const preview = el?.closest?.("#resume-preview") as HTMLElement | null;
      if (!editable || !preview) {
        setPos(null);
        return;
      }
      lastRangeRef.current = range.cloneRange();
      const rect = range.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) {
        setPos(null);
        return;
      }
      const top = rect.top + window.scrollY - 44;
      const left = rect.left + window.scrollX + rect.width / 2;
      setPos({ top: Math.max(8, top), left });
      setAlignOpen(false);
    };
    const onSelectionChange = () => {
      // Defer one frame so the selection has settled (esp. after mouseup).
      requestAnimationFrame(update);
    };
    const onMouseDown = (e: MouseEvent) => {
      const t = e.target as Node | null;
      if (t && barRef.current && barRef.current.contains(t)) return;
      // Clicking outside the bar will clear the selection naturally; just hide.
      setAlignOpen(false);
    };
    document.addEventListener("selectionchange", onSelectionChange);
    document.addEventListener("mousedown", onMouseDown, true);
    window.addEventListener("scroll", onSelectionChange, true);
    window.addEventListener("resize", onSelectionChange);
    return () => {
      document.removeEventListener("selectionchange", onSelectionChange);
      document.removeEventListener("mousedown", onMouseDown, true);
      window.removeEventListener("scroll", onSelectionChange, true);
      window.removeEventListener("resize", onSelectionChange);
    };
  }, []);

  const restoreSelection = () => {
    const range = lastRangeRef.current;
    if (!range) return;
    const sel = window.getSelection();
    if (!sel) return;
    sel.removeAllRanges();
    sel.addRange(range);
  };

  const fireInput = () => {
    const sel = window.getSelection();
    const node = sel?.anchorNode;
    const el = (node?.nodeType === 1 ? (node as Element) : node?.parentElement) ?? null;
    const editable = el?.closest?.("[data-preview-edit]") as HTMLElement | null;
    editable?.dispatchEvent(new Event("input", { bubbles: true }));
    editable?.dispatchEvent(new Event("blur", { bubbles: true }));
  };

  const run = (cmd: string, value?: string) => {
    restoreSelection();
    exec(cmd, value);
    fireInput();
  };

  const insertLink = () => {
    restoreSelection();
    const sel = window.getSelection();
    const current = sel?.toString() ?? "";
    const url = window.prompt("Enter a URL", current.startsWith("http") ? current : "https://");
    if (!url) return;
    exec("createLink", url);
    fireInput();
  };

  const rewriteSelection = async () => {
    const range = lastRangeRef.current;
    if (!range) return;
    const text = range.toString().trim();
    if (!text) return;
    setBusy(true);
    try {
      const res = await fetch("/api/rewrite-snippet", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          text,
          context: { headline: data.headline, jobDescription: data.jobDescription },
        }),
      });
      if (res.status === 429) { toast.error("Rate limit hit."); return; }
      if (res.status === 402) { toast.error("AI credits exhausted."); return; }
      if (!res.ok) { toast.error("Rewrite failed."); return; }
      const out = (await res.json()) as { text?: string };
      const replacement = (out.text ?? "").trim();
      if (!replacement) { toast.error("Empty rewrite."); return; }
      restoreSelection();
      exec("insertText", replacement);
      fireInput();
      toast.success("Rewritten");
    } catch {
      toast.error("Rewrite failed.");
    } finally {
      setBusy(false);
    }
  };

  if (!pos) return null;

  const btn = "h-7 w-7 inline-flex items-center justify-center rounded text-foreground/80 hover:bg-muted hover:text-foreground transition";

  return (
    <div
      ref={barRef}
      className="no-print fixed z-50 -translate-x-1/2 flex items-center gap-0.5 rounded-lg border border-border bg-background/95 backdrop-blur px-1.5 py-1 shadow-lg"
      style={{ top: pos.top, left: pos.left }}
      onMouseDown={e => e.preventDefault()}
    >
      <button
        onClick={rewriteSelection}
        disabled={busy}
        className="inline-flex items-center gap-1 rounded-md bg-[var(--navy-light)] text-white h-7 px-2 text-xs font-medium hover:opacity-90 disabled:opacity-60"
        title="Rewrite with AI"
      >
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />} Rewrite
      </button>
      <span className="mx-1 h-5 w-px bg-border" />
      <button className={btn} onClick={() => run("bold")} title="Bold"><Bold className="h-3.5 w-3.5" /></button>
      <button className={btn} onClick={() => run("italic")} title="Italic"><Italic className="h-3.5 w-3.5" /></button>
      <button className={btn} onClick={() => run("underline")} title="Underline"><Underline className="h-3.5 w-3.5" /></button>
      <span className="mx-1 h-5 w-px bg-border" />
      <button className={btn} onClick={() => run("insertUnorderedList")} title="Bulleted list"><List className="h-3.5 w-3.5" /></button>
      <button className={btn} onClick={() => run("insertOrderedList")} title="Numbered list"><ListOrdered className="h-3.5 w-3.5" /></button>
      <button className={btn} onClick={insertLink} title="Insert link"><LinkIcon className="h-3.5 w-3.5" /></button>
      <span className="mx-1 h-5 w-px bg-border" />
      <div className="relative">
        <button
          className={cn(btn, "w-auto px-1.5 gap-0.5")}
          onClick={() => setAlignOpen(v => !v)}
          title="Text alignment"
        >
          <AlignJustify className="h-3.5 w-3.5" />
          <ChevronDown className="h-3 w-3" />
        </button>
        {alignOpen && (
          <div className="absolute right-0 top-full mt-1 flex items-center gap-0.5 rounded-md border border-border bg-popover p-1 shadow-md">
            <button className={btn} onClick={() => { run("justifyLeft"); setAlignOpen(false); }} title="Align left"><AlignLeft className="h-3.5 w-3.5" /></button>
            <button className={btn} onClick={() => { run("justifyCenter"); setAlignOpen(false); }} title="Align center"><AlignCenter className="h-3.5 w-3.5" /></button>
            <button className={btn} onClick={() => { run("justifyRight"); setAlignOpen(false); }} title="Align right"><AlignRight className="h-3.5 w-3.5" /></button>
            <button className={btn} onClick={() => { run("justifyFull"); setAlignOpen(false); }} title="Justify"><AlignJustify className="h-3.5 w-3.5" /></button>
          </div>
        )}
      </div>
    </div>
  );
}