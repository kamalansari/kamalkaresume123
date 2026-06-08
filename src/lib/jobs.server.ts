// Server-only Adzuna integration + cache upsert. Do not import from client code.
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export const TARGET_QUERIES = [
  "Data Analyst",
  "Business Analyst",
  "Power BI Developer",
  "SQL Developer",
  "Python Developer",
  "Data Engineer",
  "MIS Executive",
  "Reporting Analyst",
];

export const TARGET_CITIES = [
  "Mumbai",
  "Pune",
  "Bengaluru",
  "Hyderabad",
  "Chennai",
  "Delhi",
  "Gurgaon",
  "Noida",
  "Kolkata",
  "Ahmedabad",
  "Remote",
];

// ───────────────────────── Retry helper ─────────────────────────
// Exponential backoff with jitter for transient failures (network errors, 5xx, 408, 429).
// Non-retryable: 4xx (except 408/429) and explicit "non_retryable" errors.

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export type RetryOpts = {
  retries?: number;       // number of retry attempts after the initial try (default 3)
  baseDelayMs?: number;   // initial backoff (default 400ms)
  maxDelayMs?: number;    // cap on backoff (default 4000ms)
  label?: string;         // for log lines
  shouldRetry?: (err: unknown, attempt: number) => boolean;
};

export async function withRetry<T>(fn: () => Promise<T>, opts: RetryOpts = {}): Promise<T> {
  const retries = opts.retries ?? 3;
  const base = opts.baseDelayMs ?? 400;
  const max = opts.maxDelayMs ?? 4000;
  const label = opts.label ?? "op";
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const retryable = opts.shouldRetry ? opts.shouldRetry(err, attempt) : true;
      if (!retryable || attempt === retries) break;
      const expo = Math.min(max, base * 2 ** attempt);
      const delay = Math.round(expo * (0.5 + Math.random() * 0.5)); // jitter 50-100%
      console.warn(`[retry] ${label} attempt ${attempt + 1}/${retries + 1} failed: ${(err as Error).message}. retrying in ${delay}ms`);
      await sleep(delay);
    }
  }
  throw lastErr;
}

class NonRetryableError extends Error {
  constructor(message: string) { super(message); this.name = "NonRetryableError"; }
}

async function fetchWithRetry(
  url: string,
  init: RequestInit & { timeoutMs?: number } = {},
  opts: RetryOpts = {},
): Promise<Response> {
  const { timeoutMs = 15000, ...rest } = init;
  return withRetry(async () => {
    const res = await fetch(url, { ...rest, signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) {
      const status = res.status;
      // Read body once for both error inspection and re-exposure to caller via clone.
      const bodyText = await res.clone().text();
      const transient = status >= 500 || status === 408 || status === 429;
      // 429 may be either rate-limit (retry) or subscription error (don't retry).
      if (status === 429 && isRapidApiSubscriptionError(status, bodyText)) {
        throw new NonRetryableError(`HTTP ${status}: ${bodyText.slice(0, 200)}`);
      }
      if (!transient) {
        throw new NonRetryableError(`HTTP ${status}: ${bodyText.slice(0, 200)}`);
      }
      throw new Error(`HTTP ${status}: ${bodyText.slice(0, 200)}`);
    }
    return res;
  }, {
    ...opts,
    shouldRetry: (err) => !(err instanceof NonRetryableError),
  });
}

type AdzunaJob = {
  id: string;
  title: string;
  description: string;
  redirect_url: string;
  created: string;
  location?: { display_name?: string; area?: string[] };
  company?: { display_name?: string };
  category?: { label?: string; tag?: string };
  contract_type?: string;
  contract_time?: string;
  salary_min?: number;
  salary_max?: number;
  salary_is_predicted?: string;
  __CLASS__?: string;
};

type AdzunaResponse = {
  results?: AdzunaJob[];
  count?: number;
};

const SKILL_DICT = [
  "sql","python","r","excel","power bi","powerbi","tableau","looker","snowflake","redshift","bigquery",
  "azure","aws","gcp","etl","airflow","dbt","spark","hadoop","kafka","databricks",
  "javascript","typescript","react","node","django","flask","fastapi","java","scala",
  "machine learning","ml","ai","nlp","statistics","forecasting","a/b testing","experimentation",
  "vba","power query","dax","ssis","ssrs","ssas","mongodb","postgres","mysql","oracle",
  "salesforce","sap","jira","confluence","git","docker","kubernetes",
];

export function extractSkills(text: string): string[] {
  const t = (text || "").toLowerCase();
  const hit = new Set<string>();
  for (const s of SKILL_DICT) {
    const re = new RegExp(`(^|[^a-z0-9])${s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z0-9]|$)`, "i");
    if (re.test(t)) hit.add(s.replace(/\b\w/g, c => c.toUpperCase()));
  }
  return Array.from(hit).slice(0, 12);
}

function isRemote(job: AdzunaJob): boolean {
  const hay = `${job.title} ${job.location?.display_name ?? ""} ${job.description}`.toLowerCase();
  return /remote|work\s*from\s*home|wfh|anywhere/.test(hay);
}

export function getServiceClient() {
  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
  });
}

