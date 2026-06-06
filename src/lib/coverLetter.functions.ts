import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const Input = z.object({
  resumeText: z.string().min(20).max(20000),
  jobDescription: z.string().min(20).max(20000),
  jobTitle: z.string().max(200).optional().default(""),
  company: z.string().max(200).optional().default(""),
  hiringManager: z.string().max(200).optional().default(""),
  tone: z.enum(["professional", "friendly", "enthusiastic", "concise", "confident"]).optional().default("professional"),
  length: z.enum(["short", "medium", "long"]).optional().default("medium"),
});

const VariationsInput = z.object({
  resumeText: z.string().min(20).max(20000),
  jobDescription: z.string().min(20).max(20000),
  jobTitle: z.string().max(200).optional().default(""),
  company: z.string().max(200).optional().default(""),
  hiringManager: z.string().max(200).optional().default(""),
  length: z.enum(["short", "medium", "long"]).optional().default("medium"),
});

async function callAiForLetter(data: z.infer<typeof Input>): Promise<string> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("AI service is not configured.");

  const lengthHint =
    data.length === "short" ? "around 180-220 words, 3 short paragraphs" :
    data.length === "long" ? "around 400-500 words, 4-5 paragraphs" :
    "around 280-340 words, 3-4 paragraphs";

  const system = `You are an expert career coach who writes tailored, human-sounding cover letters.
Rules:
- Use ONLY facts present in the candidate's resume. Never invent employers, degrees, metrics, or skills.
- Mirror keywords and requirements from the job description where the resume genuinely supports them.
- Avoid clichés ("hardworking team player", "I am writing to apply"). Open with a concrete hook.
- No markdown, no bullet lists, no headers. Plain prose paragraphs only.
- Do not include the date or postal addresses. Start with the greeting line.
- End with "Sincerely," on its own line, then the candidate's name on the next line.
- Tone: ${data.tone}. Length: ${lengthHint}.`;

  const user = `JOB TITLE: ${data.jobTitle || "(not provided)"}
COMPANY: ${data.company || "(not provided)"}
HIRING MANAGER: ${data.hiringManager || "(unknown — use 'Dear Hiring Manager,')"}

=== JOB DESCRIPTION ===
${data.jobDescription}

=== CANDIDATE RESUME ===
${data.resumeText}

Write the cover letter now.`;

  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });

  if (resp.status === 429) {
    throw new Error("Rate limit reached. Please try again in a minute.");
  }
  if (resp.status === 402) {
    throw new Error("AI credits exhausted. Add credits in your workspace settings.");
  }
  if (!resp.ok) {
    const t = await resp.text().catch(() => "");
    console.error("AI gateway error", resp.status, t);
    throw new Error("Failed to generate cover letter.");
  }

  const json = await resp.json();
  const content: string = json?.choices?.[0]?.message?.content ?? "";
  if (!content.trim()) throw new Error("Empty response from AI.");
  return content.trim();
}

export const generateCoverLetter = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data }) => {
    const letter = await callAiForLetter(data);
    return { letter };
  });

export const generateCoverLetterVariations = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => VariationsInput.parse(input))
  .handler(async ({ data }) => {
    const tones: Array<"professional" | "friendly" | "confident"> = ["professional", "friendly", "confident"];
    const results = await Promise.all(
      tones.map(async (tone) => {
        try {
          const letter = await callAiForLetter({ ...data, tone });
          return { tone, letter };
        } catch (err) {
          console.error(`Failed to generate ${tone} variation:`, err);
          return { tone, letter: "", error: err instanceof Error ? err.message : "Failed" };
        }
      })
    );
    return { variations: results };
  });
