import { createFileRoute } from "@tanstack/react-router";
import "@tanstack/react-start";

type Body = {
  jobDescription: string;
  current: {
    name?: string;
    headline?: string;
    summary?: string;
    skills?: string;
    experience?: { id: string; title: string; company: string; bullets: string }[];
  };
};

const SYSTEM = `You are a resume tailoring engine. Given a job description and the user's current resume content, generate a tailored resume payload.
Return ONLY strict JSON, no markdown, no preamble, matching this TypeScript type:
{
  "headline": string,        // 4-8 words, role-specific
  "summary": string,         // 2-3 sentences, 40-70 words, weave JD keywords, no first person
  "skills": string,          // comma-separated, max 18, ordered by JD relevance
  "experience": { "id": string, "bullets": string }[]  // one entry per input experience id, rewritten bullets, one per line, no glyphs, strong verbs, measurable impact
}
Keep the same experience IDs as in the input. Do not invent experience the user does not have.`;

export const Route = createFileRoute("/api/generate-from-jd")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const key = process.env.LOVABLE_API_KEY;
        if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });
        const body = (await request.json()) as Body;
        if (!body?.jobDescription?.trim()) return new Response("Missing jobDescription", { status: 400 });

        const userPrompt = [
          `Job description:\n${body.jobDescription}`,
          `Current headline: ${body.current.headline ?? ""}`,
          `Current summary: ${body.current.summary ?? ""}`,
          `Current skills: ${body.current.skills ?? ""}`,
          `Current experience (JSON): ${JSON.stringify(body.current.experience ?? [])}`,
        ].join("\n\n");

        const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { "content-type": "application/json", "Lovable-API-Key": key },
          body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            response_format: { type: "json_object" },
            messages: [
              { role: "system", content: SYSTEM },
              { role: "user", content: userPrompt },
            ],
          }),
        });
        if (!res.ok) {
          const text = await res.text();
          return new Response(text || "AI gateway error", { status: res.status });
        }
        const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
        const raw = data.choices?.[0]?.message?.content?.trim() ?? "{}";
        try {
          const parsed = JSON.parse(raw);
          return Response.json(parsed);
        } catch {
          return new Response("Bad AI response", { status: 502 });
        }
      },
    },
  },
});