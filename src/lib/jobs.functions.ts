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
  workMode: z.enum(["any", "remote", "hybrid", "onsite"]).optional().default("any"),
  experience: z.enum(["any", "fresher", "1-3", "3-5", "5-8", "8+"]).optional().default("any"),
  minSalaryLpa: z.number().min(0).max(200).optional().default(0),
  source: z.enum(["all", "Adzuna", "Naukri"]).optional().default("all"),
  cursor: z.number().min(0).optional().default(0),
  pageSize: z.number().min(5).max(50).optional().default(20),
});

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
      const s = data.search.trim();
      q = q.or(`title.ilike.%${s}%,company_name.ilike.%${s}%,description.ilike.%${s}%`);
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
