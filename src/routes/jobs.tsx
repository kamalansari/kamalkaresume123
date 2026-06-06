import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Search, Filter, MapPin, Briefcase, Calendar, Building2, Tag, Bookmark, Sparkles, Loader2, ArrowLeft, ExternalLink, Gauge, ChevronDown, Download, ChevronRight, FileText, Wand2, MessageSquare, RefreshCw, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { resumeStore, newId, type SavedResume } from "@/components/builder/resumeStore";
import { defaultResume, type ResumeData } from "@/components/builder/types";
import { computeScore, canonical } from "@/components/builder/atsScore";
import { downloadAtsReportPdf } from "@/components/builder/atsReportPdf";
import { cn } from "@/lib/utils";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { authFetch } from "@/lib/authFetch";

export const Route = createFileRoute("/jobs")({
  head: () => ({
    meta: [
      { title: "Find Jobs — ResumeForge" },
      { name: "description", content: "AI-recommended job listings tailored to your resume, with one-click ATS scoring and Apply links." },
    ],
  }),
  component: JobsPage,
});

type Job = {
  id: string;
  title: string;
  company: string;
  location: string;
  experience: string;
  salary: string;
  postedAgo: string;
  postedAt?: number;
  tags: string[];
  jd: string;
  source?: string;
  applyUrl?: string;
  remote?: boolean;
};

const CACHE_KEY = "rf:jobsCache:v2";
const PAGE_SIZE = 20;

const INDUSTRIES = ["All industries", "IT Services", "Banking & Finance", "Healthcare", "E-commerce", "Manufacturing", "Education", "Consulting", "Media"];
const ROLES = ["All roles", "Software Engineering", "Data & Analytics", "Product", "Design", "Marketing", "Sales", "Operations", "HR"];
const DATES = ["1 Day", "3 Days", "1 Week", "15 Days", "1 Month", "All time"];
const EXPERIENCES = ["Fresher", "0-1 years", "1-2 years", "2 years", "2-5 years", "5-8 years", "8-12 years", "12+ years"];
const DRAFT_RESUME_ID = "__current_draft";

const EXPERIENCE_LEVELS = [
  { id: "any", label: "Any level", min: -1, max: 100 },
  { id: "fresher", label: "Fresher (0-1 yr)", min: 0, max: 1 },
  { id: "junior", label: "Junior (1-3 yrs)", min: 1, max: 3 },
  { id: "mid", label: "Mid (3-6 yrs)", min: 3, max: 6 },
  { id: "senior", label: "Senior (6-10 yrs)", min: 6, max: 10 },
  { id: "lead", label: "Lead (10+ yrs)", min: 10, max: 100 },
] as const;
type ExpLevelId = (typeof EXPERIENCE_LEVELS)[number]["id"];

// Parse experience strings like "3-5 years", "0-1 yr", "Fresher", "8+ years"
function parseExperienceYears(value: string): { min: number; max: number } {
  const v = (value || "").toLowerCase();
  if (!v) return { min: 0, max: 100 };
  if (/fresher|entry/.test(v)) return { min: 0, max: 1 };
  const range = v.match(/(\d+)\s*[-–to]+\s*(\d+)/);
  if (range) return { min: Number(range[1]), max: Number(range[2]) };
  const plus = v.match(/(\d+)\s*\+/);
  if (plus) return { min: Number(plus[1]), max: 100 };
  const single = v.match(/(\d+)/);
  if (single) { const n = Number(single[1]); return { min: n, max: n }; }
  return { min: 0, max: 100 };
}

// Parse salary strings like "₹8-15 LPA", "12 LPA", "Not disclosed", "10-18 LPA"
function parseSalaryLpa(value: string): { min: number; max: number } | null {
  const v = (value || "").toLowerCase();
  if (!v || /not\s*disclosed|undisclosed/.test(v)) return null;
  const nums = v.match(/\d+(?:\.\d+)?/g);
  if (!nums || nums.length === 0) return null;
  const isLpa = /lpa|lakh/.test(v);
  const isCr = /cr|crore/.test(v);
  const factor = isCr ? 100 : isLpa ? 1 : 1; // assume LPA when units are missing
  const vals = nums.map(Number).map(n => n * factor);
  return { min: Math.min(...vals), max: Math.max(...vals) };
}

