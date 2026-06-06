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
  Share2,
  Download,
  Check,
  Loader2,
  Pencil as PencilIcon,
} from "lucide-react";
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
  onPdf: () => void;
  getData: () => ResumeData;
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
  onPdf,
  getData,
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

  const share = async () => {
    try {
      const payload = compressToEncodedURIComponent(JSON.stringify(getData()));
      const url = `${window.location.origin}/builder#r=${payload}`;
      await navigator.clipboard.writeText(url);
      toast.success("Share link copied to clipboard");
    } catch {
      toast.error("Could not generate share link");
    }
  };

  const savedLabel = saving
    ? "Saving…"
    : savedAt
      ? `Saved ${timeAgo(savedAt)}`
      : "Not saved yet";

  return (
    <div className="no-print sticky top-14 z-20 border-b border-border bg-background/90 backdrop-blur-md shadow-[var(--shadow-soft)]">
      <div className="mx-auto max-w-[1600px] px-3 sm:px-6 h-12 flex items-center gap-2">
        {/* Resume name + autosave */}
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
              className="group inline-flex items-center gap-1.5 truncate rounded-md px-2 py-1 text-sm font-semibold hover:bg-accent/60"
              title="Rename resume"
            >
              <span className="truncate max-w-[180px] sm:max-w-[280px]">{name}</span>
              <PencilIcon className="h-3.5 w-3.5 opacity-0 group-hover:opacity-70 transition-opacity" />
            </button>
          )}
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

        {/* Undo / Redo */}
        <div className="hidden md:flex items-center gap-0.5 rounded-lg border border-border p-0.5">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2"
            onClick={onUndo}
            disabled={!canUndo}
            title="Undo (Ctrl/Cmd+Z)"
          >
            <Undo2 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2"
            onClick={onRedo}
            disabled={!canRedo}
            title="Redo (Ctrl/Cmd+Shift+Z)"
          >
            <Redo2 className="h-4 w-4" />
          </Button>
        </div>

        {/* Zoom */}
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

        {/* Preview toggle */}
        <Button
          variant={previewOnly ? "default" : "outline"}
          size="sm"
          className="h-8"
          onClick={onTogglePreview}
          title={previewOnly ? "Switch to edit mode" : "Preview only"}
        >
          {previewOnly ? <Pencil className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          <span className="hidden sm:inline">{previewOnly ? "Edit" : "Preview"}</span>
        </Button>

        {/* Share */}
        <Button variant="outline" size="sm" className="h-8" onClick={share} title="Copy shareable link">
          <Share2 className="h-4 w-4" />
          <span className="hidden sm:inline">Share</span>
        </Button>

        {/* PDF */}
        <Button
          size="sm"
          className="h-8"
          style={{ background: "var(--gradient-hero)", color: "white" }}
          onClick={onPdf}
          title="Download as PDF"
        >
          <Download className="h-4 w-4" />
          <span className="hidden sm:inline">PDF</span>
        </Button>
      </div>
    </div>
  );
}
