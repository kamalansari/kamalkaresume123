import type { JobRow } from "@/lib/jobs.functions";
import type { ResumeData } from "@/components/builder/types";
import { resumeStore } from "@/components/builder/resumeStore";
import { defaultResume } from "@/components/builder/types";

export type SeniorityLevel = "fresher" | "junior" | "mid" | "senior" | "lead";

export type ResumeProfile = {
  skills: string[];           // normalized lowercase
  titles: string[];           // lowercase job titles
  keywords: Set<string>;      // bag of meaningful tokens from full resume
  years: number;              // estimated total years of experience
  seniority: SeniorityLevel;
};

export type MatchBreakdown = {
  score: number;              // 0..99
  skills: {
    weight: number;           // max points
    earned: number;
    matched: string[];
    missing: string[];        // top job skills not in resume
  };
  keywords: {
    weight: number;
    earned: number;
    matched: string[];        // resume keywords found in description
  };
  seniority: {
    weight: number;
    earned: number;
    jobLevel: SeniorityLevel;
    resumeLevel: SeniorityLevel;
    note: string;
  };
  title: {
    weight: number;
    earned: number;
    matched: boolean;
    note: string;
  };
};

const STOP = new Set([
  "and","the","for","with","you","are","our","your","this","that","from","have","has","will","they","their","its","into","over","per","via","not","but","all","any","can","may","one","two","new","etc","use","using","work","team","role","job","ability","skills","experience","experiences","year","years","strong","good","excellent","plus","across","also","such","including","each","both","other","more","most","preferred","required","based","level","please","apply","client","clients","company","opportunity",
]);

