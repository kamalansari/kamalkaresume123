import { useMemo, useState } from "react";
import { format, parse, isValid } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/** ATS-friendly month/year format, e.g. "Aug 2023". */
const MY_FORMAT = "MMM yyyy";

function parseMonthYear(value: string | undefined | null): Date | undefined {
  if (!value) return undefined;
  const v = value.trim();
  // Try "MMM yyyy", "MMMM yyyy", "MM/yyyy", "yyyy-MM", "yyyy".
  for (const fmt of [MY_FORMAT, "MMMM yyyy", "MM/yyyy", "yyyy-MM", "yyyy"]) {
    const d = parse(v, fmt, new Date());
    if (isValid(d)) return d;
  }
  return undefined;
}

function formatMY(d: Date | undefined) {
  return d ? format(d, MY_FORMAT) : "";
}

export function MonthYearPicker({
  value,
  onChange,
  placeholder = "Pick a date",
  disabled,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}) {
  const date = useMemo(() => parseMonthYear(value), [value]);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            "w-full h-9 justify-start text-left font-normal",
            !value && "text-muted-foreground",
            className,
          )}
        >
          <CalendarIcon className="mr-2 h-3.5 w-3.5 opacity-70" />
          {value || placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={date}
          onSelect={(d) => onChange(formatMY(d ?? undefined))}
          captionLayout="dropdown"
          fromYear={1960}
          toYear={new Date().getFullYear() + 8}
          initialFocus
          className={cn("p-3 pointer-events-auto")}
        />
        {value && (
          <div className="flex justify-end gap-2 border-t border-border p-2">
            <Button size="sm" variant="ghost" onClick={() => onChange("")}>Clear</Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

/**
 * Date range picker that writes a single ATS-friendly string into the form,
 * e.g. "Aug 2019 — May 2023" or "Aug 2019 — Present".
 */
export function DateRangePicker({
  value,
  onChange,
  allowPresent = true,
  startLabel = "Start",
  endLabel = "End",
}: {
  value: string;
  onChange: (v: string) => void;
  allowPresent?: boolean;
  startLabel?: string;
  endLabel?: string;
}) {
  // Split "A — B" / "A - B" / "A – B" into [start, end] strings.
  const [start, endRaw] = useMemo(() => {
    const parts = (value || "").split(/\s*[—–-]\s*/);
    return [parts[0] ?? "", parts.slice(1).join(" — ") ?? ""];
  }, [value]);
  const end = endRaw || "";
  const [present, setPresent] = useState(() => /present/i.test(end));

  const write = (s: string, e: string, pres: boolean) => {
    const right = pres ? "Present" : e;
    if (!s && !right) return onChange("");
    onChange(right ? `${s || ""} — ${right}`.trim() : (s || ""));
  };

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-[11px] text-muted-foreground">{startLabel}</Label>
          <MonthYearPicker value={start} onChange={(v) => write(v, end, present)} placeholder="Start month" />
        </div>
        <div className="space-y-1">
          <Label className="text-[11px] text-muted-foreground">{endLabel}</Label>
          <MonthYearPicker
            value={present ? "Present" : end}
            onChange={(v) => write(start, v, false)}
            placeholder={present ? "Present" : "End month"}
            disabled={present}
          />
        </div>
      </div>
      {allowPresent && (
        <label className="inline-flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
          <Checkbox
            checked={present}
            onCheckedChange={(c) => {
              const next = !!c;
              setPresent(next);
              write(start, next ? "" : end, next);
            }}
          />
          Currently here / In progress
        </label>
      )}
    </div>
  );
}