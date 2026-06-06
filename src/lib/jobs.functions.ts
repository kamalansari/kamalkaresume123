import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type JobRow = {
  id: string;
  external_job_id: string;
  title: string;
  company_name: string | null;
  location: string | null;
  country: string | null;
  category: string | null;
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string | null;
  description: string | null;
  redirect_url: string;
  contract_type: string | null;
  contract_time: string | null;
  created_date: string | null;
  source: string;
  company_logo: string | null;
  skills: string[];
  is_remote: boolean;
  is_active: boolean;
};

const ListInput = z.object({
  search: z.string().max(200).optional().default(""),
  location: z.string().max(200).optional().default(""),
  company: z.string().max(200).optional().default(""),
  workMode: z.enum(["any", "remote", "hybrid", "onsite"]).optional().default("any"),
  experience: z.enum(["any", "fresher", "1-3", "3-5", "5-8", "8+"]).optional().default("any"),
  minSalaryLpa: z.number().min(0).max(200).optional().default(0),
  source: z.enum(["all", "Adzuna", "Naukri", "LinkedIn", "Indeed", "Glassdoor"]).optional().default("all"),
  cursor: z.number().min(0).optional().default(0),
  pageSize: z.number().min(5).max(50).optional().default(20),
});

function escapePostgrestFilterValue(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function makeIlikePattern(value: string): string | null {
  const cleaned = value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
  if (!cleaned) return null;
  return escapePostgrestFilterValue(`%${cleaned}%`);
}

export const listJobs = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => ListInput.parse(input))
  .handler(async ({ data }) => {
    const { getServiceClient } = await import("@/lib/jobs.server");
    const supabase = getServiceClient();
    let q = supabase
      .from("jobs")
      .select("*", { count: "exact" })
      .eq("is_active", true);

    if (data.search.trim()) {
      const pattern = makeIlikePattern(data.search);
      if (pattern) q = q.or(`title.ilike.${pattern},description.ilike.${pattern}`);
    }
    if (data.company.trim()) {
      const c = data.company.trim();
      q = q.ilike("company_name", `%${c}%`);
    }
    if (data.location.trim()) {
      const l = data.location.trim();
      q = q.ilike("location", `%${l}%`);
    }
    if (data.workMode === "remote") q = q.eq("is_remote", true);
    if (data.workMode === "onsite") q = q.eq("is_remote", false);
    if (data.minSalaryLpa > 0) {
      q = q.gte("salary_max", data.minSalaryLpa * 100000);
    }
    if (data.source !== "all") {
      q = q.eq("source", data.source);
    }

    const from = data.cursor;
    const to = data.cursor + data.pageSize - 1;
    const { data: rows, count, error } = await q
      .order("created_date", { ascending: false, nullsFirst: false })
      .range(from, to);
    if (error) throw new Error(error.message);

    return {
      jobs: (rows ?? []) as JobRow[],
      total: count ?? 0,
      nextCursor: (rows?.length ?? 0) === data.pageSize ? data.cursor + data.pageSize : null,
    };
  });

export const triggerJobSync = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { syncAllJobs } = await import("@/lib/jobs.server");
    return syncAllJobs();
  });

const SaveInput = z.object({ jobId: z.string().uuid() });

export const saveJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SaveInput.parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("saved_jobs")
      .insert({ user_id: context.userId, job_id: data.jobId });
    if (error && !/duplicate key/i.test(error.message)) throw new Error(error.message);
    return { ok: true };
  });

export const unsaveJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SaveInput.parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("saved_jobs")
      .delete()
      .eq("user_id", context.userId)
      .eq("job_id", data.jobId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listSavedJobs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("saved_jobs")
      .select("job_id, created_at, jobs(*)")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { saved: data ?? [] };
  });

const AppInput = z.object({
  jobId: z.string().uuid(),
  status: z.enum(["applied", "interview", "offer", "rejected"]),
  notes: z.string().max(2000).optional(),
});

export const upsertApplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => AppInput.parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("job_applications")
      .upsert(
        { user_id: context.userId, job_id: data.jobId, status: data.status, notes: data.notes ?? null },
        { onConflict: "user_id,job_id" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listApplications = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("job_applications")
      .select("job_id, status, notes, updated_at, jobs(*)")
      .eq("user_id", context.userId)
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { applications: data ?? [] };
  });

export type ProviderStatus = {
  name: string;
  status: "available" | "missing_credentials" | "not_subscribed" | "error";
  count: number;
};

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

export const getProviderStatus = createServerFn({ method: "POST" })
  .handler(async () => {
    const { getServiceClient } = await import("@/lib/jobs.server");
    const supabase = getServiceClient();

    const { data: rows } = await supabase
      .from("jobs")
      .select("source")
      .eq("is_active", true);
    const dbCounts = (rows ?? []).reduce<Record<string, number>>((acc, r) => {
      acc[r.source] = (acc[r.source] ?? 0) + 1;
      return acc;
    }, {});

    const adzunaId = process.env.ADZUNA_APP_ID;
    const adzunaKey = process.env.ADZUNA_APP_KEY;
    let adzunaStatus: ProviderStatus["status"] = "missing_credentials";
    if (adzunaId && adzunaKey) {
      try {
        const url = `https://api.adzuna.com/v1/api/jobs/in/search/1?app_id=${encodeURIComponent(adzunaId)}&app_key=${encodeURIComponent(adzunaKey)}&results_per_page=1&what=developer&content-type=application/json`;
        const res = await fetch(url, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(5000) });
        adzunaStatus = res.ok ? "available" : "error";
      } catch {
        adzunaStatus = "error";
      }
    }

    const rapidKey = process.env.RAPIDAPI_KEY;
    let jsearchStatus: ProviderStatus["status"] = "missing_credentials";
    if (rapidKey) {
      try {
        const url = `https://jsearch.p.rapidapi.com/search?query=developer%20in%20India&page=1&num_pages=1&country=in&date_posted=month`;
        const res = await fetch(url, {
          headers: {
            "X-RapidAPI-Key": rapidKey,
            "X-RapidAPI-Host": "jsearch.p.rapidapi.com",
          },
          signal: AbortSignal.timeout(5000),
        });
        if (res.ok) {
          jsearchStatus = "available";
        } else {
          const body = await res.text().catch(() => "");
          if (isRapidApiSubscriptionError(res.status, body)) {
            jsearchStatus = "not_subscribed";
          } else {
            jsearchStatus = "error";
          }
        }
      } catch {
        jsearchStatus = "error";
      }
    }

    return {
      providers: [
        { name: "Adzuna", status: adzunaStatus, count: dbCounts["Adzuna"] ?? 0 },
        { name: "Naukri", status: jsearchStatus, count: dbCounts["Naukri"] ?? 0 },
        { name: "LinkedIn", status: jsearchStatus, count: dbCounts["LinkedIn"] ?? 0 },
        { name: "Indeed", status: jsearchStatus, count: dbCounts["Indeed"] ?? 0 },
        { name: "Glassdoor", status: jsearchStatus, count: dbCounts["Glassdoor"] ?? 0 },
      ] as ProviderStatus[],
    };
  });
