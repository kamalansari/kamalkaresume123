import { createFileRoute } from "@tanstack/react-router";
import "@tanstack/react-start";

type Body = {
  kind: "summary" | "bullets" | "skills" | "education";
  text: string;
  context?: {
    headline?: string;
    jobDescription?: string;
    title?: string;
    company?: string;
    skills?: string;
  };
};

const SYSTEM: Record<Body["kind"], string> = {
  summary:
    "You rewrite resume summaries. Return ONLY the rewritten summary. 2-3 sentences, 40-70 words, no 'I', strong verbs, concrete impact, ATS-friendly. Weave keywords from the target job description.",
  bullets:
    "You rewrite resume experience bullets. Return ONLY rewritten bullets, one per line, no bullet glyphs, no numbering, no preamble. Each line starts with a strong action verb, includes a measurable outcome (%, $, time, scale) when possible, under 22 words. Keep the same count of bullets as the input. Weave keywords from the target JD when relevant.",
  skills:
    "You normalize a resume skills list. Return ONLY a comma-separated list, deduped, ordered by relevance to the target job description if provided, max 18 items, properly capitalized (e.g. 'TypeScript', 'A/B Testing'). No prose.",
  education:
    "You tighten a resume education entry description. Return ONLY the rewritten text, under 25 words, no preamble.",
};

export const Route = createFileRoute("/api/rewrite-section")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const key = process.env.LOVABLE_API_KEY;
        if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });
        const body = (await request.json()) as Body;
        if (!body?.kind || typeof body.text !== "string") {
          return new Response("Invalid payload", { status: 400 });
        }
        const ctx = body.context ?? {};
        const userPrompt = [
          ctx.headline ? `Role headline: ${ctx.headline}` : "",
          ctx.title || ctx.company ? `Position: ${ctx.title ?? ""} at ${ctx.company ?? ""}` : "",
          ctx.skills ? `Skills: ${ctx.skills}` : "",
          ctx.jobDescription ? `Target job description:\n${ctx.jobDescription}` : "",
          `Original ${body.kind}:\n${body.text}`,
        ].filter(Boolean).join("\n\n");

        const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { "content-type": "application/json", "Lovable-API-Key": key },
          body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            messages: [
              { role: "system", content: SYSTEM[body.kind] },
              { role: "user", content: userPrompt },
            ],
          }),
        });
        if (!res.ok) {
          const text = await res.text();
          return new Response(text || "AI gateway error", { status: res.status });
        }
        const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
        const text = data.choices?.[0]?.message?.content?.trim() ?? "";
        return Response.json({ text });
      },
    },
  },
});