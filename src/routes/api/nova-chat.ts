import { createFileRoute } from "@tanstack/react-router";
import "@tanstack/react-start";

type Body = {
  messages: { role: "user" | "assistant"; content: string }[];
  resume?: { headline?: string; summary?: string; skills?: string };
  jobDescription?: string;
};

const SYSTEM = `You are NOVA, an upbeat career coach. Keep replies under 120 words, concrete, and tailored to the user's resume + target JD. Use short bullet lists when listing more than two items. Never invent employers or dates the user did not state.`;

export const Route = createFileRoute("/api/nova-chat")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const key = process.env.LOVABLE_API_KEY;
        if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });
        const body = (await request.json()) as Body;
        if (!Array.isArray(body.messages) || body.messages.length === 0)
          return new Response("Missing messages", { status: 400 });

        const ctx = `Candidate headline: ${body.resume?.headline ?? ""}\nSkills: ${body.resume?.skills ?? ""}\nSummary: ${body.resume?.summary ?? ""}\nTarget JD: ${(body.jobDescription || "").slice(0, 1500)}`;

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