async function callAdzuna(
  appId: string,
  appKey: string,
  query: string,
  where: string,
  page: number,
): Promise<AdzunaJob[]> {
  const params = new URLSearchParams({
    app_id: appId,
    app_key: appKey,
    results_per_page: "50",
    what: query,
    "content-type": "application/json",
    max_days_old: "30",
  });
  if (where && where.toLowerCase() !== "remote") params.set("where", where);
  if (where && where.toLowerCase() === "remote") params.set("what_or", `${query} remote`);
  const url = `https://api.adzuna.com/v1/api/jobs/in/search/${page}?${params.toString()}`;
  try {
    const res = await fetchWithRetry(url, { headers: { accept: "application/json" }, timeoutMs: 10000 }, { label: `adzuna ${query}@${where}` });
    const data = (await res.json()) as AdzunaResponse;
    return data.results ?? [];
  } catch (e) {
    console.warn(`[adzuna] ${query} @ ${where}: ${(e as Error).message}`);
    return [];
  }
}

type UpsertRow = Database["public"]["Tables"]["jobs"]["Insert"];

function toRow(job: AdzunaJob): UpsertRow {
  const description = (job.description || "").replace(/\s+/g, " ").trim();
  return {
    external_job_id: `adzuna_${job.id}`,
    title: job.title,
    company_name: job.company?.display_name ?? null,
    location: job.location?.display_name ?? null,
    country: "IN",
    category: job.category?.label ?? null,
    salary_min: job.salary_min ?? null,
    salary_max: job.salary_max ?? null,
    salary_currency: "INR",
    description: description.slice(0, 4000),
    redirect_url: job.redirect_url,
    contract_type: job.contract_type ?? null,
    contract_time: job.contract_time ?? null,
    created_date: job.created ? new Date(job.created).toISOString() : null,
    source: "Adzuna",
    company_logo: null,
    skills: extractSkills(`${job.title} ${description}`),
    is_remote: isRemote(job),
    is_active: true,
    fetched_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 14 * 86400000).toISOString(),
  };
}

export type SyncResult = {
  fetched: number;
  upserted: number;
  deactivated: number;
  errors: string[];
};

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      results[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return results;
}

export async function syncAdzunaJobs(opts?: { queries?: string[]; cities?: string[] }): Promise<SyncResult> {
  const appId = process.env.ADZUNA_APP_ID;
  const appKey = process.env.ADZUNA_APP_KEY;
  if (!appId || !appKey) {
    return { fetched: 0, upserted: 0, deactivated: 0, errors: ["Missing ADZUNA_APP_ID/ADZUNA_APP_KEY"] };
  }
  const queries = opts?.queries ?? TARGET_QUERIES;
  const cities = opts?.cities ?? TARGET_CITIES;
  const supabase = getServiceClient();
  const errors: string[] = [];
  const allRows = new Map<string, UpsertRow>();

  const tasks = queries.flatMap((q) => cities.map((city) => ({ q, city })));
  await mapWithConcurrency(tasks, 10, async ({ q, city }) => {
    try {
      const jobs = await callAdzuna(appId, appKey, q, city, 1);
      for (const j of jobs) {
        const row = toRow(j);
        if (!allRows.has(row.external_job_id)) allRows.set(row.external_job_id, row);
      }
    } catch (e) {
      errors.push(`${q}@${city}: ${(e as Error).message}`);
    }
  });

  const rows = Array.from(allRows.values());
  let upserted = 0;
  const batches: UpsertRow[][] = [];
  for (let i = 0; i < rows.length; i += 200) batches.push(rows.slice(i, i + 200));
  await mapWithConcurrency(batches, 4, async (slice) => {
    const { error } = await supabase.from("jobs").upsert(slice, { onConflict: "external_job_id" });
    if (error) errors.push(`upsert: ${error.message}`);
    else upserted += slice.length;
  });

  // deactivate expired
  const { data: deactivatedRows, error: deErr } = await supabase
    .from("jobs")
    .update({ is_active: false })
    .lt("expires_at", new Date().toISOString())
    .eq("is_active", true)
    .select("id");
  if (deErr) errors.push(`deactivate: ${deErr.message}`);
  const count = deactivatedRows?.length ?? 0;

  return { fetched: rows.length, upserted, deactivated: count ?? 0, errors };
}

