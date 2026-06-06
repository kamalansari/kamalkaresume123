import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { History as HistoryIcon, RotateCcw, Trash2, Clock } from "lucide-react";
import { historyStore, type HistorySnapshot } from "./historyStore";
import type { ResumeData } from "./types";
import { toast } from "sonner";

function formatRelative(at: number) {
  const diff = Date.now() - at;
  const s = Math.floor(diff / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hr ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d} day${d === 1 ? "" : "s"} ago`;
  return new Date(at).toLocaleString();
}

export function HistoryDialog({
  open,
  onOpenChange,
  resumeId,
  resumeName,
  onRestore,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  resumeId: string | null;
  resumeName: string;
  onRestore: (data: ResumeData) => void;
}) {
  const [snapshots, setSnapshots] = useState<HistorySnapshot[]>([]);

  useEffect(() => {
    if (!open) return;
    setSnapshots(resumeId ? historyStore.list(resumeId) : []);
  }, [open, resumeId]);

  const refresh = () => {
    setSnapshots(resumeId ? historyStore.list(resumeId) : []);
  };

  const handleRestore = (snap: HistorySnapshot) => {
    onRestore(snap.data);
    toast.success(`Restored version from ${formatRelative(snap.at)}`);
    onOpenChange(false);
  };

  const handleDelete = (snap: HistorySnapshot) => {
    if (!resumeId) return;
    historyStore.remove(resumeId, snap.id);
    refresh();
  };

  const handleClearAll = () => {
    if (!resumeId) return;
    if (!window.confirm("Delete all version history for this resume?")) return;
    historyStore.clear(resumeId);
    refresh();
    toast.success("History cleared");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="inline-flex items-center gap-2">
            <HistoryIcon className="h-4 w-4" /> Version history
          </DialogTitle>
          <DialogDescription>
            {resumeId
              ? `Past saves of "${resumeName}". Restore any version instantly.`
              : "Save this resume first to start tracking versions."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto -mx-1 px-1">
          {!resumeId || snapshots.length === 0 ? (
            <div className="text-sm text-muted-foreground border border-dashed border-border rounded-md px-4 py-6 text-center">
              No versions yet. Each time you Save, a snapshot is added here.
            </div>
          ) : (
            <ul className="divide-y divide-border rounded-md border border-border">
              {snapshots.map((s, i) => (
                <li
                  key={s.id}
                  className="flex items-center gap-3 px-3 py-2.5 hover:bg-muted/40"
                >
                  <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">
                      {s.label}
                      {i === 0 && (
                        <span className="ml-2 text-[10px] uppercase tracking-wider text-emerald-600">
                          latest
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {formatRelative(s.at)} · {new Date(s.at).toLocaleString()}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7"
                    onClick={() => handleRestore(s)}
                  >
                    <RotateCcw className="h-3.5 w-3.5" /> Restore
                  </Button>
                  <button
                    type="button"
                    onClick={() => handleDelete(s)}
                    className="h-7 w-7 inline-flex items-center justify-center rounded text-muted-foreground hover:text-destructive hover:bg-muted"
                    title="Delete version"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {resumeId && snapshots.length > 0 && (
          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={handleClearAll}
              className="text-xs text-muted-foreground hover:text-destructive"
            >
              Clear all history
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
