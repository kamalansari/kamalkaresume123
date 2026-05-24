import { useCallback, useEffect, useRef, useState } from "react";
import { Bold, Italic, Underline, List } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  applyBoldToSelection,
  applyBulletToSelection,
  applyItalicToSelection,
  applyUnderlineToSelection,
} from "@/lib/inlineFormat";

type Props = {
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  placeholder?: string;
  className?: string;
};

type Apply = (el: HTMLTextAreaElement | null) => { value: string; start: number; end: number } | null;

export function FormattableTextarea({ value, onChange, rows = 4, placeholder, className }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [hasSelection, setHasSelection] = useState(false);

  const apply = useCallback((fn: Apply) => {
    const res = fn(ref.current);
    if (!res) return;
    onChange(res.value);
    requestAnimationFrame(() => {
      const el = ref.current;
      if (el) {
        el.focus();
        el.setSelectionRange(res.start, res.end);
        setHasSelection(res.end > res.start);
      }
    });
  }, [onChange]);

  const checkSelection = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setHasSelection((el.selectionEnd ?? 0) > (el.selectionStart ?? 0));
  }, []);

  useEffect(() => {
    const onDocSel = () => checkSelection();
    document.addEventListener("selectionchange", onDocSel);
    return () => document.removeEventListener("selectionchange", onDocSel);
  }, [checkSelection]);

  const btn = "h-7 w-7 inline-flex items-center justify-center rounded hover:bg-accent hover:text-accent-foreground text-foreground/80";

  return (
    <div ref={wrapRef} className="relative">
      {hasSelection && (
        <div
          className="absolute -top-9 left-0 z-20 flex items-center gap-0.5 rounded-md border bg-popover px-1 py-1 shadow-md"
          onMouseDown={e => e.preventDefault()}
        >
          <button type="button" title="Bold (Ctrl+B)" className={btn} onClick={() => apply(applyBoldToSelection)}>
            <Bold className="h-3.5 w-3.5" />
          </button>
          <button type="button" title="Italic (Ctrl+I)" className={btn} onClick={() => apply(applyItalicToSelection)}>
            <Italic className="h-3.5 w-3.5" />
          </button>
          <button type="button" title="Underline (Ctrl+U)" className={btn} onClick={() => apply(applyUnderlineToSelection)}>
            <Underline className="h-3.5 w-3.5" />
          </button>
          <span className="mx-0.5 h-4 w-px bg-border" />
          <button type="button" title="Bullet list" className={btn} onClick={() => apply(applyBulletToSelection)}>
            <List className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
      <Textarea
        ref={ref}
        rows={rows}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        onSelect={checkSelection}
        onMouseUp={checkSelection}
        onKeyUp={checkSelection}
        onBlur={() => setTimeout(checkSelection, 0)}
        onKeyDown={e => {
          const mod = e.ctrlKey || e.metaKey;
          const k = e.key.toLowerCase();
          if (mod && k === "b") { e.preventDefault(); apply(applyBoldToSelection); return; }
          if (mod && k === "i") { e.preventDefault(); apply(applyItalicToSelection); return; }
          if (mod && k === "u") { e.preventDefault(); apply(applyUnderlineToSelection); return; }
          if (e.altKey && !mod && k === "b") { e.preventDefault(); apply(applyBoldToSelection); return; }
          if (e.altKey && !mod && k === "l") { e.preventDefault(); apply(applyBulletToSelection); return; }
        }}
        className={cn(className)}
      />
    </div>
  );
}