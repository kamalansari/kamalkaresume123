import { createFileRoute } from "@tanstack/react-router";
import "@tanstack/react-start";
import { requireAuth } from "@/lib/requireAuth.server";

type Body = {
  messages: { role: "user" | "assistant"; content: string }[];
  resume?: {
    name?: string;
    headline?: string;
    summary?: string;
    skills?: string;
    experience?: { title?: string; company?: string; date?: string; bullets?: string }[];
    education?: { degree?: string; school?: string; date?: string }[];
  };
  jobDescription?: string;
  missingKeywords?: string[];
  matchedKeywords?: string[];
  atsScore?: number;
  coverage?: number;
};

const SYSTEM = `You are NOVA — an expert AI Resume Assistant and career coach.

You help the candidate with:
1. RESUME REVIEW — Give a focused critique of the resume the user pasted. Call out strengths and the top 3 weaknesses.
2. CONTENT SUGGESTIONS — Recommend concrete edits to summary, headline, and bullets to improve clarity and impact.
3. GRAMMAR & CLARITY — Correct grammar, spelling, tense consistency, and tighten verbose phrasing. Show the corrected version when asked.
4. ATS KEYWORD OPTIMIZATION — Use the provided missing keywords and JD context. Suggest where in the resume to naturally weave them in. Never keyword-stuff.
5. ACHIEVEMENT-BASED BULLETS — Rewrite or generate bullets in the format: Strong action verb + task + measurable outcome (%, $, time, scale). Avoid responsibilities; focus on impact.
6. RECRUITER-FOCUSED RECOMMENDATIONS — Explain what recruiters and hiring managers in the target role look for, common red flags, and how to position the candidate.

RULES:
- Be concrete and tailored to the candidate's actual resume + JD. Never invent employers, titles, dates, metrics, or skills the user did not provide. Use realistic placeholders like "[add metric]" when numbers are unknown.
- Use markdown: short paragraphs, **bold** for emphasis, and bullet lists (- ) when listing 3+ items. Keep replies under ~200 words unless rewriting a section.
- When rewriting bullets, return them as a clean markdown bullet list ready to paste.
- When the user asks for grammar fixes, show "Before" and "After" succinctly.
- If the resume or JD context is empty, briefly ask the user to add it and offer 2–3 things you can do once it's available.`;

export const Route = createFileRoute("/api/nova-chat")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const auth = await requireAuth(request);
        if (auth instanceof Response) return auth;
        const key = process.env.LOVABLE_API_KEY;
        if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });
        const body = (await request.json()) as Body;
        if (!Array.isArray(body.messages) || body.messages.length === 0)
          return new Response("Missing messages", { status: 400 });

        const r = body.resume ?? {};
        const expText = (r.experience ?? [])
          .slice(0, 5)
          .map(e => `- ${e.title ?? ""} @ ${e.company ?? ""} (${e.date ?? ""})\n${(e.bullets ?? "").split("\n").map(b => `  • ${b}`).join("\n")}`)
          .join("\n");
        const eduText = (r.education ?? [])
          .slice(0, 3)
          .map(e => `- ${e.degree ?? ""} @ ${e.school ?? ""} (${e.date ?? ""})`)
          .join("\n");
        const ctx = [
          `Candidate name: ${r.name ?? ""}`,
          `Headline: ${r.headline ?? ""}`,
          `Summary: ${r.summary ?? ""}`,
          `Skills: ${r.skills ?? ""}`,
          `Experience:\n${expText}`,
          `Education:\n${eduText}`,
          `Target JD: ${(body.jobDescription || "").slice(0, 1800)}`,
          `ATS score: ${body.atsScore ?? "n/a"}/100`,
          `JD coverage: ${body.coverage != null ? Math.round(body.coverage * 100) + "%" : "n/a"}`,
          `Matched keywords: ${(body.matchedKeywords ?? []).slice(0, 25).join(", ")}`,
          `MISSING keywords (prioritize weaving these in): ${(body.missingKeywords ?? []).slice(0, 25).join(", ")}`,
        ].join("\n");

        const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { "content-type": "application/json", "Lovable-API-Key": key },
          body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            messages: [
              { role: "system", content: SYSTEM },
              { role: "system", content: ctx },
              ...body.messages,
            ],
          }),
        });
        if (!res.ok) return new Response(await res.text(), { status: res.status });
        const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
        return Response.json({ reply: data.choices?.[0]?.message?.content?.trim() ?? "" });
      },
    },
  },
});