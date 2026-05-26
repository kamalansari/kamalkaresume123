import { createFileRoute } from "@tanstack/react-router";
import "@tanstack/react-start";

type Body = { text: string };

const SYSTEM = `You are a resume parser. Given the raw text extracted from a candidate's resume (PDF or DOCX), extract the structured fields and return STRICT JSON only — no markdown, no preamble, no commentary.

Return JSON matching this TypeScript shape (omit keys you cannot determine; do not invent data):
{
  "name": string,
  "headline": string,           // current role / target title, 3-8 words
  "email": string,
  "phone": string,
  "location": string,
  "links": string,              // " · " separated, no protocol prefix
  "summary": string,            // 2-4 sentences, no first person
  "skills": string,             // comma-separated, ordered by relevance
  "experience": { "title": string, "company": string, "date": string, "bullets": string }[],
  "education": { "degree": string, "school": string, "date": string, "field"?: string, "location"?: string, "gpa"?: string, "honors"?: string }[],
  "projects": { "name": string, "link": string, "date": string, "bullets": string }[],
  "certifications": { "name": string, "issuer": string, "date": string }[],
  "awards": { "name": string, "issuer": string, "date": string }[],
  "languages": { "name": string, "level": string }[]
}

Rules:
- For "bullets", put each bullet on its own line, no bullet glyphs.
- For "date" use the original format from the resume (e.g. "Jan 2022 — Present").
- Keep prose concise; preserve the candidate's wording where possible.`;

export const Route = createFileRoute("/api/parse-resume")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const key = process.env.LOVABLE_API_KEY;
        if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });
        const body = (await request.json()) as Body;
        const text = (body?.text ?? "").trim();
        if (!text) return new Response("Missing text", { status: 400 });
        if (text.length > 60000) return new Response("Resume text too large", { status: 413 });

        const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { "content-type": "application/json", "Lovable-API-Key": key },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            response_format: { type: "json_object" },
            messages: [
              { role: "system", content: SYSTEM },
              { role: "user", content: `Resume text:\n\n${text}` },
            ],
          }),
        });
        if (!res.ok) {
          const errText = await res.text();
          return new Response(errText || "AI gateway error", { status: res.status });
        }
        const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
        const raw = data.choices?.[0]?.message?.content?.trim() ?? "{}";
        try {
          return Response.json(JSON.parse(raw));
        } catch {
          return new Response("Bad AI response", { status: 502 });
        }
      },
    },
  },
});