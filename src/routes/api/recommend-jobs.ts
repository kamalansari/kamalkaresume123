import { createFileRoute } from "@tanstack/react-router";
import "@tanstack/react-start";
import { requireAuth } from "@/lib/requireAuth.server";

type Body = {
  jobTitle?: string;
  experience?: string;
  location?: string;
  keywords?: string;
  page?: number;
  pageSize?: number;
};

type OutJob = {
  id: string;
  title: string;
  company: string;
  location: string;
  experience: string;
  salary: string;
  postedAgo: string;
  postedAt: number;
  tags: string[];
  jd: string;
  source: string; // publisher name e.g. "LinkedIn", "Naukri", "Company Website"
  applyUrl: string;
  remote: boolean;
  logo?: string;
};

type ProviderIssue = {
  code: "missing_rapidapi_key" | "jsearch_not_subscribed" | "jsearch_rate_limited" | "jsearch_unavailable";
  message: string;
  detail?: string;
  status?: number;
};

type ProviderResult = { jobs: OutJob[]; issue?: ProviderIssue };

// --- tiny in-memory cache (per-worker) -------------------------------------
type CacheEntry = { at: number; jobs: OutJob[] };
const CACHE = new Map<string, CacheEntry>();
const CACHE_TTL = 10 * 60 * 1000;

function cacheKey(b: Body) {
  return `${(b.jobTitle ?? "").toLowerCase()}|${(b.location ?? "").toLowerCase()}|${(b.keywords ?? "").toLowerCase()}`;
}

function searchLocations(location: string): string[] {
  const parts = location.split(/[,;|]/).map(p => p.trim()).filter(Boolean);
  const normalized = parts.length > 0 ? parts : ["India"];
  const hasRemote = normalized.some(p => /remote|work\s*from\s*home|wfh/i.test(p));
  const hasIndia = normalized.some(p => /india|bharat/i.test(p));
  const locs = [...normalized.slice(0, 2)];
  if (!hasIndia) locs.push("India");
  if (!hasRemote) locs.push("Remote");
  return Array.from(new Set(locs.map(l => l.trim()).filter(Boolean))).slice(0, 4);
}

function isIndiaOrOpenRemote(location: string, remote: boolean): boolean {
  const loc = location.toLowerCase();
  if (/india|remote|worldwide|anywhere|global|asia|apac/.test(loc)) return true;
  return remote && !/usa|united states|canada|brazil|europe|germany|france|uk|united kingdom|australia/.test(loc);
}

function relevantToQuery(job: Pick<OutJob, "title" | "tags" | "jd">, query: string): boolean {
  const terms = query.toLowerCase().split(/[\s,+/()-]+/).filter(w => w.length > 2);
  if (terms.length === 0) return true;
  const title = job.title.toLowerCase();
  const hay = `${job.title} ${job.tags.join(" ")} ${job.jd}`.toLowerCase();
  return terms.some(t => title.includes(t)) || terms.every(t => hay.includes(t));
}

// --- helpers ---------------------------------------------------------------
function timeAgo(ms: number): string {
  const s = Math.max(1, Math.floor((Date.now() - ms) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60); if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24); if (d < 30) return `${d}d ago`;
  const mo = Math.floor(d / 30); if (mo < 12) return `${mo}mo ago`;
  return `${Math.floor(mo / 12)}y ago`;
}

function htmlToText(s: string) {
  return s.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\s+/g, " ").trim();
}

function formatSalary(min: number | null, max: number | null, currency: string | null, period: string | null): string {
  if (!min && !max) return "Not disclosed";
  const cur = (currency || "").toUpperCase();
  const per = (period || "").toUpperCase();
  // Convert to LPA when INR + YEAR
  if (cur === "INR" && (per === "YEAR" || !per)) {
    const lo = min ? Math.round((min / 100000) * 10) / 10 : null;
    const hi = max ? Math.round((max / 100000) * 10) / 10 : null;
    if (lo && hi) return `₹${lo}-${hi} LPA`;
    if (hi) return `₹${hi} LPA`;
    if (lo) return `₹${lo}+ LPA`;
  }
  const sym = cur === "INR" ? "₹" : cur === "USD" ? "$" : cur === "EUR" ? "€" : cur === "GBP" ? "£" : `${cur} `;
  const fmt = (n: number) => n >= 1000 ? `${Math.round(n / 1000)}k` : `${n}`;
  const lbl = per === "HOUR" ? "/hr" : per === "MONTH" ? "/mo" : per === "YEAR" ? "/yr" : "";
  if (min && max) return `${sym}${fmt(min)}-${fmt(max)}${lbl}`;
  if (max) return `${sym}${fmt(max)}${lbl}`;
  return `${sym}${fmt(min!)}${lbl}`;
}

function experienceLabel(months: number | null | undefined, noExp: boolean | null | undefined): string {
  if (noExp) return "Fresher";
  if (months == null) return "Not specified";
  const yrs = Math.round((months / 12) * 10) / 10;
  if (yrs <= 1) return "0-1 years";
  if (yrs <= 3) return `${Math.floor(yrs)}-${Math.ceil(yrs) + 1} years`;
  return `${Math.floor(yrs)}+ years`;
}

