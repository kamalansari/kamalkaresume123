import { createFileRoute } from "@tanstack/react-router";
import "@tanstack/react-start";
import { requireAuth } from "@/lib/requireAuth.server";

type Body = {
  round: "dsa" | "system_design" | "behavioral";
  role: string;
  level?: string;
  difficulty?: "easy" | "medium" | "hard";
  previousQuestions?: string[];
};

const SYSTEM: Record<Body["round"], string> = {
  dsa: "You are a senior coding interviewer. Generate ONE clear data-structures-and-algorithms problem appropriate for the target role/level/difficulty. Include: title, problem statement, input/output format, 1 small example, and 1-2 hints. Plain text, no markdown headings. <= 220 words. Avoid problems already listed in 'previousQuestions'.",
  system_design: "You are a senior system-design interviewer. Generate ONE realistic system-design prompt for the target role/level. Include: scenario, scale assumptions, 4-6 specific things the candidate must address (data model, APIs, scaling, reliability, tradeoffs). Plain text, no markdown headings. <= 220 words. Avoid topics already in 'previousQuestions'.",
  behavioral: "You are a senior hiring manager. Generate ONE behavioral question tailored to the role/level. Add 3 short STAR probes the candidate should cover. Plain text, no markdown headings. <= 140 words. Avoid prompts already in 'previousQuestions'.",
};

export const Route = createFileRoute("/api/interview-question")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const auth = await requireAuth(request);
        if (auth instanceof Response) return auth;
        const key = process.env.LOVABLE_API_KEY;
        if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });
        const body = (await request.json()) as Body;
        if (!body?.round) return new Response("Invalid payload", { status: 400 });
        const user = [
          `Role: ${body.role || "Software Engineer"}`,
          `Level: ${body.level || "mid"}`,
          `Difficulty: ${body.difficulty || "medium"}`,
          body.previousQuestions?.length ? `previousQuestions:\n- ${body.previousQuestions.slice(-5).join("\n- ")}` : "",
        ].filter(Boolean).join("\n");
        const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { "content-type": "application/json", "Lovable-API-Key": key },
          body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            messages: [
              { role: "system", content: SYSTEM[body.round] },
              { role: "user", content: user },
            ],
          }),
        });
        if (!res.ok) return new Response(await res.text(), { status: res.status });
        const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
        return Response.json({ question: data.choices?.[0]?.message?.content?.trim() ?? "" });
      },
    },
  },
});