import { createFileRoute } from "@tanstack/react-router";
import "@tanstack/react-start";

type Body = {
  jd: string;
  jobTitle: string;
  resume: { headline?: string; summary?: string; skills?: string };
  question?: string;
};

const SYSTEM_DEFAULT = `You are "Nova", a concise career coach. Given a job listing and the user's resume snapshot, return:
- 3-5 bullet tips to improve the application
- Exact ATS keywords from the JD to add to the resume
Return ONLY JSON: { "tips": string[], "keywords": string[] }`;

const SYSTEM_QUESTION = `You are "Nova", a concise career coach. The user has asked a SPECIFIC question about a job listing and their resume.
Answer the question directly in 3-5 short bullet tips (each <= 22 words, actionable). Then list ATS keywords from the JD relevant to the answer.
Return ONLY JSON: { "tips": string[], "keywords": string[] }`;

export const Route = createFileRoute("/api/job-tip")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const key = process.env.LOVABLE_API_KEY;
        if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });
        const body = (await request.json()) as Body;
        if (!body?.jd?.trim()) return new Response("Missing jd", { status: 400 });

        const q = body.question?.trim();
        const user = [
          q ? `User question: ${q}` : null,
          `Job title: ${body.jobTitle}`,
          `Job description:\n${body.jd}`,
          `Resume headline: ${body.resume.headline ?? ""}`,
          `Resume summary: ${body.resume.summary ?? ""}`,
          `Resume skills: ${body.resume.skills ?? ""}`,
        ].filter(Boolean).join("\n\n");

        const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { "content-type": "application/json", "Lovable-API-Key": key },
          body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            response_format: { type: "json_object" },
            messages: [
              { role: "system", content: q ? SYSTEM_QUESTION : SYSTEM_DEFAULT },
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