function JobsPage() {
  const [resumes, setResumes] = useState<SavedResume[]>([]);
  const [draftResume, setDraftResume] = useState<ResumeData | null>(null);
  const [activeResumeId, setActiveResumeId] = useState<string>("");
  const [jobTitle, setJobTitle] = useState("Data Analyst");
  const [experience, setExperience] = useState("2 years");
  const [location, setLocation] = useState("Mumbai, Thane, Navi Mumbai");
  const [industry, setIndustry] = useState(INDUSTRIES[0]);
  const [role, setRole] = useState(ROLES[0]);
  const [datePosted, setDatePosted] = useState("1 Week");
  const [alias, setAlias] = useState("");
  const [keywords, setKeywords] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [totalResults, setTotalResults] = useState(0);
  const [fetchedAt, setFetchedAt] = useState<number | null>(null);
  const [activeRoleTab, setActiveRoleTab] = useState("Data Analyst");
  const [scoreJob, setScoreJob] = useState<Job | null>(null);
  const [scoreResume, setScoreResume] = useState<ResumeData | null>(null);
  const [novaJob, setNovaJob] = useState<Job | null>(null);
  const [novaLoading, setNovaLoading] = useState(false);
  const [novaResp, setNovaResp] = useState<{ tips: string[]; keywords: string[] } | null>(null);
  const [novaQuestion, setNovaQuestion] = useState<string>("");
  const [applyJob, setApplyJob] = useState<Job | null>(null);
  const [applyName, setApplyName] = useState<string>("");
  const [applyResumeId, setApplyResumeId] = useState<string>("");
  const [applyLoading, setApplyLoading] = useState(false);
  const [applyStep, setApplyStep] = useState<"tailor" | "confirm">("tailor");
  const [applySavedResume, setApplySavedResume] = useState<SavedResume | null>(null);
  const [savedJobIds, setSavedJobIds] = useState<Set<string>>(() => loadSavedJobIds());
  const navigate = useNavigate();
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // Client-side filter state for recommended-jobs panel
  const [roleFilter, setRoleFilter] = useState<Set<string>>(new Set());
  const [expLevel, setExpLevel] = useState<ExpLevelId>("any");
  const [salaryRange, setSalaryRange] = useState<[number, number]>([0, 100]);
  const [minScore, setMinScore] = useState<number>(0);

  const refreshResumes = () => {
    const list = resumeStore.list();
    const primaryId = resumeStore.getPrimaryId();
    setResumes(list);
    setDraftResume(resumeStore.getDraft());
    setActiveResumeId(current => {
      if (current === DRAFT_RESUME_ID && resumeStore.getDraft()) return current;
      if (current && list.some(r => r.id === current)) return current;
      if (resumeStore.getDraft()) return DRAFT_RESUME_ID;
      if (primaryId && list.some(r => r.id === primaryId)) return primaryId;
      return list[0]?.id ?? "";
    });
  };

  useEffect(() => {
    refreshResumes();
    // Hydrate from session cache for snappy initial load
    try {
      const raw = sessionStorage.getItem(CACHE_KEY);
      if (raw) {
        const c = JSON.parse(raw) as { jobs: Job[]; total: number; page: number; hasMore: boolean; fetchedAt: number; jobTitle: string; location: string };
        if (c.jobs?.length) {
          setJobs(c.jobs);
          setTotalResults(c.total ?? c.jobs.length);
          setPage(c.page ?? 1);
          setHasMore(!!c.hasMore);
          setFetchedAt(c.fetchedAt ?? Date.now());
          if (c.jobTitle) { setJobTitle(c.jobTitle); setActiveRoleTab(c.jobTitle); }
          if (c.location) setLocation(c.location);
        }
      }
    } catch { /* ignore */ }
  }, []);

  const activeResume: ResumeData = useMemo(() => {
    if (activeResumeId === DRAFT_RESUME_ID) return draftResume ?? defaultResume;
    const r = resumes.find(x => x.id === activeResumeId);
    return r?.data ?? draftResume ?? defaultResume;
  }, [resumes, activeResumeId, draftResume]);

  const activeResumeName = activeResumeId === DRAFT_RESUME_ID ? "Current draft" : resumes.find(r => r.id === activeResumeId)?.name ?? (draftResume ? "Current draft" : "Default sample");

  const filterCount = [industry !== INDUSTRIES[0], role !== ROLES[0], datePosted !== "All time", alias, keywords].filter(Boolean).length;

  const fetchPage = useCallback(async (pageNum: number, append: boolean) => {
    if (!jobTitle.trim()) { toast.error("Enter a job title."); return; }
    append ? setLoadingMore(true) : setLoading(true);
    try {
      const res = await authFetch("/api/recommend-jobs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jobTitle, experience, location, keywords, page: pageNum, pageSize: PAGE_SIZE }),
      });
      if (res.status === 429) { toast.error("Rate limit hit. Retry shortly."); return; }
      if (!res.ok) { toast.error("Search failed."); return; }
      const out = (await res.json()) as { jobs?: Job[]; total?: number; hasMore?: boolean; fetchedAt?: number };
      const nextJobs = normalizeJobs(out.jobs ?? []);
      const merged = append ? [...jobs, ...nextJobs] : nextJobs;
      setJobs(merged);
      setTotalResults(out.total ?? merged.length);
      setHasMore(!!out.hasMore);
      setPage(pageNum);
      const stamp = out.fetchedAt ?? Date.now();
      setFetchedAt(stamp);
      try {
        sessionStorage.setItem(CACHE_KEY, JSON.stringify({
          jobs: merged, total: out.total ?? merged.length, page: pageNum, hasMore: !!out.hasMore,
          fetchedAt: stamp, jobTitle, location,
        }));
      } catch { /* ignore */ }
      if (!append) {
        setRoleFilter(new Set()); setExpLevel("any"); setMinScore(0); setSalaryRange([0, 100]);
        toast.success(`${out.total ?? nextJobs.length} live jobs found`);
      }
    } catch { toast.error("Network error."); }
    finally { append ? setLoadingMore(false) : setLoading(false); }
  }, [jobTitle, experience, location, keywords, jobs]);

  const searchJobs = useCallback(() => {
    setActiveRoleTab(jobTitle);
    fetchPage(1, false);
  }, [fetchPage, jobTitle]);

  // Infinite scroll observer
  useEffect(() => {
    if (!hasMore || loading || loadingMore) return;
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) fetchPage(page + 1, true);
    }, { rootMargin: "400px" });
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, loading, loadingMore, page, fetchPage]);



  const askNova = async (job: Job, question?: string) => {
    setNovaJob(job);
    setNovaResp(null);
    setNovaQuestion(question ?? "");
    setNovaLoading(true);
    try {
      const res = await authFetch("/api/job-tip", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          jd: job.jd, jobTitle: job.title,
          resume: { headline: activeResume.headline, summary: activeResume.summary, skills: activeResume.skills },
          question: question ?? undefined,
        }),
      });
      if (!res.ok) { toast.error("Nova couldn't respond."); return; }
      setNovaResp(await res.json());
    } catch { toast.error("Network error."); }
    finally { setNovaLoading(false); }
  };

  // Tailor a chosen resume against a job's JD via /api/align-resume and save as a new SavedResume.
  const tailorAndSave = async (job: Job, name: string, sourceId?: string): Promise<SavedResume | null> => {
    const id = sourceId || resumeStore.getPrimaryId() || "";
    const source = resumeStore.list().find(r => r.id === id) || resumeStore.getPrimary();
    if (!source) {
      toast.error("Set a primary resume first in Dashboard.");
      return null;
    }
    const base = source.data;
    try {
      const res = await authFetch("/api/align-resume", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          jobDescription: getJobScoringText(job),
          resume: {
            name: base.name, headline: base.headline, summary: base.summary, skills: base.skills,
            experience: (base.experience ?? []).map(e => ({ title: e.title, company: e.company, date: e.date, bullets: e.bullets })),
          },
        }),
      });
      if (res.status === 429) { toast.error("Rate limit hit. Retry shortly."); return null; }
      if (res.status === 402) { toast.error("AI credits exhausted."); return null; }
      if (!res.ok) { toast.error("Tailoring failed."); return null; }
      const out = (await res.json()) as {
        headline?: string; summary?: string; skills?: string;
        experience?: { title?: string; company?: string; date?: string; bullets?: string }[];
      };
      const mergedExp = (base.experience ?? []).map((exp, i) => ({
        ...exp,
        bullets: out.experience?.[i]?.bullets?.trim() || exp.bullets,
      }));
      const tailored: ResumeData = {
        ...base,
        headline: out.headline?.trim() || base.headline,
        summary: out.summary?.trim() || base.summary,
        skills: out.skills?.trim() || base.skills,
        experience: mergedExp,
        jobDescription: getJobScoringText(job),
      };
      const entry: SavedResume = { id: newId(), name: name.trim() || `${job.company} - ${job.title}`, updatedAt: Date.now(), data: tailored };
      resumeStore.upsert(entry);
      refreshResumes();
      setActiveResumeId(entry.id);
      return entry;
    } catch { toast.error("Network error."); return null; }
  };

  const openApply = (job: Job) => {
    setApplyJob(job);
    setApplyName(`${job.company} - ${job.title}`.slice(0, 80));
    setApplyResumeId(resumeStore.getPrimaryId() || resumes[0]?.id || "");
    setApplyStep("tailor");
    setApplySavedResume(null);
  };

  const confirmTailorAndApply = async () => {
    if (!applyJob) return;
    setApplyLoading(true);
    const saved = await tailorAndSave(applyJob, applyName, applyResumeId);
    setApplyLoading(false);
    if (saved) {
      toast.success(`Tailored resume saved as "${saved.name}".`);
      setApplySavedResume(saved);
      setApplyStep("confirm");
    }
  };

  const applyToJob = (job: Job) => {
    const url = job.applyUrl || naukriUrl(job.title);
    window.open(url, "_blank", "noreferrer");
  };

  const openNaukriAndClose = () => {
    if (applyJob) applyToJob(applyJob);
    setApplyJob(null);
  };

  const toggleSaveJob = (job: Job) => {
    setSavedJobIds(prev => {
      const next = new Set(prev);
      if (next.has(job.id)) {
        next.delete(job.id);
        toast.success("Removed from saved jobs");
      } else {
        next.add(job.id);
        toast.success(`Saved "${job.title}" at ${job.company}`);
      }
      persistSavedJobIds(next);
      persistSavedJob(job, next.has(job.id));
      return next;
    });
  };

  const tailorFromNova = async () => {
    if (!novaJob) return;
    setApplyLoading(true);
    const saved = await tailorAndSave(novaJob, `${novaJob.company} - ${novaJob.title}`);
    setApplyLoading(false);
    if (saved) {
      toast.success(`Saved "${saved.name}".`, {
        action: { label: "Open in builder", onClick: () => navigate({ to: "/builder" }) },
      });
    }
  };

  const naukriUrl = (title: string) => {
    const slug = title.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const locSlug = location.trim().toLowerCase().split(/[,;|]/)[0].replace(/\s+/g, "-");
    return `https://www.naukri.com/${slug || "jobs"}-jobs${locSlug ? `-in-${locSlug}` : ""}`;
  };

  // Score every job once against the active resume — used by both rendering and filtering.
  const scoredJobs = useMemo(() => jobs.map(job => ({
    job,
    score: computeScore({ ...activeResume, jobDescription: getJobScoringText(job) }).score,
    exp: parseExperienceYears(job.experience),
    salary: parseSalaryLpa(job.salary),
  })), [jobs, activeResume]);

  // Derive role options + salary bounds from the current jobs list.
  const roleOptions = useMemo(() => {
    const seen = new Map<string, number>();
    for (const { job } of scoredJobs) {
      const key = job.title.split(/[-–|·,(]/)[0].trim() || job.title;
      seen.set(key, (seen.get(key) ?? 0) + 1);
    }
    return Array.from(seen.entries()).sort((a, b) => b[1] - a[1]).slice(0, 12);
  }, [scoredJobs]);

  const salaryBounds = useMemo<[number, number]>(() => {
    const all = scoredJobs.flatMap(s => s.salary ? [s.salary.min, s.salary.max] : []);
    if (all.length === 0) return [0, 100];
    return [Math.floor(Math.min(...all)), Math.ceil(Math.max(...all))];
  }, [scoredJobs]);

  // Clamp salaryRange to the available bounds whenever bounds change.
  useEffect(() => {
    setSalaryRange(([lo, hi]) => {
      const [bMin, bMax] = salaryBounds;
      const isReset = lo === 0 && hi === 100;
      return isReset ? [bMin, bMax] : [Math.max(lo, bMin), Math.min(hi, bMax)];
    });
  }, [salaryBounds]);

  const expRange = EXPERIENCE_LEVELS.find(l => l.id === expLevel)!;

  const filteredJobs = useMemo(() => {
    return scoredJobs
      .filter(s => {
        if (roleFilter.size > 0) {
          const key = s.job.title.split(/[-–|·,(]/)[0].trim() || s.job.title;
          if (!roleFilter.has(key)) return false;
        }
        if (expLevel !== "any") {
          // Overlap test between job's experience range and selected level range
          if (s.exp.max < expRange.min || s.exp.min > expRange.max) return false;
        }
        if (s.salary) {
          if (s.salary.max < salaryRange[0] || s.salary.min > salaryRange[1]) return false;
        }
        if (s.score < minScore) return false;
        return true;
      })
      .sort((a, b) => b.score - a.score);
  }, [scoredJobs, roleFilter, expLevel, expRange, salaryRange, minScore]);

  const clientFilterCount =
    (roleFilter.size > 0 ? 1 : 0) +
    (expLevel !== "any" ? 1 : 0) +
    (salaryRange[0] !== salaryBounds[0] || salaryRange[1] !== salaryBounds[1] ? 1 : 0) +
    (minScore > 0 ? 1 : 0);

  const resetClientFilters = () => {
    setRoleFilter(new Set());
    setExpLevel("any");
    setSalaryRange(salaryBounds);
    setMinScore(0);
  };

  return (
    <div className="min-h-screen bg-secondary/40">
      <header className="sticky top-0 z-30 backdrop-blur-md bg-background/80 border-b border-border">
        <div className="mx-auto max-w-[1400px] px-6 h-14 flex items-center justify-between">
          <Link to="/builder" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Back to builder
          </Link>
          <div className="font-display font-semibold">Find Jobs</div>
          <div className="w-32 text-right">
            <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">Home</Link>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1400px] px-4 md:px-6 py-6 space-y-4">
        {/* Search row */}
        <div className="rounded-xl border border-border bg-card shadow-[var(--shadow-soft)] overflow-hidden">
          <div className="grid grid-cols-12 gap-px bg-border">
            <FieldCell className="col-span-12 md:col-span-5" label="JOB TITLE" icon={<Search className="h-4 w-4 text-muted-foreground" />}>
              <Input value={jobTitle} onChange={e => setJobTitle(e.target.value)} placeholder="Data Analyst"
                className="h-9 border-0 px-0 shadow-none focus-visible:ring-0 text-base" />
            </FieldCell>
            <FieldCell className="col-span-6 md:col-span-2" label="EXPERIENCE" icon={null}>
              <SelectInline value={experience} onChange={setExperience} options={EXPERIENCES} />
            </FieldCell>
            <FieldCell className="col-span-6 md:col-span-3" label="LOCATION" icon={<MapPin className="h-4 w-4 text-muted-foreground" />}>
              <Input value={location} onChange={e => setLocation(e.target.value)} placeholder="Mumbai, Thane"
                className="h-9 border-0 px-0 shadow-none focus-visible:ring-0 text-base" />
            </FieldCell>
            <div className="col-span-12 md:col-span-2 bg-card flex items-stretch">
              <Button onClick={searchJobs} disabled={loading} className="m-2 flex-1" variant="hero" style={{ background: "var(--gradient-hero)" }}>
                {loading ? <Loader2 className="animate-spin" /> : <Search />} Search Jobs
              </Button>
            </div>
          </div>

          {/* Create alias chip + filters toggle */}
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 bg-card border-t border-border">
            {jobTitle.trim() && (
              <button
                onClick={() => { setAlias(jobTitle); toast.success(`Alias "${jobTitle}" added`); }}
                className="inline-flex items-center gap-1.5 text-sm text-[var(--navy-light)] hover:underline"
              >
                <span className="text-lg leading-none">+</span> Create "{jobTitle}"
              </button>
            )}
            <button
              onClick={() => setFiltersOpen(o => !o)}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background h-8 px-3 text-xs font-medium hover:border-[var(--navy-light)]"
            >
              <Filter className="h-3.5 w-3.5" /> Filters
              {filterCount > 0 && <span className="ml-1 rounded-full bg-[var(--navy-light)] text-white text-[10px] px-1.5 py-0.5">{filterCount}</span>}
            </button>
          </div>

          {/* Filter row */}
          {filtersOpen && (
            <div className="grid grid-cols-12 gap-px bg-border border-t border-border">
              <FieldCell className="col-span-12 md:col-span-4" label="INDUSTRY" icon={<Building2 className="h-3.5 w-3.5 text-muted-foreground" />}>
                <SelectInline value={industry} onChange={setIndustry} options={INDUSTRIES} />
              </FieldCell>
              <FieldCell className="col-span-12 md:col-span-4" label="ROLE CATEGORY" icon={<Briefcase className="h-3.5 w-3.5 text-muted-foreground" />}>
                <SelectInline value={role} onChange={setRole} options={ROLES} />
              </FieldCell>
              <FieldCell className="col-span-12 md:col-span-4" label="DATE POSTED" icon={<Calendar className="h-3.5 w-3.5 text-muted-foreground" />}>
                <SelectInline value={datePosted} onChange={setDatePosted} options={DATES} />
              </FieldCell>
              <FieldCell className="col-span-12 md:col-span-6" label="JOB TITLE ALIAS" icon={<Tag className="h-3.5 w-3.5 text-muted-foreground" />}>
                <Input value={alias} onChange={e => setAlias(e.target.value)} placeholder="Search job titles…"
                  className="h-9 border-0 px-0 shadow-none focus-visible:ring-0" />
              </FieldCell>
              <FieldCell className="col-span-12 md:col-span-6" label="KEYWORDS TO INCLUDE" icon={<Tag className="h-3.5 w-3.5 text-muted-foreground" />}>
                <Input value={keywords} onChange={e => setKeywords(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") searchJobs(); }}
                  placeholder="Type and press Enter"
                  className="h-9 border-0 px-0 shadow-none focus-visible:ring-0" />
              </FieldCell>
            </div>
          )}
        </div>

        {/* Recommended header + selectors */}
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-semibold">
              {totalResults > 0 ? `${totalResults} Live Jobs Found` : "Live Job Matches"}{" "}
              <span className="text-sm font-normal text-muted-foreground">
                ({filteredJobs.length}{filteredJobs.length !== jobs.length ? ` of ${jobs.length} loaded` : " shown"}{location ? ` · ${location}` : ""})
              </span>
            </h2>
            <p className="text-xs text-muted-foreground inline-flex items-center gap-2">
              <Globe className="h-3 w-3" /> Live listings from Remotive &amp; Arbeitnow · ranked by your resume
              {fetchedAt && <span>· Updated {formatStamp(fetchedAt)}</span>}
              {jobs.length > 0 && (
                <button onClick={searchJobs} className="ml-1 inline-flex items-center gap-1 text-[var(--navy-light)] hover:underline">
                  <RefreshCw className="h-3 w-3" /> Refresh
                </button>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* Resume selector */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="rounded-full">
                  <span className="truncate max-w-[160px]">{activeResumeName}</span>
                  <ChevronDown className="h-3.5 w-3.5 opacity-60" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel className="text-[11px] uppercase tracking-widest text-muted-foreground">Score against resume</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {resumes.length === 0 && (
                  <DropdownMenuItem disabled>{draftResume ? "Using latest builder draft." : "No saved resumes. Save one in the builder."}</DropdownMenuItem>
                )}
                {draftResume && (
                  <DropdownMenuItem onClick={() => setActiveResumeId(DRAFT_RESUME_ID)}>
                    {activeResumeId === DRAFT_RESUME_ID ? "✓ " : "  "}Current draft
                  </DropdownMenuItem>
                )}
                {resumes.map(r => (
                  <DropdownMenuItem key={r.id} onClick={() => setActiveResumeId(r.id)}>
                    {r.id === activeResumeId ? "✓ " : "  "}{r.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            {/* Role tab */}
            <div className="inline-flex items-center rounded-full border border-border bg-background h-9 px-3">
              <span className="text-sm font-medium border-b-2 border-[var(--navy-light)] pb-0.5">{activeRoleTab}</span>
            </div>
          </div>
        </div>

        {/* Client-side refine filters — live ATS rescores via useMemo above */}
        {!loading && jobs.length > 0 && (
          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="inline-flex items-center gap-2 text-sm font-semibold">
                <Filter className="h-4 w-4 text-[var(--navy-light)]" /> Refine recommendations
                {clientFilterCount > 0 && (
                  <span className="rounded-full bg-[var(--navy-light)] text-white text-[10px] px-1.5 py-0.5">{clientFilterCount}</span>
                )}
              </div>
              {clientFilterCount > 0 && (
                <button onClick={resetClientFilters} className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline">
                  Reset filters
                </button>
              )}
            </div>
            <div className="grid md:grid-cols-3 gap-4">
              {/* Role */}
              <div className="space-y-1.5">
                <Label className="text-[10px] tracking-widest text-muted-foreground font-semibold">ROLE</Label>
                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-auto">
                  {roleOptions.length === 0 && <span className="text-xs text-muted-foreground">No roles to filter.</span>}
                  {roleOptions.map(([name, count]) => {
                    const active = roleFilter.has(name);
                    return (
                      <button
                        key={name}
                        type="button"
                        onClick={() => setRoleFilter(prev => {
                          const next = new Set(prev);
                          next.has(name) ? next.delete(name) : next.add(name);
                          return next;
                        })}
                        className={cn(
                          "text-xs px-2 py-1 rounded-full border transition-colors",
                          active
                            ? "bg-[var(--navy-light)] text-white border-[var(--navy-light)]"
                            : "bg-background border-border hover:border-[var(--navy-light)]"
                        )}
                      >
                        {name} <span className={cn("opacity-60", active && "text-white/80")}>({count})</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              {/* Experience level */}
              <div className="space-y-1.5">
                <Label className="text-[10px] tracking-widest text-muted-foreground font-semibold">EXPERIENCE LEVEL</Label>
                <SelectInline value={expLevel} onChange={v => setExpLevel(v as ExpLevelId)} options={EXPERIENCE_LEVELS.map(l => l.id)} labels={EXPERIENCE_LEVELS.map(l => l.label)} />
              </div>
              {/* Salary range */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-[10px] tracking-widest text-muted-foreground font-semibold">SALARY (LPA)</Label>
                  <span className="text-xs text-muted-foreground tabular-nums">₹{salaryRange[0]} – ₹{salaryRange[1]}</span>
                </div>
                <Slider
                  min={salaryBounds[0]}
                  max={salaryBounds[1]}
                  step={1}
                  value={salaryRange}
                  onValueChange={v => setSalaryRange([v[0] ?? salaryBounds[0], v[1] ?? salaryBounds[1]])}
                  className="py-2"
                />
              </div>
            </div>
            {/* Min ATS score */}
            <div className="grid md:grid-cols-3 gap-4">
              <div className="space-y-1.5 md:col-span-3">
                <div className="flex items-center justify-between">
                  <Label className="text-[10px] tracking-widest text-muted-foreground font-semibold">MINIMUM ATS SCORE</Label>
                  <span className="text-xs text-muted-foreground tabular-nums">{minScore}+ / 100</span>
                </div>
                <Slider
                  min={0}
                  max={100}
                  step={5}
                  value={[minScore]}
                  onValueChange={v => setMinScore(v[0] ?? 0)}
                  className="py-2"
                />
              </div>
            </div>
          </div>
        )}

        {/* Jobs grid */}
        {loading && (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-border bg-card h-44 animate-pulse" />
            ))}
          </div>
        )}

        {!loading && jobs.length === 0 && (
          <EmptyState jobTitle={jobTitle} location={location} onSuggest={(t, l) => { setJobTitle(t); if (l) setLocation(l); setTimeout(searchJobs, 0); }} />
        )}

        {!loading && jobs.length > 0 && filteredJobs.length === 0 && (
          <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center space-y-2">
            <Briefcase className="h-8 w-8 mx-auto text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No jobs match the current filters.</p>
            <button onClick={resetClientFilters} className="text-sm text-[var(--navy-light)] hover:underline">Reset filters</button>
          </div>
        )}

        {!loading && filteredJobs.length > 0 && (
          <>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredJobs.map(({ job, score }) => (
                <JobCard
                  key={job.id}
                  job={job}
                  resume={activeResume}
                  liveScore={score}
                  onScore={() => { refreshResumes(); setScoreResume(getLatestResume(activeResumeId, activeResume)); setScoreJob(job); }}
                  onNova={() => askNova(job)}
                  onApply={() => openApply(job)}
                  isSaved={savedJobIds.has(job.id)}
                  onToggleSave={() => toggleSaveJob(job)}
                />
              ))}
            </div>
            {loadingMore && (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3 mt-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="rounded-xl border border-border bg-card h-44 animate-pulse" />
                ))}
              </div>
            )}
            {hasMore && <div ref={sentinelRef} className="h-10" aria-hidden />}
            {!hasMore && jobs.length > 0 && (
              <div className="text-center text-xs text-muted-foreground py-6">You've reached the end · {totalResults} live jobs</div>
            )}
          </>
        )}
      </div>

      {/* Score Dialog */}
      <Dialog open={!!scoreJob} onOpenChange={o => { if (!o) { setScoreJob(null); setScoreResume(null); } }}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>ATS Score · {scoreJob?.title}</DialogTitle></DialogHeader>
          {scoreJob && <ScoreView jd={getJobScoringText(scoreJob)} resume={scoreResume ?? activeResume} />}
          {scoreJob && (
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  try {
                    downloadAtsReportPdf(
                      {
                        title: scoreJob.title,
                        company: scoreJob.company,
                        location: scoreJob.location,
                        experience: scoreJob.experience,
                        salary: scoreJob.salary,
                        jd: getJobScoringText(scoreJob),
                      },
                      scoreResume ?? activeResume,
                    );
                    toast.success("ATS report downloaded");
                  } catch {
                    toast.error("Could not generate PDF.");
                  }
                }}
              >
                <Download className="h-4 w-4" /> Download PDF report
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      {/* Nova Dialog */}
      <Dialog open={!!novaJob} onOpenChange={o => !o && setNovaJob(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-[var(--navy-light)]" /> Nova on {novaJob?.title}</DialogTitle></DialogHeader>
          {novaQuestion && (
            <div className="text-xs rounded-md bg-secondary/60 border border-border px-2 py-1.5 text-muted-foreground">
              <span className="font-medium text-foreground">Q:</span> {novaQuestion}
            </div>
          )}
          {novaLoading && <div className="py-6 text-center text-sm text-muted-foreground"><Loader2 className="animate-spin inline mr-2" /> Nova is thinking…</div>}
          {!novaLoading && novaResp && (
            <div className="space-y-4 max-h-[55vh] overflow-auto">
              <div>
                <div className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Tips</div>
                <ul className="space-y-1.5 text-sm list-disc pl-5">{novaResp.tips.map((t, i) => <li key={i}>{t}</li>)}</ul>
              </div>
              <div>
                <div className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Keywords to add</div>
                <div className="flex flex-wrap gap-1.5">
                  {novaResp.keywords.map(k => (
                    <span key={k} className="text-xs px-2 py-1 rounded-md bg-[var(--navy-light)]/10 text-[var(--navy-light)] border border-[var(--navy-light)]/20">{k}</span>
                  ))}
                </div>
              </div>
              {novaJob && (
                <div>
                  <div className="text-xs uppercase tracking-widest text-muted-foreground mb-1.5 inline-flex items-center gap-1.5">
                    <MessageSquare className="h-3.5 w-3.5" /> Related questions
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      `What experience should I highlight for ${novaJob.title}?`,
                      `Which skills are missing from my resume for this role?`,
                      `How should I rewrite my summary for ${novaJob.company}?`,
                      `What interview questions should I expect?`,
                    ].map(q => (
                      <button
                        key={q}
                        onClick={() => askNova(novaJob, q)}
                        className="text-xs px-2.5 py-1 rounded-full border border-border bg-background hover:border-[var(--navy-light)] hover:text-[var(--navy-light)] transition-colors"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="ghost" onClick={() => setNovaJob(null)}>Close</Button>
            <Button onClick={tailorFromNova} disabled={applyLoading || !novaJob}>
              {applyLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
              Tailor & Save Resume
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Apply Dialog */}
      <Dialog open={!!applyJob} onOpenChange={o => { if (!o && !applyLoading) setApplyJob(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wand2 className="h-4 w-4 text-[var(--navy-light)]" />
              {applyStep === "tailor" ? `Tailor resume for ${applyJob?.company}` : `Ready to apply at ${applyJob?.company}?`}
            </DialogTitle>
          </DialogHeader>
          {applyStep === "tailor" ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              We'll rewrite your active resume's headline, summary, skills and bullets to align with this JD, then save it as a new copy you can edit anytime.
            </p>
            <div className="space-y-1.5">
              <Label className="text-[10px] tracking-widest text-muted-foreground font-semibold">SAVE AS</Label>
              <Input value={applyName} onChange={e => setApplyName(e.target.value)} placeholder={`${applyJob?.company} - ${applyJob?.title}`} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] tracking-widest text-muted-foreground font-semibold">SOURCE RESUME</Label>
              <Select value={applyResumeId} onValueChange={setApplyResumeId}>
                <SelectTrigger><SelectValue placeholder="Choose resume" /></SelectTrigger>
                <SelectContent>
                  {resumes.map(r => {
                    const isPrimary = r.id === resumeStore.getPrimaryId();
                    return (
                      <SelectItem key={r.id} value={r.id}>
                        {r.name}{isPrimary ? " · Primary" : ""}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          </div>
          ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Your tailored resume <b className="text-foreground">"{applySavedResume?.name}"</b> is saved. Open Naukri now to submit your application?
            </p>
            <div className="rounded-lg border border-border bg-secondary/40 p-3 text-xs space-y-1">
              <div><span className="text-muted-foreground">Role:</span> <b>{applyJob?.title}</b></div>
              <div><span className="text-muted-foreground">Company:</span> {applyJob?.company}</div>
              <div><span className="text-muted-foreground">Location:</span> {applyJob?.location}</div>
            </div>
          </div>
          )}
          <DialogFooter className="gap-2 sm:gap-2">
          {applyStep === "tailor" ? (<>
            <Button
              variant="ghost"
              disabled={applyLoading}
              onClick={() => {
                if (applyJob) window.open(naukriUrl(applyJob.title), "_blank", "noreferrer");
                setApplyJob(null);
              }}
            >
              Skip & Apply
            </Button>
            <Button onClick={confirmTailorAndApply} disabled={applyLoading || !applyName.trim()}>
              {applyLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
              Tailor & Save Resume
            </Button>
          </>) : (<>
            <Button variant="ghost" onClick={() => setApplyJob(null)}>Not now</Button>
            <Button variant="outline" onClick={() => { navigate({ to: "/builder" }); setApplyJob(null); }}>
              Edit in builder
            </Button>
            <Button onClick={openNaukriAndClose} className="bg-[var(--navy-light)] text-white hover:opacity-95">
              <ExternalLink className="h-3.5 w-3.5" /> Yes, apply on Naukri
            </Button>
          </>)}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function getLatestResume(activeResumeId: string, fallback: ResumeData): ResumeData {
  if (activeResumeId === DRAFT_RESUME_ID) return resumeStore.getDraft() ?? fallback;
  const selected = activeResumeId ? resumeStore.get(activeResumeId)?.data : null;
  return selected ?? resumeStore.getDraft() ?? fallback;
}

const SAVED_JOBS_IDS_KEY = "rf:savedJobIds";
const SAVED_JOBS_KEY = "rf:savedJobs";

function loadSavedJobIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(SAVED_JOBS_IDS_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? new Set(arr.filter((x): x is string => typeof x === "string")) : new Set();
  } catch { return new Set(); }
}

function persistSavedJobIds(ids: Set<string>) {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(SAVED_JOBS_IDS_KEY, JSON.stringify(Array.from(ids))); } catch { /* ignore */ }
}

function persistSavedJob(job: Job, isSaved: boolean) {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(SAVED_JOBS_KEY);
    const list: Job[] = raw ? JSON.parse(raw) : [];
    const next = list.filter(j => j.id !== job.id);
    if (isSaved) next.unshift(job);
    window.localStorage.setItem(SAVED_JOBS_KEY, JSON.stringify(next.slice(0, 200)));
  } catch { /* ignore */ }
}

function text(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function getJobScoringText(job: Job): string {
  return [job.jd, job.title, job.company, job.experience, job.tags?.join(" ")].filter(Boolean).join(". ");
}

function normalizeJobs(items: Job[]): Job[] {
  return items.map((job, index) => {
    const title = text(job.title, "Recommended Role");
    const tags = Array.isArray(job.tags) ? job.tags.filter(Boolean).map(String) : [];
    const normalized: Job = {
      id: text(job.id, `job_${index + 1}`),
      title,
      company: text(job.company, "Hiring company"),
      location: text(job.location, "India"),
      experience: text(job.experience, "Experience not specified"),
      salary: text(job.salary, "Not disclosed"),
      postedAgo: text(job.postedAgo, "Recently posted"),
      postedAt: typeof job.postedAt === "number" ? job.postedAt : undefined,
      tags,
      jd: text(job.jd),
      source: text(job.source, ""),
      applyUrl: text(job.applyUrl, ""),
      remote: !!job.remote,
    };
    return { ...normalized, jd: normalized.jd || getJobScoringText(normalized) };
  });
}

function FieldCell({ label, icon, children, className }: { label: string; icon: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("bg-card px-4 py-2", className)}>
      <Label className="text-[10px] tracking-widest text-muted-foreground font-semibold">{label}</Label>
      <div className="flex items-center gap-2">{icon}{children}</div>
    </div>
  );
}

function SelectInline({ value, onChange, options, labels }: { value: string; onChange: (v: string) => void; options: string[]; labels?: string[] }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)}
      className="w-full h-9 bg-transparent border-0 text-base focus:outline-none cursor-pointer">
      {options.map((o, i) => <option key={o} value={o}>{labels?.[i] ?? o}</option>)}
    </select>
  );
}

function JobCard({ job, resume, onScore, onNova, onApply, liveScore, isSaved, onToggleSave }: { job: Job; resume: ResumeData; onScore: () => void; onNova: () => void; onApply: () => void; liveScore?: number; isSaved: boolean; onToggleSave: () => void }) {
  const scoringText = getJobScoringText(job);
  const computedScore = useMemo(() => computeScore({ ...resume, jobDescription: scoringText }).score, [resume, scoringText]);
  const score = liveScore ?? computedScore;
  const [expanded, setExpanded] = useState(false);
  const tone = score >= 80 ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/30"
    : score >= 60 ? "bg-[var(--navy-light)]/10 text-[var(--navy-light)] border-[var(--navy-light)]/20"
    : score >= 40 ? "bg-amber-500/10 text-amber-700 border-amber-500/30"
    : "bg-destructive/10 text-destructive border-destructive/30";
  return (
    <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-3 hover:border-[var(--navy-light)] hover:shadow-[var(--shadow-soft)] transition-all">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-3 min-w-0">
          <div className="h-10 w-10 rounded-md bg-[var(--navy-light)]/10 text-[var(--navy-light)] font-bold flex items-center justify-center shrink-0">
            {(job.company || "?").charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="font-semibold truncate">{job.title}</div>
            <div className="text-sm text-muted-foreground truncate">{job.company}</div>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={onScore} className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold", tone)} title="Open live ATS match against selected resume">
            <Gauge className="h-3 w-3" /> {score}
          </button>
          <button
            type="button"
            onClick={onToggleSave}
            aria-pressed={isSaved}
            title={isSaved ? "Saved — click to remove" : "Save job"}
            className={cn(
              "hover:text-foreground transition-colors",
              isSaved ? "text-[var(--navy-light)]" : "text-muted-foreground",
            )}
          >
            <Bookmark className={cn("h-4 w-4", isSaved && "fill-current")} />
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 text-xs">
        {job.experience && <Chip>{job.experience}</Chip>}
        {job.location && <Chip><MapPin className="h-3 w-3" /> {job.location}</Chip>}
        {job.salary && <Chip className="text-[var(--navy-light)] bg-[var(--navy-light)]/10 border-[var(--navy-light)]/20">{job.salary}</Chip>}
      </div>

      {/* Expandable JD preview — same text the ATS score uses */}
      <div className="rounded-lg border border-border bg-secondary/40">
        <button
          type="button"
          onClick={() => setExpanded(e => !e)}
          aria-expanded={expanded}
          className="w-full flex items-center justify-between gap-2 px-3 py-2 text-xs font-medium hover:bg-secondary/70 transition-colors rounded-lg"
        >
          <span className="inline-flex items-center gap-1.5 text-foreground">
            <FileText className="h-3.5 w-3.5 text-[var(--navy-light)]" />
            {expanded ? "Hide" : "Show"} job description used for scoring
          </span>
          <ChevronRight className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform", expanded && "rotate-90")} />
        </button>
        {expanded && (
          <div className="px-3 pb-3 pt-1 text-xs leading-relaxed text-muted-foreground max-h-56 overflow-auto whitespace-pre-wrap border-t border-border">
            {scoringText || "No job description text was provided for this listing."}
            {job.tags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {job.tags.map(t => (
                  <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-background border border-border">{t}</span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className={cn(
            "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
            sourceTone(job.source),
          )}>
            <Globe className="h-2.5 w-2.5" /> {job.source || "Live"}
          </span>
          {job.remote && <span className="text-[10px]">· Remote</span>}
        </span>
        <button type="button" onClick={onScore} className="inline-flex items-center gap-1 rounded-full bg-[var(--navy-light)]/10 text-[var(--navy-light)] px-2.5 py-1 hover:bg-[var(--navy-light)]/20">
          <Gauge className="h-3 w-3" /> Check Score
        </button>
      </div>

      <div className="flex items-center justify-between gap-2 pt-2 border-t border-border">
        <span className="text-xs text-muted-foreground">{job.postedAgo}</span>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={onNova}>
            <Sparkles className="h-3.5 w-3.5" /> Ask Nova
          </Button>
          <Button size="sm" onClick={onApply} className="bg-[var(--navy-light)] text-white hover:opacity-95">
            Apply Now <ExternalLink className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function Chip({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-0.5", className)}>
      {children}
    </span>
  );
}

function ScoreView({ jd, resume }: { jd: string; resume: ResumeData }) {
  const score = useMemo(() => computeScore({ ...resume, jobDescription: jd }), [jd, resume]);
  const isEmpty = !resume.name?.trim() && !resume.skills?.trim() && !resume.summary?.trim();
  const sectionMap = useMemo(() => buildSectionMap(resume), [resume]);
  const matchedBySection = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const kw of score.matched) {
      const sections = sectionMap.get(canonical(kw)) ?? ["Other"];
      for (const s of sections) {
        if (!map.has(s)) map.set(s, []);
        map.get(s)!.push(kw);
      }
    }
    return Array.from(map.entries()).sort((a, b) => b[1].length - a[1].length);
  }, [score.matched, sectionMap]);
  const passedChecks = score.checks.filter(c => c.pass);
  const failedChecks = score.checks.filter(c => !c.pass);
  if (isEmpty) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          No saved resume found. Build and save a resume in the builder to get a real ATS match score against this job.
        </p>
        <Link
          to="/builder"
          className="inline-flex items-center gap-1 rounded-md bg-[var(--navy-light)] text-white h-9 px-3 text-sm font-medium hover:opacity-95"
        >
          Open builder
        </Link>
        <div className="pt-2">
          <div className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Top keywords in this job</div>
          <div className="flex flex-wrap gap-1.5">
            {score.missing.slice(0, 24).map(k => (
              <span key={k} className="text-xs px-2 py-1 rounded-md bg-secondary border border-border">{k}</span>
            ))}
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <div className="flex items-baseline gap-2">
        <span className="font-display text-5xl font-bold">{score.score}</span>
        <span className="text-muted-foreground">/100 match</span>
      </div>
      <div className="h-2 rounded-full bg-secondary overflow-hidden">
        <div className="h-full" style={{ width: `${score.score}%`, background: "var(--gradient-accent)" }} />
      </div>

      {/* Score breakdown — which checks contributed */}
      <div className="rounded-lg border border-border bg-card/60 p-3">
        <div className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Score breakdown</div>
        <ul className="space-y-1.5 text-sm">
          {score.checks.map(c => (
            <li key={c.label} className="flex items-center justify-between gap-2">
              <span className={c.pass ? "text-foreground" : "text-muted-foreground"}>
                <span className={`inline-block h-1.5 w-1.5 rounded-full mr-2 ${c.pass ? "bg-emerald-500" : "bg-rose-400"}`} />
                {c.label}
              </span>
              <span className={`tabular-nums text-xs font-semibold ${c.pass ? "text-emerald-600" : "text-muted-foreground"}`}>
                {c.pass ? `+${c.weight}` : `0 / ${c.weight}`}
              </span>
            </li>
          ))}
        </ul>
        <div className="mt-2 pt-2 border-t border-border flex justify-between text-xs text-muted-foreground">
          <span>{passedChecks.length} passed · {failedChecks.length} to improve</span>
          <span className="font-semibold text-foreground">Total {score.score}/100</span>
        </div>
      </div>

      {/* Resume sections that contributed matched keywords */}
      {matchedBySection.length > 0 && (
        <div className="rounded-lg border border-border bg-card/60 p-3">
          <div className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Contributing resume sections</div>
          <div className="space-y-2">
            {matchedBySection.map(([section, kws]) => (
              <div key={section}>
                <div className="text-xs font-semibold mb-1 flex items-center justify-between">
                  <span>{section}</span>
                  <span className="text-muted-foreground">{kws.length} keyword{kws.length === 1 ? "" : "s"}</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {kws.slice(0, 20).map(k => (
                    <span key={k} className="text-xs px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-700 border border-emerald-500/20">{k}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {score.matched.length > 0 && (
        <div>
          <div className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Matched ({score.matched.length})</div>
          <div className="flex flex-wrap gap-1.5">
            {score.matched.slice(0, 30).map(k => (
              <span key={k} className="text-xs px-2 py-1 rounded-md bg-[var(--navy-light)]/10 text-[var(--navy-light)] border border-[var(--navy-light)]/20">{k}</span>
            ))}
          </div>
        </div>
      )}
      {score.missing.length > 0 && (
        <div>
          <div className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Missing ({score.missing.length})</div>
          <div className="flex flex-wrap gap-1.5">
            {score.missing.slice(0, 30).map(k => (
              <span key={k} className="text-xs px-2 py-1 rounded-md bg-destructive/10 text-destructive border border-destructive/20">{k}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function buildSectionMap(resume: ResumeData): Map<string, string[]> {
  const sections: Record<string, string> = {
    "Headline": [resume.headline].filter(Boolean).join(" "),
    "Summary": resume.summary ?? "",
    "Skills": resume.skills ?? "",
    "Experience": (resume.experience ?? []).flatMap(e => [e.title, e.company, e.bullets]).filter(Boolean).join(" "),
    "Projects": (resume.projects ?? []).flatMap(p => [p.name, p.bullets]).filter(Boolean).join(" "),
    "Education": (resume.education ?? []).flatMap(e => [e.degree, e.school]).filter(Boolean).join(" "),
    "Certifications": (resume.certifications ?? []).flatMap(c => [c.name, c.issuer]).filter(Boolean).join(" "),
  };
  const map = new Map<string, string[]>();
  for (const [name, text] of Object.entries(sections)) {
    const lower = (text || "").toLowerCase();
    if (!lower) continue;
    const found = new Set(lower.match(/[a-z][a-z0-9+.#-]{1,}/g) || []);
    for (const tok of found) {
      const c = canonical(tok);
      if (!map.has(c)) map.set(c, []);
      const arr = map.get(c)!;
      if (!arr.includes(name)) arr.push(name);
    }
  }
  return map;
}

function formatStamp(ms: number): string {
  const s = Math.max(1, Math.floor((Date.now() - ms) / 1000));
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  try { return new Date(ms).toLocaleString(); } catch { return ""; }
}

function sourceTone(src?: string): string {
  switch ((src || "").toLowerCase()) {
    case "remotive": return "bg-emerald-500/10 text-emerald-700 border-emerald-500/30";
    case "arbeitnow": return "bg-blue-500/10 text-blue-700 border-blue-500/30";
    case "linkedin": return "bg-sky-500/10 text-sky-700 border-sky-500/30";
    case "indeed": return "bg-indigo-500/10 text-indigo-700 border-indigo-500/30";
    case "naukri": return "bg-orange-500/10 text-orange-700 border-orange-500/30";
    case "foundit": return "bg-purple-500/10 text-purple-700 border-purple-500/30";
    default: return "bg-secondary text-foreground border-border";
  }
}

function EmptyState({ jobTitle, location, onSuggest }: { jobTitle: string; location: string; onSuggest: (title: string, loc?: string) => void }) {
  const suggestions = [
    { title: jobTitle || "Data Analyst", loc: "Remote" },
    { title: "Software Engineer", loc: "Bangalore" },
    { title: "Product Manager", loc: "India" },
    { title: "Frontend Developer", loc: "Remote" },
    { title: "DevOps Engineer", loc: "Hyderabad" },
  ];
  const hasSearched = !!jobTitle.trim();
  return (
    <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center space-y-4">
      <Briefcase className="h-10 w-10 mx-auto text-muted-foreground" />
      <div>
        <p className="font-semibold">
          {hasSearched ? `No live jobs found for "${jobTitle}"${location ? ` in ${location}` : ""}` : "Search for live jobs"}
        </p>
        <p className="text-sm text-muted-foreground mt-1">
          {hasSearched
            ? "Try a broader title, drop the location, or pick a suggestion below."
            : "Enter a role above, or try one of these popular searches:"}
        </p>
      </div>
      <div className="flex flex-wrap gap-2 justify-center">
        {suggestions.map(s => (
          <button
            key={s.title + s.loc}
            onClick={() => onSuggest(s.title, s.loc)}
            className="text-xs px-3 py-1.5 rounded-full border border-border bg-background hover:border-[var(--navy-light)] hover:text-[var(--navy-light)] transition-colors"
          >
            {s.title} <span className="opacity-60">· {s.loc}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
