import { useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  GripVertical,
  Plus,
  Trash2,
  Sparkles,
  Loader2,
  Wand2,
  History,
  TrendingUp,
  ChevronDown,
  Settings2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FormattableTextarea } from "./FormattableTextarea";
import { DateRangePicker } from "./MonthYearPicker";
import type { Experience } from "./types";
import { cn } from "@/lib/utils";

/** Strong action verbs grouped for the inserter. */
export const ACTION_VERBS: { group: string; verbs: string[] }[] = [
  { group: "Led & Owned", verbs: ["Led", "Spearheaded", "Directed", "Owned", "Drove", "Championed", "Orchestrated"] },
  { group: "Built & Shipped", verbs: ["Built", "Designed", "Engineered", "Launched", "Shipped", "Implemented", "Developed", "Architected"] },
  { group: "Improved", verbs: ["Improved", "Optimized", "Streamlined", "Accelerated", "Refactored", "Reduced", "Increased", "Boosted"] },
  { group: "Delivered", verbs: ["Delivered", "Achieved", "Generated", "Produced", "Secured", "Negotiated", "Closed"] },
  { group: "Collaborated", verbs: ["Partnered", "Collaborated", "Mentored", "Coached", "Facilitated", "Influenced", "Aligned"] },
  { group: "Analyzed", verbs: ["Analyzed", "Researched", "Evaluated", "Audited", "Measured", "Forecasted"] },
];

const WEAK_OPENERS = new Set([
  "responsible",
  "worked",
  "helped",
  "did",
  "was",
  "assisted",
  "tasked",
  "duties",
]);

function ensureActionVerb(line: string, fallback = "Drove"): string {
  const trimmed = line.trim().replace(/^[-•]\s*/, "");
  if (!trimmed) return trimmed;
  const first = trimmed.split(/\s+/)[0].toLowerCase().replace(/[^a-z]/g, "");
  if (WEAK_OPENERS.has(first)) {
    return `${fallback} ${trimmed.replace(/^\S+\s*/, "").replace(/^(for|to|with|on)\s+/i, "")}`.trim();
  }
  return trimmed;
}

/** Auto-strengthen every line with an action verb when missing. */
function autoActionVerbs(text: string, fallback?: string): string {
  const f = fallback && fallback.trim() ? fallback.trim() : "Drove";
  return text
    .split("\n")
    .map((l, i) => {
      if (!l.trim()) return l;
      // Rotate through custom verbs list if multiple provided (comma list handled by caller)
      return ensureActionVerb(l, f);
    })
    .join("\n");
}

/* ---------------- Custom verbs storage ---------------- */
const CUSTOM_VERBS_KEY = "rb.experience.customVerbs.v1";

type CustomVerbsState = { verbs: string[]; fallback: string };

function loadCustomVerbs(): CustomVerbsState {
  if (typeof window === "undefined") return { verbs: [], fallback: "Drove" };
  try {
    const raw = window.localStorage.getItem(CUSTOM_VERBS_KEY);
    if (!raw) return { verbs: [], fallback: "Drove" };
    const parsed = JSON.parse(raw);
    return {
      verbs: Array.isArray(parsed?.verbs) ? parsed.verbs.filter((v: unknown) => typeof v === "string") : [],
      fallback: typeof parsed?.fallback === "string" && parsed.fallback.trim() ? parsed.fallback : "Drove",
    };
  } catch {
    return { verbs: [], fallback: "Drove" };
  }
}

function saveCustomVerbs(s: CustomVerbsState) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CUSTOM_VERBS_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

const HISTORY_KEY = "rb.experience.history.v1";
const HISTORY_LIMIT = 20;

type HistorySnapshot = { at: number; label: string; experience: Experience[] };

function loadHistory(): HistorySnapshot[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(0, HISTORY_LIMIT) : [];
  } catch {
    return [];
  }
}

function saveHistory(list: HistorySnapshot[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(0, HISTORY_LIMIT)));
  } catch {
    /* ignore quota */
  }
}

