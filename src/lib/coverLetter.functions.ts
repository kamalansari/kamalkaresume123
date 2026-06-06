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

export interface LetterResult {
  letter: string;
  matches: string[];
}

function extractJson(text: string): { letter?: string; matches?: unknown } | null {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```$/i, "").trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(trimmed.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

async function callAiForLetter(data: z.infer<typeof Input>): Promise<LetterResult> {
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
- The letter body must be plain prose paragraphs only — no markdown, no bullet lists, no headers.
- Do not include the date or postal addresses. Start with the greeting line.
- End with "Sincerely," on its own line, then the candidate's name on the next line.
- Tone: ${data.tone}. Length: ${lengthHint}.

Respond with a single JSON object only — no prose before or after, no markdown fences. Shape:
{
  "letter": "<the full cover letter as plain text with \\n line breaks>",
  "matches": [
    "<Resume section name> — <one short sentence on which detail mapped to which job requirement>",
    ...
  ]
}
Rules for "matches":
- 3 to 5 concise bullets, each under 22 words.
- Start every bullet with the resume section actually used (e.g. "Experience", "Summary", "Skills", "Projects", "Education", "Certifications", "Headline").
- Reference a specific resume detail (role, project, skill, metric) AND the job requirement it satisfies.
- Do NOT list sections that were not actually used.`;

  const user = `JOB TITLE: ${data.jobTitle || "(not provided)"}
COMPANY: ${data.company || "(not provided)"}
HIRING MANAGER: ${data.hiringManager || "(unknown — use 'Dear Hiring Manager,')"}

=== JOB DESCRIPTION ===
${data.jobDescription}

=== CANDIDATE RESUME ===
${data.resumeText}

Return the JSON object now.`;

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

  const parsed = extractJson(content);
  const letter = typeof parsed?.letter === "string" ? parsed.letter.trim() : "";
  const matches = Array.isArray(parsed?.matches)
    ? (parsed!.matches as unknown[]).filter((m): m is string => typeof m === "string" && m.trim().length > 0).map((m) => m.trim())
    : [];

  if (!letter) {
    // Fallback: model didn't follow JSON contract — use raw content as letter, no matches.
    return { letter: content.trim(), matches: [] };
  }
  return { letter, matches };
}

export const generateCoverLetter = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data }) => {
    const result = await callAiForLetter(data);
    return result;
  });

export const generateCoverLetterVariations = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => VariationsInput.parse(input))
  .handler(async ({ data }) => {
    const tones: Array<"professional" | "friendly" | "confident"> = ["professional", "friendly", "confident"];
    const results = await Promise.all(
      tones.map(async (tone) => {
        try {
          const { letter, matches } = await callAiForLetter({ ...data, tone });
          return { tone, letter, matches };
        } catch (err) {
          console.error(`Failed to generate ${tone} variation:`, err);
          return { tone, letter: "", matches: [], error: err instanceof Error ? err.message : "Failed" };
        }
      })
    );
    return { variations: results };
  });
