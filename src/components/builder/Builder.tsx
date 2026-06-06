import { authFetch } from "@/lib/authFetch";
import { useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Plus, Trash2, Gauge, CheckCircle2, XCircle, Sparkles, Share2, Loader2, GripVertical, FileType, FileText, Save, FolderOpen, FilePlus2, Check, Pencil, Briefcase, ExternalLink, AlignJustify, Bold, X, PanelRightOpen, Wand2, Copy, Download, FolderOpen as OpenIcon, MousePointerClick, Columns, Square, Star, Shield, RotateCcw, User, UserPlus, IdCard, Upload, Eye, LayoutTemplate, Wrench, GraduationCap, Trophy, Target, AlertCircle, History as HistoryIcon } from "lucide-react";
import { toast } from "sonner";
import { defaultResume, FONT_PRESETS, COLOR_PRESETS, TEMPLATE_SIDEBAR_DEFAULTS, SIDEBAR_ELIGIBLE, type ResumeData, type Experience, type Education, type Project, type Certification, type Award, type Language, type TemplateId, type SectionId, type CustomSection } from "./types";
import { computeScore, jdKeywordSet, isJdKeyword, COMMON_ATS_KEYWORD_SET } from "./atsScore";
import { useSkillDictVersion } from "@/lib/skillDictionaryStore";
import { highlightKeywordsInEditable } from "@/lib/liveKeywordHighlight";
import { ResumeDocument } from "./ResumeDocument";
import { exportDocx } from "./exportDocx";
import { resumeStore, newId, type SavedResume } from "./resumeStore";
import { profileStore, type Profile } from "./profileStore";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, verticalListSortingStrategy, sortableKeyboardCoordinates, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Slider } from "@/components/ui/slider";
import { parseSkills } from "@/lib/parseSkills";
import { normalizeBulletText } from "@/lib/resumeText";
import { cn } from "@/lib/utils";
import { FormattableTextarea } from "./FormattableTextarea";
import { AtsPanel } from "./AtsPanel";
import { PreviewToolbar } from "./PreviewToolbar";
import { MonthYearPicker, DateRangePicker } from "./MonthYearPicker";
import { SavedResumesGallery } from "./SavedResumesGallery";
import { TemplatesPopover, SectionsPopover, StylePopover } from "./BuilderTopToolbar";
import { SectionReorderBar } from "./SectionReorderBar";
import { HistoryDialog } from "./HistoryDialog";
import { historyStore } from "./historyStore";
import { SelectionFormatToolbar } from "./SelectionFormatToolbar";
import { ExperienceSection, autoActionVerbs, autoActionVerbsDetailed, loadCustomVerbs } from "./ExperienceSection";
import lzString from "lz-string";
const { decompressFromEncodedURIComponent } = lzString;
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { AiAssistantDock, AI_ASSISTANT_OPEN_EVENT } from "./workspace/AiAssistantDock";
import { StickyToolbar } from "./workspace/StickyToolbar";

function uid() { return Math.random().toString(36).slice(2, 9); }

function getSectionCompletion(data: ResumeData) {
  return {
    basics: !!(data.name?.trim() && data.email?.trim() && data.phone?.trim()),
    experience: data.experience.some(e => e.title?.trim() && e.company?.trim()),
    education: data.education.some(e => e.school?.trim() && e.degree?.trim()),
    skills: !!(data.skills?.trim()),
    extras: data.projects.length > 0 || data.certifications.length > 0 || data.awards.length > 0 || data.languages.length > 0 || data.customSections.length > 0,
    target: !!(data.jobDescription?.trim()),
  };
}

function getCompletionPercent(data: ResumeData) {
  const c = getSectionCompletion(data);
  const total = Object.keys(c).length;
  const done = Object.values(c).filter(Boolean).length;
  return Math.round((done / total) * 100);
}

function sameSkillSet(a: string[], b: string[]) {
  if (a.length !== b.length) return false;
  const counts = new Map<string, number>();
  for (const item of a) counts.set(item, (counts.get(item) ?? 0) + 1);
  for (const item of b) {
    const count = counts.get(item) ?? 0;
    if (count <= 0) return false;
    count === 1 ? counts.delete(item) : counts.set(item, count - 1);
  }
  return counts.size === 0;
}

/**
 * Wraps the resume preview and scales the 8.5in document down to fit the
 * container width on smaller viewports. The wrapper itself reports the
 * scaled-down height so the surrounding layout doesn't reserve extra space.
 */
