const BULLET_PREFIX_RE = /^\s*(?:[\u2022•·\-*–—]|\d+[.)])\s*/;

const RESUME_ACTION_VERBS = [
  "Achieved",
  "Analyzed",
  "Architected",
  "Built",
  "Collaborated",
  "Coached",
  "Created",
  "Delivered",
  "Designed",
  "Developed",
  "Directed",
  "Drove",
  "Enabled",
  "Engineered",
  "Established",
  "Executed",
  "Facilitated",
  "Generated",
  "Implemented",
  "Improved",
  "Increased",
  "Launched",
  "Led",
  "Managed",
  "Mentored",
  "Optimized",
  "Owned",
  "Partnered",
  "Reduced",
  "Shipped",
  "Spearheaded",
  "Streamlined",
];

const ACTION_VERB_RE = new RegExp(
  `([.!?])\\s+(?=(${RESUME_ACTION_VERBS.join("|")})\\b)`,
  "g",
);

export function splitBulletLines(input: unknown): string[] {
  if (Array.isArray(input)) {
    return input.flatMap((item) => splitBulletLines(item));
  }

  if (input == null) return [];

  let text = String(input)
    .replace(/<\/li>\s*<li[^>]*>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/\r/g, "\n")
    .replace(/\\n/g, "\n")
    .trim();

  if (!text) return [];

  text = text
    .replace(/\s*[\u2022•]\s*/g, "\n")
    .replace(/\s+(?=\d+[.)]\s+)/g, "\n")
    .replace(/\s+[–—]\s+(?=[A-Z])/g, "\n")
    .replace(ACTION_VERB_RE, "$1\n");

  let lines = text
    .split(/\n+/)
    .map((line) => line.trim().replace(BULLET_PREFIX_RE, "").trim())
    .filter(Boolean);

  if (lines.length <= 1) {
    const sentenceLines = text
      .split(/(?<=[.!?])\s+(?=[A-Z][a-z]+\b)/g)
      .map((line) => line.trim().replace(BULLET_PREFIX_RE, "").trim())
      .filter(Boolean);

    if (sentenceLines.length > lines.length) lines = sentenceLines;
  }

  return lines;
}

export function normalizeBulletText(input: unknown): string {
  return splitBulletLines(input).join("\n");
}