// ───────────────────────── JSearch (RapidAPI) ─────────────────────────
// Surfaces jobs from Naukri, LinkedIn, Indeed, and Glassdoor (Adzuna India does not include these).

type JSearchApplyOption = {
  publisher?: string | null;
  apply_link?: string | null;
  is_direct?: boolean;
};

type JSearchJob = {
  job_id: string;
  employer_name?: string | null;
  employer_logo?: string | null;
  job_publisher?: string | null;
  job_title: string;
  job_description?: string | null;
  job_apply_link: string;
  job_city?: string | null;
  job_country?: string | null;
  job_is_remote?: boolean;
  job_min_salary?: number | null;
  job_max_salary?: number | null;
  job_salary_currency?: string | null;
  job_employment_type?: string | null;
  job_posted_at_datetime_utc?: string | null;
  apply_options?: JSearchApplyOption[] | null;
};

type JSearchResponse = { data?: JSearchJob[] };

function isRapidApiSubscriptionError(status: number, body: string): boolean {
  const text = body.toLowerCase();
  return (
    status === 403 ||
    status === 429 ||
    text.includes("not subscribed") ||
    text.includes("not subscribe") ||
    text.includes("you are not subscribed") ||
    text.includes("subscribe to this api") ||
    text.includes("not authorized to access this api")
  );
}

type PublisherConfig = {
  source: string;
  idPrefix: string;
  // Substrings (lower-cased) that identify this publisher in JSearch's
  // job_publisher field or in any apply_options[].publisher / apply_link entry.
  needles: string[];
};

const PUBLISHERS: PublisherConfig[] = [
  { source: "Indeed",    idPrefix: "indeed",    needles: ["indeed"] },
  { source: "LinkedIn",  idPrefix: "linkedin",  needles: ["linkedin"] },
  { source: "Naukri",    idPrefix: "naukri",    needles: ["naukri"] },
  { source: "Glassdoor", idPrefix: "glassdoor", needles: ["glassdoor"] },
];

function matchPublisher(j: JSearchJob, pub: PublisherConfig): { link: string } | null {
  const pubField = (j.job_publisher ?? "").toLowerCase();
  const mainLink = (j.job_apply_link ?? "").toLowerCase();
  for (const needle of pub.needles) {
    if (pubField.includes(needle) || mainLink.includes(needle)) {
      return { link: j.job_apply_link };
    }
    for (const opt of j.apply_options ?? []) {
      const op = (opt.publisher ?? "").toLowerCase();
      const al = (opt.apply_link ?? "").toLowerCase();
      if (op.includes(needle) || al.includes(needle)) {
        return { link: opt.apply_link || j.job_apply_link };
      }
    }
  }
  return null;
}

async function callJSearch(
  rapidKey: string,
  query: string,
  page: number,
): Promise<JSearchJob[]> {
  const params = new URLSearchParams({
    query: `${query} in India`,
    page: String(page),
    num_pages: "1",
    country: "in",
    date_posted: "month",
  });
  const url = `https://jsearch.p.rapidapi.com/search?${params.toString()}`;
  try {
    const res = await fetchWithRetry(url, {
      headers: {
        "X-RapidAPI-Key": rapidKey,
        "X-RapidAPI-Host": "jsearch.p.rapidapi.com",
        accept: "application/json",
      },
      timeoutMs: 15000,
    }, { label: `jsearch ${query} p${page}` });
    const data = (await res.json()) as JSearchResponse;
    return data.data ?? [];
  } catch (e) {
    const msg = (e as Error).message;
    if (isRapidApiSubscriptionError(0, msg) || msg.toLowerCase().includes("not subscribed")) {
      throw new Error("JSearch subscription required on RapidAPI");
    }
    console.warn(`[jsearch] ${query} p${page}: ${msg}`);
    return [];
  }
}