function tokens(text: string): string[] {
  return (text.toLowerCase().match(/[a-z][a-z0-9+.#-]{2,}/g) ?? []).filter(t => !STOP.has(t));
}

function parseYears(dateStr: string): number {
  if (!dateStr) return 0;
  const s = dateStr.toLowerCase();
  const now = new Date().getFullYear();
  const nums = Array.from(s.matchAll(/\b(19|20)\d{2}\b/g)).map(m => parseInt(m[0], 10));
  const hasPresent = /present|current|now|ongoing/.test(s);
  if (nums.length >= 2) return Math.max(0, nums[1] - nums[0]);
  if (nums.length === 1) return Math.max(0, (hasPresent ? now : now) - nums[0]);
  // patterns like "3 years", "2.5 yrs"
  const m = s.match(/(\d+(?:\.\d+)?)\s*(?:\+)?\s*(?:yrs?|years?)/);
  if (m) return parseFloat(m[1]);
  return 0;
}

function levelFromYears(y: number): SeniorityLevel {
  if (y < 1) return "fresher";
  if (y < 3) return "junior";
  if (y < 6) return "mid";
  if (y < 10) return "senior";
  return "lead";
}

function levelFromText(text: string): SeniorityLevel | null {
  const t = text.toLowerCase();
  if (/\b(principal|staff|head of|director|vp\b|lead engineer|engineering manager|tech lead)\b/.test(t)) return "lead";
  if (/\b(sr\.?|senior|sde\s*ii+|sde\s*3)\b/.test(t)) return "senior";
  if (/\b(intern|trainee|fresher|graduate|entry[- ]level|sde\s*0)\b/.test(t)) return "fresher";
  if (/\b(junior|jr\.?|associate|sde\s*i\b|sde\s*1)\b/.test(t)) return "junior";
  if (/\b(mid[- ]level|sde\s*ii\b|sde\s*2)\b/.test(t)) return "mid";
  return null;
}

function levelFromYearReq(text: string): { level: SeniorityLevel; years: number } | null {
  const m = text.toLowerCase().match(/(\d+)\s*(?:\+|plus)?\s*(?:\-\s*\d+\s*)?(?:to\s*\d+\s*)?(?:yrs?|years?)/);
  if (!m) return null;
  const y = parseInt(m[1], 10);
  return { level: levelFromYears(y), years: y };
}

export function buildResumeProfile(resume?: ResumeData): ResumeProfile {
  const r = resume ?? resumeStore.getPrimary()?.data ?? resumeStore.getDraft() ?? defaultResume;
  const rawSkills = typeof r.skills === "string" ? r.skills : "";
  const skills = rawSkills
    .split(/[,|;·\n/]+/)
    .map(s => s.toLowerCase().trim())
    .filter(s => s && s.length > 1);
  const exps = r.experience ?? [];
  const titles = exps.map(e => (e.title ?? "").toLowerCase()).filter(Boolean);
  const years = exps.reduce((sum, e) => sum + parseYears(e.date ?? ""), 0);
  const blob = [
    r.summary ?? "",
    ...exps.flatMap(e => [e.title, e.company, e.bullets]),
    rawSkills,
    r.headline ?? "",
  ].join(" ");
  const keywords = new Set(tokens(blob));
  // Promote seniority by title if it indicates a higher level than years suggest
  let seniority = levelFromYears(years);
  for (const t of titles) {
    const lv = levelFromText(t);
    if (lv && rank(lv) > rank(seniority)) seniority = lv;
  }
  return { skills, titles, keywords, years, seniority };
}

function rank(l: SeniorityLevel): number {
  return { fresher: 0, junior: 1, mid: 2, senior: 3, lead: 4 }[l];
}

const LEVEL_LABEL: Record<SeniorityLevel, string> = {
  fresher: "Fresher",
  junior: "Junior",
  mid: "Mid-level",
  senior: "Senior",
  lead: "Lead / Principal",
};

export function describeLevel(l: SeniorityLevel): string {
  return LEVEL_LABEL[l];
}

function detectJobLevel(job: JobRow): SeniorityLevel {
  const fields = [job.title ?? "", job.description ?? ""].join(" \n ");
  const fromText = levelFromText(fields);
  if (fromText) return fromText;
  const fromYears = levelFromYearReq(fields);
  if (fromYears) return fromYears.level;
  return "mid";
}

const WEIGHTS = { skills: 50, keywords: 20, seniority: 20, title: 10 };

export function scoreJobBreakdown(job: JobRow, profile: ResumeProfile): MatchBreakdown {
  const jobSkills = (job.skills ?? []).map(s => s.toLowerCase());
  const desc = `${job.title ?? ""} ${job.description ?? ""}`.toLowerCase();

  // 1) Skills overlap (explicit tags + skills mentioned in description)
  const resumeSkillSet = new Set(profile.skills);
  const matchedSkills = Array.from(new Set([
    ...jobSkills.filter(s => resumeSkillSet.has(s)),
    ...profile.skills.filter(s => new RegExp(`(^|[^a-z0-9])${escape(s)}([^a-z0-9]|$)`, "i").test(desc)),
  ]));
  const skillUniverse = Math.max(jobSkills.length, 5);
  const skillsEarned = Math.min(WEIGHTS.skills, (matchedSkills.length / skillUniverse) * WEIGHTS.skills);
  const missingSkills = jobSkills.filter(s => !resumeSkillSet.has(s)).slice(0, 6);

  // 2) Keyword overlap from job description vs resume vocabulary
  const jobTokens = new Set(tokens(desc));
  const kwMatched: string[] = [];
  for (const t of jobTokens) {
    if (profile.keywords.has(t) && !matchedSkills.includes(t)) kwMatched.push(t);
  }
  const kwTotal = Math.max(jobTokens.size, 20);
  const kwEarned = Math.min(WEIGHTS.keywords, (kwMatched.length / kwTotal) * WEIGHTS.keywords * 4);

  // 3) Seniority alignment
  const jobLevel = detectJobLevel(job);
  const diff = Math.abs(rank(profile.seniority) - rank(jobLevel));
  const seniorityEarned =
    diff === 0 ? WEIGHTS.seniority :
    diff === 1 ? WEIGHTS.seniority * 0.6 :
    diff === 2 ? WEIGHTS.seniority * 0.2 :
    0;
  const seniorityNote =
    diff === 0 ? "Your seniority matches this role." :
    rank(profile.seniority) < rank(jobLevel)
      ? `Role looks ${diff > 1 ? "much " : ""}more senior than your profile.`
      : `You may be over-qualified by ${diff} level${diff > 1 ? "s" : ""}.`;

  // 4) Title alignment (any of resume titles overlaps job title noun)
  const jobTitleLower = (job.title ?? "").toLowerCase();
  const titleHit = profile.titles.some(t => {
    if (!t) return false;
    const head = t.split(/[,–-]| at /)[0].trim();
    if (!head) return false;
    const first = head.split(/\s+/)[0];
    return jobTitleLower.includes(head) || (first.length > 3 && jobTitleLower.includes(first));
  });
  const titleEarned = titleHit ? WEIGHTS.title : 0;

  const total = skillsEarned + kwEarned + seniorityEarned + titleEarned;
  const score = Math.max(0, Math.min(99, Math.round(total)));

  return {
    score,
    skills: {
      weight: WEIGHTS.skills,
      earned: Math.round(skillsEarned),
      matched: matchedSkills.slice(0, 10),
      missing: missingSkills,
    },
    keywords: {
      weight: WEIGHTS.keywords,
      earned: Math.round(kwEarned),
      matched: kwMatched.slice(0, 10),
    },
    seniority: {
      weight: WEIGHTS.seniority,
      earned: Math.round(seniorityEarned),
      jobLevel,
      resumeLevel: profile.seniority,
      note: seniorityNote,
    },
    title: {
      weight: WEIGHTS.title,
      earned: titleEarned,
      matched: titleHit,
      note: titleHit ? "Your past title aligns with this role." : "No direct title overlap.",
    },
  };
}

function escape(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