// --- JSearch (RapidAPI) ----------------------------------------------------
type JSearchJob = {
  job_id: string;
  employer_name: string;
  employer_logo: string | null;
  job_publisher: string;
  job_title: string;
  job_apply_link: string;
  job_apply_is_direct?: boolean;
  apply_options?: Array<{ publisher: string; apply_link: string; is_direct: boolean }>;
  job_description: string;
  job_is_remote: boolean;
  job_posted_at_timestamp: number | null;
  job_city: string | null;
  job_state: string | null;
  job_country: string | null;
  job_location?: string | null;
  job_employment_type?: string | null;
  job_min_salary: number | null;
  job_max_salary: number | null;
  job_salary_currency: string | null;
  job_salary_period: string | null;
  job_required_experience?: {
    no_experience_required?: boolean | null;
    required_experience_in_months?: number | null;
  };
  job_required_skills?: string[] | null;
};

type RemotiveJob = {
  id: number | string;
  url: string;
  title: string;
  company_name: string;
  candidate_required_location?: string;
  publication_date?: string;
  salary?: string;
  description?: string;
  tags?: string[];
  company_logo?: string;
};

async function fetchJSearch(query: string, location: string, pages: number): Promise<ProviderResult> {
  const key = process.env.RAPIDAPI_KEY;
  if (!key) {
    return { jobs: [], issue: { code: "missing_rapidapi_key", message: "Job search is not configured yet.", detail: "Add RAPIDAPI_KEY to enable JSearch live listings." } };
  }
  const q = [query, location].filter(Boolean).join(" in ") || "jobs";
  const out: OutJob[] = [];
  try {
    const res = await fetch(
      `https://jsearch.p.rapidapi.com/search?query=${encodeURIComponent(q)}&page=1&num_pages=${pages}&country=in&date_posted=month`,
      { headers: { "x-rapidapi-key": key, "x-rapidapi-host": "jsearch.p.rapidapi.com" } },
    );
    if (!res.ok) {
      const detail = (await res.text()).slice(0, 300);
      console.warn("[jsearch] status", res.status, detail);
      if (res.status === 403 && /not subscribed/i.test(detail)) {
        return { jobs: [], issue: { code: "jsearch_not_subscribed", message: "JSearch is not enabled for this RapidAPI key.", detail: "Subscribe this key to the JSearch API on RapidAPI, then retry the search.", status: res.status } };
      }
      if (res.status === 429) {
        return { jobs: [], issue: { code: "jsearch_rate_limited", message: "JSearch rate limit reached.", detail: "Please wait a moment or upgrade the RapidAPI plan, then retry.", status: res.status } };
      }
      return { jobs: [], issue: { code: "jsearch_unavailable", message: "JSearch could not return jobs right now.", detail, status: res.status } };
    }
    const data = (await res.json()) as { data?: JSearchJob[] };
    for (const j of data.data ?? []) {
      const posted = j.job_posted_at_timestamp ? j.job_posted_at_timestamp * 1000 : Date.now();
      const loc = [j.job_city, j.job_state].filter(Boolean).join(", ") || j.job_location || j.job_country || (j.job_is_remote ? "Remote" : "India");
      // Build a "Career Pages" entry if direct apply exists
      const directApply = j.apply_options?.find(o => o.is_direct) || (j.job_apply_is_direct ? { publisher: "Company Website", apply_link: j.job_apply_link, is_direct: true } : null);
      const base: OutJob = {
        id: `js_${j.job_id}`,
        title: j.job_title,
        company: j.employer_name,
        location: loc,
        experience: experienceLabel(j.job_required_experience?.required_experience_in_months ?? null, j.job_required_experience?.no_experience_required ?? null),
        salary: formatSalary(j.job_min_salary, j.job_max_salary, j.job_salary_currency, j.job_salary_period),
        postedAgo: timeAgo(posted),
        postedAt: posted,
        tags: (j.job_required_skills ?? []).slice(0, 6),
        jd: htmlToText(j.job_description ?? "").slice(0, 2200),
        source: j.job_publisher || "Web",
        applyUrl: j.job_apply_link,
        remote: !!j.job_is_remote,
        logo: j.employer_logo ?? undefined,
      };
      out.push(base);
      // Add a separate "Career Pages" variant if direct apply differs from main publisher
      if (directApply && !/company website|career/i.test(base.source) && directApply.apply_link !== base.applyUrl) {
        out.push({
          ...base,
          id: `${base.id}_cp`,
          source: "Company Website",
          applyUrl: directApply.apply_link,
        });
      }
    }
  } catch (e) {
    console.warn("[jsearch] error", (e as Error).message);
    return { jobs: [], issue: { code: "jsearch_unavailable", message: "Job search provider is temporarily unavailable.", detail: (e as Error).message } };
  }
  return { jobs: out };
}