function jsearchToRow(job: JSearchJob, pub: PublisherConfig, link: string): UpsertRow {
  const description = (job.job_description || "").replace(/\s+/g, " ").trim();
  const loc = [job.job_city, job.job_country].filter(Boolean).join(", ");
  return {
    external_job_id: `${pub.idPrefix}_${job.job_id}`,
    title: job.job_title,
    company_name: job.employer_name ?? null,
    location: loc || null,
    country: job.job_country ?? "IN",
    category: null,
    salary_min: job.job_min_salary ?? null,
    salary_max: job.job_max_salary ?? null,
    salary_currency: job.job_salary_currency ?? "INR",
    description: description.slice(0, 4000),
    redirect_url: link,
    contract_type: null,
    contract_time: job.job_employment_type ?? null,
    created_date: job.job_posted_at_datetime_utc ?? null,
    source: pub.source,
    company_logo: job.employer_logo ?? null,
    skills: extractSkills(`${job.job_title} ${description}`),
    is_remote: Boolean(job.job_is_remote),
    is_active: true,
    fetched_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 14 * 86400000).toISOString(),
  };
}

export async function syncJSearchJobs(opts?: { queries?: string[]; pages?: number }): Promise<SyncResult> {
  const rapidKey = process.env.RAPIDAPI_KEY;
  if (!rapidKey) {
    return { fetched: 0, upserted: 0, deactivated: 0, errors: ["Missing RAPIDAPI_KEY"] };
  }
  const queries = opts?.queries ?? TARGET_QUERIES;
  const pages = opts?.pages ?? 2;
  const supabase = getServiceClient();
  const errors: string[] = [];
  const allRows = new Map<string, UpsertRow>();

  // One JSearch call per (query, page). Each returned job is fanned out to
  // every publisher present in its apply_options, so a single API call yields
  // Indeed + LinkedIn + Naukri + Glassdoor rows when the listing is mirrored.
  const tasks: { q: string; p: number }[] = [];
  for (const q of queries) {
    for (let p = 1; p <= pages; p++) tasks.push({ q, p });
  }
  await mapWithConcurrency(tasks, 4, async ({ q, p }) => {
    try {
      const jobs = await callJSearch(rapidKey, q, p);
      for (const j of jobs) {
        for (const pub of PUBLISHERS) {
          const m = matchPublisher(j, pub);
          if (!m) continue;
          const row = jsearchToRow(j, pub, m.link);
          if (!allRows.has(row.external_job_id)) allRows.set(row.external_job_id, row);
        }
      }
    } catch (e) {
      errors.push(`${q} p${p}: ${(e as Error).message}`);
    }
  });

  const rows = Array.from(allRows.values());
  let upserted = 0;
  const batches: UpsertRow[][] = [];
  for (let i = 0; i < rows.length; i += 200) batches.push(rows.slice(i, i + 200));
  await mapWithConcurrency(batches, 4, async (slice) => {
    const { error } = await supabase.from("jobs").upsert(slice, { onConflict: "external_job_id" });
    if (error) errors.push(`upsert: ${error.message}`);
    else upserted += slice.length;
  });

  return { fetched: rows.length, upserted, deactivated: 0, errors };
}

// Back-compat alias
export const syncJSearchNaukriJobs = syncJSearchJobs;

// ───────────────────────── Jooble ─────────────────────────
// Free job aggregator covering 70+ countries. Surfaces Indeed, LinkedIn, Naukri,
// and many company sites. Auth is a POST with the API key in the URL path.

type JoobleJob = {
  id?: string | number;
  title: string;
  location?: string;
  snippet?: string;
  salary?: string;
  source?: string;
  type?: string;
  link: string;
  company?: string;
  updated?: string;
};

