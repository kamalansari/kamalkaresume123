import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Bold } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { applyBoldToSelection } from "@/lib/inlineFormat";

type Props = {
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  placeholder?: string;
  className?: string;
};

export function FormattableTextarea({ value, onChange, rows = 4, placeholder, className }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [bar, setBar] = useState<{ top: number; left: number } | null>(null);

  const doBold = () => {
    const res = applyBoldToSelection(ref.current);
    if (!res) return;
    onChange(res.value);
    requestAnimationFrame(() => {
      const el = ref.current;
      if (el) {
        el.focus();
        el.setSelectionRange(res.start, res.end);
      }
    });
  };

  const updateBar = () => {
    const el = ref.current;
    if (!el) return setBar(null);
    const s = el.selectionStart ?? 0;
    const e = el.selectionEnd ?? 0;
    if (s === e || document.activeElement !== el) return setBar(null);
    // Approximate caret position by measuring against the textarea rect.
    const rect = el.getBoundingClientRect();
    // Use middle of selection vertically via line index from line breaks before selection start
    const before = el.value.slice(0, s);
    const line = before.split("\n").length - 1;
    const style = window.getComputedStyle(el);
    const lh = parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.4;
    const padTop = parseFloat(style.paddingTop) || 0;
    const top = rect.top + padTop + line * lh - el.scrollTop - 40;
    const left = rect.left + rect.width / 2 - 40;
    setBar({ top: Math.max(rect.top - 40, top), left });
  };

  useEffect(() => {
    const onSel = () => updateBar();
    document.addEventListener("selectionchange", onSel);
    window.addEventListener("scroll", onSel, true);
    window.addEventListener("resize", onSel);
    return () => {
      document.removeEventListener("selectionchange", onSel);
      window.removeEventListener("scroll", onSel, true);
      window.removeEventListener("resize", onSel);
    };
  }, []);

  return (
    <>
    <Textarea
      ref={ref}
      rows={rows}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      onBlur={() => setTimeout(() => setBar(null), 100)}
      onSelect={updateBar}
      onKeyDown={e => {
        if ((e.ctrlKey || e.metaKey) && (e.key === "b" || e.key === "B")) {
          e.preventDefault();
          doBold();
        }
      }}
      className={cn(className)}
    />
    {bar && typeof document !== "undefined" && createPortal(
      <div
        style={{ position: "fixed", top: bar.top, left: bar.left, zIndex: 50 }}
        className="flex items-center gap-1 rounded-md border border-border bg-popover px-1 py-1 shadow-md animate-in fade-in zoom-in-95"
        onMouseDown={e => e.preventDefault()}
      >
        <button
          type="button"
          onClick={doBold}
          className="inline-flex h-7 items-center gap-1 rounded px-2 text-xs font-medium hover:bg-accent hover:text-accent-foreground"
          title="Bold (Ctrl+B)"
        >
          <Bold className="h-3.5 w-3.5" /> Bold
        </button>
      </div>,
      document.body,
    )}
    </>
  );
}