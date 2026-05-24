import { createFileRoute } from "@tanstack/react-router";
import "@tanstack/react-start";

type Body = {
  round: "dsa" | "system_design" | "behavioral";
  question: string;
  answer: string;
  role?: string;
};

const RUBRIC: Record<Body["round"], string[]> = {
  dsa: ["Correctness", "Time/space complexity", "Edge cases", "Code clarity", "Communication"],
  system_design: ["Requirements clarity", "High-level design", "Data model & APIs", "Scaling & reliability", "Tradeoffs"],
  behavioral: ["Situation framing", "Concrete actions", "Measurable outcome", "Self-reflection", "Clarity & structure"],
};

export const Route = createFileRoute("/api/interview-score")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const key = process.env.LOVABLE_API_KEY;
        if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });
        const body = (await request.json()) as Body;
        if (!body?.question || !body?.answer || !body?.round) {
          return new Response("Invalid payload", { status: 400 });
        }
        const rubric = RUBRIC[body.round];
        const system = `You are a strict but fair interview evaluator. Score the candidate's answer on this rubric: ${rubric.join(", ")}. Each criterion is 0-20. Return ONLY JSON: {"rubric":[{"label":string,"score":number,"note":string}],"overall":number,"feedback":string}. overall = sum of rubric scores (0-100). feedback is 3-5 sentences, specific and actionable.`;
        const user = `Round: ${body.round}\nRole: ${body.role || "Software Engineer"}\n\nQUESTION:\n${body.question}\n\nCANDIDATE ANSWER:\n${body.answer}`;
        const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { "content-type": "application/json", "Lovable-API-Key": key },
          body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            messages: [
              { role: "system", content: system },
              { role: "user", content: user },
            ],
            response_format: { type: "json_object" },
          }),
        });
        if (!res.ok) return new Response(await res.text(), { status: res.status });
        const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
        const raw = data.choices?.[0]?.message?.content?.trim() ?? "{}";
        let parsed: { rubric?: { label: string; score: number; note?: string }[]; overall?: number; feedback?: string } = {};
        try { parsed = JSON.parse(raw); } catch { /* fallback */ }
        const sum = (parsed.rubric ?? []).reduce((s, r) => s + (Number(r.score) || 0), 0);
        return Response.json({
          rubric: parsed.rubric ?? rubric.map(l => ({ label: l, score: 0 })),
          overall: Math.max(0, Math.min(100, Number(parsed.overall) || sum)),
          feedback: parsed.feedback ?? "",
        });
      },
    },
  },
});