type JoobleResponse = { jobs?: JoobleJob[]; totalCount?: number };

function joobleToRow(job: JoobleJob, location: string): UpsertRow {
  const description = (job.snippet || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const idBase = job.id != null ? String(job.id) : job.link;
  const loc = job.location || location;
  const hay = `${job.title} ${loc} ${description}`.toLowerCase();
  const remote = /remote|work\s*from\s*home|wfh|anywhere/.test(hay);
  return {
    external_job_id: `jooble_${idBase}`,
    title: job.title,
    company_name: job.company || null,
    location: loc || null,
    country: "IN",
    category: null,
    salary_min: null,
    salary_max: null,
    salary_currency: "INR",
    description: description.slice(0, 4000),
    redirect_url: job.link,
    contract_type: null,
    contract_time: job.type ?? null,
    created_date: job.updated ? new Date(job.updated).toISOString() : null,
    source: "Jooble",
    company_logo: null,
    skills: extractSkills(`${job.title} ${description}`),
    is_remote: remote,
    is_active: true,
    fetched_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 14 * 86400000).toISOString(),
  };
}

async function callJooble(apiKey: string, keywords: string, location: string, page: number): Promise<JoobleJob[]> {
  const url = `https://jooble.org/api/${encodeURIComponent(apiKey)}`;
  try {
    const res = await fetchWithRetry(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify({ keywords, location, page: String(page) }),
      timeoutMs: 12000,
    }, { label: `jooble ${keywords}@${location} p${page}` });
    const data = (await res.json()) as JoobleResponse;
    return data.jobs ?? [];
  } catch (e) {
    console.warn(`[jooble] ${keywords} @ ${location} p${page}: ${(e as Error).message}`);
    return [];
  }
}

export async function syncJoobleJobs(opts?: { queries?: string[]; cities?: string[]; pages?: number }): Promise<SyncResult> {
  const apiKey = process.env.JOOBLE_API_KEY;
  if (!apiKey) {
    return { fetched: 0, upserted: 0, deactivated: 0, errors: ["Missing JOOBLE_API_KEY"] };
  }
  const queries = opts?.queries ?? TARGET_QUERIES;
  const cities = opts?.cities ?? TARGET_CITIES;
  const pages = opts?.pages ?? 1;
  const supabase = getServiceClient();
  const errors: string[] = [];
  const allRows = new Map<string, UpsertRow>();

  const tasks: { q: string; city: string; p: number }[] = [];
  for (const q of queries) {
    for (const city of cities) {
      for (let p = 1; p <= pages; p++) tasks.push({ q, city, p });
    }
  }
  await mapWithConcurrency(tasks, 6, async ({ q, city, p }) => {
    try {
      const jobs = await callJooble(apiKey, q, city, p);
      for (const j of jobs) {
        const row = joobleToRow(j, city);
        if (!allRows.has(row.external_job_id)) allRows.set(row.external_job_id, row);
      }
    } catch (e) {
      errors.push(`${q}@${city} p${p}: ${(e as Error).message}`);
    }
  });

  const rows = Array.from(allRows.values());
  let upserted = 0;
  const batches: UpsertRow[][] = [];
  for (let i = 0; i < rows.length; i += 200) batches.push(rows.slice(i, i + 200));
  await mapWithConcurrency(batches, 4, async (slice) => {
    const { error } = await supabase.from("jobs").upsert(slice, { onConflict: "external_job_id" });
    if (error) errors.push(`upsert: ${error.message}`);
    else upserted += slice.length;
  });

  return { fetched: rows.length, upserted, deactivated: 0, errors };
}

export async function syncAllJobs(): Promise<SyncResult> {
  const [a, j, jb] = await Promise.all([syncAdzunaJobs(), syncJSearchJobs(), syncJoobleJobs()]);
  return {
    fetched: a.fetched + j.fetched + jb.fetched,
    upserted: a.upserted + j.upserted + jb.upserted,
    deactivated: a.deactivated + j.deactivated + jb.deactivated,
    errors: [
      ...a.errors.map((e) => `adzuna:${e}`),
      ...j.errors.map((e) => `jsearch:${e}`),
      ...jb.errors.map((e) => `jooble:${e}`),
    ],
  };
}