export function ExperienceSection({
  experiences,
  setExperiences,
  updateExp,
  addExp,
  removeExp,
  rewriteWithAI,
  rewritingKey,
}: {
  experiences: Experience[];
  setExperiences: (next: Experience[]) => void;
  updateExp: (id: string, patch: Partial<Experience>) => void;
  addExp: () => void;
  removeExp: (id: string) => void;
  rewriteWithAI: (
    kind: "bullets" | "skills" | "education",
    text: string,
    ctx: Record<string, string | undefined>,
    key: string,
  ) => Promise<string | null>;
  rewritingKey: string | null;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const [customVerbs, setCustomVerbs] = useState<CustomVerbsState>(() => loadCustomVerbs());
  useEffect(() => {
    saveCustomVerbs(customVerbs);
  }, [customVerbs]);

  // History: snapshot whenever experiences change (debounced).
  const [history, setHistory] = useState<HistorySnapshot[]>(() => loadHistory());
  const lastSnap = useRef<string>("");
  useEffect(() => {
    const key = JSON.stringify(experiences);
    if (key === lastSnap.current) return;
    lastSnap.current = key;
    const t = setTimeout(() => {
      const label = experiences
        .map(e => `${e.title || "?"} @ ${e.company || "?"}`)
        .slice(0, 2)
        .join(", ") || "Empty";
      const next: HistorySnapshot[] = [
        { at: Date.now(), label, experience: experiences },
        ...loadHistory().filter(s => JSON.stringify(s.experience) !== key),
      ].slice(0, HISTORY_LIMIT);
      saveHistory(next);
      setHistory(next);
    }, 1500);
    return () => clearTimeout(t);
  }, [experiences]);

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = experiences.findIndex(x => x.id === active.id);
    const newIndex = experiences.findIndex(x => x.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    setExperiences(arrayMove(experiences, oldIndex, newIndex));
    toast.success("Reordered");
  };

  const restore = (snap: HistorySnapshot) => {
    setExperiences(snap.experience);
    toast.success("Experience history restored");
  };

  const ids = useMemo(() => experiences.map(e => e.id), [experiences]);

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
        <h3 className="font-display font-semibold">Experience</h3>
        <div className="flex items-center gap-2">
          <CustomVerbsMenu state={customVerbs} onChange={setCustomVerbs} />
          <HistoryMenu history={history} onRestore={restore} />
          <Button size="sm" variant="outline" onClick={addExp}>
            <Plus /> Add
          </Button>
        </div>
      </div>

      {experiences.length === 0 && (
        <div className="rounded-lg border border-dashed border-border bg-background p-6 text-center text-sm text-muted-foreground">
          No experience yet. Click <span className="font-medium text-foreground">Add</span> to log your first role.
        </div>
      )}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          <div className="space-y-4">
            {experiences.map((e, idx) => (
              <SortableExperienceItem
                key={e.id}
                index={idx}
                exp={e}
                customVerbs={customVerbs}
                onChange={patch => updateExp(e.id, patch)}
                onRemove={() => removeExp(e.id)}
                onRewrite={async () => {
                  const seed = e.bullets.trim() || `${e.title || "Role"} at ${e.company || "Company"}`;
                  const out = await rewriteWithAI(
                    "bullets",
                    seed,
                    { title: e.title, company: e.company },
                    `exp-${e.id}`,
                  );
                  if (out) {
                    updateExp(e.id, { bullets: out });
                    toast.success(e.bullets.trim() ? "Bullets rewritten" : "Bullets generated");
                  }
                }}
                isRewriting={rewritingKey === `exp-${e.id}`}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}

function HistoryMenu({
  history,
  onRestore,
}: {
  history: HistorySnapshot[];
  onRestore: (snap: HistorySnapshot) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="ghost" disabled={history.length <= 1}>
          <History /> History
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel>Recent versions</DropdownMenuLabel>
        {history.length === 0 && (
          <div className="px-2 py-3 text-xs text-muted-foreground">No history yet</div>
        )}
        {history.map((snap, i) => (
          <DropdownMenuItem
            key={snap.at}
            onClick={() => onRestore(snap)}
            className="flex flex-col items-start gap-0.5"
          >
            <span className="text-xs font-medium">
              {i === 0 ? "Current" : `Version ${history.length - i}`} ·{" "}
              {new Date(snap.at).toLocaleString()}
            </span>
            <span className="text-[11px] text-muted-foreground truncate w-full">{snap.label}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function SortableExperienceItem({
  exp,
  index,
  onChange,
  onRemove,
  onRewrite,
  isRewriting,
  customVerbs,
}: {
  exp: Experience;
  index: number;
  onChange: (patch: Partial<Experience>) => void;
  onRemove: () => void;
  onRewrite: () => void | Promise<void>;
  isRewriting: boolean;
  customVerbs: CustomVerbsState;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: exp.id,
  });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };

  const insertVerb = (verb: string) => {
    const lines = exp.bullets.split("\n");
    const empty = !exp.bullets.trim();
    if (empty) {
      onChange({ bullets: `${verb} ` });
    } else {
      lines.push(`${verb} `);
      onChange({ bullets: lines.join("\n") });
    }
  };

  const applyActionVerbs = () => {
    const next = autoActionVerbs(exp.bullets, customVerbs.fallback);
    if (next === exp.bullets) {
      toast("Bullets already lead with strong verbs");
    } else {
      onChange({ bullets: next });
      toast.success("Strengthened with action verbs");
    }
  };

  const appendAchievement = (line: string) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    const next = exp.bullets.trim() ? `${exp.bullets.trim()}\n${trimmed}` : trimmed;
    onChange({ bullets: next });
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="rounded-lg border border-border bg-background"
    >
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border bg-secondary/40 rounded-t-lg">
        <div className="flex items-center gap-2 min-w-0">
          <button
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing p-1 text-muted-foreground hover:text-foreground"
            aria-label="Drag to reorder"
            type="button"
          >
            <GripVertical className="h-4 w-4" />
          </button>
          <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            Role #{index + 1}
          </span>
          <span className="text-xs text-muted-foreground truncate hidden sm:inline">
            {exp.title || "Untitled"}
            {exp.company ? ` · ${exp.company}` : ""}
          </span>
        </div>
        <Button size="sm" variant="ghost" onClick={onRemove}>
          <Trash2 /> Remove
        </Button>
      </div>

      <div className="p-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs text-muted-foreground">Title</Label>
            <Input
              className="mt-1.5"
              value={exp.title}
              onChange={ev => onChange({ title: ev.target.value })}
              placeholder="Senior Product Designer"
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Company</Label>
            <Input
              className="mt-1.5"
              value={exp.company}
              onChange={ev => onChange({ company: ev.target.value })}
              placeholder="Stripe"
            />
          </div>
          <div className="col-span-2">
            <Label className="text-xs text-muted-foreground">Dates</Label>
            <div className="mt-1.5">
              <DateRangePicker
                value={exp.date}
                onChange={v => onChange({ date: v })}
                startLabel="Start"
                endLabel="End / Present"
              />
            </div>
          </div>
        </div>

        <div className="mt-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <Label className="text-xs text-muted-foreground">Bullets (one per line)</Label>
            <div className="flex items-center gap-1 flex-wrap">
              <ActionVerbMenu onPick={insertVerb} customVerbs={customVerbs.verbs} />
              <AchievementBuilder onAdd={appendAchievement} />
              <Button size="sm" variant="ghost" onClick={applyActionVerbs} disabled={!exp.bullets.trim()}>
                <Wand2 /> Strengthen
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={isRewriting || (!exp.title && !exp.company && !exp.bullets.trim())}
                onClick={() => onRewrite()}
              >
                {isRewriting ? <Loader2 className="animate-spin" /> : <Sparkles />}
                {exp.bullets.trim() ? "AI rewrite" : "AI generate"}
              </Button>
            </div>
          </div>
          <FormattableTextarea
            rows={4}
            className="mt-1.5"
            value={exp.bullets}
            onChange={v => onChange({ bullets: v })}
            onBlur={() => {
              if (!exp.bullets.trim()) return;
              const next = autoActionVerbs(exp.bullets, customVerbs.fallback);
              if (next !== exp.bullets) {
                onChange({ bullets: next });
                toast.success("Bullets auto-strengthened with action verbs");
              }
            }}
            placeholder="Led redesign of checkout flow, lifting conversion 18% across 14 markets."
          />
        </div>
      </div>
    </div>
  );
}

function ActionVerbMenu({ onPick, customVerbs }: { onPick: (verb: string) => void; customVerbs?: string[] }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="ghost">
          Action verb <ChevronDown className="h-3 w-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72 max-h-80 overflow-auto">
        {customVerbs && customVerbs.length > 0 && (
          <div className="py-1">
            <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-muted-foreground">
              My verbs
            </DropdownMenuLabel>
            <div className="flex flex-wrap gap-1 px-2 pb-1">
              {customVerbs.map(v => (
                <button
                  key={v}
                  type="button"
                  onClick={() => onPick(v)}
                  className="text-xs rounded-md border border-[var(--navy-light)] bg-[var(--navy-light)]/10 px-2 py-1 hover:bg-[var(--navy-light)]/20"
                >
                  {v}
                </button>
              ))}
            </div>
          </div>
        )}
        {ACTION_VERBS.map(g => (
          <div key={g.group} className="py-1">
            <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-muted-foreground">
              {g.group}
            </DropdownMenuLabel>
            <div className="flex flex-wrap gap-1 px-2 pb-1">
              {g.verbs.map(v => (
                <button
                  key={v}
                  type="button"
                  onClick={() => onPick(v)}
                  className="text-xs rounded-md border border-border bg-background px-2 py-1 hover:border-[var(--navy-light)] hover:text-[var(--navy-light)]"
                >
                  {v}
                </button>
              ))}
            </div>
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function AchievementBuilder({ onAdd }: { onAdd: (line: string) => void }) {
  const [open, setOpen] = useState(false);
  const [verb, setVerb] = useState("Increased");
  const [what, setWhat] = useState("");
  const [metric, setMetric] = useState("");
  const [impact, setImpact] = useState("");

  const preview = useMemo(() => {
    const parts = [verb, what.trim()].filter(Boolean).join(" ");
    const m = metric.trim();
    const i = impact.trim();
    let line = parts;
    if (m) line += ` by ${m}`;
    if (i) line += `, ${i}`;
    return line.replace(/\s+/g, " ").trim();
  }, [verb, what, metric, impact]);

  const reset = () => {
    setWhat("");
    setMetric("");
    setImpact("");
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button size="sm" variant="ghost">
          <TrendingUp /> Achievement
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Action verb</Label>
            <select
              className={cn(
                "mt-1 w-full h-9 rounded-md border border-border bg-background px-2 text-sm",
              )}
              value={verb}
              onChange={ev => setVerb(ev.target.value)}
            >
              {ACTION_VERBS.flatMap(g => g.verbs).map(v => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label className="text-xs">What you did</Label>
            <Input
              className="mt-1"
              value={what}
              onChange={ev => setWhat(ev.target.value)}
              placeholder="checkout conversion"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Metric</Label>
              <Input
                className="mt-1"
                value={metric}
                onChange={ev => setMetric(ev.target.value)}
                placeholder="18%"
              />
            </div>
            <div>
              <Label className="text-xs">Impact</Label>
              <Input
                className="mt-1"
                value={impact}
                onChange={ev => setImpact(ev.target.value)}
                placeholder="across 14 markets"
              />
            </div>
          </div>
          <div className="rounded-md border border-border bg-secondary/50 p-2 text-xs">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">
              Preview
            </div>
            {preview || <span className="text-muted-foreground">Start typing…</span>}
          </div>
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              variant="accent"
              disabled={!preview}
              onClick={() => {
                onAdd(preview);
                reset();
                setOpen(false);
                toast.success("Achievement added");
              }}
            >
              <Plus /> Add bullet
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}