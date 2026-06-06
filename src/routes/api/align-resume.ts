import { createFileRoute } from "@tanstack/react-router";
import "@tanstack/react-start";
import { requireAuth } from "@/lib/requireAuth.server";

type Body = {
  jobDescription: string;
  resume: {
    name?: string;
    headline?: string;
    summary?: string;
    skills?: string;
    experience?: { title?: string; company?: string; date?: string; bullets?: string }[];
  };
};

const SYSTEM = `You are a senior resume editor. Given a target job description and a candidate resume, rewrite the resume so it is tightly aligned to the JD while staying truthful (do NOT invent companies, titles, or fake metrics — only rephrase and reorder what's present).

Return ONLY a JSON object with this exact shape, no markdown:
{
  "headline": string,                           // <= 70 chars
  "summary": string,                            // 2-3 sentences, 40-70 words, ATS keywords woven in
  "skills": string,                             // see SKILLS FORMAT below
  "experience": [{ "title": string, "company": string, "date": string, "bullets": string }],
  "keywordsAdded": string[],                    // JD keywords now reflected in the rewrite
  "gaps": string[]                              // JD requirements the candidate appears to lack
}

SKILLS FORMAT (critical):
- If the candidate's input "skills" already uses categories (lines like "Category: a, b, c"), PRESERVE that categorized structure. Keep the same category names. Only reorder/refine items within each category by JD relevance, and drop items unsupported by the resume.
- If the input is a flat list and the JD clearly suggests groupings (e.g. Languages, Frameworks, Tools, Cloud, Databases, Soft Skills), return categorized output: one category per line, "Category: item1, item2, item3".
- Otherwise return a single comma-separated line, ordered by JD relevance.
- Max 24 items total across all categories. Use "\\n" between category lines.

The "experience" array MUST have the same length and same {title, company, date} as the input — only "bullets" may change. Each bullet line starts with a strong verb, includes a metric when input had one, under 22 words. Separate bullets with \\n.`;

export const Route = createFileRoute("/api/align-resume")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const auth = await requireAuth(request);
        if (auth instanceof Response) return auth;
        const key = process.env.LOVABLE_API_KEY;
        if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });
        const body = (await request.json()) as Body;
        if (!body?.jobDescription || !body?.resume) {
          return new Response("Invalid payload", { status: 400 });
        }
        const user = `TARGET JOB DESCRIPTION:\n${body.jobDescription}\n\nCANDIDATE RESUME (JSON):\n${JSON.stringify(body.resume, null, 2)}`;
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
        if (!res.ok) {
          const text = await res.text();
          return new Response(text || "AI gateway error", { status: res.status });
        }
        const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
        const raw = data.choices?.[0]?.message?.content?.trim() ?? "{}";
        let parsed: unknown = {};
        try { parsed = JSON.parse(raw); } catch { /* leave empty */ }
        return Response.json(parsed);
      },
    },
  },
});