import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Pencil, Trash2, Copy, FolderOpen, Star, ChevronDown, ChevronUp, Search, X, Download, Upload, ExternalLink, MoreVertical, LayoutGrid, List as ListIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { ResumeDocument } from "./ResumeDocument";
import { resumeStore, newId, type SavedResume } from "./resumeStore";
import { computeScore } from "./atsScore";
import { importResumeFile } from "@/lib/importResume";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import lzString from "lz-string";
const { compressToEncodedURIComponent } = lzString;

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
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const currentResume = useMemo(() => saved.find(r => r.id === currentId) ?? null, [saved, currentId]);
  const [view, setView] = useState<"grid" | "list">(() => {
    if (typeof window === "undefined") return "list";
    return (localStorage.getItem("resumeforge.gallery.view") as "grid" | "list") || "list";
  });
  const [visibleCount, setVisibleCount] = useState(6);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const uploadRef = useRef<HTMLInputElement | null>(null);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem("resumeforge.gallery.view", view);
  }, [view]);

  const relativeTime = (ts: number) => {
    const diff = Date.now() - ts;
    const m = Math.floor(diff / 60000);
    if (m < 1) return "just now";
    if (m < 60) return `${m} minute${m === 1 ? "" : "s"} ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h} hour${h === 1 ? "" : "s"} ago`;
    const d = Math.floor(h / 24);
    if (d < 30) return `Updated ${d} day${d === 1 ? "" : "s"} ago`;
    const mo = Math.floor(d / 30);
    if (mo < 12) return `Updated ${mo} month${mo === 1 ? "" : "s"} ago`;
    const y = Math.floor(mo / 12);
    return `Updated ${y} year${y === 1 ? "" : "s"} ago`;
  };

  const downloadOne = (r: SavedResume) => {
    const payload = { version: 1, exportedAt: Date.now(), resumes: [r] };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${r.name.replace(/[^a-z0-9-_]+/gi, "_") || "resume"}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Downloaded "${r.name}"`);
  };

  const openInNewTab = (r: SavedResume) => {
    try {
      const payload = compressToEncodedURIComponent(JSON.stringify(r.data));
      window.open(`/builder#r=${payload}`, "_blank", "noopener,noreferrer");
    } catch {
      toast.error("Could not open in new tab");
    }
  };

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

  const importResumeUpload = async (file: File) => {
    setImporting(true);
    const toastId = toast.loading(`Reading "${file.name}"…`);
    try {
      const data = await importResumeFile(file);
      const baseName = file.name.replace(/\.(pdf|docx|txt)$/i, "").trim() || "Imported resume";
      const entry: SavedResume = {
        id: newId(),
        name: data.name ? `${data.name}'s resume` : baseName,
        updatedAt: Date.now(),
        data,
      };
      resumeStore.upsert(entry);
      toast.success("Resume imported — opening editor", { id: toastId });
      window.dispatchEvent(new Event("resumeforge:refresh"));
      onOpen(entry.id);
    } catch (e: any) {
      toast.error(e?.message || "Could not parse this resume", { id: toastId });
    } finally {
      setImporting(false);
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

  // Reset pagination when filter/view changes
  useEffect(() => { setVisibleCount(view === "grid" ? 6 : 8); }, [query, view]);

  const visible = filtered.slice(0, visibleCount);
  const hasMore = filtered.length > visibleCount;

  // Lazy-render the heavy ResumeDocument preview only when the tile scrolls into view.
  function LazyPreview({ resume }: { resume: SavedResume }) {
    const ref = useRef<HTMLDivElement | null>(null);
    const [visible, setVisible] = useState(false);
    useEffect(() => {
      if (visible || typeof IntersectionObserver === "undefined") return;
      const el = ref.current;
      if (!el) return;
      const io = new IntersectionObserver(
        (entries) => {
          for (const e of entries) if (e.isIntersecting) { setVisible(true); io.disconnect(); }
        },
        { rootMargin: "200px" },
      );
      io.observe(el);
      return () => io.disconnect();
    }, [visible]);
    return (
      <div ref={ref} className="absolute inset-0 origin-top-left pointer-events-none"
           style={{ transform: "scale(0.28)", width: "357%", height: "357%" }}>
        {visible ? (
          <ResumeDocument data={resume.data} />
        ) : (
          <div className="h-full w-full bg-neutral-100" aria-hidden />
        )}
      </div>
    );
  }

  return (
    <section className="no-print mx-auto max-w-[1600px] px-6 pt-3">
      <div className="rounded-xl border border-border bg-card/40 backdrop-blur-sm">
        <div className="w-full flex items-center justify-between gap-3 px-4 py-2">
          <button
            onClick={() => setOpen(o => !o)}
            className="flex flex-1 items-center gap-2 min-w-0 text-left"
            aria-expanded={open}
          >
            <FolderOpen className="h-4 w-4 text-[var(--navy-light)] shrink-0" />
            <span className="font-display font-semibold">My Resumes</span>
            <span className="text-xs text-muted-foreground">({saved.length})</span>
            {!open && currentResume && (
              <>
                <span className="text-muted-foreground/50 mx-1">·</span>
                <span className="truncate text-sm text-muted-foreground">
                  {currentResume.name}
                </span>
              </>
            )}
          </button>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              size="sm"
              variant="accent"
              onClick={(e) => { e.stopPropagation(); uploadRef.current?.click(); }}
              disabled={importing}
              title="Upload a PDF, DOCX, or TXT resume and auto-fill the builder"
            >
              <Upload className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{importing ? "Importing…" : "Upload Resume"}</span>
            </Button>
            {!open && (
              <span className="hidden sm:inline text-xs text-muted-foreground">Manage</span>
            )}
            <button
              onClick={() => setOpen(o => !o)}
              aria-label={open ? "Collapse" : "Expand"}
              className="p-1"
            >
              {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          </div>
        </div>




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
                <div className="hidden sm:flex items-center rounded-md border bg-background p-0.5">
                  <button
                    onClick={() => setView("list")}
                    className={cn("flex h-7 items-center gap-1 rounded px-2 text-xs transition-colors", view === "list" ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground")}
                    title="List view"
                  >
                    <ListIcon className="h-3.5 w-3.5" /> List
                  </button>
                  <button
                    onClick={() => setView("grid")}
                    className={cn("flex h-7 items-center gap-1 rounded px-2 text-xs transition-colors", view === "grid" ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground")}
                    title="Grid view"
                  >
                    <LayoutGrid className="h-3.5 w-3.5" /> Grid
                  </button>
                </div>
                <Button size="sm" variant="accent" onClick={() => uploadRef.current?.click()} disabled={importing} title="Upload a PDF, DOCX, or TXT resume and auto-fill the builder">
                  <Upload className="h-3.5 w-3.5" /> {importing ? "Importing…" : "Upload Resume"}
                </Button>
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
                <input
                  ref={uploadRef}
                  type="file"
                  accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) importResumeUpload(f);
                    e.target.value = "";
                  }}
                />
              </div>
            </div>
            {view === "grid" ? (
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

              {visible.map(s => {
                const isCurrent = currentId === s.id;
                const isPrimary = primaryId === s.id;
                const score = computeScore(s.data);
                const resumeScore = score.score;
                const atsScore = Math.round((score.coverage || 0) * 100);
                const scoreColor = (n: number) =>
                  n >= 70 ? "text-emerald-600" : n >= 40 ? "text-amber-600" : "text-rose-600";
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
                      <LazyPreview resume={s} />
                    </button>

                    {/* Footer */}
                    <div className="border-t border-border bg-card px-3 py-2 space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-[11px] text-muted-foreground">
                          {relativeTime(s.updatedAt)}
                        </div>
                        {isPrimary && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-[var(--navy-light)] text-white px-2 py-0.5 text-[10px] font-semibold">
                            <Star className="h-3 w-3 fill-white" /> Primary Resume
                          </span>
                        )}
                      </div>

                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-semibold truncate" title={s.name}>{s.name}</div>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" title="More">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44">
                            <DropdownMenuItem onClick={() => onOpen(s.id)}>
                              <Pencil className="h-3.5 w-3.5" /> Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => {
                              const next = window.prompt("Rename resume", s.name);
                              if (next && next.trim()) onRename(s.id, next.trim());
                            }}>
                              <Pencil className="h-3.5 w-3.5" /> Rename
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onSetPrimary(s.id, s.name)}>
                              <Star className={cn("h-3.5 w-3.5", isPrimary && "fill-amber-400 text-amber-500")} />
                              {isPrimary ? "Unset Primary" : "Set as Primary"}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onDuplicate(s.id)}>
                              <Copy className="h-3.5 w-3.5" /> Duplicate
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => downloadOne(s)}>
                              <Download className="h-3.5 w-3.5" /> Download JSON
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => onDelete(s.id, s.name)}>
                              <Trash2 className="h-3.5 w-3.5" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>

                      <div className="flex items-center gap-3 text-xs">
                        <span className="text-muted-foreground">
                          Resume Score: <span className={cn("font-semibold", scoreColor(resumeScore))}>{resumeScore}%</span>
                        </span>
                        <span className="text-border">|</span>
                        <span className="text-muted-foreground">
                          ATS Score: <span className={cn("font-semibold", scoreColor(atsScore))}>{atsScore}%</span>
                        </span>
                      </div>

                      <div className="flex items-center justify-between pt-1 border-t border-border/60">
                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0" title="Open in new tab" onClick={() => openInNewTab(s)}>
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0" title="Edit" onClick={() => onOpen(s.id)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0" title="Duplicate" onClick={() => onDuplicate(s.id)}>
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0" title="Download" onClick={() => downloadOne(s)}>
                          <Download className="h-4 w-4" />
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
            ) : (
              <div className="divide-y divide-border rounded-lg border bg-card">
                <button
                  onClick={onNew}
                  className="group flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--navy-light)]/5"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--navy-light)]/10 text-[var(--navy-light)] group-hover:bg-[var(--navy-light)]/20">
                    <Plus className="h-4 w-4" />
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium">New Resume</div>
                    <div className="text-xs text-muted-foreground">Start from blank</div>
                  </div>
                </button>
                {visible.map(s => {
                  const isCurrent = currentId === s.id;
                  const isPrimary = primaryId === s.id;
                  const score = computeScore(s.data);
                  const resumeScore = score.score;
                  const atsScore = Math.round((score.coverage || 0) * 100);
                  const scoreColor = (n: number) =>
                    n >= 70 ? "text-emerald-600" : n >= 40 ? "text-amber-600" : "text-rose-600";
                  return (
                    <div
                      key={s.id}
                      className={cn(
                        "group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/40",
                        isCurrent && "bg-[var(--navy-light)]/5"
                      )}
                    >
                      <button
                        onClick={() => onOpen(s.id)}
                        className="flex min-w-0 flex-1 items-center gap-3 text-left"
                        title="Open resume"
                      >
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                          <FolderOpen className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="truncate text-sm font-semibold" title={s.name}>{s.name}</span>
                            {isPrimary && (
                              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[var(--navy-light)] px-1.5 py-0.5 text-[9px] font-semibold text-white">
                                <Star className="h-2.5 w-2.5 fill-white" /> Primary
                              </span>
                            )}
                          </div>
                          <div className="mt-0.5 flex items-center gap-3 text-[11px] text-muted-foreground">
                            <span>{relativeTime(s.updatedAt)}</span>
                            <span className="hidden sm:inline">·</span>
                            <span className="hidden sm:inline">Resume <span className={cn("font-semibold", scoreColor(resumeScore))}>{resumeScore}%</span></span>
                            <span className="hidden sm:inline">·</span>
                            <span className="hidden sm:inline">ATS <span className={cn("font-semibold", scoreColor(atsScore))}>{atsScore}%</span></span>
                          </div>
                        </div>
                      </button>
                      <div className="hidden items-center gap-0.5 sm:flex">
                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0" title="Open in new tab" onClick={() => openInNewTab(s)}>
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0" title="Edit" onClick={() => onOpen(s.id)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0" title="Download" onClick={() => downloadOne(s)}>
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="sm" variant="ghost" className="h-8 w-8 p-0" title="More">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44">
                          <DropdownMenuItem onClick={() => onOpen(s.id)}>
                            <Pencil className="h-3.5 w-3.5" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => {
                            const next = window.prompt("Rename resume", s.name);
                            if (next && next.trim()) onRename(s.id, next.trim());
                          }}>
                            <Pencil className="h-3.5 w-3.5" /> Rename
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onSetPrimary(s.id, s.name)}>
                            <Star className={cn("h-3.5 w-3.5", isPrimary && "fill-amber-400 text-amber-500")} />
                            {isPrimary ? "Unset Primary" : "Set as Primary"}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onDuplicate(s.id)}>
                            <Copy className="h-3.5 w-3.5" /> Duplicate
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => downloadOne(s)}>
                            <Download className="h-3.5 w-3.5" /> Download JSON
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => onDelete(s.id, s.name)}>
                            <Trash2 className="h-3.5 w-3.5" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  );
                })}
                {query && filtered.length === 0 && (
                  <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                    No resumes match "{query}".
                  </div>
                )}
              </div>
            )}

            {hasMore && (
              <div className="mt-4 flex items-center justify-center gap-3">
                <span className="text-xs text-muted-foreground">
                  Showing {visible.length} of {filtered.length}
                </span>
                <Button size="sm" variant="outline" onClick={() => setVisibleCount(c => c + (view === "grid" ? 8 : 10))}>
                  <ChevronDown className="h-3.5 w-3.5" /> Show more
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setVisibleCount(filtered.length)}>
                  Show all
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}