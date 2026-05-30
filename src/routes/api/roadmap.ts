import { createFileRoute } from "@tanstack/react-router";
import "@tanstack/react-start";
import { requireAuth } from "@/lib/requireAuth.server";

type Body = {
  role: string;
  level: string;
  timelineWeeks: number;
  focus?: string;
  readiness: { resume: number; coding: number; design: number; communication: number };
  gaps?: string[];
};

const SYSTEM = `You are a career-prep coach. Given a target role, level, timeline, current readiness scores, and known gaps, produce a focused week-by-week preparation plan.
Return ONLY JSON: {"weeks":[{"week":number,"theme":string,"goals":string[],"actions":string[],"deliverable":string}],"dailyHabits":string[]}.
- Number of weeks MUST equal timelineWeeks (cap 16).
- goals: 2-3 outcomes. actions: 3-5 specific tasks. deliverable: a single concrete artifact at week end.
- Prioritize tracks with the lowest readiness scores. Tie actions to gaps when provided.
- dailyHabits: 3-4 short repeatable habits.
Be specific and time-boxed; no fluff.`;

export const Route = createFileRoute("/api/roadmap")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const auth = await requireAuth(request);
        if (auth instanceof Response) return auth;
        const key = process.env.LOVABLE_API_KEY;
        if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });
        const body = (await request.json()) as Body;
        if (!body?.role || !body?.timelineWeeks) return new Response("Invalid payload", { status: 400 });
        const user = JSON.stringify(body, null, 2);
        const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { "content-type": "application/json", "Lovable-API-Key": key },
          body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            messages: [
              { role: "system", content: SYSTEM },
              { role: "user", content: user },
            ],
            response_format: { type: "json_object" },
          }),
        });
        if (!res.ok) return new Response(await res.text(), { status: res.status });
        const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
        const raw = data.choices?.[0]?.message?.content?.trim() ?? "{}";
        let parsed: unknown = {};
        try { parsed = JSON.parse(raw); } catch { /* */ }
        return Response.json(parsed);
      },
    },
  },
});