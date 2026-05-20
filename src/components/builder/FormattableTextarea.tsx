import { useRef } from "react";
import { Bold } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { applyBoldToSelection } from "@/lib/inlineFormat";
import { cn } from "@/lib/utils";

type Props = {
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  placeholder?: string;
  className?: string;
};

export function FormattableTextarea({ value, onChange, rows = 4, placeholder, className }: Props) {
  const ref = useRef<HTMLTextAreaElement | null>(null);

  const onBold = () => {
    const next = applyBoldToSelection(ref.current);
    if (!next) return;
    onChange(next.value);
    requestAnimationFrame(() => {
      const el = ref.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(next.start, next.end);
    });
  };

  return (
    <div className={cn("relative", className)}>
      <div className="absolute right-1.5 top-1.5 z-10">
        <button
          type="button"
          onMouseDown={e => e.preventDefault()}
          onClick={onBold}
          title="Bold selection (wraps in **…**)"
          className="inline-flex items-center gap-1 rounded-md border border-border bg-background/90 backdrop-blur px-1.5 h-6 text-[11px] font-medium text-muted-foreground hover:text-foreground hover:border-[var(--navy-light)]"
        >
          <Bold className="h-3 w-3" /> B
        </button>
      </div>
      <Textarea
        ref={ref}
        rows={rows}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="pr-12"
      />
    </div>
  );
}