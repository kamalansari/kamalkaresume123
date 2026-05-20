import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Plus, Trash2, Gauge, CheckCircle2, XCircle, Sparkles, Loader2, GripVertical, FileType, FileText, Save, FolderOpen, FilePlus2, Check, Pencil, Briefcase, Search, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { defaultResume, FONT_PRESETS, COLOR_PRESETS, type ResumeData, type Experience, type Education, type Project, type Certification, type Award, type Language, type TemplateId, type SectionId } from "./types";
import { computeScore } from "./atsScore";
import { ResumeDocument } from "./ResumeDocument";
import { exportDocx } from "./exportDocx";
import { resumeStore, newId, type SavedResume } from "./resumeStore";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, verticalListSortingStrategy, sortableKeyboardCoordinates, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Slider } from "@/components/ui/slider";
import { parseSkills } from "@/lib/parseSkills";
import { cn } from "@/lib/utils";

function uid() { return Math.random().toString(36).slice(2, 9); }

function ensureSection(order: SectionId[], id: SectionId): SectionId[] {
  return order.includes(id) ? order : [...order, id];
}

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

const TEMPLATES: { id: TemplateId; label: string; desc: string }[] = [
  { id: "classic", label: "Classic", desc: "Centered header" },
  { id: "two-column", label: "Two column", desc: "Sidebar layout" },
  { id: "modern", label: "Modern", desc: "Bold header bar" },
  { id: "sidebar-right", label: "Sidebar right", desc: "Sidebar on right" },
  { id: "compact-two", label: "Compact two", desc: "Cream sidebar" },
];

const BG_PRESETS = [
  { id: "white", label: "White", hex: "#ffffff" },
  { id: "ivory", label: "Ivory", hex: "#fbf9f4" },
  { id: "stone", label: "Stone", hex: "#f5f4f0" },
  { id: "sky", label: "Sky", hex: "#f1f5fb" },
  { id: "mint", label: "Mint", hex: "#f1f7f3" },
];

