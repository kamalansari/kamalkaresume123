import { createFileRoute } from "@tanstack/react-router";

// Public cron endpoint. Invoked by pg_cron every 6 hours with the project anon
// key in the `apikey` header. This refreshes the jobs cache from Adzuna.
export const Route = createFileRoute("/api/public/hooks/fetch-jobs")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = request.headers.get("apikey") ?? "";
        const expected = process.env.SUPABASE_PUBLISHABLE_KEY ?? "";
        if (!expected || apiKey !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }
        const { syncAdzunaJobs } = await import("@/lib/jobs.server");
        const result = await syncAdzunaJobs();
        return Response.json({ ok: true, ...result });
      },
    },
  },
});
