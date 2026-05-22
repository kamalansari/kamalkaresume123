import { useEffect, useMemo, useState } from "react";
import { flushSync } from "react-dom";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Plus, Trash2, Gauge, CheckCircle2, XCircle, Sparkles, Loader2, GripVertical, FileType, FileText, Save, FolderOpen, FilePlus2, Check, Pencil, Briefcase, ExternalLink, AlignJustify, Bold, X, PanelRightOpen, Wand2, Copy, Download, FolderOpen as OpenIcon, MousePointerClick, Columns, Square, Star, Shield, RotateCcw, User, UserPlus, IdCard, Upload, Eye } from "lucide-react";
import { toast } from "sonner";
import { defaultResume, FONT_PRESETS, COLOR_PRESETS, type ResumeData, type Experience, type Education, type Project, type Certification, type Award, type Language, type TemplateId, type SectionId } from "./types";
import { computeScore } from "./atsScore";
import { ResumeDocument } from "./ResumeDocument";
import { exportDocx } from "./exportDocx";
import { resumeStore, newId, type SavedResume } from "./resumeStore";
import { profileStore, type Profile } from "./profileStore";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, verticalListSortingStrategy, sortableKeyboardCoordinates, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Slider } from "@/components/ui/slider";
import { parseSkills } from "@/lib/parseSkills";
import { cn } from "@/lib/utils";
import { FormattableTextarea } from "./FormattableTextarea";
import { AtsPanel } from "./AtsPanel";
import { PreviewToolbar } from "./PreviewToolbar";
import { SavedResumesGallery } from "./SavedResumesGallery";
import { TemplatesPopover, SectionsPopover, StylePopover } from "./BuilderTopToolbar";
import lzString from "lz-string";
const { decompressFromEncodedURIComponent } = lzString;
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

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
  { id: "professional", label: "Professional", desc: "Uppercase classic" },
  { id: "modern", label: "Modern", desc: "Bold header bar" },
  { id: "executive", label: "Executive", desc: "Authoritative band" },
  { id: "minimal", label: "Minimal", desc: "Quiet & spacious" },
  { id: "two-column", label: "Two column", desc: "Sidebar layout" },
  { id: "fresher", label: "Fresher", desc: "Friendly cream sidebar" },
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
  const [renameTargetId, setRenameTargetId] = useState<string | null>(null);
  const [atsOpen, setAtsOpen] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [jdDialogOpen, setJdDialogOpen] = useState(false);
  const [jdDialogText, setJdDialogText] = useState("");
  const [jdSaveAsNew, setJdSaveAsNew] = useState(true);
  const [jdTailoredName, setJdTailoredName] = useState("");
  const [primaryId, setPrimaryId] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [inlineEdit, setInlineEdit] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [atsSheetOpen, setAtsSheetOpen] = useState(false);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null);
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
  const [profileNameDraft, setProfileNameDraft] = useState("");
  const [profileRenameId, setProfileRenameId] = useState<string | null>(null);
  const score = useMemo(() => computeScore(data), [data]);

  const profileApplied = useMemo(() => {
    const p = profileStore.get();
    if (!p) return false;
    const eq = (a: unknown, b: unknown) => JSON.stringify(a ?? "") === JSON.stringify(b ?? "");
    const hasAny = !!(p.name || p.headline || p.email || p.phone || p.location || (p.links && (p.links as string).length) || (p.education && (p.education as unknown[]).length));
    if (!hasAny) return false;
    return (
      eq(p.name, data.name) && eq(p.headline, data.headline) && eq(p.email, data.email) &&
      eq(p.phone, data.phone) && eq(p.location, data.location) && eq(p.links, data.links) &&
      eq(p.education, data.education)
    );
  }, [data.name, data.headline, data.email, data.phone, data.location, data.links, data.education]);

  useEffect(() => { setSaved(resumeStore.list()); setPrimaryId(resumeStore.getPrimaryId()); }, []);
  useEffect(() => { setMounted(true); }, []);

  // Load profiles and apply active profile on first mount
  useEffect(() => {
    setProfiles(profileStore.list());
    setActiveProfileId(profileStore.getActiveId());
    const p = profileStore.get();
    if (p) setData(d => ({ ...d, ...p }));
  }, []);

  // Auto-save profile fields to the active profile whenever they change
  useEffect(() => {
    if (!mounted) return;
    profileStore.save(data);
    setProfiles(profileStore.list());
    setActiveProfileId(profileStore.getActiveId());
  }, [mounted, data.name, data.headline, data.email, data.phone, data.location, data.links, data.education]);

  // Load shared resume from URL hash (#r=...) once on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    const hash = window.location.hash;
    if (!hash.startsWith("#r=")) return;
    try {
      const raw = decompressFromEncodedURIComponent(hash.slice(3));
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<ResumeData>;
      setData(d => ({ ...d, ...parsed }));
      setCurrentName("Shared resume");
      setCurrentId(null);
      toast.success("Loaded shared resume");
      window.history.replaceState(null, "", window.location.pathname);
    } catch {
      // ignore malformed share links
    }
  }, []);

  const refreshList = () => { setSaved(resumeStore.list()); setPrimaryId(resumeStore.getPrimaryId()); };

  const setAsPrimary = (id: string, name: string) => {
    resumeStore.setPrimary(id);
    refreshList();
    toast.success(`"${name}" is now your Primary Resume`);
  };

  const loadPrimary = () => {
    const p = resumeStore.getPrimary();
    if (!p) { toast.error("No Primary Resume set. Save one and mark it as Primary."); return; }
    setData({ ...defaultResume, ...p.data });
    setCurrentId(p.id);
    setCurrentName(p.name);
    toast.success(`Loaded Primary: "${p.name}"`);
  };

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
    const targetId = renameTargetId ?? currentId;
    if (!trimmed || !targetId) return;
    resumeStore.rename(targetId, trimmed);
    if (targetId === currentId) setCurrentName(trimmed);
    setRenameOpen(false);
    setRenameTargetId(null);
    refreshList();
    toast.success("Renamed");
  };

  const deleteSaved = (id: string, name: string) => {
    resumeStore.remove(id);
    if (currentId === id) { setCurrentId(null); setCurrentName("Untitled resume"); }
    refreshList();
    toast.success(`Deleted "${name}"`);
  };

  const duplicateSaved = (id: string) => {
    const copy = resumeStore.duplicate(id);
    if (!copy) { toast.error("Could not duplicate"); return; }
    refreshList();
    toast.success(`Duplicated as "${copy.name}"`);
  };

  const downloadSavedDocx = async (id: string) => {
    const entry = resumeStore.get(id);
    if (!entry) return;
    try { await exportDocx(entry.data); toast.success(`Downloaded "${entry.name}"`); }
    catch { toast.error("DOCX export failed"); }
  };

  const printSavedPdf = (id: string) => {
    const entry = resumeStore.get(id);
    if (!entry) { toast.error("Resume not found"); return; }
    flushSync(() => {
      setData({ ...defaultResume, ...entry.data });
      setCurrentId(entry.id);
      setCurrentName(entry.name);
    });
    requestAnimationFrame(() => window.print());
  };

  const openRenameFor = (id: string, name: string) => {
    setRenameTargetId(id);
    setNameDraft(name);
    setRenameOpen(true);
  };

  const scrollToEditor = (id: SectionId | "header") => {
    const anchor = id === "header" ? "edit-personal" : `edit-${id}`;
    const el = document.getElementById(anchor);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    el.classList.add("ring-2", "ring-[var(--navy-light)]");
    setTimeout(() => el.classList.remove("ring-2", "ring-[var(--navy-light)]"), 1400);
    const firstInput = el.querySelector<HTMLInputElement | HTMLTextAreaElement>("input, textarea");
    firstInput?.focus();
  };

  const newResume = () => {
    const p = profileStore.get();
    setData({ ...defaultResume, ...(p ?? {}) });
    setCurrentId(null);
    setCurrentName("Untitled resume");
    toast.success("Started a new resume");
  };

  const refreshProfiles = () => {
    setProfiles(profileStore.list());
    setActiveProfileId(profileStore.getActiveId());
  };

  const applyProfileFields = (p: Profile) => {
    setData(d => ({ ...d, ...p.fields }));
  };

  const switchProfile = (id: string) => {
    const p = profileStore.list().find(x => x.id === id);
    if (!p) return;
    profileStore.setActive(id);
    applyProfileFields(p);
    refreshProfiles();
    toast.success(`Switched to "${p.name}"`);
  };

  const createProfile = (name: string, fromCurrent: boolean) => {
    const trimmed = name.trim() || "Untitled profile";
    const p = profileStore.create(trimmed, fromCurrent ? {
      name: data.name, headline: data.headline, email: data.email,
      phone: data.phone, location: data.location, links: data.links, education: data.education,
    } : {});
    if (!fromCurrent) applyProfileFields(p);
    refreshProfiles();
    setProfileDialogOpen(false);
    setProfileNameDraft("");
    toast.success(`Profile "${p.name}" created`);
  };

  const renameProfile = (id: string, name: string) => {
    profileStore.rename(id, name);
    refreshProfiles();
    setProfileRenameId(null);
    setProfileNameDraft("");
    toast.success("Profile renamed");
  };

  const deleteProfile = (id: string, name: string) => {
    if (typeof window !== "undefined" && !window.confirm(`Delete profile "${name}"? Saved resumes are not affected.`)) return;
    profileStore.remove(id);
    refreshProfiles();
    const next = profileStore.get();
    if (next) setData(d => ({ ...d, ...next }));
    toast.success(`Deleted "${name}"`);
  };

  const exportProfiles = () => {
    const list = profileStore.list();
    if (!list.length) { toast.error("No profiles to export"); return; }
    const payload = {
      type: "resumeforge.profiles",
      version: 1,
      exportedAt: new Date().toISOString(),
      activeId: profileStore.getActiveId(),
      profiles: list,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `resumeforge-profiles-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${list.length} profile${list.length === 1 ? "" : "s"}`);
  };

  const exportSingleProfile = (p: Profile) => {
    const payload = {
      type: "resumeforge.profile",
      version: 1,
      exportedAt: new Date().toISOString(),
      profile: p,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const safe = (p.name || "profile").replace(/[^a-z0-9\-_]+/gi, "-").toLowerCase();
    a.download = `resumeforge-profile-${safe}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast.success(`Exported "${p.name}"`);
  };

  const previewProfile = (p: Profile) => {
    // Switch + scroll the live preview into view so the user can see it instantly.
    switchProfile(p.id);
    setTimeout(() => {
      const el = document.getElementById("resume-preview");
      el?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  };

  const importProfiles = () => {
    if (typeof window === "undefined") return;
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json,.json";
    input.multiple = true;
    input.onchange = async () => {
      const files = Array.from(input.files ?? []);
      if (!files.length) return;

      // Collect profile candidates from every supported file shape:
      //  - { type: "resumeforge.profiles", profiles: [...] }
      //  - { type: "resumeforge.profile",  profile: {...} }
      //  - a single Profile object
      //  - a saved resume / raw ResumeData (extract profile fields)
      const candidates: Profile[] = [];
      for (const file of files) {
        try {
          const text = await file.text();
          const parsed = JSON.parse(text);
          const pushFromFields = (name: string, src: Partial<ResumeData> & { id?: string }) => {
            candidates.push({
              id: src.id ?? "",
              name: name || src.name || "Imported",
              fields: {
                name: src.name ?? "",
                headline: src.headline ?? "",
                email: src.email ?? "",
                phone: src.phone ?? "",
                location: src.location ?? "",
                links: src.links ?? "",
                education: src.education ?? [],
              },
            });
          };
          if (parsed?.type === "resumeforge.profiles" && Array.isArray(parsed.profiles)) {
            for (const p of parsed.profiles) if (p?.fields) candidates.push(p as Profile);
          } else if (parsed?.type === "resumeforge.profile" && parsed.profile?.fields) {
            candidates.push(parsed.profile as Profile);
          } else if (parsed?.fields && typeof parsed.fields === "object") {
            candidates.push(parsed as Profile);
          } else if (parsed?.data && typeof parsed.data === "object") {
            // Saved-resume export shape: { id, name, data: ResumeData }
            pushFromFields(parsed.name || file.name.replace(/\.json$/i, ""), parsed.data);
          } else if (parsed && typeof parsed === "object") {
            // Raw ResumeData / arbitrary object with profile-like fields
            pushFromFields(parsed.name || file.name.replace(/\.json$/i, ""), parsed);
          }
        } catch {
          toast.error(`Could not read "${file.name}"`);
        }
      }

      if (!candidates.length) { toast.error("No profiles found in selected file(s)"); return; }

      const replace = window.confirm(
        `Import ${candidates.length} profile(s)?\n\nOK = Replace all existing profiles\nCancel = Merge (skip duplicates by id)`
      );
      if (replace) profileStore.list().forEach(p => profileStore.remove(p.id));

      let added = 0, updated = 0;
      const seen = new Set<string>();
      for (const p of candidates) {
        // Prevent duplicates within the same import batch as well
        if (p.id && seen.has(p.id)) { updated++; continue; }
        const res = profileStore.upsert(p, { preserveId: !!p.id });
        if (p.id) seen.add(res.profile.id);
        if (res.status === "added") added++; else updated++;
      }
      refreshProfiles();
      const active = profileStore.get();
      if (active) setData(d => ({ ...d, ...active }));
      toast.success(
        `Imported ${added} new${updated ? `, updated ${updated}` : ""} profile${added + updated === 1 ? "" : "s"}`
      );
    };
    input.click();
  };

  const resetProfile = () => {
    if (typeof window !== "undefined" && !window.confirm("Reset your saved profile? This clears your name, contact info, links, and education from this device. Saved resumes are not affected.")) return;
    profileStore.clear();
    setData(d => ({
      ...d,
      name: "",
      headline: "",
      email: "",
      phone: "",
      location: "",
      links: "",
      education: [],
    }));
    toast.success("Profile reset");
  };

  const update = <K extends keyof ResumeData>(k: K, v: ResumeData[K]) => setData(d => ({ ...d, [k]: v }));

  const updatePatch = (patch: Partial<ResumeData>) => setData(d => ({ ...d, ...patch }));

  const commitPreviewEdits = (source: ResumeData = data, opts: { sync?: boolean } = { sync: true }): ResumeData => {
    if (typeof document === "undefined") return source;
    const root = document.getElementById("resume-preview");
    if (!root) return source;

    let next = source;
    let dirty = false;
    root.querySelectorAll<HTMLElement>("[data-preview-edit]").forEach(el => {
      const kind = el.dataset.previewEdit;
      if (kind === "summary") {
        const value = el.innerText;
        if (value !== source.summary) { next = { ...next, summary: value }; dirty = true; }
      }
      if (kind === "skills") {
        const value = el.innerText;
        const displayed = parseSkills(source.skills).join(" | ");
        if (value !== displayed && value !== source.skills) { next = { ...next, skills: value }; dirty = true; }
      }
      if (kind === "experience-bullets") {
        const id = el.dataset.previewExpId;
        const current = source.experience.find(e => e.id === id);
        if (!id || !current) return;
        const bullets = el.innerText.split("\n").map(line => line.replace(/^\s*[•-]\s*/, "").trim()).filter(Boolean).join("\n");
        if (bullets !== current.bullets) {
          next = { ...next, experience: next.experience.map(e => e.id === id ? { ...e, bullets } : e) };
          dirty = true;
        }
      }
    });

    if (dirty && opts.sync !== false) flushSync(() => setData(next));
    return next;
  };

  const printCurrentResume = () => {
    commitPreviewEdits();
    requestAnimationFrame(() => window.print());
  };

  // Autosave: continuously sync contentEditable edits in the preview to the
  // saved-resume store (and React state on idle) so that downloads, share
  // links, and the saved-resumes gallery always reflect the latest text —
  // without requiring the user to blur the field first. We avoid calling
  // setData synchronously while the user is typing because the editable
  // sections use content-based React keys that would remount and lose caret.
  useEffect(() => {
    if (!mounted) return;
    const root = document.getElementById("resume-preview");
    if (!root) return;
    let storeTimer: ReturnType<typeof setTimeout> | null = null;
    let stateTimer: ReturnType<typeof setTimeout> | null = null;
    const onInput = (e: Event) => {
      const target = e.target as HTMLElement | null;
      if (!target || !target.closest?.("[data-preview-edit]")) return;
      // Persist to the saved-resume store quickly (no re-render).
      if (storeTimer) clearTimeout(storeTimer);
      storeTimer = setTimeout(() => {
        const next = commitPreviewEdits(data, { sync: false });
        if (currentId) {
          resumeStore.upsert({ id: currentId, name: currentName, updatedAt: Date.now(), data: next });
          setSaved(resumeStore.list());
        }
      }, 300);
      // Sync to React state after the user pauses, so downloads via getData()
      // and share links pick up the latest text even before blur.
      if (stateTimer) clearTimeout(stateTimer);
      stateTimer = setTimeout(() => { commitPreviewEdits(); }, 900);
    };
    root.addEventListener("input", onInput);
    return () => {
      root.removeEventListener("input", onInput);
      if (storeTimer) clearTimeout(storeTimer);
      if (stateTimer) clearTimeout(stateTimer);
    };
  }, [mounted, data, currentId, currentName]);

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
    try { await exportDocx(commitPreviewEdits()); toast.success("DOCX downloaded"); }
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

  const rewriteFromPreview = async (kind: "summary" | "skills" | "experience-bullets", refId?: string) => {
    if (kind === "summary") { await rewriteSummary(); return; }
    if (kind === "skills") {
      const out = await rewriteWithAI("skills", data.skills, {}, "skills");
      if (out) { update("skills", out); toast.success("Skills rewritten"); }
      return;
    }
    if (kind === "experience-bullets" && refId) {
      const e = data.experience.find(x => x.id === refId);
      if (!e) return;
      const out = await rewriteWithAI("bullets", e.bullets, { title: e.title, company: e.company }, `exp-${e.id}`);
      if (out) { updateExp(e.id, { bullets: out }); toast.success("Bullets rewritten"); }
    }
  };

  const generateFromJD = async () => {
    if (!data.jobDescription.trim()) { toast.error("Paste a job description first."); return; }
    setGenerating(true);
    try {
      const res = await fetch("/api/generate-from-jd", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          jobDescription: data.jobDescription,
          current: {
            name: data.name,
            headline: data.headline,
            summary: data.summary,
            skills: data.skills,
            experience: data.experience.map(e => ({ id: e.id, title: e.title, company: e.company, bullets: e.bullets })),
          },
        }),
      });
      if (res.status === 429) { toast.error("Rate limit hit."); return; }
      if (res.status === 402) { toast.error("AI credits exhausted."); return; }
      if (!res.ok) { toast.error("AI tailoring failed."); return; }
      const out = (await res.json()) as { headline?: string; summary?: string; skills?: string; experience?: { id: string; bullets: string }[] };
      setData(d => ({
        ...d,
        headline: out.headline || d.headline,
        summary: out.summary || d.summary,
        skills: out.skills || d.skills,
        experience: d.experience.map(e => {
          const match = out.experience?.find(x => x.id === e.id);
          return match ? { ...e, bullets: match.bullets } : e;
        }),
      }));
      toast.success("Resume tailored to JD");
    } catch {
      toast.error("Network error.");
    } finally {
      setGenerating(false);
    }
  };

  const generateAtsResumeFromDialog = async () => {
    const jd = jdDialogText.trim();
    if (!jd) { toast.error("Paste a job description first."); return; }
    setGenerating(true);
    try {
      // Always tailor from Primary Resume if set (keeps career data secure & editable)
      const primary = resumeStore.getPrimary();
      const source: ResumeData = primary ? { ...defaultResume, ...primary.data } : data;
      const res = await fetch("/api/generate-from-jd", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          jobDescription: jd,
          current: {
            name: source.name,
            headline: source.headline,
            summary: source.summary,
            skills: source.skills,
            experience: source.experience.map(e => ({ id: e.id, title: e.title, company: e.company, bullets: e.bullets })),
          },
        }),
      });
      if (res.status === 429) { toast.error("Rate limit hit."); return; }
      if (res.status === 402) { toast.error("AI credits exhausted."); return; }
      if (!res.ok) { toast.error("AI generation failed."); return; }
      const out = (await res.json()) as { headline?: string; summary?: string; skills?: string; experience?: { id: string; bullets: string }[] };
      const tailored: ResumeData = {
        ...source,
        jobDescription: jd,
        headline: out.headline || source.headline,
        summary: out.summary || source.summary,
        skills: out.skills || source.skills,
        experience: source.experience.map(e => {
          const match = out.experience?.find(x => x.id === e.id);
          return match ? { ...e, bullets: match.bullets } : e;
        }),
      };
      if (jdSaveAsNew) {
        // Save tailored version as a NEW resume — Primary stays untouched
        const id = newId();
        const name = (jdTailoredName.trim() || `Tailored — ${new Date().toLocaleDateString()}`);
        resumeStore.upsert({ id, name, updatedAt: Date.now(), data: tailored });
        setData(tailored);
        setCurrentId(id);
        setCurrentName(name);
        refreshList();
        toast.success(primary ? `Tailored from Primary, saved as "${name}"` : `Tailored resume saved as "${name}"`);
      } else {
        setData(tailored);
        toast.success("ATS-tailored resume generated");
      }
      setJdDialogOpen(false);
      setJdDialogText("");
      setJdTailoredName("");
    } catch {
      toast.error("Network error.");
    } finally {
      setGenerating(false);
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
            {mounted && profileApplied && (
              <span
                className="hidden md:inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-300"
                title="Your saved profile (name, contact, education) is applied to this resume"
              >
                <CheckCircle2 className="h-3 w-3" /> Profile applied
              </span>
            )}
            <Button variant="accent" onClick={saveCurrent} title={currentId ? `Save "${currentName}"` : "Save resume"}>
              <Save /> <span className="hidden sm:inline">{currentId ? "Save" : "Save…"}</span>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" title="Manage profile templates">
                  <IdCard /> <span className="hidden sm:inline">Profile</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-72">
                <DropdownMenuLabel className="text-[11px] uppercase tracking-widest text-muted-foreground inline-flex items-center gap-1.5">
                  <User className="h-3 w-3" /> Profiles ({profiles.length})
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {profiles.length === 0 && (
                  <div className="px-2 py-2 text-xs text-muted-foreground">
                    No profiles yet. Edit your personal info and a default profile is created automatically.
                  </div>
                )}
                <div className="max-h-64 overflow-auto">
                  {profiles.map(p => (
                    <div key={p.id} className="group rounded-sm px-1 py-1 hover:bg-accent/40">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => switchProfile(p.id)}
                          className="flex-1 text-left rounded-sm px-2 py-1"
                          title={`Apply ${p.name}`}
                        >
                          <div className="flex items-center gap-2">
                            {p.id === activeProfileId
                              ? <Check className="h-3.5 w-3.5 text-emerald-600" />
                              : <span className="inline-block w-3.5" />
                            }
                            <span className="truncate text-sm font-medium">{p.name}</span>
                          </div>
                          <div className="ml-5 truncate text-[11px] text-muted-foreground">
                            {p.fields.name || "—"}{p.fields.email ? ` · ${p.fields.email}` : ""}
                          </div>
                        </button>
                        <button
                          onClick={() => previewProfile(p)}
                          className="rounded p-1 opacity-60 hover:opacity-100 hover:bg-accent"
                          title="Preview in resume"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => exportSingleProfile(p)}
                          className="rounded p-1 opacity-60 hover:opacity-100 hover:bg-accent"
                          title="Download this profile (.json)"
                        >
                          <Download className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => { setProfileRenameId(p.id); setProfileNameDraft(p.name); }}
                          className="rounded p-1 opacity-60 hover:opacity-100 hover:bg-accent"
                          title="Rename profile"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => deleteProfile(p.id, p.name)}
                          className="rounded p-1 opacity-60 hover:opacity-100 hover:bg-destructive/10 hover:text-destructive"
                          title="Delete profile"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => { setProfileNameDraft(""); setProfileDialogOpen(true); }}>
                  <UserPlus className="h-4 w-4" /> Save current as new profile…
                </DropdownMenuItem>
                <DropdownMenuItem onClick={exportProfiles} disabled={profiles.length === 0}>
                  <Download className="h-4 w-4" /> Export profiles (.json)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={importProfiles}>
                  <Upload className="h-4 w-4" /> Import profiles…
                </DropdownMenuItem>
                <DropdownMenuItem onClick={resetProfile}>
                  <RotateCcw className="h-4 w-4" /> Reset active profile
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
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
                <DropdownMenuItem onClick={resetProfile}>
                  <RotateCcw className="h-4 w-4" /> Reset profile
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-[11px] uppercase tracking-widest text-muted-foreground inline-flex items-center gap-1.5">
                  <Shield className="h-3 w-3" /> Primary Resume
                </DropdownMenuLabel>
                <DropdownMenuItem onClick={loadPrimary} disabled={!primaryId}>
                  <OpenIcon className="h-4 w-4" /> Open Primary
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={!currentId}
                  onClick={() => currentId && setAsPrimary(currentId, currentName)}
                >
                  <Star className="h-4 w-4" /> Mark current as Primary
                </DropdownMenuItem>
                {primaryId && (
                  <DropdownMenuItem onClick={() => { resumeStore.setPrimary(null); refreshList(); toast.success("Primary cleared"); }}>
                    <X className="h-4 w-4" /> Clear Primary
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-[11px] uppercase tracking-widest text-muted-foreground">
                  Saved ({saved.length})
                </DropdownMenuLabel>
                {saved.length === 0 && (
                  <div className="px-2 py-2 text-xs text-muted-foreground">No saved resumes yet. Use “Save as new…” to create one per job.</div>
                )}
                <div className="max-h-72 overflow-auto">
                {saved.map(s => (
                    <div key={s.id} className="group rounded-sm px-1.5 py-1 hover:bg-accent/40">
                      <button
                        onClick={() => loadSaved(s.id)}
                        className="w-full text-left rounded-sm px-2 py-1"
                        title="Open in editor"
                      >
                        <div className="flex items-center gap-2 text-sm font-medium truncate">
                          {currentId === s.id && <Check className="h-3.5 w-3.5 text-[var(--navy-light)]" />}
                          {primaryId === s.id && <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-500" />}
                          <span className="truncate">{s.name}</span>
                          {primaryId === s.id && <span className="text-[10px] uppercase tracking-widest text-amber-600">Primary</span>}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {new Date(s.updatedAt).toLocaleString()}
                        </div>
                      </button>
                      <div className="mt-1 flex items-center gap-1 px-1">
                        <RowAction icon={<OpenIcon className="h-3.5 w-3.5" />} label="Open" onClick={() => loadSaved(s.id)} />
                        <RowAction icon={<Star className={cn("h-3.5 w-3.5", primaryId === s.id && "fill-amber-400 text-amber-500")} />} label={primaryId === s.id ? "Primary" : "Set Primary"} onClick={() => setAsPrimary(s.id, s.name)} />
                        <RowAction icon={<Pencil className="h-3.5 w-3.5" />} label="Rename" onClick={() => openRenameFor(s.id, s.name)} />
                        <RowAction icon={<Copy className="h-3.5 w-3.5" />} label="Duplicate" onClick={() => duplicateSaved(s.id)} />
                        <RowAction icon={<Download className="h-3.5 w-3.5" />} label="DOCX" onClick={() => downloadSavedDocx(s.id)} />
                        <RowAction icon={<FileText className="h-3.5 w-3.5" />} label="PDF" onClick={() => printSavedPdf(s.id)} />
                        <RowAction icon={<Trash2 className="h-3.5 w-3.5" />} label="Delete" danger onClick={() => deleteSaved(s.id, s.name)} />
                      </div>
                    </div>
                  ))}
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="outline" onClick={() => { setJdDialogText(data.jobDescription); setJdDialogOpen(true); }}>
              <Wand2 /> <span className="hidden sm:inline">JD → Resume</span>
            </Button>
            <Link
              to="/jobs"
              className="inline-flex items-center gap-2 whitespace-nowrap rounded-md text-sm font-medium border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-3"
            >
              <Briefcase className="h-4 w-4" /> <span className="hidden sm:inline">Find Jobs</span>
            </Link>
            <Button variant="outline" onClick={handleDocx} disabled={exporting}>
              {exporting ? <Loader2 className="animate-spin" /> : <FileType />} DOCX
            </Button>
            <Button variant="hero" style={{ background: "var(--gradient-hero)" }} onClick={printCurrentResume}>
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
            <Button variant="ghost" onClick={() => { setRenameOpen(false); setRenameTargetId(null); }}>Cancel</Button>
            <Button onClick={() => renameCurrent(nameDraft)}>Save name</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={profileDialogOpen} onOpenChange={setProfileDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Save current personal info as profile</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Saves the current name, contact, links, and education as a reusable profile template you can switch between per resume.
          </p>
          <Input
            autoFocus
            placeholder="e.g. Personal, Freelance, Consulting"
            value={profileNameDraft}
            onChange={e => setProfileNameDraft(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") createProfile(profileNameDraft, true); }}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setProfileDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => createProfile(profileNameDraft, true)}>Create profile</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!profileRenameId} onOpenChange={(o) => { if (!o) { setProfileRenameId(null); setProfileNameDraft(""); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Rename profile</DialogTitle></DialogHeader>
          <Input
            autoFocus
            value={profileNameDraft}
            onChange={e => setProfileNameDraft(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && profileRenameId) renameProfile(profileRenameId, profileNameDraft); }}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setProfileRenameId(null); setProfileNameDraft(""); }}>Cancel</Button>
            <Button onClick={() => profileRenameId && renameProfile(profileRenameId, profileNameDraft)}>Save name</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={jdDialogOpen} onOpenChange={setJdDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Generate ATS-ready resume from a job description</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Paste the job posting below. AI will tailor your headline, summary, skills and bullets to match — keeping your real employers and dates.
          </p>
          <div className={cn("rounded-md border px-3 py-2 text-xs flex items-center gap-2",
            primaryId ? "border-amber-300/60 bg-amber-50 text-amber-900" : "border-border bg-muted text-muted-foreground")}>
            <Shield className="h-3.5 w-3.5" />
            {primaryId
              ? <>Tailoring from your <strong>Primary Resume</strong> — your original career data stays untouched.</>
              : <>No Primary Resume set. Tailoring will use the current editor data. Tip: mark one resume as Primary to keep a secure master copy.</>}
          </div>
          <Textarea
            autoFocus
            rows={12}
            value={jdDialogText}
            onChange={e => setJdDialogText(e.target.value)}
            placeholder="Paste the job description here…"
          />
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={jdSaveAsNew} onChange={e => setJdSaveAsNew(e.target.checked)} />
              Save tailored result as a new resume (keeps Primary safe)
            </label>
            {jdSaveAsNew && (
              <Input
                value={jdTailoredName}
                onChange={e => setJdTailoredName(e.target.value)}
                placeholder="Name this tailored version (e.g. “Stripe — Senior PM”)"
              />
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setJdDialogOpen(false)}>Cancel</Button>
            <Button onClick={generateAtsResumeFromDialog} disabled={generating || !jdDialogText.trim()}>
              {generating ? <Loader2 className="animate-spin" /> : <Sparkles />}
              {generating ? "Generating…" : "Generate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SavedResumesGallery
        saved={saved}
        currentId={currentId}
        primaryId={primaryId}
        onOpen={loadSaved}
        onRename={(id, name) => { resumeStore.rename(id, name); if (id === currentId) setCurrentName(name); refreshList(); toast.success("Renamed"); }}
        onDuplicate={duplicateSaved}
        onDelete={deleteSaved}
        onNew={newResume}
        onSetPrimary={setAsPrimary}
      />

      <div className={cn("mx-auto max-w-[1600px] grid gap-6 px-6 py-6",
        atsOpen
          ? "lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)_minmax(0,360px)]"
          : "lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]"
      )}>
        {/* Editor */}
        <div className="no-print space-y-6">
          <div id="edit-personal" className="rounded-xl">
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
          </div>

          <div id="edit-summary" className="rounded-xl">
          <Card
            title="Summary"
            action={
              <Button size="sm" variant="accent" onClick={rewriteSummary} disabled={rewriting}>
                {rewriting ? <Loader2 className="animate-spin" /> : <Sparkles />}
                {rewriting ? "Rewriting…" : "Rewrite with AI"}
              </Button>
            }
          >
            <FormattableTextarea rows={4} value={data.summary} onChange={v => update("summary", v)} placeholder="2-3 sentences on who you are and what you do." />
            <p className="mt-2 text-xs text-muted-foreground">Select text and click <b>B</b> to bold it. Tip: paste a job description below for a tailored rewrite.</p>
          </Card>
          </div>

          <div id="edit-experience" className="rounded-xl">
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
                    <div className="flex items-center justify-between">
                      <Label className="text-xs text-muted-foreground">Bullets (one per line)</Label>
                      <Button
                        size="sm" variant="ghost"
                        disabled={rewritingKey === `exp-${e.id}` || !e.bullets.trim()}
                        onClick={async () => {
                          const out = await rewriteWithAI("bullets", e.bullets, { title: e.title, company: e.company }, `exp-${e.id}`);
                          if (out) { updateExp(e.id, { bullets: out }); toast.success("Bullets rewritten"); }
                        }}
                      >
                        {rewritingKey === `exp-${e.id}` ? <Loader2 className="animate-spin" /> : <Sparkles />} AI rewrite
                      </Button>
                    </div>
                    <FormattableTextarea rows={4} className="mt-1.5" value={e.bullets} onChange={v => updateExp(e.id, { bullets: v })} placeholder="Led redesign of checkout flow, lifting conversion 18%." />
                  </div>
                  <div className="mt-2 flex justify-end">
                    <Button size="sm" variant="ghost" onClick={() => removeExp(e.id)}><Trash2 /> Remove</Button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
          </div>

          <div id="edit-education" className="rounded-xl">
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
          </div>

          <div id="edit-skills" className="rounded-xl">
          <Card
            title="Skills"
            action={
              <Button size="sm" variant="ghost" disabled={rewritingKey === "skills" || !data.skills.trim()}
                onClick={async () => {
                  const out = await rewriteWithAI("skills", data.skills, {}, "skills");
                  if (out) { update("skills", out); toast.success("Skills tuned"); }
                }}>
                {rewritingKey === "skills" ? <Loader2 className="animate-spin" /> : <Sparkles />} AI tune
              </Button>
            }
          >
            <Textarea rows={3} value={data.skills} onChange={e => update("skills", e.target.value)} placeholder="Comma or pipe separated: React | TypeScript, Figma | Design Systems" />
            <p className="mt-2 text-xs text-muted-foreground">Separate with <code>,</code> or <code>|</code>. {parseSkills(data.skills).length} skills detected.</p>
          </Card>
          </div>

          {data.sectionOrder.includes("projects") && (
            <div id="edit-projects" className="rounded-xl">
            <Card title="Projects" action={<Button size="sm" variant="outline" onClick={addProject}><Plus /> Add</Button>}>
              <div className="space-y-4">
                {data.projects.map(p => (
                  <div key={p.id} className="rounded-lg border border-border p-4 bg-background">
                    <Grid>
                      <Field label="Name"><Input value={p.name} onChange={ev => updateProject(p.id, { name: ev.target.value })} /></Field>
                      <Field label="Link"><Input value={p.link} onChange={ev => updateProject(p.id, { link: ev.target.value })} placeholder="github.com/…" /></Field>
                      <Field label="Date" full><Input value={p.date} onChange={ev => updateProject(p.id, { date: ev.target.value })} placeholder="2024" /></Field>
                    </Grid>
                    <div className="mt-3">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs text-muted-foreground">Bullets (one per line)</Label>
                        <Button size="sm" variant="ghost" disabled={rewritingKey === `proj-${p.id}` || !p.bullets.trim()}
                          onClick={async () => {
                            const out = await rewriteWithAI("bullets", p.bullets, { title: p.name }, `proj-${p.id}`);
                            if (out) { updateProject(p.id, { bullets: out }); toast.success("Project rewritten"); }
                          }}>
                          {rewritingKey === `proj-${p.id}` ? <Loader2 className="animate-spin" /> : <Sparkles />} AI rewrite
                        </Button>
                      </div>
                      <FormattableTextarea rows={3} className="mt-1.5" value={p.bullets} onChange={v => updateProject(p.id, { bullets: v })} />
                    </div>
                    <div className="mt-2 flex justify-end">
                      <Button size="sm" variant="ghost" onClick={() => removeProject(p.id)}><Trash2 /> Remove</Button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
            </div>
          )}

          {data.sectionOrder.includes("certifications") && (
            <div id="edit-certifications" className="rounded-xl">
            <Card title="Certifications" action={<Button size="sm" variant="outline" onClick={addCert}><Plus /> Add</Button>}>
              <div className="space-y-3">
                {data.certifications.map(c => (
                  <div key={c.id} className="rounded-lg border border-border p-4 bg-background">
                    <Grid>
                      <Field label="Name" full><Input value={c.name} onChange={ev => updateCert(c.id, { name: ev.target.value })} /></Field>
                      <Field label="Issuer"><Input value={c.issuer} onChange={ev => updateCert(c.id, { issuer: ev.target.value })} /></Field>
                      <Field label="Date"><Input value={c.date} onChange={ev => updateCert(c.id, { date: ev.target.value })} /></Field>
                    </Grid>
                    <div className="mt-2 flex justify-end">
                      <Button size="sm" variant="ghost" onClick={() => removeCert(c.id)}><Trash2 /> Remove</Button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
            </div>
          )}

          {data.sectionOrder.includes("awards") && (
            <div id="edit-awards" className="rounded-xl">
            <Card title="Awards" action={<Button size="sm" variant="outline" onClick={addAward}><Plus /> Add</Button>}>
              <div className="space-y-3">
                {data.awards.map(a => (
                  <div key={a.id} className="rounded-lg border border-border p-4 bg-background">
                    <Grid>
                      <Field label="Name" full><Input value={a.name} onChange={ev => updateAward(a.id, { name: ev.target.value })} /></Field>
                      <Field label="Issuer"><Input value={a.issuer} onChange={ev => updateAward(a.id, { issuer: ev.target.value })} /></Field>
                      <Field label="Date"><Input value={a.date} onChange={ev => updateAward(a.id, { date: ev.target.value })} /></Field>
                    </Grid>
                    <div className="mt-2 flex justify-end">
                      <Button size="sm" variant="ghost" onClick={() => removeAward(a.id)}><Trash2 /> Remove</Button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
            </div>
          )}

          {data.sectionOrder.includes("languages") && (
            <div id="edit-languages" className="rounded-xl">
            <Card title="Languages" action={<Button size="sm" variant="outline" onClick={addLang}><Plus /> Add</Button>}>
              <div className="space-y-3">
                {data.languages.map(l => (
                  <div key={l.id} className="rounded-lg border border-border p-4 bg-background">
                    <Grid>
                      <Field label="Language"><Input value={l.name} onChange={ev => updateLang(l.id, { name: ev.target.value })} /></Field>
                      <Field label="Proficiency"><Input value={l.level} onChange={ev => updateLang(l.id, { level: ev.target.value })} placeholder="Native / Fluent / B2" /></Field>
                    </Grid>
                    <div className="mt-2 flex justify-end">
                      <Button size="sm" variant="ghost" onClick={() => removeLang(l.id)}><Trash2 /> Remove</Button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
            </div>
          )}

          <Card
            title="Target job description"
            action={
              <Button size="sm" variant="accent" onClick={generateFromJD} disabled={generating || !data.jobDescription.trim()}>
                {generating ? <Loader2 className="animate-spin" /> : <Wand2 />}
                {generating ? "Tailoring…" : "AI tailor resume"}
              </Button>
            }
          >
            <p className="text-xs text-muted-foreground mb-2">Paste the job posting to score keyword match and tailor the whole resume in one click.</p>
            <Textarea rows={6} value={data.jobDescription} onChange={e => update("jobDescription", e.target.value)} placeholder="Paste the job description here..." />
            <div className="mt-3">
              <Label className="text-xs text-muted-foreground">Extra ATS keywords (comma separated)</Label>
              <Input className="mt-1.5" value={data.extraKeywords} onChange={e => update("extraKeywords", e.target.value)} placeholder="e.g. SOC2, GraphQL, Series B" />
              <p className="mt-1 text-[11px] text-muted-foreground">Counts toward ATS keyword coverage even if not in your visible text.</p>
            </div>
          </Card>

          <Card title="Find jobs">
            <p className="text-xs text-muted-foreground mb-3">Open searches tuned to your headline and location.</p>
            <div className="grid grid-cols-2 gap-2">
              <JobSearchButton site="linkedin" data={data} />
              <JobSearchButton site="indeed" data={data} />
              <JobSearchButton site="google" data={data} />
              <JobSearchButton site="wellfound" data={data} />
              <JobSearchButton site="naukri" data={data} />
            </div>
          </Card>
        </div>

        {/* Preview */}
        <div id="resume-preview" className="min-w-0 relative scroll-mt-20">
          {!atsOpen && (
            <button
              onClick={() => setAtsOpen(true)}
              className="no-print hidden lg:inline-flex absolute right-2 top-2 z-10 items-center gap-1.5 rounded-md border border-border bg-background h-8 px-2.5 text-xs font-medium hover:border-[var(--navy-light)]"
              title="Open ATS panel"
            >
              <PanelRightOpen className="h-3.5 w-3.5" /> ATS · {score.score}
            </button>
          )}
          <PreviewToolbar
            zoom={zoom}
            setZoom={setZoom}
            data={data}
            getData={() => commitPreviewEdits()}
            onPdf={printCurrentResume}
            onDocx={handleDocx}
            docxBusy={exporting}
            extras={
              <>
                <TemplatesPopover data={data} onPick={(id) => update("template", id)} />
                <SectionsPopover
                  data={data}
                  onUpdate={(order) => update("sectionOrder", order)}
                  onAdd={(id) => addSectionIfMissing(id)}
                  onRemove={(id) => removeSectionFromOrder(id)}
                />
                <StylePopover data={data} onPatch={(p) => setData(d => ({ ...d, ...p }))} />
              </>
            }
          />
          {/* Mobile ATS trigger */}
          <div className="no-print lg:hidden mb-3">
            <Sheet open={atsSheetOpen} onOpenChange={setAtsSheetOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" className="w-full">
                  <Gauge className="h-4 w-4" /> Open ATS analysis · {score.score}
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto p-0">
                <div className="p-4">
                  <AtsPanel
                    data={data}
                    onClose={() => setAtsSheetOpen(false)}
                    onAppendBulletsToFirstExperience={(bullets) => {
                      setData(d => {
                        const exp = [...d.experience];
                        if (exp.length === 0) {
                          exp.push({ id: uid(), title: d.headline || "Role", company: "", date: "", bullets: bullets.join("\n") });
                        } else {
                          exp[0] = { ...exp[0], bullets: [exp[0].bullets, ...bullets].filter(Boolean).join("\n") };
                        }
                        return { ...d, experience: exp };
                      });
                    }}
                    onAddExtraKeywords={(kw) => {
                      const existing = data.extraKeywords.split(",").map(s => s.trim()).filter(Boolean);
                      const merged = Array.from(new Set([...existing, ...kw])).join(", ");
                      update("extraKeywords", merged);
                    }}
                    onOneClickOptimize={generateFromJD}
                    optimizing={generating}
                  />
                </div>
              </SheetContent>
            </Sheet>
          </div>
          <div className="overflow-auto rounded-xl">
            <div
              className="resume-preview-scale"
              style={{
                transform: `scale(${zoom})`,
                transformOrigin: "top center",
                width: zoom < 1 ? "100%" : undefined,
              }}
            >
              <ResumeDocument
                data={data}
                onSectionClick={inlineEdit ? undefined : scrollToEditor}
                editable={inlineEdit}
                handlers={{
                  onUpdate: updatePatch,
                  onUpdateExperienceBullets: (id, bullets) => updateExp(id, { bullets }),
                  onRewrite: rewriteFromPreview,
                  rewritingKey: rewriting ? "summary" : rewritingKey,
                }}
              />
            </div>
          </div>
        </div>

        {/* ATS panel */}
        {atsOpen && (
        <div className="no-print hidden lg:block">
        <AtsPanel
          data={data}
          onClose={() => setAtsOpen(false)}
          onAppendBulletsToFirstExperience={(bullets) => {
            setData(d => {
              const exp = [...d.experience];
              if (exp.length === 0) {
                exp.push({ id: uid(), title: d.headline || "Role", company: "", date: "", bullets: bullets.join("\n") });
              } else {
                exp[0] = { ...exp[0], bullets: [exp[0].bullets, ...bullets].filter(Boolean).join("\n") };
              }
              return { ...d, experience: exp };
            });
          }}
          onAddExtraKeywords={(kw) => {
            const existing = data.extraKeywords.split(",").map(s => s.trim()).filter(Boolean);
            const merged = Array.from(new Set([...existing, ...kw])).join(", ");
            update("extraKeywords", merged);
          }}
          onOneClickOptimize={generateFromJD}
          optimizing={generating}
        />
        </div>
        )}
      </div>
    </div>
  );
}

function Card({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 transition-shadow">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display font-semibold">{title}</h3>
        {action}
      </div>
      {children}
    </div>
  );
}

function RowAction({ icon, label, onClick, danger }: { icon: React.ReactNode; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      title={label}
      className={cn(
        "inline-flex items-center gap-1 rounded-sm px-1.5 py-1 text-[11px] text-muted-foreground hover:bg-secondary",
        danger && "hover:text-destructive hover:bg-destructive/10"
      )}
    >
      {icon}<span className="hidden md:inline">{label}</span>
    </button>
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

function JobSearchButton({ site, data }: { site: "linkedin" | "indeed" | "google" | "wellfound" | "naukri"; data: ResumeData }) {
  const kw = encodeURIComponent(data.headline || data.experience[0]?.title || "");
  const loc = encodeURIComponent(data.location || "");
  const labels: Record<typeof site, string> = {
    linkedin: "LinkedIn",
    indeed: "Indeed",
    google: "Google Jobs",
    wellfound: "Wellfound",
    naukri: "Naukri",
  };
  const urls: Record<typeof site, string> = {
    linkedin: `https://www.linkedin.com/jobs/search/?keywords=${kw}&location=${loc}`,
    indeed: `https://www.indeed.com/jobs?q=${kw}&l=${loc}`,
    google: `https://www.google.com/search?q=${kw}+jobs+${loc}&ibp=htl;jobs`,
    wellfound: `https://wellfound.com/jobs?role=${kw}&location=${loc}`,
    naukri: `https://www.naukri.com/${(data.headline || data.experience[0]?.title || "").toString().trim().toLowerCase().replace(/\s+/g, "-") || "jobs"}-jobs${loc ? `-in-${loc}` : ""}`,
  };
  return (
    <a href={urls[site]} target="_blank" rel="noreferrer"
      className="inline-flex items-center justify-center gap-2 rounded-md border border-border bg-background h-9 px-3 text-sm font-medium hover:border-[var(--navy-light)] hover:text-[var(--navy-light)] transition-colors">
      <Briefcase className="h-4 w-4" /> {labels[site]} <ExternalLink className="h-3 w-3 opacity-60" />
    </a>
  );
}

