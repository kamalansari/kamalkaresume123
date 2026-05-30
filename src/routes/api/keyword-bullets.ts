import { createFileRoute } from "@tanstack/react-router";
import "@tanstack/react-start";
import { requireAuth } from "@/lib/requireAuth.server";

type Body = {
  keywords: string[];
  jobTitle?: string;
  headline?: string;
  jobDescription?: string;
  experience?: { title: string; company: string }[];
};

const SYSTEM = `You write ATS-friendly resume bullet points.
Given a list of missing keywords and the candidate context, return ONLY strict JSON:
{"bullets": ["...", "..."]}
Rules: 3-5 bullets, each starts with a strong action verb, weaves in 1-2 target keywords naturally, includes a measurable outcome where possible. No markdown, no numbering, no leading bullet character.`;

export const Route = createFileRoute("/api/keyword-bullets")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const auth = await requireAuth(request);
        if (auth instanceof Response) return auth;
        const key = process.env.LOVABLE_API_KEY;
        if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });
        const body = (await request.json()) as Body;
        if (!Array.isArray(body.keywords) || body.keywords.length === 0)
          return new Response("Missing keywords", { status: 400 });

        const user = [
          `Target keywords: ${body.keywords.join(", ")}`,
          `Job title: ${body.jobTitle || body.headline || ""}`,
          `JD excerpt: ${(body.jobDescription || "").slice(0, 1200)}`,
          `Recent roles: ${(body.experience || []).slice(0, 3).map(e => `${e.title} @ ${e.company}`).join("; ")}`,
        ].join("\n");

        const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { "content-type": "application/json", "Lovable-API-Key": key },
          body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            response_format: { type: "json_object" },
            messages: [
              { role: "system", content: SYSTEM },
              { role: "user", content: user },
            ],
          }),
        });
        if (!res.ok) return new Response(await res.text(), { status: res.status });
        const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
        const raw = data.choices?.[0]?.message?.content?.trim() ?? "{}";
        try { return Response.json(JSON.parse(raw)); }
        catch { return new Response("Bad AI response", { status: 502 }); }
      },
    },
  },
});