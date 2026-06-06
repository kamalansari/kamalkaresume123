import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useInfiniteQuery, useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Search, MapPin, Briefcase, Building2, Bookmark, BookmarkCheck,
  Sparkles, Loader2, ArrowLeft, ExternalLink, RefreshCw, Filter, X, IndianRupee,
  Info, Check, CircleDot,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  listJobs, saveJob, unsaveJob, listSavedJobs, triggerJobSync,
  type JobRow,
} from "@/lib/jobs.functions";
import {
  buildResumeProfile, scoreJobBreakdown, describeLevel,
  type MatchBreakdown,
} from "@/lib/jobMatch";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/jobs")({
  head: () => ({
    meta: [
      { title: "Find Jobs — ResumeForge" },
      { name: "description", content: "Live India + remote tech jobs sourced from Adzuna, ranked against your resume." },
    ],
  }),
  component: JobsPage,
});

type WorkMode = "any" | "remote" | "hybrid" | "onsite";
type ExpId = "any" | "fresher" | "1-3" | "3-5" | "5-8" | "8+";

const EXPERIENCE_OPTIONS: { id: ExpId; label: string }[] = [
  { id: "any", label: "Any experience" },
  { id: "fresher", label: "Fresher" },
  { id: "1-3", label: "1–3 years" },
  { id: "3-5", label: "3–5 years" },
  { id: "5-8", label: "5–8 years" },
  { id: "8+", label: "8+ years" },
];

const WORK_MODES: { id: WorkMode; label: string }[] = [
  { id: "any", label: "Any" },
  { id: "remote", label: "Remote" },
  { id: "hybrid", label: "Hybrid" },
  { id: "onsite", label: "Onsite" },
];

function timeAgo(iso: string | null): string {
  if (!iso) return "Recently";
  const ms = Date.now() - new Date(iso).getTime();
  const h = Math.floor(ms / 3600000);
  if (h < 1) return "Just now";
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return `${Math.floor(d / 30)}mo ago`;
}

function formatSalary(min: number | null, max: number | null): string {
  if (!min && !max) return "Salary not disclosed";
  const toLpa = (n: number) => `${(n / 100000).toFixed(1).replace(/\.0$/, "")} LPA`;
  if (min && max) return `₹${toLpa(min)} – ${toLpa(max)}`;
  return `₹${toLpa((max ?? min)!)}`;
}