function SortableSectionRow({ id, onRemove }: { id: SectionId; onRemove?: () => void }) {
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
      className="flex items-center gap-2 rounded-md border border-border bg-background px-2 py-2 text-sm hover:border-[var(--navy-light)]"
    >
      <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing p-1 text-muted-foreground" aria-label="Drag">
        <GripVertical className="h-4 w-4" />
      </button>
      <span className="font-medium flex-1">{SECTION_LABELS[id]}</span>
      {onRemove && (
        <button onClick={onRemove} className="p-1 text-muted-foreground hover:text-destructive" aria-label="Remove from order">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

function TemplateThumb({ id, accent }: { id: TemplateId; accent: string }) {
  if (id === "two-column" || id === "fresher") {
    const cream = id === "fresher";
    return (
      <div className="aspect-[3/4] w-full rounded bg-white border border-border overflow-hidden flex">
        <div className="w-1/3 h-full p-1 space-y-1" style={{ background: cream ? "#f4f3ef" : accent }}>
          <div className="h-1 w-3/4 rounded" style={{ background: cream ? accent : "rgba(255,255,255,0.85)" }} />
          <div className="h-0.5 w-full rounded" style={{ background: cream ? "rgba(0,0,0,0.12)" : "rgba(255,255,255,0.5)" }} />
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
  if (id === "sidebar-right") {
    return (
      <div className="aspect-[3/4] w-full rounded bg-white border border-border overflow-hidden flex">
        <div className="flex-1 p-1 space-y-1">
          <div className="h-1 w-3/4 rounded bg-foreground/30" />
          <div className="h-0.5 w-full rounded bg-foreground/10" />
          <div className="h-0.5 w-5/6 rounded bg-foreground/10" />
        </div>
        <div className="w-1/3 h-full" style={{ background: accent }} />
      </div>
    );
  }
  if (id === "compact-two") {
    return (
      <div className="aspect-[3/4] w-full rounded bg-white border border-border overflow-hidden flex">
        <div className="w-1/3 h-full p-1 space-y-1" style={{ background: "#f4f3ef" }}>
          <div className="h-1 w-3/4 rounded" style={{ background: accent }} />
          <div className="h-0.5 w-full rounded bg-foreground/15" />
        </div>
        <div className="flex-1 p-1 space-y-1">
          <div className="h-0.5 w-full rounded bg-foreground/10" />
          <div className="h-0.5 w-5/6 rounded bg-foreground/10" />
        </div>
      </div>
    );
  }
  if (id === "modern" || id === "executive") {
    const exec = id === "executive";
    return (
      <div className="aspect-[3/4] w-full rounded bg-white border border-border overflow-hidden">
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
      <div className="aspect-[3/4] w-full rounded bg-white border border-border overflow-hidden p-1.5 flex flex-col">
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
  // classic + professional
  const pro = id === "professional";
  return (
    <div className="aspect-[3/4] w-full rounded bg-white border border-border overflow-hidden p-1.5 flex flex-col items-center">
      <div className={cn("h-1 rounded", pro ? "w-3/4" : "w-2/3")} style={{ background: accent, letterSpacing: pro ? "0.2em" : undefined }} />
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