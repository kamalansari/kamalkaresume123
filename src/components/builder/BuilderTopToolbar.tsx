import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { LayoutTemplate, ListOrdered, Palette, Check, Plus, GripVertical, X, AlignJustify, AlignLeft, AlignCenter, Bold, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Undo2, Redo2, PanelLeft, PanelRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, rectSortingStrategy, sortableKeyboardCoordinates, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { COLOR_PRESETS, FONT_PRESETS, SIDEBAR_ELIGIBLE, getSidebarSectionIds, templateHasSidebar, type CustomSection, type ResumeData, type SectionId, type TemplateId } from "./types";
import { parseSkillGroups } from "@/lib/parseSkills";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export type TemplateMeta = {
  id: TemplateId;
  label: string;
  desc: string;
  cols: 1 | 2;
};

export const ALL_TEMPLATES: TemplateMeta[] = [
  { id: "classic", label: "Classic", desc: "Timeless centered", cols: 1 },
  { id: "professional", label: "Professional", desc: "Uppercase formal", cols: 1 },
  { id: "executive", label: "Executive", desc: "Authoritative band", cols: 1 },
  { id: "minimal", label: "Minimal", desc: "Quiet & spacious", cols: 1 },
  { id: "modern", label: "Modern", desc: "Bold header bar", cols: 1 },
  { id: "technical", label: "Technical", desc: "Slate engineering band", cols: 1 },
  { id: "academic", label: "Academic", desc: "Burgundy scholarly", cols: 1 },
  { id: "editorial", label: "Editorial", desc: "Magazine serif", cols: 1 },
  { id: "noir", label: "Noir", desc: "Black header, sharp", cols: 1 },
  { id: "luxe", label: "Luxe", desc: "Gold accents, premium", cols: 1 },
  { id: "monochrome", label: "Monochrome", desc: "All black & white", cols: 1 },
  { id: "two-column", label: "Two column", desc: "Dark sidebar", cols: 2 },
  { id: "sidebar-right", label: "Sidebar right", desc: "Right rail accent", cols: 2 },
  { id: "iconic", label: "Iconic", desc: "Teal sidebar, icons", cols: 2 },
  { id: "creative", label: "Creative", desc: "Violet right rail", cols: 2 },
  { id: "aurora", label: "Aurora", desc: "Indigo gradient rail", cols: 2 },
  { id: "startup", label: "Startup", desc: "Orange compact two-col", cols: 2 },
  { id: "novoresume", label: "Novoresume", desc: "Blue contact band, right rail", cols: 2 },
];

const BG_PRESETS = [
  { id: "white", label: "White", hex: "#ffffff" },
  { id: "ivory", label: "Ivory", hex: "#fbf9f4" },
  { id: "stone", label: "Stone", hex: "#f5f4f0" },
  { id: "sky", label: "Sky", hex: "#f1f5fb" },
  { id: "mint", label: "Mint", hex: "#f1f7f3" },
];

const SECTION_LABELS: Record<SectionId, string> = {
  summary: "Summary",
  experience: "Experience",
  education: "Education",
  skills: "Skills",
  projects: "Projects",
  certifications: "Certifications",
  awards: "Awards",
  languages: "Languages",
};

// Preview-only accent overrides so the template picker thumbnails show
// each template's signature color even before the user picks one.
const TEMPLATE_THUMB_ACCENT: Partial<Record<TemplateId, string>> = {
  minimal: "#1f1f1f",
  iconic: "#0d8a8a",
  creative: "#7c3aed",
  technical: "#334155",
  academic: "#7a1f3d",
  startup: "#ea580c",
  corporate: "#0f2a52",
  luxe: "#a17a2d",
  noir: "#0a0a0a",
  editorial: "#1c1c1c",
  aurora: "#5b6cff",
  monochrome: "#2a2a2a",
};

function Thumb({ t, accent, active }: { t: TemplateMeta; accent: string; active: boolean }) {
  const id = t.id;
  accent = TEMPLATE_THUMB_ACCENT[id] ?? accent;
  const inner = (() => {
    if (id === "aurora") {
      return (
        <div className="h-full w-full flex">
          <div className="flex-1 p-1 space-y-1">
            <div className="h-1 w-3/4 rounded bg-foreground/30" />
            <div className="h-0.5 w-full rounded bg-foreground/10" />
            <div className="h-0.5 w-5/6 rounded bg-foreground/10" />
            <div className="h-0.5 w-2/3 rounded bg-foreground/10" />
          </div>
          <div
            className="w-1/3 h-full p-1 space-y-1"
            style={{ background: "linear-gradient(180deg, #5b6cff 0%, #a855f7 60%, #ec4899 100%)" }}
          >
            <div className="h-1 w-3/4 rounded bg-white/85" />
            <div className="h-0.5 w-full rounded bg-white/50" />
            <div className="h-0.5 w-2/3 rounded bg-white/50" />
          </div>
        </div>
      );
    }
    if (id === "noir") {
      return (
        <div className="h-full w-full">
          <div className="h-1/3 w-full p-1 flex items-end" style={{ background: "#0a0a0a" }}>
            <div className="h-1 w-2/3 rounded" style={{ background: "#f5d77a" }} />
          </div>
          <div className="p-1 space-y-1">
            <div className="h-0.5 w-full rounded bg-foreground/15" />
            <div className="h-0.5 w-5/6 rounded bg-foreground/15" />
            <div className="h-0.5 w-2/3 rounded bg-foreground/15" />
          </div>
        </div>
      );
    }
    if (id === "luxe") {
      return (
        <div className="h-full w-full p-1.5 flex flex-col items-center">
          <div className="h-1 w-2/3 rounded" style={{ background: "#a17a2d" }} />
          <div className="mt-0.5 h-0.5 w-1/2 rounded bg-foreground/30" />
          <div className="mt-1 h-px w-full" style={{ background: "linear-gradient(90deg, transparent, #a17a2d, transparent)" }} />
          <div className="mt-1 self-stretch space-y-1">
            <div className="h-0.5 w-full rounded bg-foreground/10" />
            <div className="h-0.5 w-5/6 rounded bg-foreground/10" />
            <div className="h-0.5 w-3/4 rounded bg-foreground/10" />
          </div>
        </div>
      );
    }
    if (id === "editorial") {
      return (
        <div className="h-full w-full p-1.5 flex flex-col">
          <div className="font-serif italic text-[7px] leading-none text-foreground/80">Aa</div>
          <div className="mt-0.5 h-1 w-2/3 rounded bg-foreground/80" />
          <div className="mt-0.5 h-0.5 w-1/3 rounded bg-foreground/30" />
          <div className="mt-1 h-px w-full bg-foreground/30" />
          <div className="mt-1 space-y-1">
            <div className="h-0.5 w-full rounded bg-foreground/10" />
            <div className="h-0.5 w-5/6 rounded bg-foreground/10" />
            <div className="h-0.5 w-3/4 rounded bg-foreground/10" />
          </div>
        </div>
      );
    }
    if (id === "monochrome") {
      return (
        <div className="h-full w-full p-1.5 flex flex-col">
          <div className="h-1 w-1/2 rounded bg-foreground" />
          <div className="mt-0.5 h-0.5 w-1/3 rounded bg-foreground/50" />
          <div className="mt-1 h-px w-full bg-foreground/40" />
          <div className="mt-1 space-y-1">
            <div className="h-0.5 w-full rounded bg-foreground/20" />
            <div className="h-0.5 w-5/6 rounded bg-foreground/20" />
            <div className="h-0.5 w-3/4 rounded bg-foreground/20" />
          </div>
        </div>
      );
    }
    if (id === "two-column" || id === "fresher" || id === "iconic") {
      const cream = id === "fresher";
      return (
        <div className="h-full w-full flex">
          <div className="w-1/3 h-full p-1 space-y-1" style={{ background: cream ? "#f4f3ef" : accent }}>
            <div className="h-1.5 w-3/4 rounded" style={{ background: cream ? accent : "rgba(255,255,255,0.85)" }} />
            <div className="h-0.5 w-full rounded" style={{ background: cream ? "rgba(0,0,0,0.12)" : "rgba(255,255,255,0.5)" }} />
            <div className="h-0.5 w-2/3 rounded" style={{ background: cream ? "rgba(0,0,0,0.12)" : "rgba(255,255,255,0.5)" }} />
          </div>
          <div className="flex-1 p-1 space-y-1">
            <div className="h-1 w-3/4 rounded bg-foreground/30" />
            <div className="h-0.5 w-full rounded bg-foreground/10" />
            <div className="h-0.5 w-5/6 rounded bg-foreground/10" />
            <div className="h-0.5 w-2/3 rounded bg-foreground/10" />
          </div>
        </div>
      );
    }
    if (id === "sidebar-right" || id === "contemporary" || id === "creative") {
      return (
        <div className="h-full w-full flex">
          <div className="flex-1 p-1 space-y-1">
            <div className="h-1 w-3/4 rounded bg-foreground/30" />
            <div className="h-0.5 w-full rounded bg-foreground/10" />
            <div className="h-0.5 w-5/6 rounded bg-foreground/10" />
            <div className="h-0.5 w-2/3 rounded bg-foreground/10" />
          </div>
          <div className="w-1/3 h-full p-1 space-y-1" style={{ background: accent }}>
            <div className="h-1 w-3/4 rounded bg-white/80" />
            <div className="h-0.5 w-full rounded bg-white/40" />
          </div>
        </div>
      );
    }
    if (id === "compact-two" || id === "startup") {
      return (
        <div className="h-full w-full flex">
          <div className="w-1/3 h-full p-1 space-y-1" style={{ background: "#f4f3ef" }}>
            <div className="h-1 w-3/4 rounded" style={{ background: accent }} />
            <div className="h-0.5 w-full rounded bg-foreground/15" />
          </div>
          <div className="flex-1 p-1 space-y-1">
            <div className="h-0.5 w-full rounded bg-foreground/10" />
            <div className="h-0.5 w-5/6 rounded bg-foreground/10" />
            <div className="h-0.5 w-3/4 rounded bg-foreground/10" />
          </div>
        </div>
      );
    }
    if (id === "modern" || id === "executive" || id === "bold" || id === "technical") {
      const exec = id === "executive" || id === "bold" || id === "technical";
      return (
        <div className="h-full w-full">
          <div className="h-1/4 w-full p-1 flex items-end" style={{ background: accent, borderBottom: exec ? "2px solid rgba(0,0,0,0.4)" : undefined }}>
            <div className="h-1 w-2/3 rounded bg-white/80" />
          </div>
          <div className="p-1 space-y-1">
            <div className="h-0.5 w-full rounded bg-foreground/10" />
            <div className="h-0.5 w-5/6 rounded bg-foreground/10" />
            <div className="h-0.5 w-2/3 rounded bg-foreground/10" />
          </div>
        </div>
      );
    }
    if (id === "minimal") {
      return (
        <div className="h-full w-full p-1.5 flex flex-col">
          <div className="h-1 w-1/2 rounded bg-foreground/80" />
          <div className="mt-0.5 h-0.5 w-1/3 rounded bg-foreground/30" />
          <div className="mt-1 h-px w-full bg-foreground/15" />
          <div className="mt-1 space-y-1">
            <div className="h-0.5 w-full rounded bg-foreground/10" />
            <div className="h-0.5 w-5/6 rounded bg-foreground/10" />
            <div className="h-0.5 w-3/4 rounded bg-foreground/10" />
          </div>
        </div>
      );
    }
    // classic, professional, elegant
    const pro = id === "professional" || id === "corporate" || id === "academic";
    return (
      <div className="h-full w-full p-1.5 flex flex-col items-center">
        <div className={cn("h-1 rounded", pro ? "w-3/4" : "w-2/3")} style={{ background: accent }} />
        <div className="mt-0.5 h-0.5 w-1/2 rounded bg-foreground/30" />
        <div className="mt-1 h-px w-full" style={{ background: accent, opacity: 0.4 }} />
        <div className="mt-1 self-stretch space-y-1">
          <div className="h-0.5 w-full rounded bg-foreground/10" />
          <div className="h-0.5 w-5/6 rounded bg-foreground/10" />
          <div className="h-0.5 w-3/4 rounded bg-foreground/10" />
        </div>
      </div>
    );
  })();
  return (
    <div className={cn("aspect-[3/4] w-full rounded-md bg-white border-2 overflow-hidden relative transition", active ? "border-primary shadow-md" : "border-border hover:border-foreground/40")}>
      {inner}
      {active && (
        <div className="absolute bottom-1 right-1 h-5 w-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow">
          <Check className="h-3 w-3" />
        </div>
      )}
    </div>
  );
}

function TemplatesGrid({ data, onPick, filter }: { data: ResumeData; onPick: (id: TemplateId) => void; filter: "all" | 1 | 2 }) {
  const list = ALL_TEMPLATES.filter(t => filter === "all" ? true : t.cols === filter);
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {list.map(t => (
        <button key={t.id} onClick={() => onPick(t.id)} className="text-left group">
          <Thumb t={t} accent={data.accentHex} active={data.template === t.id} />
          <div className="mt-1.5 text-xs font-medium">{t.label}</div>
          {data.template === t.id ? (
            <div className="text-[10px] text-primary font-medium">Active</div>
          ) : (
            <div className="text-[10px] text-muted-foreground">{t.desc}</div>
          )}
        </button>
      ))}
    </div>
  );
}