function JobsPage() {
  const [authed, setAuthed] = useState<boolean>(false);
  const [search, setSearch] = useState("");
  const [location, setLocation] = useState("");
  const [workMode, setWorkMode] = useState<WorkMode>("any");
  const [experience, setExperience] = useState<ExpId>("any");
  const [minSalary, setMinSalary] = useState<number>(0);
  const [source, setSource] = useState<"all" | "Adzuna" | "Naukri">("all");
  const [showFilters, setShowFilters] = useState(false);
  const [tab, setTab] = useState<"all" | "saved">("all");
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const queryClient = useQueryClient();
  const listFn = useServerFn(listJobs);
  const savedFn = useServerFn(listSavedJobs);
  const saveFn = useServerFn(saveJob);
  const unsaveFn = useServerFn(unsaveJob);
  const syncFn = useServerFn(triggerJobSync);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setAuthed(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setAuthed(!!s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const [profileTick, setProfileTick] = useState(0);
  const profile = useMemo(() => buildResumeProfile(), [profileTick, authed]);
  const hasResumeData = profile.skills.length > 0 || profile.titles.length > 0;

  useEffect(() => {
    // Hydrate on mount (SSR has no localStorage) and react to cross-tab updates.
    setProfileTick((t) => t + 1);
    const onStorage = (e: StorageEvent) => {
      if (!e.key || e.key.startsWith("resume")) setProfileTick((t) => t + 1);
    };
    window.addEventListener("storage", onStorage);
    const onFocus = () => setProfileTick((t) => t + 1);
    window.addEventListener("focus", onFocus);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  const filters = { search, location, workMode, experience, minSalaryLpa: minSalary, source };

  const jobsQuery = useInfiniteQuery({
    queryKey: ["jobs", filters],
    queryFn: ({ pageParam = 0 }) =>
      listFn({ data: { ...filters, cursor: pageParam, pageSize: 20 } }),
    initialPageParam: 0,
    getNextPageParam: (last) => last.nextCursor,
    staleTime: 60_000,
  });

  const savedQuery = useQuery({
    queryKey: ["savedJobs"],
    queryFn: () => savedFn(),
    enabled: authed,
    staleTime: 30_000,
  });

  const savedIds = useMemo(
    () => new Set((savedQuery.data?.saved ?? []).map((s) => s.job_id)),
    [savedQuery.data],
  );

  const saveMut = useMutation({
    mutationFn: async ({ jobId, save }: { jobId: string; save: boolean }) =>
      save ? saveFn({ data: { jobId } }) : unsaveFn({ data: { jobId } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["savedJobs"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const syncMut = useMutation({
    mutationFn: () => syncFn(),
    onSuccess: (r) => {
      toast.success(`Refreshed: ${r.upserted} jobs cached`);
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
    },
    onError: (e: Error) => toast.error(`Refresh failed: ${e.message}`),
  });

  // Infinite scroll
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && jobsQuery.hasNextPage && !jobsQuery.isFetchingNextPage) {
        jobsQuery.fetchNextPage();
      }
    }, { rootMargin: "300px" });
    obs.observe(el);
    return () => obs.disconnect();
  }, [jobsQuery.hasNextPage, jobsQuery.isFetchingNextPage, jobsQuery.fetchNextPage]);

  const allJobs: JobRow[] = useMemo(
    () => jobsQuery.data?.pages.flatMap((p) => p.jobs) ?? [],
    [jobsQuery.data],
  );
  const total = jobsQuery.data?.pages[0]?.total ?? 0;

  const rankedJobs = useMemo(() => {
    const scored = allJobs.map((j) => {
      const breakdown = scoreJobBreakdown(j, profile);
      return { job: j, score: breakdown.score, breakdown };
    });
    scored.sort((a, b) => b.score - a.score);
    return scored;
  }, [allJobs, profile]);

  const savedList = savedQuery.data?.saved ?? [];
  const visibleList = tab === "saved"
    ? savedList.map((s) => {
        const job = s.jobs as unknown as JobRow;
        const breakdown = scoreJobBreakdown(job, profile);
        return { job, score: breakdown.score, breakdown };
      })
    : rankedJobs;

  const clearFilters = () => {
    setSearch(""); setLocation(""); setWorkMode("any"); setExperience("any"); setMinSalary(0); setSource("all");
  };

  const activeFilters = [
    workMode !== "any" && WORK_MODES.find((w) => w.id === workMode)?.label,
    experience !== "any" && EXPERIENCE_OPTIONS.find((e) => e.id === experience)?.label,
    minSalary > 0 && `${minSalary}+ LPA`,
    location && `📍 ${location}`,
    source !== "all" && `Source: ${source}`,
  ].filter(Boolean) as string[];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur">
        <div className="container max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link to="/dashboard" className="shrink-0">
            <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-base sm:text-lg font-semibold truncate">Find Jobs</h1>
            <p className="text-xs text-muted-foreground">
              {total > 0 ? `${total.toLocaleString()} live jobs` : "Live jobs from Adzuna"} · cached & refreshed every 6h
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => syncMut.mutate()}
            disabled={syncMut.isPending || !authed}
            className="hidden sm:flex"
          >
            <RefreshCw className={cn("h-4 w-4 mr-2", syncMut.isPending && "animate-spin")} />
            Refresh
          </Button>
        </div>

        {/* Search bar */}
        <div className="container max-w-7xl mx-auto px-4 pb-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search title, company, skill…"
                className="pl-9"
              />
            </div>
            <div className="relative w-40 hidden sm:block">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Location"
                className="pl-9"
              />
            </div>
            <Button variant="outline" onClick={() => setShowFilters((s) => !s)}>
              <Filter className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Filters</span>
              {activeFilters.length > 0 && (
                <Badge variant="secondary" className="ml-2 h-5 px-1.5">{activeFilters.length}</Badge>
              )}
            </Button>
          </div>

          {/* Filters panel */}
          {showFilters && (
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-4 gap-3 p-4 rounded-lg border bg-muted/30">
              <div className="sm:hidden">
                <Label className="text-xs">Location</Label>
                <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Any city" />
              </div>
              <div>
                <Label className="text-xs">Work mode</Label>
                <Select value={workMode} onValueChange={(v) => setWorkMode(v as WorkMode)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {WORK_MODES.map((w) => <SelectItem key={w.id} value={w.id}>{w.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Experience</Label>
                <Select value={experience} onValueChange={(v) => setExperience(v as ExpId)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {EXPERIENCE_OPTIONS.map((e) => <SelectItem key={e.id} value={e.id}>{e.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs flex items-center justify-between">
                  <span>Min salary</span>
                  <span className="text-foreground font-medium">{minSalary > 0 ? `${minSalary} LPA` : "Any"}</span>
                </Label>
                <Slider
                  value={[minSalary]}
                  onValueChange={(v) => setMinSalary(v[0])}
                  min={0} max={50} step={1}
                  className="mt-3"
                />
              </div>
              <div className="sm:col-span-4 flex justify-end">
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  <X className="h-4 w-4 mr-1" /> Clear
                </Button>
              </div>
            </div>
          )}

          {/* Tabs */}
          <div className="mt-3 flex gap-2 overflow-x-auto">
            <button
              onClick={() => setTab("all")}
              className={cn("px-3 py-1.5 rounded-full text-sm whitespace-nowrap border transition",
                tab === "all" ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border hover:bg-muted")}
            >
              <Sparkles className="inline h-3.5 w-3.5 mr-1" /> All jobs
            </button>
            <button
              onClick={() => setTab("saved")}
              className={cn("px-3 py-1.5 rounded-full text-sm whitespace-nowrap border transition",
                tab === "saved" ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border hover:bg-muted")}
              disabled={!authed}
            >
              <BookmarkCheck className="inline h-3.5 w-3.5 mr-1" />
              Saved {savedList.length > 0 && `(${savedList.length})`}
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="container max-w-7xl mx-auto px-4 py-6">
        {jobsQuery.isLoading && tab === "all" ? (
          <SkeletonGrid />
        ) : visibleList.length === 0 ? (
          <EmptyState
            tab={tab}
            onRefresh={() => syncMut.mutate()}
            refreshing={syncMut.isPending}
            authed={authed}
          />
        ) : (
          <>
            {!hasResumeData && (
              <div className="mb-4 rounded-lg border border-primary/30 bg-primary/5 p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                <Sparkles className="h-5 w-5 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">Personalised match scores are off</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Add or set a primary resume to rank these jobs by your skills, seniority and title.
                  </p>
                </div>
                <Link to="/builder" className="shrink-0">
                  <Button size="sm">Open resume builder</Button>
                </Link>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {visibleList.map(({ job, score, breakdown }) => (
                <JobCard
                  key={job.id}
                  job={job}
                  score={score}
                  breakdown={breakdown}
                  saved={savedIds.has(job.id)}
                  authed={authed}
                  onToggleSave={() => {
                    if (!authed) { toast.error("Sign in to save jobs"); return; }
                    saveMut.mutate({ jobId: job.id, save: !savedIds.has(job.id) });
                  }}
                />
              ))}
            </div>

            {tab === "all" && (
              <>
                <div ref={sentinelRef} className="h-10" />
                {jobsQuery.isFetchingNextPage && (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                )}
                {!jobsQuery.hasNextPage && allJobs.length > 0 && (
                  <p className="text-center text-sm text-muted-foreground py-8">
                    That's all {allJobs.length} matches for now.
                  </p>
                )}
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="border rounded-xl p-5 space-y-3 animate-pulse">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-lg bg-muted" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-muted rounded w-3/4" />
              <div className="h-3 bg-muted rounded w-1/2" />
            </div>
          </div>
          <div className="h-3 bg-muted rounded w-full" />
          <div className="h-3 bg-muted rounded w-5/6" />
          <div className="flex gap-2 pt-2">
            <div className="h-6 w-16 bg-muted rounded-full" />
            <div className="h-6 w-20 bg-muted rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState({
  tab, onRefresh, refreshing, authed,
}: { tab: "all" | "saved"; onRefresh: () => void; refreshing: boolean; authed: boolean }) {
  if (tab === "saved") {
    return (
      <div className="text-center py-16 max-w-md mx-auto">
        <Bookmark className="h-12 w-12 mx-auto text-muted-foreground" />
        <h2 className="mt-4 text-lg font-semibold">No saved jobs yet</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Tap the bookmark icon on any job to save it for later.
        </p>
      </div>
    );
  }
  return (
    <div className="text-center py-16 max-w-md mx-auto">
      <Briefcase className="h-12 w-12 mx-auto text-muted-foreground" />
      <h2 className="mt-4 text-lg font-semibold">No jobs match your filters</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Try clearing filters, or refresh the cache to pull the latest Adzuna listings.
      </p>
      {authed && (
        <Button onClick={onRefresh} disabled={refreshing} className="mt-4">
          <RefreshCw className={cn("h-4 w-4 mr-2", refreshing && "animate-spin")} />
          Refresh now
        </Button>
      )}
    </div>
  );
}

function JobCard({
  job, score, breakdown, saved, authed, onToggleSave,
}: {
  job: JobRow; score: number; breakdown: MatchBreakdown; saved: boolean; authed: boolean; onToggleSave: () => void;
}) {
  const initial = (job.company_name ?? job.title).charAt(0).toUpperCase();
  const tone = score >= 75 ? "bg-emerald-500" : score >= 50 ? "bg-amber-500" : "bg-muted-foreground/50";
  return (
    <article className="group border rounded-xl p-5 bg-card hover:shadow-lg hover:border-primary/40 transition-all flex flex-col">
      <div className="flex items-start gap-3">
        <div className="h-11 w-11 rounded-lg bg-gradient-to-br from-primary/15 to-primary/5 flex items-center justify-center text-primary font-semibold shrink-0">
          {job.company_logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={job.company_logo} alt={job.company_name ?? ""} className="h-full w-full object-contain rounded-lg" />
          ) : initial}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm leading-tight line-clamp-2">{job.title}</h3>
          <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Building2 className="h-3 w-3 shrink-0" />
            <span className="truncate">{job.company_name ?? "Confidential"}</span>
          </div>
        </div>
        <button
          onClick={onToggleSave}
          className="shrink-0 p-1.5 rounded-md hover:bg-muted transition"
          aria-label={saved ? "Unsave job" : "Save job"}
          disabled={!authed}
        >
          {saved
            ? <BookmarkCheck className="h-4 w-4 text-primary" />
            : <Bookmark className="h-4 w-4 text-muted-foreground" />}
        </button>
      </div>

      <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground items-center">
        {job.location && (
          <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{job.location}</span>
        )}
        {job.is_remote && <Badge variant="secondary" className="h-5 text-[10px]">Remote</Badge>}
        <span className="inline-flex items-center gap-1"><IndianRupee className="h-3 w-3" />{formatSalary(job.salary_min, job.salary_max).replace("₹", "")}</span>
        <Badge
          variant="outline"
          className={cn(
            "h-5 text-[10px] px-1.5",
            job.source === "Naukri"
              ? "border-amber-500/40 text-amber-700 dark:text-amber-300 bg-amber-500/10"
              : "border-sky-500/40 text-sky-700 dark:text-sky-300 bg-sky-500/10"
          )}
        >
          {job.source}
        </Badge>
      </div>

      {job.skills.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {job.skills.slice(0, 5).map((s) => {
            const hit = breakdown.skills.matched.includes(s.toLowerCase());
            return (
              <span
                key={s}
                className={cn(
                  "text-[10px] px-2 py-0.5 rounded-full border",
                  hit
                    ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                    : "bg-muted text-muted-foreground border-transparent",
                )}
              >
                {s}
              </span>
            );
          })}
        </div>
      )}

      <div className="mt-3">
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="font-medium text-foreground inline-flex items-center gap-1">
            Match {score}%
            <MatchPopover breakdown={breakdown} />
          </span>
          <span className="text-muted-foreground">{timeAgo(job.created_date)}</span>
        </div>
        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className={cn("h-full rounded-full transition-all", tone)}
            style={{ width: `${Math.max(score, 2)}%` }}
          />
        </div>
      </div>


      <div className="mt-auto pt-4 flex items-center gap-2">
        <Button asChild size="sm" className="flex-1">
          <a href={job.redirect_url} target="_blank" rel="noopener noreferrer">
            Apply <ExternalLink className="h-3 w-3 ml-1.5" />
          </a>
        </Button>
      </div>
    </article>
  );
}

function MatchPopover({ breakdown }: { breakdown: MatchBreakdown }) {
  const rows = [
    { key: "Skills", data: breakdown.skills, icon: <Sparkles className="h-3.5 w-3.5" /> },
    { key: "Keywords", data: breakdown.keywords, icon: <CircleDot className="h-3.5 w-3.5" /> },
    { key: "Seniority", data: breakdown.seniority, icon: <Briefcase className="h-3.5 w-3.5" /> },
    { key: "Title", data: breakdown.title, icon: <Check className="h-3.5 w-3.5" /> },
  ] as const;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="text-muted-foreground hover:text-foreground transition"
          aria-label="Why this match score?"
        >
          <Info className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold">Match {breakdown.score}%</p>
            <p className="text-[11px] text-muted-foreground">How your resume stacks up</p>
          </div>
        </div>
        <div className="space-y-2.5">
          {rows.map(({ key, data, icon }) => {
            const pct = Math.round((data.earned / data.weight) * 100);
            return (
              <div key={key}>
                <div className="flex items-center justify-between text-xs">
                  <span className="inline-flex items-center gap-1.5 font-medium">{icon}{key}</span>
                  <span className="text-muted-foreground">{data.earned}/{data.weight}</span>
                </div>
                <Progress value={pct} className="h-1 mt-1" />
              </div>
            );
          })}
        </div>
        <div className="border-t pt-3 space-y-2 text-[11px] leading-relaxed">
          {breakdown.skills.matched.length > 0 && (
            <p>
              <span className="font-medium text-foreground">Matched skills:</span>{" "}
              <span className="text-muted-foreground">{breakdown.skills.matched.slice(0, 6).join(", ")}</span>
            </p>
          )}
          {breakdown.skills.missing.length > 0 && (
            <p>
              <span className="font-medium text-foreground">Missing:</span>{" "}
              <span className="text-muted-foreground">{breakdown.skills.missing.join(", ")}</span>
            </p>
          )}
          <p>
            <span className="font-medium text-foreground">Seniority:</span>{" "}
            <span className="text-muted-foreground">
              Job looks {describeLevel(breakdown.seniority.jobLevel)} · You're {describeLevel(breakdown.seniority.resumeLevel)}. {breakdown.seniority.note}
            </span>
          </p>
          <p>
            <span className="font-medium text-foreground">Title:</span>{" "}
            <span className="text-muted-foreground">{breakdown.title.note}</span>
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}
