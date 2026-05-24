import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Search, Filter, MapPin, Briefcase, Calendar, Building2, Tag, Bookmark, Sparkles, Loader2, ArrowLeft, ExternalLink, Gauge, ChevronDown, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { resumeStore, type SavedResume } from "@/components/builder/resumeStore";
import { defaultResume, type ResumeData } from "@/components/builder/types";
import { computeScore, canonical } from "@/components/builder/atsScore";
import { downloadAtsReportPdf } from "@/components/builder/atsReportPdf";
import { cn } from "@/lib/utils";
import { Slider } from "@/components/ui/slider";

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
  tags: string[];
  jd: string;
};

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
  const [activeRoleTab, setActiveRoleTab] = useState("Data Analyst");
  const [scoreJob, setScoreJob] = useState<Job | null>(null);
  const [scoreResume, setScoreResume] = useState<ResumeData | null>(null);
  const [novaJob, setNovaJob] = useState<Job | null>(null);
  const [novaLoading, setNovaLoading] = useState(false);
  const [novaResp, setNovaResp] = useState<{ tips: string[]; keywords: string[] } | null>(null);

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
  }, []);

  const activeResume: ResumeData = useMemo(() => {
    if (activeResumeId === DRAFT_RESUME_ID) return draftResume ?? defaultResume;
    const r = resumes.find(x => x.id === activeResumeId);
    return r?.data ?? draftResume ?? defaultResume;
  }, [resumes, activeResumeId, draftResume]);

  const activeResumeName = activeResumeId === DRAFT_RESUME_ID ? "Current draft" : resumes.find(r => r.id === activeResumeId)?.name ?? (draftResume ? "Current draft" : "Default sample");

  const filterCount = [industry !== INDUSTRIES[0], role !== ROLES[0], datePosted !== "All time", alias, keywords].filter(Boolean).length;

  const searchJobs = async () => {
    if (!jobTitle.trim()) { toast.error("Enter a job title."); return; }
    setLoading(true);
    setActiveRoleTab(jobTitle);
    try {
      const res = await fetch("/api/recommend-jobs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          jobTitle, experience, location,
          industry: industry === INDUSTRIES[0] ? "" : industry,
          roleCategory: role === ROLES[0] ? "" : role,
          datePosted, keywords,
          resume: { headline: activeResume.headline, skills: activeResume.skills, summary: activeResume.summary },
        }),
      });
      if (res.status === 429) { toast.error("Rate limit hit. Retry shortly."); return; }
      if (res.status === 402) { toast.error("AI credits exhausted."); return; }
      if (!res.ok) { toast.error("Search failed."); return; }
      const out = (await res.json()) as { jobs?: Job[] };
      const nextJobs = normalizeJobs(out.jobs ?? []);
      setJobs(nextJobs);
      // Reset client filters on a fresh search so users see all results first.
      setRoleFilter(new Set());
      setExpLevel("any");
      setMinScore(0);
      setSalaryRange([0, 100]);
      toast.success(`${nextJobs.length} jobs matched`);
    } catch { toast.error("Network error."); }
    finally { setLoading(false); }
  };

  const askNova = async (job: Job) => {
    setNovaJob(job);
    setNovaResp(null);
    setNovaLoading(true);
    try {
      const res = await fetch("/api/job-tip", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          jd: job.jd, jobTitle: job.title,
          resume: { headline: activeResume.headline, summary: activeResume.summary, skills: activeResume.skills },
        }),
      });
      if (!res.ok) { toast.error("Nova couldn't respond."); return; }
      setNovaResp(await res.json());
    } catch { toast.error("Network error."); }
    finally { setNovaLoading(false); }
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
              Recommended Jobs{" "}
              <span className="text-sm font-normal text-muted-foreground">
                ({filteredJobs.length}{filteredJobs.length !== jobs.length ? ` of ${jobs.length}` : ""} jobs{location ? ` in ${location}` : ""})
              </span>
            </h2>
            <p className="text-xs text-muted-foreground">AI-generated previews for demo — verified listings via "Apply Now" on Naukri.</p>
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
          <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center">
            <Briefcase className="h-8 w-8 mx-auto text-muted-foreground" />
            <p className="mt-2 text-sm text-muted-foreground">Click <b>Search Jobs</b> to fetch AI-curated recommendations.</p>
          </div>
        )}

        {!loading && jobs.length > 0 && filteredJobs.length === 0 && (
          <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center space-y-2">
            <Briefcase className="h-8 w-8 mx-auto text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No jobs match the current filters.</p>
            <button onClick={resetClientFilters} className="text-sm text-[var(--navy-light)] hover:underline">Reset filters</button>
          </div>
        )}

        {!loading && filteredJobs.length > 0 && (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredJobs.map(({ job, score }) => (
              <JobCard
                key={job.id}
                job={job}
                resume={activeResume}
                liveScore={score}
                onScore={() => { refreshResumes(); setScoreResume(getLatestResume(activeResumeId, activeResume)); setScoreJob(job); }}
                onNova={() => askNova(job)}
                naukriUrl={naukriUrl}
              />
            ))}
          </div>
        )}
      </div>

      {/* Score Dialog */}
      <Dialog open={!!scoreJob} onOpenChange={o => { if (!o) { setScoreJob(null); setScoreResume(null); } }}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>ATS Score · {scoreJob?.title}</DialogTitle></DialogHeader>
          {scoreJob && <ScoreView jd={getJobScoringText(scoreJob)} resume={scoreResume ?? activeResume} />}
        </DialogContent>
      </Dialog>

      {/* Nova Dialog */}
      <Dialog open={!!novaJob} onOpenChange={o => !o && setNovaJob(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-[var(--navy-light)]" /> Nova on {novaJob?.title}</DialogTitle></DialogHeader>
          {novaLoading && <div className="py-6 text-center text-sm text-muted-foreground"><Loader2 className="animate-spin inline mr-2" /> Nova is thinking…</div>}
          {novaResp && (
            <div className="space-y-4">
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
            </div>
          )}
          <DialogFooter><Button variant="ghost" onClick={() => setNovaJob(null)}>Close</Button></DialogFooter>
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
    const normalized = {
      id: text(job.id, `job_${index + 1}`),
      title,
      company: text(job.company, "Hiring company"),
      location: text(job.location, "India"),
      experience: text(job.experience, "Experience not specified"),
      salary: text(job.salary, "Not disclosed"),
      postedAgo: text(job.postedAgo, "Recently posted"),
      tags,
      jd: text(job.jd),
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

function JobCard({ job, resume, onScore, onNova, naukriUrl, liveScore }: { job: Job; resume: ResumeData; onScore: () => void; onNova: () => void; naukriUrl: (t: string) => string; liveScore?: number }) {
  const scoringText = getJobScoringText(job);
  const computedScore = useMemo(() => computeScore({ ...resume, jobDescription: scoringText }).score, [resume, scoringText]);
  const score = liveScore ?? computedScore;
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
          <button className="text-muted-foreground hover:text-foreground" title="Save">
            <Bookmark className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 text-xs">
        {job.experience && <Chip>{job.experience}</Chip>}
        {job.location && <Chip><MapPin className="h-3 w-3" /> {job.location}</Chip>}
        {job.salary && <Chip className="text-[var(--navy-light)] bg-[var(--navy-light)]/10 border-[var(--navy-light)]/20">{job.salary}</Chip>}
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Source: Naukri</span>
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
          <a href={naukriUrl(job.title)} target="_blank" rel="noreferrer"
            className="inline-flex items-center gap-1 rounded-md bg-[var(--navy-light)] text-white h-8 px-3 text-sm font-medium hover:opacity-95">
            Apply Now <ExternalLink className="h-3 w-3" />
          </a>
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