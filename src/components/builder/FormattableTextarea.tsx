import { useRef } from "react";
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
  return (
    <Textarea
      ref={ref}
      rows={rows}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      onKeyDown={e => {
        if ((e.ctrlKey || e.metaKey) && (e.key === "b" || e.key === "B")) {
          const res = applyBoldToSelection(ref.current);
          if (res) {
            e.preventDefault();
            onChange(res.value);
            requestAnimationFrame(() => {
              const el = ref.current;
              if (el) el.setSelectionRange(res.start, res.end);
            });
          }
        }
      }}
      className={cn(className)}
    />
  );
}