export function TemplatesPopover({ data, onPick }: { data: ResumeData; onPick: (id: TemplateId) => void }) {
  const counts = {
    all: ALL_TEMPLATES.length,
    one: ALL_TEMPLATES.filter(t => t.cols === 1).length,
    two: ALL_TEMPLATES.filter(t => t.cols === 2).length,
  };
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button id="builder-templates-trigger" variant="outline" size="sm" className="h-8">
          <LayoutTemplate className="h-4 w-4" /> <span className="hidden sm:inline">Templates</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(92vw,640px)] max-h-[70vh] overflow-y-auto p-3">
        <Tabs defaultValue="all">
          <TabsList>
            <TabsTrigger value="all">All <span className="ml-1.5 text-xs opacity-70">{counts.all}</span></TabsTrigger>
            <TabsTrigger value="1">Single Column <span className="ml-1.5 text-xs opacity-70">{counts.one}</span></TabsTrigger>
            <TabsTrigger value="2">Double Column <span className="ml-1.5 text-xs opacity-70">{counts.two}</span></TabsTrigger>
          </TabsList>
          <TabsContent value="all" className="mt-3"><TemplatesGrid data={data} onPick={onPick} filter="all" /></TabsContent>
          <TabsContent value="1" className="mt-3"><TemplatesGrid data={data} onPick={onPick} filter={1} /></TabsContent>
          <TabsContent value="2" className="mt-3"><TemplatesGrid data={data} onPick={onPick} filter={2} /></TabsContent>
        </Tabs>
      </PopoverContent>
    </Popover>
  );
}

