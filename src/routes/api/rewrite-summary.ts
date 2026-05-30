import { createFileRoute } from "@tanstack/react-router";
import "@tanstack/react-start";
import { requireAuth } from "@/lib/requireAuth.server";

type Body = {
  summary?: string;
  headline?: string;
  jobDescription?: string;
  experience?: { title?: string; company?: string; bullets?: string }[];
  skills?: string;
};

export const Route = createFileRoute("/api/rewrite-summary")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const auth = await requireAuth(request);
        if (auth instanceof Response) return auth;
        const key = process.env.LOVABLE_API_KEY;
        if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        const body = (await request.json()) as Body;
        const expBlock = (body.experience ?? [])
          .slice(0, 4)
          .map((e) => `- ${e.title ?? ""} at ${e.company ?? ""}: ${e.bullets ?? ""}`)
          .join("\n");

        const userPrompt = [
          `Role headline: ${body.headline ?? ""}`,
          `Skills: ${body.skills ?? ""}`,
          `Recent experience:\n${expBlock}`,
          body.jobDescription ? `Target job description:\n${body.jobDescription}` : "",
          body.summary ? `Current summary (rewrite, don't merely paraphrase):\n${body.summary}` : "",
        ]
          .filter(Boolean)
          .join("\n\n");

        const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "Lovable-API-Key": key,
          },
          body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            messages: [
              {
                role: "system",
                content:
                  "You rewrite resume professional summaries. Return ONLY the rewritten summary (no preamble, no quotes, no markdown). 2-3 sentences, 40-70 words, first-person implied (no 'I'), strong action verbs, concrete impact, ATS-friendly, weave in keywords from the target job description when provided.",
              },
              { role: "user", content: userPrompt },
            ],
          }),
        });

        if (!res.ok) {
          const text = await res.text();
          return new Response(text || "AI gateway error", { status: res.status });
        }
        const data = (await res.json()) as {
          choices?: { message?: { content?: string } }[];
        };
        const summary = data.choices?.[0]?.message?.content?.trim() ?? "";
        return Response.json({ summary });
      },
    },
  },
});