export function Builder() {
  const [data, setData] = useState<ResumeData>(defaultResume);
  const [rewriting, setRewriting] = useState(false);
  const [rewritingKey, setRewritingKey] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [currentName, setCurrentName] = useState<string>("Untitled resume");
  const [saved, setSaved] = useState<SavedResume[]>([]);
  const [saveAsOpen, setSaveAsOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const score = useMemo(() => computeScore(data), [data]);

  useEffect(() => { setSaved(resumeStore.list()); }, []);

  const refreshList = () => setSaved(resumeStore.list());

  const saveCurrent = () => {
    if (!currentId) { setNameDraft(data.name ? `${data.name}'s resume` : "Untitled resume"); setSaveAsOpen(true); return; }
    resumeStore.upsert({ id: currentId, name: currentName, updatedAt: Date.now(), data });
    refreshList();
    toast.success(`Saved "${currentName}"`);
  };

  const saveAs = (name: string) => {
    const trimmed = name.trim() || "Untitled resume";
    const id = newId();
    resumeStore.upsert({ id, name: trimmed, updatedAt: Date.now(), data });
    setCurrentId(id);
    setCurrentName(trimmed);
    setSaveAsOpen(false);
    refreshList();
    toast.success(`Saved as "${trimmed}"`);
  };

  const loadSaved = (id: string) => {
    const entry = resumeStore.get(id);
    if (!entry) { toast.error("Resume not found"); return; }
    setData({ ...defaultResume, ...entry.data });
    setCurrentId(entry.id);
    setCurrentName(entry.name);
    toast.success(`Loaded "${entry.name}"`);
  };

  const renameCurrent = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed || !currentId) return;
    resumeStore.rename(currentId, trimmed);
    setCurrentName(trimmed);
    setRenameOpen(false);
    refreshList();
    toast.success("Renamed");
  };

  const deleteSaved = (id: string, name: string) => {
    resumeStore.remove(id);
    if (currentId === id) { setCurrentId(null); setCurrentName("Untitled resume"); }
    refreshList();
    toast.success(`Deleted "${name}"`);
  };

  const newResume = () => {
    setData(defaultResume);
    setCurrentId(null);
    setCurrentName("Untitled resume");
    toast.success("Started a new resume");
  };

  const update = <K extends keyof ResumeData>(k: K, v: ResumeData[K]) => setData(d => ({ ...d, [k]: v }));

  const updateExp = (id: string, patch: Partial<Experience>) =>
    setData(d => ({ ...d, experience: d.experience.map(e => e.id === id ? { ...e, ...patch } : e) }));
  const addExp = () => setData(d => ({ ...d, experience: [...d.experience, { id: uid(), title: "", company: "", date: "", bullets: "" }] }));
  const removeExp = (id: string) => setData(d => ({ ...d, experience: d.experience.filter(e => e.id !== id) }));

  const updateEdu = (id: string, patch: Partial<Education>) =>
    setData(d => ({ ...d, education: d.education.map(e => e.id === id ? { ...e, ...patch } : e) }));
  const addEdu = () => setData(d => ({ ...d, education: [...d.education, { id: uid(), degree: "", school: "", date: "" }] }));
  const removeEdu = (id: string) => setData(d => ({ ...d, education: d.education.filter(e => e.id !== id) }));

  const updateProject = (id: string, patch: Partial<Project>) =>
    setData(d => ({ ...d, projects: d.projects.map(p => p.id === id ? { ...p, ...patch } : p) }));
  const addProject = () => setData(d => ({ ...d, projects: [...d.projects, { id: uid(), name: "", link: "", date: "", bullets: "" }], sectionOrder: ensureSection(d.sectionOrder, "projects") }));
  const removeProject = (id: string) => setData(d => ({ ...d, projects: d.projects.filter(p => p.id !== id) }));

  const updateCert = (id: string, patch: Partial<Certification>) =>
    setData(d => ({ ...d, certifications: d.certifications.map(c => c.id === id ? { ...c, ...patch } : c) }));
  const addCert = () => setData(d => ({ ...d, certifications: [...d.certifications, { id: uid(), name: "", issuer: "", date: "" }], sectionOrder: ensureSection(d.sectionOrder, "certifications") }));
  const removeCert = (id: string) => setData(d => ({ ...d, certifications: d.certifications.filter(c => c.id !== id) }));

  const updateAward = (id: string, patch: Partial<Award>) =>
    setData(d => ({ ...d, awards: d.awards.map(a => a.id === id ? { ...a, ...patch } : a) }));
  const addAward = () => setData(d => ({ ...d, awards: [...d.awards, { id: uid(), name: "", issuer: "", date: "" }], sectionOrder: ensureSection(d.sectionOrder, "awards") }));
  const removeAward = (id: string) => setData(d => ({ ...d, awards: d.awards.filter(a => a.id !== id) }));

  const updateLang = (id: string, patch: Partial<Language>) =>
    setData(d => ({ ...d, languages: d.languages.map(l => l.id === id ? { ...l, ...patch } : l) }));
  const addLang = () => setData(d => ({ ...d, languages: [...d.languages, { id: uid(), name: "", level: "" }], sectionOrder: ensureSection(d.sectionOrder, "languages") }));
  const removeLang = (id: string) => setData(d => ({ ...d, languages: d.languages.filter(l => l.id !== id) }));

  const addSectionIfMissing = (id: SectionId) => {
    setData(d => ({ ...d, sectionOrder: ensureSection(d.sectionOrder, id) }));
    if (id === "projects" && data.projects.length === 0) addProject();
    if (id === "certifications" && data.certifications.length === 0) addCert();
    if (id === "awards" && data.awards.length === 0) addAward();
    if (id === "languages" && data.languages.length === 0) addLang();
  };
  const removeSectionFromOrder = (id: SectionId) => setData(d => ({ ...d, sectionOrder: d.sectionOrder.filter(s => s !== id) }));

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const onSectionDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = data.sectionOrder.indexOf(active.id as SectionId);
    const newIndex = data.sectionOrder.indexOf(over.id as SectionId);
    if (oldIndex < 0 || newIndex < 0) return;
    update("sectionOrder", arrayMove(data.sectionOrder, oldIndex, newIndex));
  };

  const handleDocx = async () => {
    setExporting(true);
    try { await exportDocx(data); toast.success("DOCX downloaded"); }
    catch { toast.error("Could not export DOCX"); }
    finally { setExporting(false); }
  };

  const rewriteSummary = async () => {
    setRewriting(true);
    try {
      const res = await fetch("/api/rewrite-summary", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          summary: data.summary,
          headline: data.headline,
          jobDescription: data.jobDescription,
          skills: data.skills,
          experience: data.experience.map(e => ({ title: e.title, company: e.company, bullets: e.bullets })),
        }),
      });
      if (res.status === 429) { toast.error("Rate limit hit. Please retry in a moment."); return; }
      if (res.status === 402) { toast.error("AI credits exhausted. Add credits in Workspace settings."); return; }
      if (!res.ok) { toast.error("Rewrite failed. Please try again."); return; }
      const json = (await res.json()) as { summary?: string };
      if (json.summary) {
        update("summary", json.summary);
        toast.success("Summary rewritten");
      }
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setRewriting(false);
    }
  };

  const rewriteWithAI = async (kind: "bullets" | "skills" | "education", text: string, ctx: Record<string, string | undefined>, key: string): Promise<string | null> => {
    setRewritingKey(key);
    try {
      const res = await fetch("/api/rewrite-section", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind, text, context: { headline: data.headline, jobDescription: data.jobDescription, skills: data.skills, ...ctx } }),
      });
      if (res.status === 429) { toast.error("Rate limit hit. Please retry."); return null; }
      if (res.status === 402) { toast.error("AI credits exhausted."); return null; }
      if (!res.ok) { toast.error("Rewrite failed."); return null; }
      const json = (await res.json()) as { text?: string };
      return json.text ?? null;
    } catch {
      toast.error("Network error.");
      return null;
    } finally {
      setRewritingKey(null);
    }
  };

  return (
    <div className="min-h-screen bg-secondary/40">
      <header className="no-print sticky top-0 z-30 backdrop-blur-md bg-background/80 border-b border-border">
        <div className="mx-auto max-w-[1600px] px-6 h-14 flex items-center justify-between">
          <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
          <div className="font-display font-semibold">ResumeForge Builder</div>
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <FolderOpen /> <span className="hidden sm:inline">Resumes</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-72">
                <DropdownMenuLabel className="text-[11px] uppercase tracking-widest text-muted-foreground">
                  Current: {currentName}{currentId ? "" : " (unsaved)"}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={saveCurrent}>
                  <Save className="h-4 w-4" /> {currentId ? "Save" : "Save…"}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { setNameDraft(currentName); setSaveAsOpen(true); }}>
                  <FilePlus2 className="h-4 w-4" /> Save as new…
                </DropdownMenuItem>
                {currentId && (
                  <DropdownMenuItem onClick={() => { setNameDraft(currentName); setRenameOpen(true); }}>
                    <Pencil className="h-4 w-4" /> Rename current
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={newResume}>
                  <Plus className="h-4 w-4" /> New blank resume
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-[11px] uppercase tracking-widest text-muted-foreground">
                  Saved ({saved.length})
                </DropdownMenuLabel>
                {saved.length === 0 && (
                  <div className="px-2 py-2 text-xs text-muted-foreground">No saved resumes yet. Use “Save as new…” to create one per job.</div>
                )}
                <div className="max-h-72 overflow-auto">
                  {saved.map(s => (
                    <div key={s.id} className="group flex items-center gap-1 px-1.5 py-0.5">
                      <button
                        onClick={() => loadSaved(s.id)}
                        className="flex-1 text-left rounded-sm px-2 py-1.5 hover:bg-accent hover:text-accent-foreground"
                      >
                        <div className="flex items-center gap-2 text-sm font-medium truncate">
                          {currentId === s.id && <Check className="h-3.5 w-3.5 text-[var(--navy-light)]" />}
                          <span className="truncate">{s.name}</span>
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {new Date(s.updatedAt).toLocaleString()}
                        </div>
                      </button>
                      <button
                        onClick={() => deleteSaved(s.id, s.name)}
                        className="opacity-0 group-hover:opacity-100 p-1.5 rounded-sm text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        title="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="outline" onClick={handleDocx} disabled={exporting}>
              {exporting ? <Loader2 className="animate-spin" /> : <FileType />} DOCX
            </Button>
            <Button variant="hero" style={{ background: "var(--gradient-hero)" }} onClick={() => window.print()}>
              <FileText /> PDF
            </Button>
          </div>
        </div>
      </header>

      <Dialog open={saveAsOpen} onOpenChange={setSaveAsOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Save resume as…</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Name (e.g. “Stripe — Senior PM”)</Label>
            <Input
              autoFocus
              value={nameDraft}
              onChange={e => setNameDraft(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") saveAs(nameDraft); }}
              placeholder="Name this version"
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSaveAsOpen(false)}>Cancel</Button>
            <Button onClick={() => saveAs(nameDraft)}><Save /> Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Rename resume</DialogTitle></DialogHeader>
          <Input
            autoFocus
            value={nameDraft}
            onChange={e => setNameDraft(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") renameCurrent(nameDraft); }}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRenameOpen(false)}>Cancel</Button>
            <Button onClick={() => renameCurrent(nameDraft)}>Save name</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="mx-auto max-w-[1600px] grid lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)_minmax(0,360px)] gap-6 px-6 py-6">
        {/* Editor */}
        <div className="no-print space-y-6">
          <Card title="Design">
            <div className="space-y-4">
              <div>
                <Label className="text-xs text-muted-foreground">Template</Label>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {TEMPLATES.map(t => (
                    <button
                      key={t.id}
                      onClick={() => update("template", t.id)}
                      className={cn(
                        "rounded-lg border p-2.5 text-left transition-all hover:border-[var(--navy-light)]",
                        data.template === t.id ? "border-[var(--navy-light)] bg-[var(--navy-light)]/5 ring-2 ring-[var(--navy-light)]/30" : "border-border"
                      )}
                    >
                      <TemplateThumb id={t.id} accent={data.accentHex} />
                      <div className="mt-1.5 text-xs font-medium">{t.label}</div>
                      <div className="text-[10px] text-muted-foreground">{t.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <Label className="text-xs text-muted-foreground">Accent color</Label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {COLOR_PRESETS.map(c => (
                    <button
                      key={c.id}
                      title={c.label}
                      onClick={() => update("accentHex", c.hex)}
                      className={cn("h-7 w-7 rounded-full border-2 transition-transform hover:scale-110", data.accentHex === c.hex ? "border-foreground ring-2 ring-foreground/20" : "border-white shadow-sm")}
                      style={{ background: c.hex }}
                    />
                  ))}
                  <label className="h-7 w-7 rounded-full border-2 border-dashed border-border flex items-center justify-center cursor-pointer overflow-hidden">
                    <input type="color" value={data.accentHex} onChange={e => update("accentHex", e.target.value)} className="h-10 w-10 cursor-pointer border-0 bg-transparent p-0" />
                  </label>
                </div>
              </div>

              <div>
                <Label className="text-xs text-muted-foreground">Background</Label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {BG_PRESETS.map(c => (
                    <button
                      key={c.id}
                      title={c.label}
                      onClick={() => update("bgHex", c.hex)}
                      className={cn("h-7 w-7 rounded-full border-2 transition-transform hover:scale-110", data.bgHex === c.hex ? "border-foreground ring-2 ring-foreground/20" : "border-border")}
                      style={{ background: c.hex }}
                    />
                  ))}
                  <label className="h-7 w-7 rounded-full border-2 border-dashed border-border flex items-center justify-center cursor-pointer overflow-hidden">
                    <input type="color" value={data.bgHex} onChange={e => update("bgHex", e.target.value)} className="h-10 w-10 cursor-pointer border-0 bg-transparent p-0" />
                  </label>
                </div>
              </div>

              <div>
                <Label className="text-xs text-muted-foreground">Font</Label>
                <select
                  value={data.fontId}
                  onChange={e => update("fontId", e.target.value)}
                  className="mt-1.5 w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                >
                  {FONT_PRESETS.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-muted-foreground">Font size</Label>
                  <span className="text-xs tabular-nums text-muted-foreground">{data.fontSize.toFixed(1)} pt</span>
                </div>
                <Slider
                  className="mt-2"
                  min={9} max={13} step={0.5}
                  value={[data.fontSize]}
                  onValueChange={([v]) => update("fontSize", v)}
                />
              </div>

              <div>
                <Label className="text-xs text-muted-foreground">Section order</Label>
                <p className="text-[11px] text-muted-foreground mt-0.5 mb-2">Drag to reorder how sections appear on the resume.</p>
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onSectionDragEnd}>
                  <SortableContext items={data.sectionOrder} strategy={verticalListSortingStrategy}>
                    <div className="space-y-1.5">
                      {data.sectionOrder.map(id => <SortableSectionRow key={id} id={id} onRemove={() => removeSectionFromOrder(id)} />)}
                    </div>
                  </SortableContext>
                </DndContext>
                <div className="mt-3">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="sm" variant="outline" className="w-full"><Plus /> Add section</Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      {(["projects","certifications","awards","languages"] as SectionId[]).map(id => (
                        <DropdownMenuItem key={id} disabled={data.sectionOrder.includes(id)} onClick={() => addSectionIfMissing(id)}>
                          {SECTION_LABELS[id]}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </div>
          </Card>

          <Card title="Personal">
            <Grid>
              <Field label="Full name"><Input value={data.name} onChange={e => update("name", e.target.value)} /></Field>
              <Field label="Headline"><Input value={data.headline} onChange={e => update("headline", e.target.value)} /></Field>
              <Field label="Email"><Input value={data.email} onChange={e => update("email", e.target.value)} /></Field>
              <Field label="Phone"><Input value={data.phone} onChange={e => update("phone", e.target.value)} /></Field>
              <Field label="Location"><Input value={data.location} onChange={e => update("location", e.target.value)} /></Field>
              <Field label="Links"><Input value={data.links} onChange={e => update("links", e.target.value)} /></Field>
            </Grid>
          </Card>

          <Card
            title="Summary"
            action={
              <Button size="sm" variant="accent" onClick={rewriteSummary} disabled={rewriting}>
                {rewriting ? <Loader2 className="animate-spin" /> : <Sparkles />}
                {rewriting ? "Rewriting…" : "Rewrite with AI"}
              </Button>
            }
          >
            <Textarea rows={4} value={data.summary} onChange={e => update("summary", e.target.value)} placeholder="2-3 sentences on who you are and what you do." />
            <p className="mt-2 text-xs text-muted-foreground">Tip: paste a job description below for a tailored rewrite.</p>
          </Card>

          <Card title="Experience" action={<Button size="sm" variant="outline" onClick={addExp}><Plus /> Add</Button>}>
            <div className="space-y-4">
              {data.experience.map(e => (
                <div key={e.id} className="rounded-lg border border-border p-4 bg-background">
                  <Grid>
                    <Field label="Title"><Input value={e.title} onChange={ev => updateExp(e.id, { title: ev.target.value })} /></Field>
                    <Field label="Company"><Input value={e.company} onChange={ev => updateExp(e.id, { company: ev.target.value })} /></Field>
                    <Field label="Dates" full><Input value={e.date} onChange={ev => updateExp(e.id, { date: ev.target.value })} placeholder="2022 — Present" /></Field>
                  </Grid>
                  <div className="mt-3">
                    <Label className="text-xs text-muted-foreground">Bullets (one per line)</Label>
                    <Textarea rows={4} className="mt-1.5" value={e.bullets} onChange={ev => updateExp(e.id, { bullets: ev.target.value })} placeholder="Led redesign of checkout flow, lifting conversion 18%." />
                  </div>
                  <div className="mt-2 flex justify-end">
                    <Button size="sm" variant="ghost" onClick={() => removeExp(e.id)}><Trash2 /> Remove</Button>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card title="Education" action={<Button size="sm" variant="outline" onClick={addEdu}><Plus /> Add</Button>}>
            <div className="space-y-3">
              {data.education.map(ed => (
                <div key={ed.id} className="rounded-lg border border-border p-4 bg-background">
                  <Grid>
                    <Field label="Degree" full><Input value={ed.degree} onChange={ev => updateEdu(ed.id, { degree: ev.target.value })} /></Field>
                    <Field label="School"><Input value={ed.school} onChange={ev => updateEdu(ed.id, { school: ev.target.value })} /></Field>
                    <Field label="Date"><Input value={ed.date} onChange={ev => updateEdu(ed.id, { date: ev.target.value })} /></Field>
                  </Grid>
                  <div className="mt-2 flex justify-end">
                    <Button size="sm" variant="ghost" onClick={() => removeEdu(ed.id)}><Trash2 /> Remove</Button>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card title="Skills">
            <Textarea rows={3} value={data.skills} onChange={e => update("skills", e.target.value)} placeholder="Comma-separated skills" />
          </Card>

          <Card title="Target job description">
            <p className="text-xs text-muted-foreground mb-2">Paste the job posting to score keyword match and surface missing terms.</p>
            <Textarea rows={6} value={data.jobDescription} onChange={e => update("jobDescription", e.target.value)} placeholder="Paste the job description here..." />
          </Card>
        </div>

        {/* Preview */}
        <div className="min-w-0">
          <div className="overflow-auto rounded-xl">
            <ResumeDocument data={data} />
          </div>
        </div>

        {/* ATS panel */}
        <aside className="no-print space-y-4 lg:sticky lg:top-20 self-start">
          <div className="rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Gauge className="h-4 w-4 text-[var(--navy-light)]" /> ATS SCORE
            </div>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="font-display text-5xl font-bold">{score.score}</span>
              <span className="text-muted-foreground">/100</span>
            </div>
            <div className="mt-3 h-2 rounded-full bg-secondary overflow-hidden">
              <div className="h-full rounded-full transition-all" style={{ width: `${score.score}%`, background: "var(--gradient-accent)" }} />
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              {score.score >= 85 ? "Excellent — ready to apply." : score.score >= 65 ? "Solid. A few fixes will push it higher." : "Needs work. Tackle the items below."}
            </p>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <div className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-3">Checks</div>
            <ul className="space-y-2.5">
              {score.checks.map(c => (
                <li key={c.label} className="flex gap-2.5 text-sm">
                  {c.pass
                    ? <CheckCircle2 className="h-4 w-4 mt-0.5 text-[var(--navy-light)] shrink-0" />
                    : <XCircle className="h-4 w-4 mt-0.5 text-destructive shrink-0" />}
                  <div>
                    <div className={c.pass ? "" : "font-medium"}>{c.label}</div>
                    {!c.pass && c.hint && <div className="text-xs text-muted-foreground">{c.hint}</div>}
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {data.jobDescription && (
            <div className="rounded-xl border border-border bg-card p-5">
              <div className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-3">Keyword match · {(score.coverage * 100).toFixed(0)}%</div>
              {score.missing.length > 0 ? (
                <>
                  <div className="text-xs text-muted-foreground mb-2">Missing from your resume:</div>
                  <div className="flex flex-wrap gap-1.5">
                    {score.missing.slice(0, 20).map(k => (
                      <span key={k} className="text-xs px-2 py-1 rounded-md bg-destructive/10 text-destructive border border-destructive/20">{k}</span>
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Every keyword from the JD appears in your resume. 🎯</p>
              )}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function Card({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display font-semibold">{title}</h3>
        {action}
      </div>
      {children}
    </div>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-3">{children}</div>;
}

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={full ? "col-span-2" : ""}>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

function SortableSectionRow({ id }: { id: SectionId }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm cursor-grab active:cursor-grabbing hover:border-[var(--navy-light)]"
    >
      <GripVertical className="h-4 w-4 text-muted-foreground" />
      <span className="font-medium">{SECTION_LABELS[id]}</span>
    </div>
  );
}

function TemplateThumb({ id, accent }: { id: TemplateId; accent: string }) {
  if (id === "two-column") {
    return (
      <div className="aspect-[3/4] w-full rounded bg-white border border-border overflow-hidden flex">
        <div className="w-1/3 h-full" style={{ background: accent }} />
        <div className="flex-1 p-1 space-y-1">
          <div className="h-1 w-3/4 rounded bg-foreground/30" />
          <div className="h-0.5 w-full rounded bg-foreground/10" />
          <div className="h-0.5 w-5/6 rounded bg-foreground/10" />
          <div className="h-0.5 w-2/3 rounded bg-foreground/10" />
        </div>
      </div>
    );
  }
  if (id === "modern") {
    return (
      <div className="aspect-[3/4] w-full rounded bg-white border border-border overflow-hidden">
        <div className="h-1/4 w-full p-1 flex items-end" style={{ background: accent }}>
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
  return (
    <div className="aspect-[3/4] w-full rounded bg-white border border-border overflow-hidden p-1.5 flex flex-col items-center">
      <div className="h-1 w-2/3 rounded" style={{ background: accent }} />
      <div className="mt-0.5 h-0.5 w-1/2 rounded bg-foreground/30" />
      <div className="mt-1 h-px w-full" style={{ background: accent, opacity: 0.4 }} />
      <div className="mt-1 self-stretch space-y-1">
        <div className="h-0.5 w-full rounded bg-foreground/10" />
        <div className="h-0.5 w-5/6 rounded bg-foreground/10" />
        <div className="h-0.5 w-3/4 rounded bg-foreground/10" />
      </div>
    </div>
  );
}