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
  const res = await fetch(url, { headers: { accept: "application/json" } });
  if (!res.ok) {
    const body = (await res.text()).slice(0, 200);
    console.warn(`[adzuna] ${res.status} ${query} @ ${where}: ${body}`);
    return [];
  }
  const data = (await res.json()) as AdzunaResponse;
  return data.results ?? [];
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

  for (const q of queries) {
    for (const city of cities) {
      try {
        const jobs = await callAdzuna(appId, appKey, q, city, 1);
        for (const j of jobs) {
          const row = toRow(j);
          if (!allRows.has(row.external_job_id)) allRows.set(row.external_job_id, row);
        }
      } catch (e) {
        errors.push(`${q}@${city}: ${(e as Error).message}`);
      }
    }
  }

  const rows = Array.from(allRows.values());
  let upserted = 0;
  // batch upsert
  for (let i = 0; i < rows.length; i += 200) {
    const slice = rows.slice(i, i + 200);
    const { error } = await supabase.from("jobs").upsert(slice, { onConflict: "external_job_id" });
    if (error) errors.push(`upsert: ${error.message}`);
    else upserted += slice.length;
  }

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
// Used to surface Naukri.com jobs (Adzuna India does not include naukri).

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
};

type JSearchResponse = { data?: JSearchJob[] };

async function callJSearch(
  rapidKey: string,
  query: string,
  page: number,
): Promise<JSearchJob[]> {
  const params = new URLSearchParams({
    query: `${query} in India via Naukri`,
    page: String(page),
    num_pages: "1",
    country: "in",
    date_posted: "month",
  });
  const url = `https://jsearch.p.rapidapi.com/search?${params.toString()}`;
  const res = await fetch(url, {
    headers: {
      "X-RapidAPI-Key": rapidKey,
      "X-RapidAPI-Host": "jsearch.p.rapidapi.com",
      accept: "application/json",
    },
  });
  if (!res.ok) {
    const body = (await res.text()).slice(0, 200);
    console.warn(`[jsearch] ${res.status} ${query} p${page}: ${body}`);
    return [];
  }
  const data = (await res.json()) as JSearchResponse;
  return data.data ?? [];
}

function isNaukri(job: JSearchJob): boolean {
  const pub = (job.job_publisher ?? "").toLowerCase();
  const link = (job.job_apply_link ?? "").toLowerCase();
  return pub.includes("naukri") || link.includes("naukri.com");
}

function jsearchToRow(job: JSearchJob): UpsertRow {
  const description = (job.job_description || "").replace(/\s+/g, " ").trim();
  const loc = [job.job_city, job.job_country].filter(Boolean).join(", ");
  return {
    external_job_id: `naukri_${job.job_id}`,
    title: job.job_title,
    company_name: job.employer_name ?? null,
    location: loc || null,
    country: job.job_country ?? "IN",
    category: null,
    salary_min: job.job_min_salary ?? null,
    salary_max: job.job_max_salary ?? null,
    salary_currency: job.job_salary_currency ?? "INR",
    description: description.slice(0, 4000),
    redirect_url: job.job_apply_link,
    contract_type: null,
    contract_time: job.job_employment_type ?? null,
    created_date: job.job_posted_at_datetime_utc ?? null,
    source: "Naukri",
    company_logo: job.employer_logo ?? null,
    skills: extractSkills(`${job.job_title} ${description}`),
    is_remote: Boolean(job.job_is_remote),
    is_active: true,
    fetched_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 14 * 86400000).toISOString(),
  };
}

export async function syncJSearchNaukriJobs(opts?: { queries?: string[]; pages?: number }): Promise<SyncResult> {
  const rapidKey = process.env.RAPIDAPI_KEY;
  if (!rapidKey) {
    return { fetched: 0, upserted: 0, deactivated: 0, errors: ["Missing RAPIDAPI_KEY"] };
  }
  const queries = opts?.queries ?? TARGET_QUERIES;
  const pages = opts?.pages ?? 1;
  const supabase = getServiceClient();
  const errors: string[] = [];
  const allRows = new Map<string, UpsertRow>();

  for (const q of queries) {
    for (let p = 1; p <= pages; p++) {
      try {
        const jobs = await callJSearch(rapidKey, q, p);
        for (const j of jobs) {
          if (!isNaukri(j)) continue;
          const row = jsearchToRow(j);
          if (!allRows.has(row.external_job_id)) allRows.set(row.external_job_id, row);
        }
      } catch (e) {
        errors.push(`${q} p${p}: ${(e as Error).message}`);
      }
    }
  }

  const rows = Array.from(allRows.values());
  let upserted = 0;
  for (let i = 0; i < rows.length; i += 200) {
    const slice = rows.slice(i, i + 200);
    const { error } = await supabase.from("jobs").upsert(slice, { onConflict: "external_job_id" });
    if (error) errors.push(`upsert: ${error.message}`);
    else upserted += slice.length;
  }

  return { fetched: rows.length, upserted, deactivated: 0, errors };
}

export async function syncAllJobs(): Promise<SyncResult> {
  const a = await syncAdzunaJobs();
  const n = await syncJSearchNaukriJobs();
  return {
    fetched: a.fetched + n.fetched,
    upserted: a.upserted + n.upserted,
    deactivated: a.deactivated + n.deactivated,
    errors: [...a.errors.map((e) => `adzuna:${e}`), ...n.errors.map((e) => `naukri:${e}`)],
  };
}
