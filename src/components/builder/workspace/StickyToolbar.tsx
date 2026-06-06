import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Undo2,
  Redo2,
  ZoomIn,
  ZoomOut,
  Eye,
  Pencil,
  Check,
  Loader2,
  MoreHorizontal,
  Pencil as PencilIcon,
  X,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Search } from "lucide-react";
import { toast } from "sonner";
import lzString from "lz-string";
import type { ResumeData } from "../types";
import { cn } from "@/lib/utils";

const { compressToEncodedURIComponent } = lzString;

type Props = {
  name: string;
  onRename: (next: string) => void;
  savedAt: number | null;
  saving: boolean;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  zoom: number;
  onZoom: (next: number) => void;
  previewOnly: boolean;
  onTogglePreview: () => void;
};

const ZOOMS = [0.5, 0.6, 0.75, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2];

function timeAgo(ts: number) {
  const s = Math.max(1, Math.round((Date.now() - ts) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  return `${h}h ago`;
}

export function StickyToolbar({
  name,
  onRename,
  savedAt,
  saving,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  zoom,
  onZoom,
  previewOnly,
  onTogglePreview,
}: Props) {
  const [editingName, setEditingName] = useState(false);
  const [draft, setDraft] = useState(name);
  const [, force] = useState(0);

  useEffect(() => setDraft(name), [name]);
  // Re-render the "saved Xs ago" label every 15s.
  useEffect(() => {
    const t = window.setInterval(() => force(n => n + 1), 15000);
    return () => window.clearInterval(t);
  }, []);

  const commit = () => {
    setEditingName(false);
    const next = draft.trim();
    if (next && next !== name) onRename(next);
    else setDraft(name);
  };

  const decZoom = () => {
    const i = ZOOMS.findIndex(z => z >= zoom);
    onZoom(ZOOMS[Math.max(0, (i <= 0 ? 0 : i - 1))]);
  };
  const incZoom = () => {
    const i = ZOOMS.findIndex(z => z >= zoom);
    onZoom(ZOOMS[Math.min(ZOOMS.length - 1, i < 0 ? ZOOMS.length - 1 : i + 1)]);
  };


  const savedLabel = saving
    ? "Saving…"
    : savedAt
      ? `Saved ${timeAgo(savedAt)}`
      : "Not saved yet";

  return (
    <div className="no-print sticky top-14 z-20 border-b border-border bg-background/90 backdrop-blur-md shadow-[var(--shadow-soft)]">
      <div className="mx-auto max-w-[1600px] px-2 sm:px-6 h-12 flex items-center gap-2">
        {/* Resume name + autosave — always visible, shrinks on mobile */}
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {editingName ? (
            <Input
              autoFocus
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onBlur={commit}
              onKeyDown={e => {
                if (e.key === "Enter") commit();
                if (e.key === "Escape") { setDraft(name); setEditingName(false); }
              }}
              className="h-8 max-w-[260px] text-sm font-medium"
            />
          ) : (
            <button
              type="button"
              onClick={() => setEditingName(true)}
              className="group inline-flex items-center gap-1.5 min-w-0 rounded-md px-2 py-1 text-sm font-semibold hover:bg-accent/60"
              title="Rename resume"
            >
              <span className="truncate max-w-[120px] sm:max-w-[280px]">{name}</span>
              <PencilIcon className="h-3.5 w-3.5 opacity-60 sm:opacity-0 sm:group-hover:opacity-70 transition-opacity shrink-0" />
            </button>
          )}
          {/* Compact autosave dot on mobile, full pill on sm+ */}
          <span
            className={cn(
              "sm:hidden inline-flex h-2 w-2 rounded-full shrink-0",
              saving ? "bg-amber-500 animate-pulse" : "bg-emerald-500",
            )}
            title={savedLabel}
            aria-label={savedLabel}
          />
          <span
            className={cn(
              "hidden sm:inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
              saving
                ? "bg-amber-500/10 text-amber-700 dark:text-amber-300"
                : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
            )}
            title="Autosave status"
          >
            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
            {savedLabel}
          </span>
        </div>

        {/* Desktop inline controls */}
        <div className="hidden md:flex items-center gap-0.5 rounded-lg border border-border p-0.5">
          <Button variant="ghost" size="sm" className="h-8 px-2" onClick={onUndo} disabled={!canUndo} title="Undo (Ctrl/Cmd+Z)">
            <Undo2 className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" className="h-8 px-2" onClick={onRedo} disabled={!canRedo} title="Redo (Ctrl/Cmd+Shift+Z)">
            <Redo2 className="h-4 w-4" />
          </Button>
        </div>

        <div className="hidden md:flex items-center gap-0.5 rounded-lg border border-border p-0.5">
          <Button variant="ghost" size="sm" className="h-8 px-2" onClick={decZoom} title="Zoom out">
            <ZoomOut className="h-4 w-4" />
          </Button>
          <button
            type="button"
            onClick={() => onZoom(1)}
            className="px-2 text-xs font-medium tabular-nums w-12 hover:text-primary"
            title="Reset zoom"
          >
            {Math.round(zoom * 100)}%
          </button>
          <Button variant="ghost" size="sm" className="h-8 px-2" onClick={incZoom} title="Zoom in">
            <ZoomIn className="h-4 w-4" />
          </Button>
        </div>

        {/* Mobile overflow sheet — searchable, large tap targets, full labels */}
        <MobileActionsSheet
          previewOnly={previewOnly}
          onTogglePreview={onTogglePreview}
          onUndo={onUndo}
          onRedo={onRedo}
          canUndo={canUndo}
          canRedo={canRedo}
          zoom={zoom}
          onZoom={onZoom}
          decZoom={decZoom}
          incZoom={incZoom}
        />
      </div>
    </div>
  );
}

type MobileSheetProps = {
  previewOnly: boolean;
  onTogglePreview: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  zoom: number;
  onZoom: (n: number) => void;
  decZoom: () => void;
  incZoom: () => void;
};

function MobileActionsSheet({
  previewOnly,
  onTogglePreview,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  zoom,
  onZoom,
  decZoom,
  incZoom,
}: MobileSheetProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  type Action = {
    id: string;
    label: string;
    description: string;
    icon: React.ReactNode;
    keywords: string;
    onClick: () => void;
    disabled?: boolean;
    group: "View" | "History" | "Zoom" | "Share";
  };

  const actions: Action[] = [
    {
      id: "preview",
      label: previewOnly ? "Switch to edit mode" : "Preview only",
      description: previewOnly
        ? "Re-enable inline editing in the resume preview"
        : "Hide editing controls and show a clean preview",
      icon: previewOnly ? <Pencil className="h-5 w-5" aria-hidden="true" /> : <Eye className="h-5 w-5" aria-hidden="true" />,
      keywords: "preview edit view toggle mode",
      onClick: () => { onTogglePreview(); setOpen(false); },
      group: "View",
    },
    {
      id: "undo",
      label: "Undo",
      description: "Revert the last change to sections",
      icon: <Undo2 className="h-5 w-5" aria-hidden="true" />,
      keywords: "undo back revert history",
      onClick: () => { onUndo(); setOpen(false); },
      disabled: !canUndo,
      group: "History",
    },
    {
      id: "redo",
      label: "Redo",
      description: "Reapply the change you just undid",
      icon: <Redo2 className="h-5 w-5" aria-hidden="true" />,
      keywords: "redo forward history",
      onClick: () => { onRedo(); setOpen(false); },
      disabled: !canRedo,
      group: "History",
    },
    {
      id: "zoom-out",
      label: "Zoom out",
      description: `Currently ${Math.round(zoom * 100)}%`,
      icon: <ZoomOut className="h-5 w-5" aria-hidden="true" />,
      keywords: "zoom out smaller decrease size",
      onClick: () => { decZoom(); },
      group: "Zoom",
    },
    {
      id: "zoom-reset",
      label: "Reset zoom to 100%",
      description: "Return the preview to its default size",
      icon: <Check className="h-5 w-5" aria-hidden="true" />,
      keywords: "zoom reset default 100 fit",
      onClick: () => { onZoom(1); },
      group: "Zoom",
    },
    {
      id: "zoom-in",
      label: "Zoom in",
      description: `Currently ${Math.round(zoom * 100)}%`,
      icon: <ZoomIn className="h-5 w-5" aria-hidden="true" />,
      keywords: "zoom in bigger increase size",
      onClick: () => { incZoom(); },
      group: "Zoom",
    },
  ];

  const q = query.trim().toLowerCase();
  const filtered = q
    ? actions.filter(a =>
        a.label.toLowerCase().includes(q) ||
        a.description.toLowerCase().includes(q) ||
        a.keywords.includes(q),
      )
    : actions;

  const groups: Action["group"][] = ["View", "History", "Zoom"];

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="md:hidden h-11 w-11 p-0 shrink-0"
          aria-label="More toolbar actions"
        >
          <MoreHorizontal className="h-5 w-5" aria-hidden="true" />
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="p-0 max-h-[85dvh] flex flex-col">
        <SheetHeader className="p-4 pb-2 text-left">
          <SheetTitle>Toolbar actions</SheetTitle>
        </SheetHeader>
        <div className="px-4 pb-3">
          <label htmlFor="toolbar-action-search" className="sr-only">
            Search actions
          </label>
          <div className="relative">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              id="toolbar-action-search"
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search actions…"
              className="h-11 pl-9 pr-9 text-base"
            />
            {query.length > 0 && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-2 pb-[env(safe-area-inset-bottom)]">
          {filtered.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <Search className="mx-auto h-8 w-8 text-muted-foreground/60 mb-3" aria-hidden="true" />
              <p className="text-sm font-medium text-foreground">No actions match “{query}”</p>
              <p className="text-xs text-muted-foreground mt-1">Try a different keyword or clear the search.</p>
              <button
                type="button"
                onClick={() => setQuery("")}
                className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground hover:bg-accent/80 transition-colors"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
                Clear search
              </button>
            </div>
          ) : (
            groups.map((g) => {
              const items = filtered.filter(a => a.group === g);
              if (items.length === 0) return null;
              return (
                <div key={g} className="mb-3">
                  <div className="px-3 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                    {g}
                  </div>
                  <ul className="flex flex-col gap-1">
                    {items.map((a) => (
                      <li key={a.id}>
                        <button
                          type="button"
                          onClick={a.onClick}
                          disabled={a.disabled}
                          className={cn(
                            "w-full min-h-11 flex items-center gap-3 rounded-lg px-3 py-2.5 text-left",
                            "hover:bg-accent/60 active:bg-accent",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                            "disabled:opacity-50 disabled:pointer-events-none",
                          )}
                        >
                          <span className="flex h-9 w-9 items-center justify-center rounded-md bg-muted text-foreground shrink-0">
                            {a.icon}
                          </span>
                          <span className="flex-1 min-w-0">
                            <span className="block text-sm font-medium text-foreground truncate">
                              {a.label}
                            </span>
                            <span className="block text-xs text-muted-foreground truncate">
                              {a.description}
                            </span>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
