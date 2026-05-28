import { createFileRoute } from "@tanstack/react-router";
import "@tanstack/react-start";

type Body = {
  text: string;
  tone?: "concise" | "impact" | "ats";
  context?: { headline?: string; jobDescription?: string };
};

export const Route = createFileRoute("/api/rewrite-snippet")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const key = process.env.LOVABLE_API_KEY;
        if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });
        const body = (await request.json()) as Body;
        if (!body?.text || typeof body.text !== "string") {
          return new Response("Invalid payload", { status: 400 });
        }
        const ctx = body.context ?? {};
        const userPrompt = [
          ctx.headline ? `Role headline: ${ctx.headline}` : "",
          ctx.jobDescription ? `Target job description:\n${ctx.jobDescription}` : "",
          `Original snippet:\n${body.text}`,
        ].filter(Boolean).join("\n\n");

        const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { "content-type": "application/json", "Lovable-API-Key": key },
          body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            messages: [
              {
                role: "system",
                content:
                  "You rewrite a short resume snippet. Return ONLY the rewritten text — no quotes, no preamble, no markdown. Preserve approximate length. Use strong action verbs, concrete impact, and weave in keywords from the job description when relevant. Do not add or remove bullet glyphs.",
              },
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