async function fetchJSearchBroad(query: string, location: string): Promise<ProviderResult> {
  const all: OutJob[] = [];
  let issue: ProviderIssue | undefined;
  for (const loc of searchLocations(location)) {
    const result = await fetchJSearch(query, loc, 1);
    if (result.issue) {
      issue = result.issue;
      if (result.issue.code === "jsearch_not_subscribed" || result.issue.code === "jsearch_rate_limited") break;
    }
    all.push(...result.jobs);
    if (all.length >= 60) break;
  }
  return { jobs: all, issue };
}

async function fetchRemotive(query: string): Promise<OutJob[]> {
  const url = `https://remotive.com/api/remote-jobs?search=${encodeURIComponent(query || "jobs")}`;
  try {
    const res = await fetch(url, { headers: { "user-agent": "ResumeForge/1.0" } });
    if (!res.ok) return [];
    const data = (await res.json()) as { jobs?: RemotiveJob[] };
    return (data.jobs ?? []).slice(0, 80).map(j => {
      const posted = j.publication_date ? Date.parse(j.publication_date) || Date.now() : Date.now();
      return {
        id: `rem_${j.id}`,
        title: j.title,
        company: j.company_name,
        location: j.candidate_required_location || "Remote",
        experience: "Not specified",
        salary: j.salary?.trim() || "Not disclosed",
        postedAgo: timeAgo(posted),
        postedAt: posted,
        tags: (j.tags ?? []).slice(0, 6),
        jd: htmlToText(j.description ?? "").slice(0, 2200),
        source: "Remotive",
        applyUrl: j.url,
        remote: true,
        logo: j.company_logo || undefined,
      };
    }).filter(j => isIndiaOrOpenRemote(j.location, j.remote) && relevantToQuery(j, query));
  } catch (e) {
    console.warn("[remotive] error", (e as Error).message);
    return [];
  }
}

// --- ranking ---------------------------------------------------------------
function rank(jobs: OutJob[], q: { title: string; location: string; keywords: string }): OutJob[] {
  const wantedLoc = q.location.toLowerCase();
  const kws = `${q.title} ${q.keywords}`.toLowerCase().split(/[,\s]+/).filter(w => w.length > 2);
  return jobs
    .map(j => {
      let s = 0;
      const hay = `${j.title} ${j.company} ${j.tags.join(" ")} ${j.jd}`.toLowerCase();
      for (const k of kws) if (hay.includes(k)) s += 3;
      if (q.title && j.title.toLowerCase().includes(q.title.toLowerCase())) s += 8;
      if (wantedLoc) {
        const loc = j.location.toLowerCase();
        if (loc.includes(wantedLoc.split(",")[0].trim())) s += 6;
        else if (j.remote) s += 2;
      }
      const ageDays = (Date.now() - j.postedAt) / 86400000;
      s += Math.max(0, 5 - ageDays / 3);
      return { j, s };
    })
    .sort((a, b) => b.s - a.s)
    .map(x => x.j);
}

// --- handler ---------------------------------------------------------------
export const Route = createFileRoute("/api/recommend-jobs")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const auth = await requireAuth(request);
        if (auth instanceof Response) return auth;
        const body = (await request.json()) as Body;
        const page = Math.max(1, Number(body.page ?? 1));
        const pageSize = Math.min(50, Math.max(5, Number(body.pageSize ?? 20)));
        const title = (body.jobTitle ?? "").trim();
        const location = (body.location ?? "").trim();
        const keywords = (body.keywords ?? "").trim();

        const key = cacheKey(body);
        let pool: OutJob[];
        let providerIssue: ProviderIssue | undefined;
        const cached = CACHE.get(key);
        if (cached && Date.now() - cached.at < CACHE_TTL) {
          pool = cached.jobs;
        } else {
          const q = [title, keywords].filter(Boolean).join(" ");
          const result = await fetchJSearchBroad(q, location);
          const fallback = result.jobs.length > 0 ? [] : await fetchRemotive(q || title || "jobs");
          const all = [...result.jobs, ...fallback];
          providerIssue = result.issue;
          // dedupe by applyUrl + source
          const seen = new Set<string>();
          const unique: OutJob[] = [];
          for (const j of all) {
            const k = `${j.source}|${j.applyUrl}`;
            if (!j.applyUrl || seen.has(k)) continue;
            if (!isIndiaOrOpenRemote(j.location, j.remote)) continue;
            if (!relevantToQuery(j, q || title)) continue;
            seen.add(k);
            unique.push(j);
          }
          pool = rank(unique, { title, location, keywords });
          if (pool.length > 0) providerIssue = undefined;
          if (pool.length > 0) CACHE.set(key, { at: Date.now(), jobs: pool });
        }

        const start = (page - 1) * pageSize;
        const slice = pool.slice(start, start + pageSize);
        return Response.json({
          jobs: slice,
          total: pool.length,
          page,
          pageSize,
          hasMore: start + slice.length < pool.length,
          fetchedAt: Date.now(),
          provider: "JSearch",
          providerIssue,
        });
      },
    },
  },
});
