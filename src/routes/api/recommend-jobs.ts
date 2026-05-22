import { createFileRoute } from "@tanstack/react-router";
import "@tanstack/react-start";

type Body = {
  jobTitle: string;
  experience?: string;
  location?: string;
  industry?: string;
  roleCategory?: string;
  datePosted?: string;
  keywords?: string;
  resume?: { headline?: string; skills?: string; summary?: string };
};

const SYSTEM = `You generate realistic but synthetic job listing previews that match the user's filters.
Return ONLY strict JSON, no markdown, matching:
{
  "jobs": [
    {
      "id": string,
      "title": string,
      "company": string,
      "location": string,
      "experience": string,        // e.g. "2-5 years"
      "salary": string,            // e.g. "₹8-15 LPA" or "Not disclosed"
      "postedAgo": string,         // e.g. "1 week ago"
      "tags": string[],            // 3-5 short skill/keyword tags
      "jd": string                 // 5-8 sentence job description used for ATS scoring
    }
  ]
}
Generate 6 plausible Indian-market listings unless the location implies otherwise. Mark this is sample data; do NOT claim they are real openings.`;

export const Route = createFileRoute("/api/recommend-jobs")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const key = process.env.LOVABLE_API_KEY;
        if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });
        const body = (await request.json()) as Body;
        if (!body?.jobTitle?.trim()) return new Response("Missing jobTitle", { status: 400 });

        const user = [
          `Job title: ${body.jobTitle}`,
          `Experience: ${body.experience || "any"}`,
          `Location: ${body.location || "any"}`,
          `Industry: ${body.industry || "any"}`,
          `Role category: ${body.roleCategory || "any"}`,
          `Date posted: ${body.datePosted || "any"}`,
          `Keywords: ${body.keywords || ""}`,
          `Resume headline: ${body.resume?.headline ?? ""}`,
          `Resume skills: ${body.resume?.skills ?? ""}`,
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