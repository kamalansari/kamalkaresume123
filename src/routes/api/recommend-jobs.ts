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
  postedAt: number; // epoch ms
  tags: string[];
  jd: string;
  source: string;
  applyUrl: string;
  remote: boolean;
};

// --- tiny in-memory cache (per-worker) -------------------------------------
type CacheEntry = { at: number; jobs: OutJob[] };
const CACHE = new Map<string, CacheEntry>();
const CACHE_TTL = 10 * 60 * 1000; // 10 min

function cacheKey(b: Body) {
  return `${(b.jobTitle ?? "").toLowerCase()}|${(b.location ?? "").toLowerCase()}|${(b.keywords ?? "").toLowerCase()}`;
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

function matchesQuery(text: string, needle: string) {
  if (!needle.trim()) return true;
  const t = text.toLowerCase();
  return needle.toLowerCase().split(/[,\s]+/).filter(Boolean).every(w => t.includes(w));
}

// --- providers -------------------------------------------------------------
type RemotiveJob = {
  id: number; url: string; title: string; company_name: string; category: string;
  tags?: string[]; job_type: string; publication_date: string;
  candidate_required_location: string; salary: string; description: string;
};

async function fetchRemotive(query: string): Promise<OutJob[]> {
  try {
    const url = `https://remotive.com/api/remote-jobs${query ? `?search=${encodeURIComponent(query)}` : ""}`;
    const res = await fetch(url, { headers: { "user-agent": "ResumeForge/1.0" } });
    if (!res.ok) return [];
    const data = (await res.json()) as { jobs?: RemotiveJob[] };
    return (data.jobs ?? []).map((j): OutJob => {
      const posted = Date.parse(j.publication_date) || Date.now();
      return {
        id: `rmt_${j.id}`,
        title: j.title,
        company: j.company_name,
        location: j.candidate_required_location || "Remote",
        experience: "Not specified",
        salary: j.salary?.trim() || "Not disclosed",
        postedAgo: timeAgo(posted),
        postedAt: posted,
        tags: (j.tags ?? []).slice(0, 6),
        jd: htmlToText(j.description ?? "").slice(0, 1800),
        source: "Remotive",
        applyUrl: j.url,
        remote: true,
      };
    });
  } catch { return []; }
}

type ArbeitnowJob = {
  slug: string; company_name: string; title: string; description: string;
  remote: boolean; url: string; tags: string[]; job_types: string[];
  location: string; created_at: number;
};

async function fetchArbeitnow(): Promise<OutJob[]> {
  const out: OutJob[] = [];
  try {
    // fetch first 2 pages for breadth
    for (let p = 1; p <= 2; p++) {
      const res = await fetch(`https://www.arbeitnow.com/api/job-board-api?page=${p}`, { headers: { "user-agent": "ResumeForge/1.0" } });
      if (!res.ok) break;
      const data = (await res.json()) as { data?: ArbeitnowJob[] };
      for (const j of data.data ?? []) {
        const posted = (j.created_at ?? Math.floor(Date.now() / 1000)) * 1000;
        out.push({
          id: `arb_${j.slug}`,
          title: j.title,
          company: j.company_name,
          location: j.location || (j.remote ? "Remote" : "—"),
          experience: "Not specified",
          salary: "Not disclosed",
          postedAgo: timeAgo(posted),
          postedAt: posted,
          tags: (j.tags ?? []).slice(0, 6),
          jd: htmlToText(j.description ?? "").slice(0, 1800),
          source: "Arbeitnow",
          applyUrl: j.url,
          remote: !!j.remote,
        });
      }
    }
  } catch { /* ignore */ }
  return out;
}

// --- ranking ---------------------------------------------------------------
function rank(jobs: OutJob[], q: { title: string; location: string; keywords: string }): OutJob[] {
  const wantedLoc = q.location.toLowerCase();
  const kws = `${q.title} ${q.keywords}`.toLowerCase().split(/[,\s]+/).filter(w => w.length > 2);
  const indiaWanted = /india|mumbai|delhi|bangalore|bengaluru|pune|hyderabad|chennai|kolkata|noida|gurgaon|ahmedabad/.test(wantedLoc);

  return jobs
    .map(j => {
      let s = 0;
      const hay = `${j.title} ${j.company} ${j.tags.join(" ")} ${j.jd}`.toLowerCase();
      for (const k of kws) if (hay.includes(k)) s += 3;
      if (q.title && j.title.toLowerCase().includes(q.title.toLowerCase())) s += 8;
      // location pref
      if (wantedLoc) {
        const loc = j.location.toLowerCase();
        if (loc.includes(wantedLoc.split(",")[0].trim())) s += 6;
        else if (indiaWanted && (loc.includes("india") || loc.includes("worldwide") || j.remote)) s += 3;
        else if (j.remote) s += 1;
      } else if (j.remote) s += 1;
      // recency: up to +5 within last 14 days
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
        const cached = CACHE.get(key);
        if (cached && Date.now() - cached.at < CACHE_TTL) {
          pool = cached.jobs;
        } else {
          const [a, b] = await Promise.all([fetchRemotive(title), fetchArbeitnow()]);
          // dedupe by applyUrl
          const seen = new Set<string>();
          const merged: OutJob[] = [];
          for (const j of [...a, ...b]) {
            if (!j.applyUrl || seen.has(j.applyUrl)) continue;
            seen.add(j.applyUrl);
            // text filter
            const hay = `${j.title} ${j.company} ${j.tags.join(" ")} ${j.jd}`;
            if (!matchesQuery(hay, `${title} ${keywords}`)) continue;
            // location filter (loose)
            if (location.trim()) {
              const loc = j.location.toLowerCase();
              const first = location.toLowerCase().split(",")[0].trim();
              const indiaWanted = /india|mumbai|delhi|bangalore|bengaluru|pune|hyderabad|chennai|kolkata|noida|gurgaon|ahmedabad/.test(location.toLowerCase());
              const ok = loc.includes(first) || (indiaWanted && (loc.includes("india") || loc.includes("worldwide") || j.remote));
              if (!ok) continue;
            }
            merged.push(j);
          }
          pool = rank(merged, { title, location, keywords });
          CACHE.set(key, { at: Date.now(), jobs: pool });
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
        });
      },
    },
  },
});
