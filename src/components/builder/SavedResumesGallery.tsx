import { useMemo, useRef, useState } from "react";
import { Plus, Pencil, Trash2, Copy, FolderOpen, Star, ChevronDown, ChevronUp, Search, X, Download, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { ResumeDocument } from "./ResumeDocument";
import { resumeStore, newId, type SavedResume } from "./resumeStore";
import { toast } from "sonner";

type Props = {
  saved: SavedResume[];
  currentId: string | null;
  primaryId: string | null;
  onOpen: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string, name: string) => void;
  onNew: () => void;
  onSetPrimary: (id: string, name: string) => void;
};

export function SavedResumesGallery({
  saved, currentId, primaryId,
  onOpen, onRename, onDuplicate, onDelete, onNew, onSetPrimary,
}: Props) {
  const [open, setOpen] = useState(true);
  const [query, setQuery] = useState("");
  const fileRef = useRef<HTMLInputElement | null>(null);

  const exportAll = () => {
    const payload = { version: 1, exportedAt: Date.now(), resumes: saved };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `resumeforge-resumes-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${saved.length} resume${saved.length === 1 ? "" : "s"}`);
  };

  const importFile = async (file: File) => {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const list: SavedResume[] = Array.isArray(parsed) ? parsed : parsed.resumes;
      if (!Array.isArray(list)) throw new Error("Invalid file");
      const existingIds = new Set(saved.map(s => s.id));
      let added = 0;
      for (const item of list) {
        if (!item || !item.data) continue;
        const entry: SavedResume = {
          id: existingIds.has(item.id) ? newId() : (item.id || newId()),
          name: item.name || "Imported resume",
          updatedAt: item.updatedAt || Date.now(),
          data: item.data,
        };
        resumeStore.upsert(entry);
        added++;
      }
      toast.success(`Imported ${added} resume${added === 1 ? "" : "s"}`);
      // Force parent refresh by reloading the page region; simplest reliable signal:
      window.dispatchEvent(new Event("resumeforge:refresh"));
    } catch (e) {
      toast.error("Could not import — file is not a valid resume export");
    }
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return saved;
    return saved.filter(s => {
      const d = s.data;
      const hay = [
        s.name,
        d.template,
        d.name,
        d.headline,
        d.email,
        d.location,
        d.links,
        d.summary,
        d.skills,
        d.extraKeywords,
        d.experience?.map(e => `${e.company} ${e.title} ${e.bullets}`).join(" "),
        d.education?.map(e => `${e.school} ${e.degree}`).join(" "),
        d.projects?.map(p => `${p.name} ${p.bullets}`).join(" "),
      ].filter(Boolean).join(" ").toLowerCase();
      return hay.includes(q);
    });
  }, [saved, query]);

  return (
    <section className="no-print mx-auto max-w-[1600px] px-6 pt-6">
      <div className="rounded-xl border border-border bg-card/40 backdrop-blur-sm">
        <button
          onClick={() => setOpen(o => !o)}
          className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left"
        >
          <div className="flex items-center gap-2">
            <FolderOpen className="h-4 w-4 text-[var(--navy-light)]" />
            <span className="font-display font-semibold">My Resumes</span>
            <span className="text-xs text-muted-foreground">({saved.length})</span>
          </div>
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>

        {open && (
          <div className="px-4 pb-4">
            <div className="mb-4 flex items-center gap-2">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search resumes by name, role, skill, company..."
                  className="pl-8 pr-8 h-9"
                />
                {query && (
                  <button
                    onClick={() => setQuery("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    title="Clear"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              {query && (
                <span className="text-xs text-muted-foreground">
                  {filtered.length} of {saved.length}
                </span>
              )}
              <div className="ml-auto flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={exportAll} disabled={saved.length === 0} title="Download all saved resumes as a JSON file">
                  <Download className="h-3.5 w-3.5" /> Export
                </Button>
                <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()} title="Import resumes from a JSON file exported on another device">
                  <Upload className="h-3.5 w-3.5" /> Import
                </Button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="application/json,.json"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) importFile(f);
                    e.target.value = "";
                  }}
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {/* Add new tile */}
              <button
                onClick={onNew}
                className="group flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border hover:border-[var(--navy-light)] hover:bg-[var(--navy-light)]/5 transition-colors aspect-[3/4] min-h-[280px]"
              >
                <div className="rounded-full bg-[var(--navy-light)]/10 p-3 group-hover:bg-[var(--navy-light)]/20 transition-colors">
                  <Plus className="h-6 w-6 text-[var(--navy-light)]" />
                </div>
                <div className="text-sm font-medium">New Resume</div>
                <div className="text-xs text-muted-foreground">Start from blank</div>
              </button>

              {filtered.map(s => {
                const isCurrent = currentId === s.id;
                const isPrimary = primaryId === s.id;
                return (
                  <div
                    key={s.id}
                    className={cn(
                      "group relative rounded-lg border bg-white overflow-hidden flex flex-col aspect-[3/4] min-h-[280px] transition-all",
                      isCurrent ? "border-[var(--navy-light)] ring-2 ring-[var(--navy-light)]/30" : "border-border hover:border-[var(--navy-light)]/60"
                    )}
                  >
                    {/* Mini preview */}
                    <button
                      onClick={() => onOpen(s.id)}
                      className="relative flex-1 overflow-hidden bg-neutral-100"
                      title="Open resume"
                    >
                      <div
                        className="absolute inset-0 origin-top-left pointer-events-none"
                        style={{ transform: "scale(0.28)", width: "357%", height: "357%" }}
                      >
                        <ResumeDocument data={s.data} />
                      </div>
                      {isPrimary && (
                        <div className="absolute top-2 left-2 inline-flex items-center gap-1 rounded-full bg-amber-500/95 text-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest shadow-sm">
                          <Star className="h-3 w-3 fill-white" /> Primary
                        </div>
                      )}
                    </button>

                    {/* Footer */}
                    <div className="border-t border-border bg-card px-3 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-semibold truncate" title={s.name}>{s.name}</div>
                          <div className="text-[11px] text-muted-foreground truncate">
                            {new Date(s.updatedAt).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                      <div className="mt-2 flex items-center gap-1">
                        <Button size="sm" variant="outline" className="h-7 flex-1 text-xs" onClick={() => onOpen(s.id)}>
                          <Pencil className="h-3 w-3" /> Edit
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 px-2" title="Set as Primary" onClick={() => onSetPrimary(s.id, s.name)}>
                          <Star className={cn("h-3.5 w-3.5", isPrimary && "fill-amber-400 text-amber-500")} />
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 px-2" title="Rename" onClick={() => {
                          const next = window.prompt("Rename resume", s.name);
                          if (next && next.trim()) onRename(s.id, next.trim());
                        }}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 px-2" title="Duplicate" onClick={() => onDuplicate(s.id)}>
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 px-2 text-destructive hover:text-destructive" title="Delete" onClick={() => onDelete(s.id, s.name)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
              {query && filtered.length === 0 && (
                <div className="col-span-full text-center text-sm text-muted-foreground py-8">
                  No resumes match "{query}".
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}