function PreviewFitWrap({ children }: { children: React.ReactNode }) {
  const outerRef = useRef<HTMLDivElement | null>(null);
  const innerRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(1);
  const [innerHeight, setInnerHeight] = useState<number | null>(null);

  useEffect(() => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner) return;
    const PAGE_PX = 8.5 * 96; // 8.5in at 96dpi
    const update = () => {
      const w = outer.clientWidth;
      if (!w) return;
      // Never upscale beyond 1; allow a slight zoom-out only when needed.
      const next = Math.min(1, w / PAGE_PX);
      setScale(next);
      // Inner is rendered at 8.5in fixed; its natural height is scrollHeight.
      setInnerHeight(inner.scrollHeight * next);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(outer);
    ro.observe(inner);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={outerRef} className="resume-preview-fit-wrap" style={{ height: innerHeight ?? undefined }}>
      <div
        ref={innerRef}
        className="resume-preview-scale"
        style={{ ["--preview-fit-scale" as string]: scale }}
      >
        {children}
      </div>
    </div>
  );
}

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
  { id: "executive", label: "Executive", desc: "Centered band & gold rule" },
  { id: "minimal", label: "Minimal", desc: "Quiet & spacious" },
  { id: "classic", label: "Classic", desc: "Traditional single column" },
  { id: "elegant", label: "Elegant", desc: "Serif headings, refined" },
  { id: "two-column", label: "Two column", desc: "Skills sidebar left" },
  { id: "sidebar-right", label: "Sidebar right", desc: "Skills sidebar right" },
  { id: "compact-two", label: "Compact two", desc: "Dense two-column" },
  { id: "fresher", label: "Fresher", desc: "Friendly cream sidebar" },
  { id: "contemporary", label: "Contemporary", desc: "Teal icons & two-column" },
  { id: "iconic", label: "Iconic", desc: "Dark header + photo + gold" },
  { id: "creative", label: "Creative", desc: "Hybrid photo header + sidebar" },
  { id: "startup", label: "Startup", desc: "Punchy modern two-column" },
  { id: "bold", label: "Bold", desc: "Strong executive band" },
  { id: "technical", label: "Technical", desc: "ATS-friendly clean grid" },
  { id: "academic", label: "Academic", desc: "Scholarly serif layout" },
  { id: "corporate", label: "Corporate", desc: "Enterprise navy & white" },
  { id: "luxe", label: "Luxe", desc: "Premium serif with gold" },
  { id: "noir", label: "Noir", desc: "High-contrast dark accents" },
  { id: "editorial", label: "Editorial", desc: "Magazine-style headings" },
  { id: "aurora", label: "Aurora", desc: "Soft gradient accents" },
  { id: "monochrome", label: "Monochrome", desc: "Black & white minimal" },
  { id: "novo-dark", label: "Novo Dark", desc: "Navy header + photo + gold rules" },
  { id: "marketer-band", label: "Marketer Band", desc: "Centered uppercase navy band" },
  { id: "ats-blue", label: "ATS Blue", desc: "Clean blue band, ATS-friendly" },
  { id: "teal-chips", label: "Teal Chips", desc: "Minimal teal with skill chips" },
  { id: "hybrid-photo", label: "Hybrid Photo", desc: "Photo header + icon sidebar" },
  { id: "dark-sidebar", label: "Dark Sidebar", desc: "Dark left rail with timeline" },
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
  const [tailorConfirmOpen, setTailorConfirmOpen] = useState(false);
  const [tailorConfirmName, setTailorConfirmName] = useState("");
  const [mounted, setMounted] = useState(false);
  const [inlineEdit, setInlineEdit] = useState(true);
  const [atsSheetOpen, setAtsSheetOpen] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [settingsSheetOpen, setSettingsSheetOpen] = useState(false);
  const [previewZoom, setPreviewZoom] = useState(1);
  // Polite live-region for screen-reader status announcements (AI actions, PDF/DOCX, saves).
  // We toggle the text via a ref+state pair so the same message can be re-announced; an
  // explicit blank flush ensures repeated identical statuses still re-fire on assistive tech.
  const [liveMsg, setLiveMsg] = useState("");
  const liveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const announce = (msg: string) => {
    if (liveTimerRef.current) clearTimeout(liveTimerRef.current);
    setLiveMsg("");
    liveTimerRef.current = setTimeout(() => setLiveMsg(msg), 60);
  };
  useEffect(() => () => { if (liveTimerRef.current) clearTimeout(liveTimerRef.current); }, []);
  // Mobile view switcher: which panel is visible on screens < lg.
  // 'editor' is the default; bottom nav toggles between editor and preview.
  const [mobileView, setMobileView] = useState<"editor" | "preview">("editor");
  // When user taps Templates on mobile bottom nav, click the existing trigger.
  const openMobileTemplates = () => {
    setMobileView("preview");
    // Scroll preview into view then fire the trigger on next frame.
    requestAnimationFrame(() => {
      document.getElementById("resume-preview")?.scrollIntoView({ behavior: "smooth", block: "start" });
      requestAnimationFrame(() => {
        (document.getElementById("builder-templates-trigger") as HTMLButtonElement | null)?.click();
      });
    });
  };
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null);
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
  const [profileNameDraft, setProfileNameDraft] = useState("");
  const [profileRenameId, setProfileRenameId] = useState<string | null>(null);
  const dictVersion = useSkillDictVersion();
  const score = useMemo(() => computeScore(data), [data, dictVersion]);

  // Change log of bullets rewritten by autoActionVerbs after the most recent JD tailoring.
  type VerbChange = { expId: string; title: string; company: string; before: string; after: string };
  const [verbChanges, setVerbChanges] = useState<VerbChange[]>([]);
  const [verbChangesOpen, setVerbChangesOpen] = useState(false);

  // ---- Undo/Redo for section ordering & custom section edits ----
  type SectionsSnapshot = { sectionOrder: SectionId[]; customSections: CustomSection[]; sidebarSections: SectionId[] | undefined };
  const [sectionsPast, setSectionsPast] = useState<SectionsSnapshot[]>([]);
  const [sectionsFuture, setSectionsFuture] = useState<SectionsSnapshot[]>([]);
  const lastPushRef = useRef<{ at: number; key: string } | null>(null);
  const dataRef = useRef(data);
  useEffect(() => { dataRef.current = data; }, [data]);

  // Transient highlight for the most recently moved/added section in the preview.
  const [flashSection, setFlashSection] = useState<SectionId | null>(null);
  const flashTimerRef = useRef<number | null>(null);
  const flashMoved = (id: SectionId) => {
    if (flashTimerRef.current) window.clearTimeout(flashTimerRef.current);
    setFlashSection(null);
    // Re-set on next frame so the animation restarts even if the same id flashes twice in a row.
    window.requestAnimationFrame(() => {
      setFlashSection(id);
      flashTimerRef.current = window.setTimeout(() => setFlashSection(null), 1200);
    });
  };

  const snapshotNow = (): SectionsSnapshot => ({
    sectionOrder: [...dataRef.current.sectionOrder],
    customSections: (dataRef.current.customSections ?? []).map(c => ({ ...c })),
    sidebarSections: dataRef.current.sidebarSections ? [...dataRef.current.sidebarSections] : undefined,
  });

  const pushSectionsHistory = (coalesceKey = "") => {
    const now = Date.now();
    const last = lastPushRef.current;
    if (coalesceKey && last && last.key === coalesceKey && now - last.at < 800) {
      lastPushRef.current = { at: now, key: coalesceKey };
      return;
    }
    lastPushRef.current = { at: now, key: coalesceKey };
    setSectionsPast(p => [...p.slice(-49), snapshotNow()]);
    setSectionsFuture([]);
  };

  const applySectionsSnapshot = (s: SectionsSnapshot) => {
    setData(d => ({ ...d, sectionOrder: s.sectionOrder, customSections: s.customSections, sidebarSections: s.sidebarSections }));
  };

  const undoSections = () => {
    if (sectionsPast.length === 0) return;
    const prev = sectionsPast[sectionsPast.length - 1];
    const current = snapshotNow();
    setSectionsPast(p => p.slice(0, -1));
    setSectionsFuture(f => [current, ...f]);
    applySectionsSnapshot(prev);
    lastPushRef.current = null;
  };

  const redoSections = () => {
    if (sectionsFuture.length === 0) return;
    const next = sectionsFuture[0];
    const current = snapshotNow();
    setSectionsFuture(f => f.slice(1));
    setSectionsPast(p => [...p, current]);
    applySectionsSnapshot(next);
    lastPushRef.current = null;
  };

  // Keyboard shortcuts: Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      // Don't hijack undo inside text inputs / contentEditable — let native edit history handle it.
      if (tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable) return;
      if (e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redoSections();
        else undoSections();
      } else if (e.key.toLowerCase() === "y") {
        e.preventDefault();
        redoSections();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sectionsPast, sectionsFuture]);

  // Opening-from-URL UX: skeleton + retry when ?open=ID arrives but the
  // resume isn't in local store yet (e.g. cloud sync hasn't pulled).
  const [openingState, setOpeningState] = useState<
    | { phase: "loading" | "notfound"; id: string; attempt: number }
    | null
  >(null);

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
  // Restore the last working draft (or fall back to Primary) on first mount so
  // skills, experience, summary, etc. survive page reloads. Skipped if the URL
  // is opening a specific resume (?open=ID) or loading a shared payload (#r=).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("open")) return;
    if (window.location.hash.startsWith("#r=")) return;
    const draft = resumeStore.getDraft();
    if (draft) {
      setData(d => ({ ...d, ...draft }));
      return;
    }
    const primary = resumeStore.getPrimary();
    if (primary) {
      setData(d => ({ ...d, ...primary.data }));
      setCurrentId(primary.id);
      setCurrentName(primary.name);
    }
  }, []);
  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!mounted) return;
    setSaving(true);
    const t = window.setTimeout(() => {
      resumeStore.saveDraft(data);
      if (currentId) {
        resumeStore.upsert({ id: currentId, name: currentName, updatedAt: Date.now(), data });
      }
      setSavedAt(Date.now());
      setSaving(false);
    }, 400);
    return () => window.clearTimeout(t);
  }, [mounted, data, currentId, currentName]);

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

  // React to ?open=ID search-param changes (even while already on /builder).
  const search = useRouterState({ select: s => s.location.search });
  const navigate = useNavigate();
  useEffect(() => {
    if (typeof window === "undefined") return;
    const openId = new URLSearchParams(window.location.search).get("open");
    if (!openId) return;
    // Show the skeleton; the resolver effect below handles fetch + retry.
    setOpeningState({ phase: "loading", id: openId, attempt: 0 });
    // Strip the param from the URL so refreshes don't re-trigger the flow.
    navigate({ to: "/builder", search: {} as never, replace: true });
  }, [search, navigate]);

  // Resolver: try to load the requested resume, retry when cloud sync fires
  // `resumeforge:refresh`, and fall back to a not-found state after a timeout.
  useEffect(() => {
    if (!openingState || openingState.phase !== "loading") return;
    const { id } = openingState;

    const tryLoad = () => {
      const entry = resumeStore.get(id);
      if (entry) {
        setData({ ...defaultResume, ...entry.data });
        setCurrentId(entry.id);
        setCurrentName(entry.name);
        toast.success(`Opened "${entry.name}"`);
        setOpeningState(null);
        return true;
      }
      return false;
    };

    if (tryLoad()) return;

    const onRefresh = () => { tryLoad(); };
    window.addEventListener("resumeforge:refresh", onRefresh);

    // After 8s give up and offer manual retry. Resets when attempt changes.
    const timeout = window.setTimeout(() => {
      if (!resumeStore.get(id)) {
        setOpeningState(s => (s && s.id === id ? { ...s, phase: "notfound" } : s));
      }
    }, 8000);

    return () => {
      window.removeEventListener("resumeforge:refresh", onRefresh);
      window.clearTimeout(timeout);
    };
  }, [openingState]);

  const retryOpen = () => {
    setOpeningState(s => (s ? { phase: "loading", id: s.id, attempt: s.attempt + 1 } : s));
  };
  const cancelOpen = () => setOpeningState(null);

  const refreshList = () => { setSaved(resumeStore.list()); setPrimaryId(resumeStore.getPrimaryId()); };

  useEffect(() => {
    const onRefresh = () => refreshList();
    window.addEventListener("resumeforge:refresh", onRefresh);
    return () => window.removeEventListener("resumeforge:refresh", onRefresh);
  }, []);

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
    resumeStore.saveDraft(data);
    historyStore.push(currentId, data, `Saved "${currentName}"`);
    refreshList();
    toast.success(`Saved "${currentName}"`);
  };

  const saveAs = (name: string) => {
    const trimmed = name.trim() || "Untitled resume";
    const id = newId();
    resumeStore.upsert({ id, name: trimmed, updatedAt: Date.now(), data });
    resumeStore.saveDraft(data);
    historyStore.push(id, data, `Created "${trimmed}"`);
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
    const existing = resumeStore.get(id);
    if (!existing) { toast.error("Could not duplicate"); return; }
    const suggested = `${existing.name} (copy)`;
    const name = typeof window !== "undefined"
      ? window.prompt("Name for the duplicated resume:", suggested)
      : suggested;
    if (name === null) return;
    const copy = resumeStore.duplicate(id, name);
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
        if (value !== displayed && value !== source.skills && !sameSkillSet(parseSkills(value), parseSkills(source.skills))) {
          next = { ...next, skills: value };
          dirty = true;
        }
      }
      if (kind === "experience-bullets") {
        const id = el.dataset.previewExpId;
        const current = source.experience.find(e => e.id === id);
        if (!id || !current) return;
        const bullets = normalizeBulletText(el.innerText);
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
    announce("Preparing PDF for download…");
    requestAnimationFrame(() => {
      window.print();
      announce("PDF ready. Use your browser's save dialog to download.");
    });
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
    // Build the live keyword set once per effect run (common ATS terms +
    // any tokens from the current job description) so we can re-bold
    // matches in the contentEditable preview as the user types.
    const liveSet = new Set<string>(COMMON_ATS_KEYWORD_SET);
    for (const k of jdKeywordSet(data.jobDescription || "")) liveSet.add(k);
    const isKw = (w: string) => isJdKeyword(w, liveSet);
    // Initial pass: bold ATS keywords inside every editable preview block
    // so the highlights are visible immediately (and get captured by PDF
    // print / share / save flows) without waiting for the user to type.
    root.querySelectorAll<HTMLElement>("[data-preview-edit]").forEach(el => {
      try { highlightKeywordsInEditable(el, isKw); } catch { /* ignore */ }
    });
    const onInput = (e: Event) => {
      const target = e.target as HTMLElement | null;
      const editEl = target?.closest?.("[data-preview-edit]") as HTMLElement | null;
      if (!editEl) return;
      // Live keyword highlighting — wrap matching tokens in <strong>
      // immediately so bold updates as the user types. Skip while an IME
      // composition is active to avoid disrupting it.
      if (!(e as InputEvent).isComposing) {
        try { highlightKeywordsInEditable(editEl, isKw); } catch { /* ignore */ }
      }
      // Persist to the saved-resume store quickly (no re-render).
      if (storeTimer) clearTimeout(storeTimer);
      storeTimer = setTimeout(() => {
        const next = commitPreviewEdits(data, { sync: false });
        resumeStore.saveDraft(next);
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
    announce("Generating DOCX file…");
    try {
      await exportDocx(commitPreviewEdits());
      announce("DOCX downloaded successfully.");
      toast.success("DOCX downloaded");
    } catch {
      announce("Could not export DOCX. Please try again.");
      toast.error("Could not export DOCX");
    } finally { setExporting(false); }
  };

  const rewriteSummary = async () => {
    setRewriting(true);
    announce("AI is rewriting your summary…");
    try {
      const res = await authFetch("/api/rewrite-summary", {
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
      if (res.status === 429) { announce("Rate limit hit. Please retry shortly."); toast.error("Rate limit hit. Please retry in a moment."); return; }
      if (res.status === 402) { announce("AI credits exhausted."); toast.error("AI credits exhausted. Add credits in Workspace settings."); return; }
      if (!res.ok) { announce("Summary rewrite failed."); toast.error("Rewrite failed. Please try again."); return; }
      const json = (await res.json()) as { summary?: string };
      if (json.summary) {
        update("summary", json.summary);
        announce("Summary rewritten by AI.");
        toast.success("Summary rewritten");
      }
    } catch {
      announce("Network error while rewriting summary.");
      toast.error("Network error. Please try again.");
    } finally {
      setRewriting(false);
    }
  };

  const rewriteWithAI = async (kind: "bullets" | "skills" | "education", text: string, ctx: Record<string, string | undefined>, key: string): Promise<string | null> => {
    setRewritingKey(key);
    announce(`AI is rewriting your ${kind === "bullets" ? "experience bullets" : kind}…`);
    try {
      const res = await authFetch("/api/rewrite-section", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind, text, context: { headline: data.headline, jobDescription: data.jobDescription, skills: data.skills, ...ctx } }),
      });
      if (res.status === 429) { announce("Rate limit hit. Please retry shortly."); toast.error("Rate limit hit. Please retry."); return null; }
      if (res.status === 402) { announce("AI credits exhausted."); toast.error("AI credits exhausted."); return null; }
      if (!res.ok) { announce("Rewrite failed."); toast.error("Rewrite failed."); return null; }
      const json = (await res.json()) as { text?: string };
      return json.text ?? null;
    } catch {
      announce("Network error during rewrite.");
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
      if (out) { update("skills", out); announce("Skills rewritten by AI."); toast.success("Skills rewritten"); }
      return;
    }
    if (kind === "experience-bullets" && refId) {
      const e = data.experience.find(x => x.id === refId);
      if (!e) return;
      const out = await rewriteWithAI("bullets", e.bullets, { title: e.title, company: e.company }, `exp-${e.id}`);
      if (out) { updateExp(e.id, { bullets: normalizeBulletText(out) }); announce("Experience bullets rewritten by AI."); toast.success("Bullets rewritten"); }
    }
  };

  const openTailorConfirm = () => {
    if (!data.jobDescription.trim()) { toast.error("Paste a job description first."); return; }
    const firstLine = data.jobDescription.split("\n").map(s => s.trim()).find(Boolean) ?? "";
    const roleHint = firstLine.replace(/[^a-zA-Z0-9 +/&-]/g, "").slice(0, 40).trim();
    const stamp = new Date().toLocaleDateString();
    setTailorConfirmName(roleHint ? `Tailored — ${roleHint} (${stamp})` : `Tailored — ${stamp}`);
    setTailorConfirmOpen(true);
  };

  const applyBaselineFix = (patch: {
    extraKeywords?: string[];
    rewrites?: { id: string; bullets: string }[];
  }) => {
    const prev = data;
    setData(d => {
      const existing = (d.extraKeywords ?? "").split(",").map(s => s.trim()).filter(Boolean);
      const merged = patch.extraKeywords?.length
        ? Array.from(new Set([...existing, ...patch.extraKeywords])).join(", ")
        : d.extraKeywords;
      const exp = d.experience.map(e => {
        const r = patch.rewrites?.find(x => x.id === e.id);
        return r ? { ...e, bullets: r.bullets } : e;
      });
      const next = { ...d, extraKeywords: merged, experience: exp };
      resumeStore.saveDraft(next);
      return next;
    });
    const kwCount = patch.extraKeywords?.length ?? 0;
    const verbCount = (patch.rewrites ?? []).reduce(
      (n, r) => n + r.bullets.split("\n").filter(Boolean).length, 0,
    );
    toast.success(
      `Applied AI fixes${kwCount ? ` · ${kwCount} keyword${kwCount === 1 ? "" : "s"}` : ""}${verbCount ? ` · rewrote ${patch.rewrites!.length} role${patch.rewrites!.length === 1 ? "" : "s"}` : ""}`,
      {
        duration: 12000,
        action: {
          label: "Undo",
          onClick: () => {
            setData(prev);
            resumeStore.saveDraft(prev);
            toast.success("Reverted to previous version");
          },
        },
      },
    );
  };

  const generateFromJD = async () => {
    if (!data.jobDescription.trim()) { toast.error("Paste a job description first."); return; }
    setTailorConfirmOpen(false);
    setGenerating(true);
    announce("AI is tailoring your resume to the job description. This can take up to 30 seconds…");
    try {
      // Always tailor from Primary Resume if set, and save the result as a NEW resume
      // so the Primary stays untouched.
      const primary = resumeStore.getPrimary();
      const source: ResumeData = primary
        ? { ...defaultResume, ...primary.data, jobDescription: data.jobDescription }
        : data;
      const res = await authFetch("/api/generate-from-jd", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          jobDescription: data.jobDescription,
          current: {
            name: source.name,
            headline: source.headline,
            summary: source.summary,
            skills: source.skills,
            experience: source.experience.map(e => ({ id: e.id, title: e.title, company: e.company, bullets: e.bullets })),
          },
        }),
      });
      if (res.status === 429) { announce("Rate limit hit during AI tailoring."); toast.error("Rate limit hit."); return; }
      if (res.status === 402) { announce("AI credits exhausted."); toast.error("AI credits exhausted."); return; }
      if (!res.ok) { announce("AI tailoring failed. Please try again."); toast.error("AI tailoring failed."); return; }
      const out = (await res.json()) as { headline?: string; summary?: string; skills?: string; experience?: { id: string; bullets: string }[] };
      const verbState = loadCustomVerbs();
      const collected: VerbChange[] = [];
      const tailored: ResumeData = {
        ...source,
        jobDescription: data.jobDescription,
        headline: out.headline || source.headline,
        summary: out.summary || source.summary,
        skills: out.skills || source.skills,
        experience: source.experience.map(e => {
          const match = out.experience?.find(x => x.id === e.id);
          if (!match) return e;
          const { text, changes } = autoActionVerbsDetailed(normalizeBulletText(match.bullets), verbState.fallback);
          for (const c of changes) collected.push({ expId: e.id, title: e.title, company: e.company, ...c });
          return { ...e, bullets: text };
        }),
      };
      // Always create a NEW tailored copy — never overwrite the Primary or current resume.
      const stamp = new Date().toLocaleDateString();
      const name = (tailorConfirmName.trim() || `Tailored — ${stamp}`);
      const id = newId();
      resumeStore.upsert({ id, name, updatedAt: Date.now(), data: tailored });
      resumeStore.saveDraft(tailored);
      setData(tailored);
      setCurrentId(id);
      setCurrentName(name);
      refreshList();
      setVerbChanges(collected);
      const baseMsg = primary
        ? `Tailored from Primary, saved as "${name}"`
        : `Tailored resume saved as "${name}"`;
      if (collected.length > 0) {
        announce(`${baseMsg}. ${collected.length} bullet${collected.length === 1 ? "" : "s"} strengthened.`);
        toast.success(`${baseMsg} · ${collected.length} bullet${collected.length === 1 ? "" : "s"} strengthened`, {
          action: { label: "View changes", onClick: () => setVerbChangesOpen(true) },
        });
      } else {
        announce(baseMsg);
        toast.success(baseMsg);
      }
    } catch {
      announce("Network error while tailoring resume.");
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
      const res = await authFetch("/api/generate-from-jd", {
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
      const verbState = loadCustomVerbs();
      const collected: VerbChange[] = [];
      const tailored: ResumeData = {
        ...source,
        jobDescription: jd,
        headline: out.headline || source.headline,
        summary: out.summary || source.summary,
        skills: out.skills || source.skills,
        experience: source.experience.map(e => {
          const match = out.experience?.find(x => x.id === e.id);
          if (!match) return e;
          const { text, changes } = autoActionVerbsDetailed(normalizeBulletText(match.bullets), verbState.fallback);
          for (const c of changes) collected.push({ expId: e.id, title: e.title, company: e.company, ...c });
          return { ...e, bullets: text };
        }),
      };
      // Never overwrite the Primary Resume — when primary exists, force save-as-new.
      const forceNew = jdSaveAsNew || !!primary;
      if (forceNew) {
        // Save tailored version as a NEW resume — Primary stays untouched
        const id = newId();
        const name = (jdTailoredName.trim() || `Tailored — ${new Date().toLocaleDateString()}`);
        resumeStore.upsert({ id, name, updatedAt: Date.now(), data: tailored });
        resumeStore.saveDraft(tailored);
        setData(tailored);
        setCurrentId(id);
        setCurrentName(name);
        refreshList();
        const baseMsg = primary ? `Tailored from Primary, saved as "${name}"` : `Tailored resume saved as "${name}"`;
        setVerbChanges(collected);
        if (collected.length > 0) {
          toast.success(`${baseMsg} · ${collected.length} bullet${collected.length === 1 ? "" : "s"} strengthened`, {
            action: { label: "View changes", onClick: () => setVerbChangesOpen(true) },
          });
        } else {
          toast.success(baseMsg);
        }
      } else {
        setData(tailored);
        setVerbChanges(collected);
        if (collected.length > 0) {
          toast.success(`ATS-tailored resume generated · ${collected.length} bullet${collected.length === 1 ? "" : "s"} strengthened`, {
            action: { label: "View changes", onClick: () => setVerbChangesOpen(true) },
          });
        } else {
          toast.success("ATS-tailored resume generated");
        }
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
    <div className="min-h-screen bg-secondary/40 builder-mobile-pad overflow-x-hidden">
      {openingState && (
        <OpeningResumeOverlay
          state={openingState}
          onRetry={retryOpen}
          onCancel={cancelOpen}
        />
      )}
      <header className="no-print sticky top-0 z-30 backdrop-blur-md bg-background/80 border-b border-border">
        <div className="mx-auto max-w-[1600px] px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> <span className="hidden sm:inline">Back</span>
          </Link>
          <div className="font-display font-semibold hidden sm:block">ResumeForge Builder</div>
          <div className="flex items-center gap-2">
            {mounted && profileApplied && (
              <span
                className="hidden md:inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-300"
                title="Your saved profile (name, contact, education) is applied to this resume"
              >
                <CheckCircle2 className="h-3 w-3" /> Profile applied
              </span>
            )}
            {verbChanges.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setVerbChangesOpen(true)}
                title="View bullets strengthened by action-verb auto-fix"
                className="relative hidden md:inline-flex"
              >
                <Wand2 className="h-4 w-4" />
                <span className="hidden sm:inline">Changes</span>
                <span className="ml-1 inline-flex items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px] font-semibold h-4 min-w-4 px-1">
                  {verbChanges.length}
                </span>
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8" title="Manage profile templates">
                  <IdCard className="h-4 w-4" /> <span className="hidden sm:inline">Profile</span>
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
            <Button
              variant="outline"
              size="sm"
              className="h-8"
              onClick={() => setHistoryOpen(true)}
              title={currentId ? "Version history" : "Save this resume to start tracking versions"}
            >
              <HistoryIcon className="h-4 w-4" /> <span className="hidden sm:inline">History</span>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8">
                  <FolderOpen className="h-4 w-4" /> <span className="hidden sm:inline">Resumes</span>
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

            {/* Tools dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8">
                  <Wrench className="h-4 w-4" /> <span className="hidden sm:inline">Tools</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onClick={() => { setJdDialogText(data.jobDescription); setJdDialogOpen(true); }}>
                  <Wand2 className="h-4 w-4" /> JD → Resume
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate({ to: "/jobs" })}>
                  <Briefcase className="h-4 w-4" /> Find Jobs
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleDocx} disabled={exporting}>
                  {exporting ? <Loader2 className="animate-spin h-4 w-4" /> : <FileType className="h-4 w-4" />} DOCX Export
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <div className="w-px h-6 bg-border hidden sm:block" />

            {/* Secondary actions */}
            <Button variant="outline" size="sm" className="h-8" onClick={saveCurrent} title={currentId ? `Save "${currentName}"` : "Save resume"}>
              <Save className="h-4 w-4" /> <span className="hidden sm:inline">{currentId ? "Save" : "Save…"}</span>
            </Button>
            <Button variant="outline" size="sm" className="h-8" onClick={() => {
              try {
                const payload = lzString.compressToEncodedURIComponent(JSON.stringify(data));
                const url = `${window.location.origin}/builder#r=${payload}`;
                navigator.clipboard.writeText(url).then(() => toast.success("Share link copied to clipboard")).catch(() => toast.error("Could not copy link"));
              } catch {
                toast.error("Could not generate share link");
              }
            }} title="Copy shareable link">
              <Share2 className="h-4 w-4" /> <span className="hidden sm:inline">Share</span>
            </Button>
            <Button variant="outline" size="sm" className="h-8 hidden md:inline-flex" onClick={() => setInlineEdit(v => !v)} title={inlineEdit ? "Preview only" : "Switch to edit mode"}>
              {inlineEdit ? <Eye className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
              <span className="hidden sm:inline">{inlineEdit ? "Preview" : "Edit"}</span>
            </Button>

            {/* Primary CTA */}
            <Button size="sm" className="h-8 shrink-0" style={{ background: "var(--gradient-hero)", color: "white" }} onClick={printCurrentResume} title="Download as PDF">
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">Download</span>
            </Button>
          </div>
        </div>
      </header>

      <StickyToolbar
        name={currentName}
        onRename={(next) => {
          setCurrentName(next);
          if (currentId) {
            resumeStore.upsert({ id: currentId, name: next, updatedAt: Date.now(), data });
            setSaved(resumeStore.list());
          }
        }}
        savedAt={savedAt}
        saving={saving}
        canUndo={sectionsPast.length > 0}
        canRedo={sectionsFuture.length > 0}
        onUndo={undoSections}
        onRedo={redoSections}
        zoom={previewZoom}
        onZoom={setPreviewZoom}
        previewOnly={!inlineEdit}
        onTogglePreview={() => setInlineEdit(v => !v)}
      />

      <HistoryDialog
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        resumeId={currentId}
        resumeName={currentName}
        onRestore={(restored) => {
          if (currentId) historyStore.push(currentId, data, `Before restore of "${currentName}"`);
          setData({ ...defaultResume, ...restored });
        }}
      />


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
              <input
                type="checkbox"
                checked={jdSaveAsNew || !!primaryId}
                disabled={!!primaryId}
                onChange={e => setJdSaveAsNew(e.target.checked)}
              />
              Save tailored result as a new resume (keeps Primary safe)
              {primaryId && <span className="text-[11px] text-amber-700">— required while a Primary is set</span>}
            </label>
            {(jdSaveAsNew || !!primaryId) && (
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

      <AlertDialog open={tailorConfirmOpen} onOpenChange={setTailorConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tailor resume to this job description?</AlertDialogTitle>
            <AlertDialogDescription>
              {primaryId
                ? "Your Primary Resume will not be modified. AI will create a new tailored copy you can review and edit."
                : "AI will create a new tailored copy of your resume. Your current resume stays untouched."}
              {" "}ATS-friendly formatting (plain text, standard sections, real employers and dates) is preserved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-1.5">
            <Label className="text-xs">Name this tailored version</Label>
            <Input
              value={tailorConfirmName}
              onChange={e => setTailorConfirmName(e.target.value)}
              placeholder="e.g. Stripe — Senior PM"
              autoFocus
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={generating}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={generateFromJD} disabled={generating}>
              {generating ? "Tailoring…" : "Create tailored copy"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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

      <div className={cn("mx-auto max-w-[1600px] grid gap-6 px-4 sm:px-6 py-6 grid-cols-1",
        atsOpen
          ? "lg:grid-cols-[3fr_7fr] xl:grid-cols-[3fr_7fr] 2xl:grid-cols-[3fr_5fr_2fr]"
          : "lg:grid-cols-[3fr_7fr] xl:grid-cols-[3fr_7fr]"
      )}>
        {/* Editor */}
        <div className={cn("no-print", mobileView !== "editor" && "hidden lg:block")}>
          {/* Resume Completion Progress */}
          <div className="mb-3 rounded-xl border border-border bg-card p-3 shadow-[var(--shadow-soft)]">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Resume Completion</span>
              <span className="text-xs font-semibold text-primary">{getCompletionPercent(data)}%</span>
            </div>
            <Progress value={getCompletionPercent(data)} className="h-2" />
          </div>
          <Tabs defaultValue="basics" className="w-full">
            <div className="sticky top-16 z-10 -mx-1 px-1 pb-2 pt-1 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
              <TabsList
                className={cn(
                  "h-auto w-full p-1 gap-1 rounded-xl border border-border bg-card shadow-[var(--shadow-soft)]",
                  // Narrow viewports: horizontal scroll with snap so tabs never overlap.
                  // Switch to a 6-col grid only when there is enough room (≥ lg).
                  "flex overflow-x-auto snap-x snap-mandatory scrollbar-thin",
                  "lg:grid lg:grid-cols-6 lg:overflow-visible"
                )}
              >
                {(() => {
                  const completion = getSectionCompletion(data);
                  const tabs = [
                    { v: "basics" as const, label: "Basics", icon: User, done: completion.basics },
                    { v: "experience" as const, label: "Experience", icon: Briefcase, done: completion.experience },
                    { v: "education" as const, label: "Education", icon: GraduationCap, done: completion.education },
                    { v: "skills" as const, label: "Skills", icon: Wrench, done: completion.skills },
                    { v: "extras" as const, label: "Extras", icon: Trophy, done: completion.extras },
                    { v: "target" as const, label: "Target", icon: Target, done: completion.target },
                  ];
                  return tabs.map(({ v, label, icon: Icon, done }) => (
                    <TabsTrigger
                      key={v}
                      value={v}
                      className="snap-start shrink-0 lg:shrink min-w-[104px] lg:min-w-0 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm whitespace-nowrap"
                    >
                      <Icon className="h-3.5 w-3.5 opacity-80" />
                      <span>{label}</span>
                      {done ? (
                        <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                      ) : (
                        <AlertCircle className="h-3 w-3 text-amber-500" />
                      )}
                    </TabsTrigger>
                  ));
                })()}
              </TabsList>
            </div>
            <TabsContent value="basics" className="space-y-6 mt-4">
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
              data.summary.trim() ? (
                <Button size="sm" variant="accent" onClick={rewriteSummary} disabled={rewriting}>
                  {rewriting ? <Loader2 className="animate-spin" /> : <Sparkles />}
                  {rewriting ? "Rewriting…" : "Rewrite with AI"}
                </Button>
              ) : null
            }
          >
            {!data.summary.trim() ? (
              <div className="rounded-lg border border-dashed border-border bg-muted/30 p-6 text-center">
                <p className="text-sm text-muted-foreground mb-3">Your summary is empty. Let AI craft one tailored to your role and target job.</p>
                <Button variant="accent" onClick={rewriteSummary} disabled={rewriting}>
                  {rewriting ? <Loader2 className="animate-spin" /> : <Sparkles />}
                  {rewriting ? "Generating…" : "Generate Professional Summary"}
                </Button>
                <p className="mt-3 text-xs text-muted-foreground">Or type your own below.</p>
                <div className="mt-3 text-left">
                  <FormattableTextarea rows={3} value={data.summary} onChange={v => update("summary", v)} placeholder="2-3 sentences on who you are and what you do." />
                </div>
              </div>
            ) : (
              <>
                <FormattableTextarea rows={4} value={data.summary} onChange={v => update("summary", v)} placeholder="2-3 sentences on who you are and what you do." />
                <p className="mt-2 text-xs text-muted-foreground">Select text and click <b>B</b> to bold it. Tip: paste a job description below for a tailored rewrite.</p>
              </>
            )}
          </Card>
          </div>
            </TabsContent>

            <TabsContent value="experience" className="space-y-6 mt-4">
          <div id="edit-experience" className="rounded-xl">
          <ExperienceSection
            experiences={data.experience}
            setExperiences={next => update("experience", next)}
            updateExp={updateExp}
            addExp={addExp}
            removeExp={removeExp}
            rewriteWithAI={rewriteWithAI}
            rewritingKey={rewritingKey}
          />
          </div>
            </TabsContent>

            <TabsContent value="education" className="space-y-6 mt-4">
          <div id="edit-education" className="rounded-xl">
          <Card title="Education" action={<Button size="sm" variant="outline" onClick={addEdu}><Plus /> Add education</Button>}>
            <div className="space-y-3">
              {data.education.length === 0 && (
                <div className="rounded-lg border border-dashed border-border bg-background p-6 text-center text-sm text-muted-foreground">
                  No education added yet. Click <span className="font-medium text-foreground">Add education</span> to list a degree.
                </div>
              )}
              {data.education.map((ed, idx) => (
                <div key={ed.id} className="rounded-lg border border-border p-4 bg-background">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Education #{idx + 1}</div>
                    <Button size="sm" variant="ghost" onClick={() => removeEdu(ed.id)}><Trash2 /> Remove</Button>
                  </div>
                  <Grid>
                    <Field label="Degree" full>
                      <Input value={ed.degree} onChange={ev => updateEdu(ed.id, { degree: ev.target.value })} placeholder="B.S. Computer Science" />
                    </Field>
                    <Field label="Field of study (optional)">
                      <Input value={ed.field ?? ""} onChange={ev => updateEdu(ed.id, { field: ev.target.value })} placeholder="Human-Computer Interaction" />
                    </Field>
                    <Field label="School / University">
                      <Input value={ed.school} onChange={ev => updateEdu(ed.id, { school: ev.target.value })} placeholder="Carnegie Mellon University" />
                    </Field>
                    <Field label="Location (optional)">
                      <Input value={ed.location ?? ""} onChange={ev => updateEdu(ed.id, { location: ev.target.value })} placeholder="Pittsburgh, PA" />
                    </Field>
                    <Field label="Date range" full>
                      <DateRangePicker
                        value={ed.date}
                        onChange={v => updateEdu(ed.id, { date: v })}
                        startLabel="Start"
                        endLabel="Graduation"
                      />
                    </Field>
                    <Field label="GPA (optional)">
                      <Input value={ed.gpa ?? ""} onChange={ev => updateEdu(ed.id, { gpa: ev.target.value })} placeholder="3.8 / 4.0" />
                    </Field>
                    <Field label="Honors / coursework (optional)">
                      <Input value={ed.honors ?? ""} onChange={ev => updateEdu(ed.id, { honors: ev.target.value })} placeholder="Magna Cum Laude · Dean's List" />
                    </Field>
                  </Grid>
                </div>
              ))}
            </div>
          </Card>
          </div>
            </TabsContent>

            <TabsContent value="skills" className="space-y-6 mt-4">
          <div id="edit-skills" className="rounded-xl">
          <Card
            title="Skills"
            action={
              data.skills.trim() ? (
                <Button size="sm" variant="ghost" disabled={rewritingKey === "skills"}
                  onClick={async () => {
                    const out = await rewriteWithAI("skills", data.skills, {}, "skills");
                    if (out) { update("skills", out); toast.success("Skills tuned"); }
                  }}>
                  {rewritingKey === "skills" ? <Loader2 className="animate-spin" /> : <Sparkles />} AI tune
                </Button>
              ) : null
            }
          >
            {!data.skills.trim() ? (
              <div className="rounded-lg border border-dashed border-border bg-muted/30 p-6 text-center">
                <p className="text-sm text-muted-foreground mb-3">No skills yet. Generate a relevant list from your role{data.jobDescription.trim() ? " and target job" : ""}.</p>
                <Button variant="accent" disabled={rewritingKey === "skills"}
                  onClick={async () => {
                    const out = await rewriteWithAI("skills", data.skills || data.headline || "", {}, "skills");
                    if (out) { update("skills", out); toast.success("Skills generated"); }
                  }}>
                  {rewritingKey === "skills" ? <Loader2 className="animate-spin" /> : <Sparkles />}
                  {rewritingKey === "skills" ? "Generating…" : "Generate Skills with AI"}
                </Button>
                <p className="mt-3 text-xs text-muted-foreground">Or type your own below.</p>
                <div className="mt-3 text-left">
                  <FormattableTextarea rows={3} value={data.skills} onChange={v => update("skills", v)} placeholder="Comma or pipe separated: React | TypeScript, Figma | Design Systems" />
                </div>
              </div>
            ) : (
              <>
                <FormattableTextarea rows={3} value={data.skills} onChange={v => update("skills", v)} placeholder="Comma or pipe separated: React | TypeScript, Figma | Design Systems" />
                <p className="mt-2 text-xs text-muted-foreground">Separate with <code>,</code> or <code>|</code>. {parseSkills(data.skills).length} skills detected.</p>
              </>
            )}
          </Card>
          </div>
            </TabsContent>

            <TabsContent value="extras" className="space-y-6 mt-4">
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
            <Card title="Certifications" action={<Button size="sm" variant="outline" onClick={addCert}><Plus /> Add certification</Button>}>
              <div className="space-y-3">
                {data.certifications.length === 0 && (
                  <div className="rounded-lg border border-dashed border-border bg-background p-6 text-center text-sm text-muted-foreground">
                    No certifications yet. Add credentials like AWS, PMP, Google Analytics to boost recruiter signal.
                  </div>
                )}
                {data.certifications.map((c, idx) => (
                  <div key={c.id} className="rounded-lg border border-border p-4 bg-background">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Certification #{idx + 1}</div>
                      <Button size="sm" variant="ghost" onClick={() => removeCert(c.id)}><Trash2 /> Remove</Button>
                    </div>
                    <Grid>
                      <Field label="Certification name" full>
                        <Input value={c.name} onChange={ev => updateCert(c.id, { name: ev.target.value })} placeholder="AWS Certified Solutions Architect" />
                      </Field>
                      <Field label="Issuing organization">
                        <Input value={c.issuer} onChange={ev => updateCert(c.id, { issuer: ev.target.value })} placeholder="Amazon Web Services" />
                      </Field>
                      <Field label="Credential ID (optional)">
                        <Input value={c.credentialId ?? ""} onChange={ev => updateCert(c.id, { credentialId: ev.target.value })} placeholder="ABCD-1234" />
                      </Field>
                      <Field label="Issue date">
                        <MonthYearPicker value={c.date} onChange={v => updateCert(c.id, { date: v })} placeholder="Pick issue date" />
                      </Field>
                      <Field label="Expiration">
                        <MonthYearPicker
                          value={c.noExpiry ? "No expiration" : (c.expires ?? "")}
                          onChange={v => updateCert(c.id, { expires: v, noExpiry: false })}
                          placeholder={c.noExpiry ? "No expiration" : "Pick expiration"}
                          disabled={!!c.noExpiry}
                        />
                      </Field>
                      <Field label="Credential URL (optional)" full>
                        <Input value={c.url ?? ""} onChange={ev => updateCert(c.id, { url: ev.target.value })} placeholder="https://credly.com/…" />
                      </Field>
                    </Grid>
                    <label className="mt-2 inline-flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
                      <input
                        type="checkbox"
                        className="h-3.5 w-3.5 accent-[var(--navy-light)]"
                        checked={!!c.noExpiry}
                        onChange={e => updateCert(c.id, { noExpiry: e.target.checked, expires: e.target.checked ? "" : (c.expires ?? "") })}
                      />
                      This credential does not expire
                    </label>
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
            </TabsContent>

            <TabsContent value="target" className="space-y-6 mt-4">
          <Card
            title="Target job description"
            action={
              <Button size="sm" variant="accent" onClick={openTailorConfirm} disabled={generating || !data.jobDescription.trim()}>
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
            </TabsContent>
          </Tabs>
        </div>

        {/* Preview */}
        <div id="resume-preview" className={cn("min-w-0 relative scroll-mt-20", mobileView !== "preview" && "hidden lg:block")}>
          {!atsOpen && (
            <button
              onClick={() => setAtsOpen(true)}
              className="no-print hidden 2xl:inline-flex absolute right-2 top-2 z-10 items-center gap-1.5 rounded-md border border-border bg-background h-8 px-2.5 text-xs font-medium hover:border-[var(--navy-light)]"
              title="Open ATS panel"
            >
              <PanelRightOpen className="h-3.5 w-3.5" /> ATS · {score.score}
            </button>
          )}
          <SectionReorderBar
            order={data.sectionOrder}
            onChange={(order) => {
              pushSectionsHistory("reorder");
              const prev = dataRef.current.sectionOrder;
              const moved = order.find((id, i) => prev[i] !== id);
              update("sectionOrder", order);
              if (moved) flashMoved(moved);
            }}
          />
          <PreviewToolbar
            data={data}
            getData={() => commitPreviewEdits()}
            onPdf={printCurrentResume}
            onDocx={handleDocx}
            docxBusy={exporting}
            onUpdate={(patch) => setData(d => ({ ...d, ...patch }))}
            extras={
              <>
                <TemplatesPopover data={data} onPick={(id) => update("template", id)} />
                <SectionsPopover
                  data={data}
                  onUpdate={(order) => {
                    pushSectionsHistory("reorder");
                    const prev = dataRef.current.sectionOrder;
                    const moved = order.find((id, i) => prev[i] !== id);
                    update("sectionOrder", order);
                    if (moved) flashMoved(moved);
                  }}
                  onAdd={(id) => { pushSectionsHistory(); addSectionIfMissing(id); flashMoved(id); }}
                  onRemove={(id) => { pushSectionsHistory(); removeSectionFromOrder(id); }}
                  onToggleSidebar={(id) => {
                    if (!SIDEBAR_ELIGIBLE.includes(id)) return;
                    pushSectionsHistory();
                    setData(d => {
                      const current = d.sidebarSections ?? TEMPLATE_SIDEBAR_DEFAULTS[d.template] ?? [];
                      const next = current.includes(id)
                        ? current.filter(s => s !== id)
                        : [...current, id];
                      return { ...d, sidebarSections: next };
                    });
                    flashMoved(id);
                  }}
                  onAddCustom={() => { pushSectionsHistory(); setData(d => ({ ...d, customSections: [...(d.customSections ?? []), { id: uid(), title: "", content: "" }] })); }}
                  onUpdateCustom={(id, patch) => {
                    const field = Object.keys(patch)[0] ?? "field";
                    pushSectionsHistory(`custom:${id}:${field}`);
                    setData(d => ({ ...d, customSections: (d.customSections ?? []).map(c => c.id === id ? { ...c, ...patch } : c) }));
                  }}
                  onRemoveCustom={(id) => { pushSectionsHistory(); setData(d => ({ ...d, customSections: (d.customSections ?? []).filter(c => c.id !== id) })); }}
                  onReorderCustom={(next) => { pushSectionsHistory("reorder-custom"); setData(d => ({ ...d, customSections: next })); }}
                  onUndo={undoSections}
                  onRedo={redoSections}
                  canUndo={sectionsPast.length > 0}
                  canRedo={sectionsFuture.length > 0}
                />
                <StylePopover data={data} onPatch={(p) => setData(d => ({ ...d, ...p }))} />
              </>
            }
          />
          {/* Mobile/tablet ATS trigger — collapses to a sheet below 2xl */}
          <div className="no-print 2xl:hidden mb-3 sticky top-16 z-10">
            <Sheet open={atsSheetOpen} onOpenChange={setAtsSheetOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" className="w-full">
                  <Gauge className="h-4 w-4" /> Open ATS analysis · {score.score}
                </Button>
              </SheetTrigger>
              <SheetContent side="right" id="ats-sheet" aria-labelledby="ats-sheet-title" aria-describedby="ats-sheet-desc" className="w-full sm:max-w-md overflow-y-auto p-0">
                <VisuallyHidden>
                  <SheetTitle id="ats-sheet-title">ATS analysis</SheetTitle>
                  <SheetDescription id="ats-sheet-desc">Review your resume's ATS score, keyword matches, and recommended improvements.</SheetDescription>
                </VisuallyHidden>
                <div className="p-4">
                  <AtsPanel
                    data={data}
                    onClose={() => setAtsSheetOpen(false)}
                    onAppendBulletsToFirstExperience={(bullets, targetId) => {
                      setData(d => {
                        const exp = [...d.experience];
                        if (exp.length === 0) {
                          exp.push({ id: uid(), title: d.headline || "Role", company: "", date: "", bullets: bullets.join("\n") });
                        } else {
                          const idx = targetId ? exp.findIndex(e => e.id === targetId) : 0;
                          const i = idx >= 0 ? idx : 0;
                          exp[i] = { ...exp[i], bullets: [exp[i].bullets, ...bullets].filter(Boolean).join("\n") };
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
                    onApplyBaselineFix={applyBaselineFix}
                    optimizing={generating}
                  />
                </div>
              </SheetContent>
            </Sheet>
          </div>
          <div className="overflow-auto rounded-xl">
            <div style={{ transform: `scale(${previewZoom})`, transformOrigin: "top left", width: previewZoom !== 1 ? `${100 / previewZoom}%` : undefined }}>
              <PreviewFitWrap>
                <ResumeDocument
                  data={data}
                  onSectionClick={inlineEdit ? undefined : scrollToEditor}
                  editable={inlineEdit}
                  flashSection={flashSection}
                  handlers={{
                    onUpdate: updatePatch,
                    onUpdateExperienceBullets: (id, bullets) => updateExp(id, { bullets }),
                    onRewrite: rewriteFromPreview,
                    rewritingKey: rewriting ? "summary" : rewritingKey,
                  }}
                />
              </PreviewFitWrap>
            </div>
          </div>

        </div>
        {inlineEdit && <SelectionFormatToolbar data={data} />}

        {/* ATS panel */}
        {atsOpen && (
        <div className="no-print hidden 2xl:block 2xl:sticky 2xl:top-20 2xl:self-start 2xl:h-[calc(100dvh-6rem)] 2xl:overflow-y-auto 2xl:overscroll-contain 2xl:pr-1 2xl:scrollbar-thin">
        <AtsPanel
          data={data}
          onClose={() => setAtsOpen(false)}
          onAppendBulletsToFirstExperience={(bullets, targetId) => {
            setData(d => {
              const exp = [...d.experience];
              if (exp.length === 0) {
                exp.push({ id: uid(), title: d.headline || "Role", company: "", date: "", bullets: bullets.join("\n") });
              } else {
                const idx = targetId ? exp.findIndex(e => e.id === targetId) : 0;
                const i = idx >= 0 ? idx : 0;
                exp[i] = { ...exp[i], bullets: [exp[i].bullets, ...bullets].filter(Boolean).join("\n") };
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
          onApplyBaselineFix={applyBaselineFix}
          optimizing={generating}
        />
        </div>
        )}
      </div>
      <Dialog open={verbChangesOpen} onOpenChange={setVerbChangesOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wand2 className="h-4 w-4" /> Action-verb changes
            </DialogTitle>
          </DialogHeader>
          {verbChanges.length === 0 ? (
            <p className="text-sm text-muted-foreground">No bullets were modified.</p>
          ) : (
            <div className="max-h-[60vh] overflow-y-auto space-y-4 pr-1">
              <p className="text-xs text-muted-foreground">
                {verbChanges.length} bullet{verbChanges.length === 1 ? "" : "s"} were rewritten to start with stronger action verbs after JD tailoring.
              </p>
              {Object.entries(
                verbChanges.reduce<Record<string, VerbChange[]>>((acc, c) => {
                  const key = `${c.title}${c.company ? ` · ${c.company}` : ""}`;
                  (acc[key] ||= []).push(c);
                  return acc;
                }, {}),
              ).map(([group, items]) => (
                <div key={group} className="rounded-lg border border-border p-3">
                  <div className="text-xs font-semibold text-foreground mb-2">{group}</div>
                  <ul className="space-y-2">
                    {items.map((c, i) => (
                      <li key={i} className="text-sm space-y-1">
                        <div className="text-muted-foreground line-through decoration-destructive/60">{c.before}</div>
                        <div className="text-foreground">{c.after}</div>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setVerbChanges([])}>Clear log</Button>
            <Button onClick={() => setVerbChangesOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Mobile bottom navigation — 5-tab nav for primary builder actions. */}
      <nav
        className="no-print lg:hidden fixed bottom-0 inset-x-0 z-30 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 pb-[env(safe-area-inset-bottom)]"
        aria-label="Builder mobile navigation"
        role="navigation"
      >
        <ul className="grid grid-cols-5 h-[64px]" role="list">
          {[
            { id: "editor" as const, label: "Resume", ariaLabel: "Edit resume", icon: Pencil, onClick: () => setMobileView("editor"), active: mobileView === "editor", controls: undefined, expanded: undefined },
            { id: "preview" as const, label: "Preview", ariaLabel: "Preview resume", icon: Eye, onClick: () => { setMobileView("preview"); requestAnimationFrame(() => document.getElementById("resume-preview")?.scrollIntoView({ behavior: "smooth", block: "start" })); }, active: mobileView === "preview", controls: "resume-preview", expanded: undefined },
            { id: "ats" as const, label: `ATS · ${score.score}`, ariaLabel: `Open ATS panel, current score ${score.score} out of 100`, icon: Gauge, onClick: () => setAtsSheetOpen(true), active: atsSheetOpen, controls: "ats-sheet", expanded: atsSheetOpen },
            { id: "ai" as const, label: "AI", ariaLabel: "Open AI assistant", icon: Sparkles, onClick: () => window.dispatchEvent(new CustomEvent(AI_ASSISTANT_OPEN_EVENT)), active: false, controls: undefined, expanded: undefined },
            { id: "settings" as const, label: "Settings", ariaLabel: "Open builder settings", icon: LayoutTemplate, onClick: () => setSettingsSheetOpen(true), active: settingsSheetOpen, controls: "settings-sheet", expanded: settingsSheetOpen },
          ].map(item => (
            <li key={item.id} className="contents">
              <button
                type="button"
                onClick={item.onClick}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors min-h-11",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
                  item.active ? "text-[var(--navy-light)]" : "text-muted-foreground hover:text-foreground"
                )}
                aria-label={item.ariaLabel}
                aria-current={item.active ? "page" : undefined}
                aria-haspopup={item.controls ? "dialog" : undefined}
                aria-expanded={item.expanded}
                aria-controls={item.controls}
              >
                <item.icon className="h-[18px] w-[18px]" aria-hidden="true" />
                <span className="leading-none">{item.label}</span>
              </button>
            </li>
          ))}
        </ul>
      </nav>

      {/* Mobile Settings sheet — surfaces template/style/sections/history actions. */}
      <Sheet open={settingsSheetOpen} onOpenChange={setSettingsSheetOpen}>
        <SheetContent
          side="bottom"
          id="settings-sheet"
          className="lg:hidden h-auto max-h-[80vh] overflow-y-auto pb-[calc(env(safe-area-inset-bottom)+16px)]"
          aria-labelledby="settings-sheet-title"
          aria-describedby="settings-sheet-desc"
        >
          <SheetTitle id="settings-sheet-title" className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase mb-3">
            Builder settings
          </SheetTitle>
          <VisuallyHidden>
            <SheetDescription id="settings-sheet-desc">
              Quick actions for templates, version history, saving and exporting your resume.
            </SheetDescription>
          </VisuallyHidden>
          <div className="grid grid-cols-2 gap-2" role="group" aria-label="Builder actions">
            <button
              type="button"
              onClick={() => { setSettingsSheetOpen(false); openMobileTemplates(); }}
              className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-3 text-sm font-medium hover:border-[var(--navy-light)] hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-11"
            >
              <LayoutTemplate className="h-4 w-4" aria-hidden="true" /> Templates
            </button>
            <button
              type="button"
              onClick={() => { setSettingsSheetOpen(false); setHistoryOpen(true); }}
              className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-3 text-sm font-medium hover:border-[var(--navy-light)] hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-11"
            >
              <HistoryIcon className="h-4 w-4" aria-hidden="true" /> History
            </button>
            <button
              type="button"
              onClick={() => { setSettingsSheetOpen(false); saveCurrent(); }}
              className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-3 text-sm font-medium hover:border-[var(--navy-light)] hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-11"
            >
              <Save className="h-4 w-4" aria-hidden="true" /> Save
            </button>
            <button
              type="button"
              onClick={() => { setSettingsSheetOpen(false); setNameDraft(currentName); setSaveAsOpen(true); }}
              className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-3 text-sm font-medium hover:border-[var(--navy-light)] hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-11"
            >
              <FilePlus2 className="h-4 w-4" aria-hidden="true" /> Save as new
            </button>
            <button
              type="button"
              onClick={() => { setSettingsSheetOpen(false); printCurrentResume(); }}
              className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-3 text-sm font-medium hover:border-[var(--navy-light)] hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-11"
            >
              <FileText className="h-4 w-4" aria-hidden="true" /> Download PDF
            </button>
            <button
              type="button"
              onClick={() => { setSettingsSheetOpen(false); handleDocx(); }}
              className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-3 text-sm font-medium hover:border-[var(--navy-light)] hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-11"
            >
              <FileType className="h-4 w-4" aria-hidden="true" /> Download DOCX
            </button>
          </div>
        </SheetContent>
      </Sheet>


      <AiAssistantDock data={data} atsScore={score.score} />

      {/* Polite ARIA live region for screen-reader status (AI rewrites, PDF/DOCX exports, tailoring). */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {liveMsg}
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

function OpeningResumeOverlay({
  state,
  onRetry,
  onCancel,
}: {
  state: { phase: "loading" | "notfound"; id: string; attempt: number };
  onRetry: () => void;
  onCancel: () => void;
}) {
  const isLoading = state.phase === "loading";
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-sm no-print"
      role="dialog"
      aria-modal="true"
      aria-label={isLoading ? "Opening resume" : "Resume not found"}
    >
      <div className="w-[min(420px,92vw)] rounded-2xl border border-border bg-card shadow-[var(--shadow-soft)] p-6">
        {isLoading ? (
          <>
            <div className="flex items-center gap-3">
              <Loader2 className="h-5 w-5 animate-spin text-[var(--navy)]" />
              <div>
                <div className="text-sm font-display font-semibold">Opening your resume…</div>
                <div className="text-xs text-muted-foreground">
                  Syncing from the cloud if needed.
                </div>
              </div>
            </div>
            <div className="mt-5 space-y-2">
              <Skeleton className="h-3 w-1/3" />
              <Skeleton className="h-3 w-2/3" />
              <Skeleton className="h-3 w-5/6" />
              <Skeleton className="h-3 w-1/2" />
              <Skeleton className="h-20 w-full mt-3 rounded-lg" />
            </div>
            <div className="mt-5 flex justify-end">
              <Button size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-3">
              <XCircle className="h-5 w-5 text-amber-600" />
              <div>
                <div className="text-sm font-display font-semibold">Couldn’t find this resume</div>
                <div className="text-xs text-muted-foreground">
                  It may not have synced to this device yet, or it was deleted elsewhere.
                </div>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={onCancel}>Dismiss</Button>
              <Button size="sm" variant="accent" onClick={onRetry}>
                <RotateCcw className="h-3.5 w-3.5" /> Retry
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}