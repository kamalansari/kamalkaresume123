import { createFileRoute } from "@tanstack/react-router";
import "@tanstack/react-start";
import { requireAuth } from "@/lib/requireAuth.server";

type Body = {
  text?: string;
  imageDataUrl?: string; // data:image/<type>;base64,...
};

const SYSTEM = `You are a job-description parser. You are given a job description, either as plain text or as an image (job posting screenshot). Your job is to:
1. Faithfully transcribe the FULL job description text. Preserve paragraph and bullet structure using newlines and "- " for bullets. Do NOT summarize or shorten.
2. Extract structured metadata from it.

Return STRICT JSON only (no markdown, no preamble) matching:
{
  "text": string,                 // full extracted JD text, preserving structure
  "skills": string[],             // hard + soft skills explicitly mentioned, deduped, max 25
  "experience": string,           // years/level requirement, e.g. "5+ years" or "Mid-level (3-5 yrs)". Empty string if not stated.
  "location": string,             // location / remote policy, e.g. "Remote (US)", "London, UK (hybrid)". Empty if not stated.
  "industry": string,             // industry / domain in <= 4 words, e.g. "FinTech", "Healthcare SaaS". Empty if unclear.
  "keywords": string[]            // 8-15 ATS-relevant keywords (tools, methodologies, certifications, role-specific terms)
}

If the image is too low quality / blank / not a job description, return {"text":"", "skills":[], "experience":"", "location":"", "industry":"", "keywords":[]}.`;

export const Route = createFileRoute("/api/extract-jd")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const auth = await requireAuth(request);
        if (auth instanceof Response) return auth;
        const key = process.env.LOVABLE_API_KEY;
        if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        const body = (await request.json()) as Body;
        const hasText = typeof body?.text === "string" && body.text.trim().length > 0;
        const hasImage = typeof body?.imageDataUrl === "string" && body.imageDataUrl.startsWith("data:image/");
        if (!hasText && !hasImage) return new Response("Provide text or imageDataUrl", { status: 400 });
        if (hasText && (body.text!.length > 60000)) return new Response("Text too large", { status: 413 });
        if (hasImage && body.imageDataUrl!.length > 8_000_000) return new Response("Image too large (max ~6MB)", { status: 413 });

        const userContent: unknown = hasImage
          ? [
              { type: "text", text: "Extract and structure the job description in this image." },
              { type: "image_url", image_url: { url: body.imageDataUrl } },
            ]
          : `Job description text:\n\n${body.text}`;

        const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { "content-type": "application/json", "Lovable-API-Key": key },
          body: JSON.stringify({
            model: hasImage ? "google/gemini-2.5-flash" : "google/gemini-2.5-flash",
            response_format: { type: "json_object" },
            messages: [
              { role: "system", content: SYSTEM },
              { role: "user", content: userContent },
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
