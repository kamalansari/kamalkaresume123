import { createFileRoute } from "@tanstack/react-router";
import "@tanstack/react-start";
import { requireAuth } from "@/lib/requireAuth.server";

type Msg = { role: "user" | "assistant"; content: string };

type Body = {
  messages: Msg[];
  job: {
    title?: string;
    company?: string;
    location?: string;
    isRemote?: boolean;
    source?: string;
    skills?: string[];
    description?: string;
    salary?: string;
  };
  resume?: {
    name?: string;
    headline?: string;
    summary?: string;
    skills?: string;
    experience?: { title?: string; company?: string; date?: string; bullets?: string }[];
  };
  match?: {
    score?: number;
    matchedSkills?: string[];
    missingSkills?: string[];
    matchedKeywords?: string[];
    jobLevel?: string;
    resumeLevel?: string;
    seniorityNote?: string;
    titleNote?: string;
  };
};

const SYSTEM = `You are NOVA — an AI career coach helping a candidate evaluate a specific job opportunity.

Your job in this conversation:
1. EXPLAIN THE MATCH — Translate the match-score breakdown into plain English. Call out the 2-3 biggest strengths and the 2-3 biggest gaps for THIS job.
2. TAILOR BULLET POINTS — Rewrite or generate 3-5 achievement-based resume bullets that weave in the job's keywords/skills naturally. Use the format: strong action verb + task + measurable outcome (%, $, time, scale). Never invent employers, dates, metrics, or skills not in the candidate's resume — use realistic placeholders like "[add metric]" when numbers are unknown.
3. POSITIONING ADVICE — Suggest a 1-2 line summary tweak and which existing experience to lead with for this role.
4. HONEST FIT CHECK — If the seniority or core skills are clearly off, say so kindly and suggest what to learn or how to reframe.

RULES:
- Always anchor your advice in the SPECIFIC job (title, company, skills, description) and the candidate's actual resume.
- Use markdown: short paragraphs, **bold** emphasis, bullet lists when listing 3+ items.
- Keep replies under ~220 words unless rewriting bullets.
- When rewriting bullets, return them as a clean markdown list ready to paste.
- If the candidate hasn't added a resume, briefly ask them to add one and offer what you can do once it's available.`;

export const Route = createFileRoute("/api/nova-job-chat")({
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

        const j = body.job ?? {};
        const r = body.resume ?? {};
        const m = body.match ?? {};

        const expText = (r.experience ?? [])
          .slice(0, 5)
          .map(
            (e) =>
              `- ${e.title ?? ""} @ ${e.company ?? ""} (${e.date ?? ""})\n${(e.bullets ?? "")
                .split("\n")
                .map((b) => `  • ${b}`)
                .join("\n")}`,
          )
          .join("\n");

        const ctx = [
          `=== JOB ===`,
          `Title: ${j.title ?? ""}`,
          `Company: ${j.company ?? ""}`,
          `Location: ${j.location ?? ""}${j.isRemote ? " (Remote)" : ""}`,
          `Salary: ${j.salary ?? "Not disclosed"}`,
          `Source: ${j.source ?? ""}`,
          `Key skills (from listing): ${(j.skills ?? []).slice(0, 25).join(", ")}`,
          `Description: ${(j.description ?? "").slice(0, 2000)}`,
          ``,
          `=== CANDIDATE RESUME ===`,
          `Name: ${r.name ?? ""}`,
          `Headline: ${r.headline ?? ""}`,
          `Summary: ${r.summary ?? ""}`,
          `Skills: ${r.skills ?? ""}`,
          `Experience:\n${expText}`,
          ``,
          `=== MATCH BREAKDOWN ===`,
          `Overall score: ${m.score ?? "n/a"}/100`,
          `Matched skills: ${(m.matchedSkills ?? []).slice(0, 20).join(", ")}`,
          `MISSING skills (gaps to address): ${(m.missingSkills ?? []).slice(0, 20).join(", ")}`,
          `Matched keywords from JD: ${(m.matchedKeywords ?? []).slice(0, 20).join(", ")}`,
          `Job seniority: ${m.jobLevel ?? "n/a"} · Candidate seniority: ${m.resumeLevel ?? "n/a"}`,
          `Seniority note: ${m.seniorityNote ?? ""}`,
          `Title alignment: ${m.titleNote ?? ""}`,
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
        if (!res.ok) {
          if (res.status === 429)
            return Response.json({ error: "Nova is busy — please try again in a moment." }, { status: 429 });
          if (res.status === 402)
            return Response.json({ error: "AI credits exhausted. Add credits to continue." }, { status: 402 });
          return new Response(await res.text(), { status: res.status });
        }
        const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
        return Response.json({ reply: data.choices?.[0]?.message?.content?.trim() ?? "" });
      },
    },
  },
});