function SortableRow({ id, onRemove, onUp, onDown, onLeft, onRight, canUp, canDown, canLeft, canRight, sidebarMode, onToggleSidebar }: {
  id: SectionId;
  onRemove: () => void;
  onUp: () => void;
  onDown: () => void;
  onLeft: () => void;
  onRight: () => void;
  canUp: boolean;
  canDown: boolean;
  canLeft: boolean;
  canRight: boolean;
  // sidebarMode: "off" = template has no sidebar (hide control),
  //              "main" = section is in main column,
  //              "sidebar" = section is in sidebar.
  // null when this section is not eligible for the sidebar.
  sidebarMode: "off" | "main" | "sidebar" | null;
  onToggleSidebar: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style: React.CSSProperties = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.6 : 1 };
  return (
    <div ref={setNodeRef} style={style} className="group flex items-center gap-1.5 rounded-md border border-border bg-background px-2 py-2 text-sm">
      <button {...attributes} {...listeners} className="cursor-grab touch-none text-muted-foreground hover:text-foreground" aria-label="Drag">
        <GripVertical className="h-4 w-4" />
      </button>
      <span className="flex-1 font-medium truncate">{SECTION_LABELS[id]}</span>
      {sidebarMode !== "off" && sidebarMode !== null && (
        <button
          onClick={onToggleSidebar}
          title={sidebarMode === "sidebar" ? "Move to main column" : "Move to sidebar"}
          aria-label={sidebarMode === "sidebar" ? "Move to main column" : "Move to sidebar"}
          aria-pressed={sidebarMode === "sidebar"}
          className={cn(
            "h-6 w-6 inline-flex items-center justify-center rounded hover:bg-muted",
            sidebarMode === "sidebar" ? "text-primary" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {sidebarMode === "sidebar" ? <PanelLeft className="h-3.5 w-3.5" /> : <PanelRight className="h-3.5 w-3.5" />}
        </button>
      )}
      <button onClick={onLeft} disabled={!canLeft} className="h-6 w-6 inline-flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 disabled:hover:bg-transparent" aria-label="Move left">
        <ChevronLeft className="h-3.5 w-3.5" />
      </button>
      <button onClick={onRight} disabled={!canRight} className="h-6 w-6 inline-flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 disabled:hover:bg-transparent" aria-label="Move right">
        <ChevronRight className="h-3.5 w-3.5" />
      </button>
      <button onClick={onUp} disabled={!canUp} className="h-6 w-6 inline-flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 disabled:hover:bg-transparent" aria-label="Move up">
        <ChevronUp className="h-3.5 w-3.5" />
      </button>
      <button onClick={onDown} disabled={!canDown} className="h-6 w-6 inline-flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 disabled:hover:bg-transparent" aria-label="Move down">
        <ChevronDown className="h-3.5 w-3.5" />
      </button>
      <button onClick={onRemove} className="h-6 w-6 inline-flex items-center justify-center rounded text-muted-foreground hover:text-destructive hover:bg-muted" aria-label="Remove section">
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export function SectionsPopover({ data, onUpdate, onAdd, onRemove, onToggleSidebar, onAddCustom, onUpdateCustom, onRemoveCustom, onReorderCustom, onUndo, onRedo, canUndo, canRedo }: {
  data: ResumeData;
  onUpdate: (order: SectionId[]) => void;
  onAdd: (id: SectionId) => void;
  onRemove: (id: SectionId) => void;
  onToggleSidebar: (id: SectionId) => void;
  onAddCustom: () => void;
  onUpdateCustom: (id: string, patch: Partial<CustomSection>) => void;
  onRemoveCustom: (id: string) => void;
  onReorderCustom: (next: CustomSection[]) => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const onEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const a = data.sectionOrder.indexOf(active.id as SectionId);
    const b = data.sectionOrder.indexOf(over.id as SectionId);
    if (a < 0 || b < 0) return;
    onUpdate(arrayMove(data.sectionOrder, a, b));
  };
  const available: SectionId[] = ["summary","experience","education","skills","projects","certifications","awards","languages"];
  const missing = available.filter(id => !data.sectionOrder.includes(id));
  const move = (from: number, to: number) => {
    if (to < 0 || to >= data.sectionOrder.length) return;
    onUpdate(arrayMove(data.sectionOrder, from, to));
  };
  const customs = data.customSections ?? [];
  const onCustomEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const a = customs.findIndex(c => c.id === active.id);
    const b = customs.findIndex(c => c.id === over.id);
    if (a < 0 || b < 0) return;
    onReorderCustom(arrayMove(customs, a, b));
  };
  const moveCustom = (from: number, to: number) => {
    if (to < 0 || to >= customs.length) return;
    onReorderCustom(arrayMove(customs, from, to));
  };
  const hasSidebar = templateHasSidebar(data.template);
  const sidebarIds = new Set(getSidebarSectionIds(data));
  const eligible = new Set(SIDEBAR_ELIGIBLE);
  const sidebarModeFor = (id: SectionId): "off" | "main" | "sidebar" | null => {
    if (!hasSidebar) return "off";
    if (!eligible.has(id)) return null;
    return sidebarIds.has(id) ? "sidebar" : "main";
  };
  const sidebarSide: "left" | "right" | null = !hasSidebar
    ? null
    : (data.template === "sidebar-right" || data.template === "contemporary")
      ? "right"
      : "left";
  const colOf = (id: SectionId): "sidebar" | "main" =>
    hasSidebar && sidebarIds.has(id) ? "sidebar" : "main";
  const findSameColPrev = (i: number): number => {
    if (!hasSidebar) return i - 1;
    const target = colOf(data.sectionOrder[i]);
    for (let j = i - 1; j >= 0; j--) {
      if (colOf(data.sectionOrder[j]) === target) return j;
    }
    return -1;
  };
  const findSameColNext = (i: number): number => {
    if (!hasSidebar) return i + 1 < data.sectionOrder.length ? i + 1 : -1;
    const target = colOf(data.sectionOrder[i]);
    for (let j = i + 1; j < data.sectionOrder.length; j++) {
      if (colOf(data.sectionOrder[j]) === target) return j;
    }
    return -1;
  };
  const canMoveLeft = (id: SectionId): boolean => {
    if (!hasSidebar) return data.sectionOrder.indexOf(id) > 0;
    if (!eligible.has(id)) return false;
    const cur = colOf(id);
    // left arrow targets whatever column is visually on the left
    const targetCol = sidebarSide === "left" ? "sidebar" : "main";
    return cur !== targetCol;
  };
  const canMoveRight = (id: SectionId): boolean => {
    if (!hasSidebar) {
      const i = data.sectionOrder.indexOf(id);
      return i >= 0 && i < data.sectionOrder.length - 1;
    }
    if (!eligible.has(id)) return false;
    const cur = colOf(id);
    const targetCol = sidebarSide === "left" ? "main" : "sidebar";
    return cur !== targetCol;
  };
  const handleLeft = (i: number) => {
    const id = data.sectionOrder[i];
    if (!hasSidebar) { move(i, i - 1); return; }
    if (canMoveLeft(id)) onToggleSidebar(id);
  };
  const handleRight = (i: number) => {
    const id = data.sectionOrder[i];
    if (!hasSidebar) { move(i, i + 1); return; }
    if (canMoveRight(id)) onToggleSidebar(id);
  };
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8">
          <ListOrdered className="h-4 w-4" /> <span className="hidden sm:inline">Sections</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[440px] max-h-[75vh] overflow-y-auto p-4">
        <div className="flex items-center justify-between mb-2.5 gap-2">
          <div className="text-[11px] font-semibold tracking-wider text-foreground/80 uppercase">Active sections</div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onUndo}
              disabled={!canUndo}
              title="Undo (Ctrl+Z)"
              aria-label="Undo"
              className="h-6 w-6 inline-flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 disabled:hover:bg-transparent"
            >
              <Undo2 className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={onRedo}
              disabled={!canRedo}
              title="Redo (Ctrl+Shift+Z)"
              aria-label="Redo"
              className="h-6 w-6 inline-flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 disabled:hover:bg-transparent"
            >
              <Redo2 className="h-3.5 w-3.5" />
            </button>
            <span className="ml-1 text-[11px] text-muted-foreground">{data.sectionOrder.length}/{available.length}</span>
          </div>
        </div>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onEnd}>
          <SortableContext items={data.sectionOrder} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-1 gap-2">
              {data.sectionOrder.map((id, i) => (
                <SortableRow
                  key={id}
                  id={id}
                  onRemove={() => onRemove(id)}
                  onLeft={() => handleLeft(i)}
                  onRight={() => handleRight(i)}
                  onUp={() => { const j = findSameColPrev(i); if (j >= 0) move(i, j); }}
                  onDown={() => { const j = findSameColNext(i); if (j >= 0) move(i, j); }}
                  canLeft={canMoveLeft(id)}
                  canRight={canMoveRight(id)}
                  canUp={findSameColPrev(i) >= 0}
                  canDown={findSameColNext(i) >= 0}
                  sidebarMode={sidebarModeFor(id)}
                  onToggleSidebar={() => onToggleSidebar(id)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
        <div className="mt-5 mb-2.5 flex items-center justify-between">
          <div className="text-[11px] font-semibold tracking-wider text-foreground/80 uppercase">Custom sections</div>
          <button onClick={onAddCustom} className="text-[11px] font-medium text-primary hover:underline inline-flex items-center gap-1">
            <Plus className="h-3 w-3" /> Add custom
          </button>
        </div>
        {customs.length === 0 ? (
          <div className="text-[11px] text-muted-foreground border border-dashed border-border rounded-md px-3 py-3 text-center">
            Create your own sections — e.g. Volunteering, Publications, Hobbies.
          </div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onCustomEnd}>
            <SortableContext items={customs.map(c => c.id)} strategy={rectSortingStrategy}>
              <div className="grid grid-cols-1 gap-2">
                {customs.map((c, i) => (
                  <CustomSortableCard
                    key={c.id}
                    section={c}
                    onChange={(patch) => onUpdateCustom(c.id, patch)}
                    onRemove={() => onRemoveCustom(c.id)}
                    onUp={() => moveCustom(i, i - 1)}
                    onDown={() => moveCustom(i, i + 1)}
                    canUp={i > 0}
                    canDown={i < customs.length - 1}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
        {missing.length > 0 && (
          <>
            <div className="mt-5 mb-2.5 text-[11px] font-semibold tracking-wider text-foreground/80 uppercase">Add to resume</div>
            <div className="grid grid-cols-2 gap-2">
              {missing.map(id => (
                <button
                  key={id}
                  onClick={() => onAdd(id)}
                  className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2.5 text-sm font-medium text-foreground/90 hover:border-foreground/40 hover:bg-muted/50 transition"
                >
                  <Plus className="h-4 w-4 text-muted-foreground" /> {SECTION_LABELS[id]}
                </button>
              ))}
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}

function CustomSortableCard({ section, onChange, onRemove, onUp, onDown, canUp, canDown }: {
  section: CustomSection;
  onChange: (patch: Partial<CustomSection>) => void;
  onRemove: () => void;
  onUp: () => void;
  onDown: () => void;
  canUp: boolean;
  canDown: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: section.id });
  const style: React.CSSProperties = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.6 : 1 };
  return (
    <div ref={setNodeRef} style={style} className="rounded-md border border-border bg-background p-2 space-y-2">
      <div className="flex items-center gap-1.5">
        <button {...attributes} {...listeners} className="cursor-grab touch-none text-muted-foreground hover:text-foreground" aria-label="Drag">
          <GripVertical className="h-4 w-4" />
        </button>
        <input
          value={section.title}
          onChange={(e) => onChange({ title: e.target.value })}
          placeholder="Section title"
          className="flex-1 h-7 rounded border border-input bg-background px-2 text-sm font-medium focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <button onClick={onUp} disabled={!canUp} className="h-6 w-6 inline-flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30" aria-label="Move up">
          <ChevronUp className="h-3.5 w-3.5" />
        </button>
        <button onClick={onDown} disabled={!canDown} className="h-6 w-6 inline-flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30" aria-label="Move down">
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <button
              className="h-6 w-6 inline-flex items-center justify-center rounded text-muted-foreground hover:text-destructive hover:bg-muted"
              aria-label="Remove custom section"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete custom section?</AlertDialogTitle>
              <AlertDialogDescription>
                {section.title?.trim()
                  ? <>This will permanently remove <span className="font-medium text-foreground">"{section.title.trim()}"</span> and its content from your resume.</>
                  : "This will permanently remove this custom section and its content from your resume."}
                {" "}You can undo this from the Sections panel.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={onRemove} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Delete section
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
      <textarea
        value={section.content}
        onChange={(e) => onChange({ content: e.target.value })}
        placeholder="Add details. Press Enter for new lines. Use **bold** for emphasis."
        rows={3}
        className="w-full rounded border border-input bg-background px-2 py-1.5 text-xs leading-relaxed focus:outline-none focus:ring-1 focus:ring-ring resize-y"
      />
    </div>
  );
}

export function StylePopover({ data, onPatch }: { data: ResumeData; onPatch: (p: Partial<ResumeData>) => void }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8">
          <Palette className="h-4 w-4" /> <span className="hidden sm:inline">Style</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-3 space-y-4">
        <div>
          <Label className="text-xs text-muted-foreground">Accent color</Label>
          <div className="mt-2 flex flex-wrap gap-2">
            {COLOR_PRESETS.map(c => (
              <button key={c.id} title={c.label} onClick={() => onPatch({ accentHex: c.hex })}
                className={cn("h-7 w-7 rounded-full border-2 transition-transform hover:scale-110", data.accentHex === c.hex ? "border-foreground ring-2 ring-foreground/20" : "border-white shadow-sm")}
                style={{ background: c.hex }} />
            ))}
            <label className="h-7 w-7 rounded-full border-2 border-dashed border-border flex items-center justify-center cursor-pointer overflow-hidden">
              <input type="color" value={data.accentHex} onChange={e => onPatch({ accentHex: e.target.value })} className="h-10 w-10 cursor-pointer border-0 bg-transparent p-0" />
            </label>
          </div>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Background</Label>
          <div className="mt-2 flex flex-wrap gap-2">
            {BG_PRESETS.map(c => (
              <button key={c.id} title={c.label} onClick={() => onPatch({ bgHex: c.hex })}
                className={cn("h-7 w-7 rounded-full border-2 transition-transform hover:scale-110", data.bgHex === c.hex ? "border-foreground ring-2 ring-foreground/20" : "border-border")}
                style={{ background: c.hex }} />
            ))}
            <label className="h-7 w-7 rounded-full border-2 border-dashed border-border flex items-center justify-center cursor-pointer overflow-hidden">
              <input type="color" value={data.bgHex} onChange={e => onPatch({ bgHex: e.target.value })} className="h-10 w-10 cursor-pointer border-0 bg-transparent p-0" />
            </label>
          </div>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Font</Label>
          <select value={data.fontId} onChange={e => onPatch({ fontId: e.target.value })}
            className="mt-1.5 w-full h-9 rounded-md border border-input bg-background px-3 text-sm">
            {FONT_PRESETS.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
          </select>
        </div>
        <div>
          <div className="flex items-center justify-between">
            <Label className="text-xs text-muted-foreground">Font size</Label>
            <span className="text-xs tabular-nums text-muted-foreground">{data.fontSize.toFixed(1)} pt</span>
          </div>
          <Slider className="mt-2" min={9} max={13} step={0.5} value={[data.fontSize]} onValueChange={([v]) => onPatch({ fontSize: v })} />
        </div>
        <div>
          <div className="flex items-center justify-between">
            <Label className="text-xs text-muted-foreground">Line height</Label>
            <span className="text-xs tabular-nums text-muted-foreground">{(data.lineHeight ?? 1.45).toFixed(2)}</span>
          </div>
          <Slider className="mt-2" min={1.1} max={1.8} step={0.05} value={[data.lineHeight ?? 1.45]} onValueChange={([v]) => onPatch({ lineHeight: v })} />
        </div>
        <div>
          <div className="flex items-center justify-between">
            <Label className="text-xs text-muted-foreground">Section spacing</Label>
            <span className="text-xs tabular-nums text-muted-foreground">{data.sectionSpacing ?? 16} px</span>
          </div>
          <Slider className="mt-2" min={6} max={28} step={1} value={[data.sectionSpacing ?? 16]} onValueChange={([v]) => onPatch({ sectionSpacing: v })} />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Skill separator</Label>
          <div className="mt-2 flex gap-2">
            <button onClick={() => onPatch({ skillSeparator: "|" })}
              className={cn("flex-1 inline-flex items-center justify-center gap-1.5 rounded-md border h-9 px-3 text-xs font-medium",
                (data.skillSeparator ?? "|") === "|" ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-foreground/40")}>
              Pipe&nbsp;|
            </button>
            <button onClick={() => onPatch({ skillSeparator: "," })}
              className={cn("flex-1 inline-flex items-center justify-center gap-1.5 rounded-md border h-9 px-3 text-xs font-medium",
                data.skillSeparator === "," ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-foreground/40")}>
              Comma&nbsp;,
            </button>
          </div>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Skills columns (desktop / print)</Label>
          <div className="mt-2 grid grid-cols-5 gap-1.5">
            {([
              { v: undefined, label: "Auto" },
              { v: 1, label: "1" },
              { v: 2, label: "2" },
              { v: 3, label: "3" },
              { v: 4, label: "4" },
            ] as const).map((opt) => {
              const active = (data.skillsColumns ?? undefined) === opt.v;
              return (
                <button
                  key={String(opt.v)}
                  onClick={() => onPatch({ skillsColumns: opt.v })}
                  className={cn(
                    "inline-flex items-center justify-center rounded-md border h-9 px-2 text-xs font-medium",
                    active ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-foreground/40",
                  )}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Skills columns (mobile preview)</Label>
          <div className="mt-2 grid grid-cols-2 gap-1.5">
            {[1, 2].map((n) => {
              const active = (data.skillsColumnsMobile ?? data.mobileSkillsColumns ?? 2) === n;
              return (
                <button
                  key={n}
                  onClick={() => onPatch({ skillsColumnsMobile: n, mobileSkillsColumns: n })}
                  className={cn(
                    "inline-flex items-center justify-center rounded-md border h-9 px-3 text-xs font-medium",
                    active ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-foreground/40",
                  )}
                >
                  {n} column{n > 1 ? "s" : ""}
                </button>
              );
            })}
          </div>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Skills view</Label>
          <div className="mt-2 grid grid-cols-2 gap-1.5">
            {([
              { v: "compact", label: "Compact" },
              { v: "categorized", label: "Categorized" },
            ] as const).map((opt) => {
              const active = (data.skillsViewMode ?? data.skillsView ?? "compact") === opt.v;
              return (
                <button
                  key={opt.v}
                  onClick={() => onPatch({ skillsViewMode: opt.v, skillsView: opt.v })}
                  className={cn(
                    "inline-flex items-center justify-center rounded-md border h-9 px-3 text-xs font-medium",
                    active ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-foreground/40",
                  )}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
          {(data.skillsViewMode ?? data.skillsView ?? "compact") === "categorized" && (
            <>
              <button
                type="button"
                onClick={() => {
                  const preset = [
                    "Programming & Analytics: ",
                    "BI & Reporting: ",
                    "Data Engineering: ",
                    "Domain Knowledge: ",
                    "Leadership & Management: ",
                  ].join("\n");
                  const existing = (data.skills ?? "").trim();
                  onPatch({ skills: existing ? `${existing}\n\n${preset}` : preset });
                }}
                className="mt-2 w-full text-[11px] text-muted-foreground hover:text-foreground underline underline-offset-2"
              >
                + Insert category preset
              </button>
              {(() => {
                const cats = parseSkillGroups(data.skills)
                  .map((g) => g.heading?.trim())
                  .filter((h): h is string => !!h);
                const unique = Array.from(new Set(cats));
                if (unique.length === 0) return null;
                const hidden = new Set(
                  (data.hiddenSkillCategories ?? []).map((h) => h.trim().toLowerCase()),
                );
                const toggle = (name: string) => {
                  const key = name.trim().toLowerCase();
                  const next = new Set(hidden);
                  if (next.has(key)) next.delete(key);
                  else next.add(key);
                  onPatch({ hiddenSkillCategories: Array.from(next) });
                };
                return (
                  <div className="mt-3">
                    <Label className="text-xs text-muted-foreground">
                      Show categories
                    </Label>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {unique.map((name) => {
                        const active = !hidden.has(name.toLowerCase());
                        return (
                          <button
                            key={name}
                            type="button"
                            onClick={() => toggle(name)}
                            className={cn(
                              "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition",
                              active
                                ? "border-primary bg-primary/10 text-primary"
                                : "border-border text-muted-foreground line-through opacity-60 hover:opacity-100",
                            )}
                            title={active ? "Click to hide" : "Click to show"}
                          >
                            {active ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                            {name}
                          </button>
                        );
                      })}
                      {hidden.size > 0 && (
                        <button
                          type="button"
                          onClick={() => onPatch({ hiddenSkillCategories: [] })}
                          className="text-[11px] text-muted-foreground hover:text-foreground underline underline-offset-2"
                        >
                          Show all
                        </button>
                      )}
                    </div>
                  </div>
                );
              })()}
            </>
          )}
          <div className="mt-3">
            <Label className="text-xs text-muted-foreground">Balance strategy</Label>
            <div className="mt-2 grid grid-cols-3 gap-1.5">
              {([
                { v: "length", label: "Length", hint: "Balance by estimated wrapped lines (default)" },
                { v: "count", label: "Count", hint: "Equal number of items per column" },
                { v: "chars", label: "Chars", hint: "Weight by raw character count" },
              ] as const).map((opt) => {
                const active = (data.skillsBalanceStrategy ?? data.balanceStrategy ?? "length") === opt.v;
                return (
                  <button
                    key={opt.v}
                    title={opt.hint}
                    onClick={() => onPatch({ skillsBalanceStrategy: opt.v, balanceStrategy: opt.v })}
                    className={cn(
                      "inline-flex items-center justify-center rounded-md border h-9 px-2 text-xs font-medium",
                      active ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-foreground/40",
                    )}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
            <div className="mt-3 flex items-center justify-between gap-2">
              <Label className="text-xs text-muted-foreground">Bias</Label>
              <span className="text-[11px] tabular-nums text-muted-foreground">
                {(data.skillsBalanceBias ?? data.skillsBias ?? 1).toFixed(2)}×
              </span>
            </div>
            <input
              type="range"
              min={0.5}
              max={1.5}
              step={0.05}
              value={data.skillsBalanceBias ?? data.skillsBias ?? 1}
              onChange={(e) => onPatch({ skillsBalanceBias: Number(e.target.value), skillsBias: Number(e.target.value) })}
              className="mt-1 w-full accent-primary"
              aria-label="Skills balance bias"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>Fill left</span>
              <span>Even</span>
              <span>Spread</span>
            </div>
            {(data.skillsBalanceStrategy ?? data.balanceStrategy ?? "length") !== "length" ||
            (data.skillsBalanceBias ?? data.skillsBias ?? 1) !== 1 ? (
              <button
                type="button"
                onClick={() => onPatch({ skillsBalanceStrategy: "length", balanceStrategy: "length", skillsBalanceBias: 1, skillsBias: 1 })}
                className="mt-2 text-[11px] text-muted-foreground hover:text-foreground underline underline-offset-2"
              >
                Reset to default
              </button>
            ) : null}
          </div>
        </div>

        <div>
          <Label className="text-xs text-muted-foreground">Skills text style</Label>
          <div className="mt-2 grid grid-cols-2 gap-1.5">
            {([
              { v: "chips", label: "Chips" },
              { v: "plain", label: "Plain" },
            ] as const).map((opt) => {
              const active = (data.skillsTextStyle ?? data.textStyle ?? "chips") === opt.v;
              return (
                <button
                  key={opt.v}
                  onClick={() => onPatch({ skillsTextStyle: opt.v, textStyle: opt.v })}
                  className={cn(
                    "inline-flex items-center justify-center rounded-md border h-9 px-3 text-xs font-medium",
                    active ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-foreground/40",
                  )}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <Label className="text-xs text-muted-foreground">Body text style</Label>
          <div className="mt-2 flex gap-2">
            <button onClick={() => onPatch({ justifyText: !data.justifyText })}
              className={cn("flex-1 inline-flex items-center justify-center gap-1.5 rounded-md border h-9 px-3 text-xs font-medium",
                data.justifyText ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-foreground/40")}>
              <AlignJustify className="h-4 w-4" /> Justify
            </button>
            <button onClick={() => onPatch({ boldBody: !data.boldBody })}
              className={cn("flex-1 inline-flex items-center justify-center gap-1.5 rounded-md border h-9 px-3 text-xs font-medium",
                data.boldBody ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-foreground/40")}>
              <Bold className="h-4 w-4" /> Bold
            </button>
          </div>
        </div>

        <AlignPicker
          label="Summary alignment"
          value={data.summaryAlign ?? (data.justifyText ? "justify" : "left")}
          onChange={(v) => onPatch({ summaryAlign: v })}
        />
        <AlignPicker
          label="Experience alignment"
          value={data.experienceAlign ?? (data.justifyText ? "justify" : "left")}
          onChange={(v) => onPatch({ experienceAlign: v })}
        />
      </PopoverContent>
    </Popover>
  );
}

function AlignPicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: "left" | "justify" | "center";
  onChange: (v: "left" | "justify" | "center") => void;
}) {
  const opts: { id: "left" | "justify" | "center"; icon: React.ReactNode; label: string }[] = [
    { id: "left", icon: <AlignLeft className="h-4 w-4" />, label: "Left" },
    { id: "justify", icon: <AlignJustify className="h-4 w-4" />, label: "Justify" },
    { id: "center", icon: <AlignCenter className="h-4 w-4" />, label: "Center" },
  ];
  return (
    <div>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="mt-2 flex gap-2">
        {opts.map((o) => (
          <button
            key={o.id}
            onClick={() => onChange(o.id)}
            className={cn(
              "flex-1 inline-flex items-center justify-center gap-1.5 rounded-md border h-9 px-2 text-xs font-medium",
              value === o.id
                ? "border-primary bg-primary/10 text-primary"
                : "border-border hover:border-foreground/40",
            )}
          >
            {o.icon} {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
