import type { ResumeData } from "./types";
import { parseSkills } from "@/lib/parseSkills";

const STOP = new Set([
  "the","a","an","and","or","of","to","in","for","on","with","at","by","from","is","are","be","as","that","this","it","you","we","our","your","their","they","will","have","has","had","not","but","if","than","then","into","over","per","via","up","down","out","about","across","also","more","most","such","including","including:","each","both","any","all","other","its","etc","using","use","used","high","low","new","work","working","strong","ability","able","experience","experiences","skills","skill","preferred","required","plus","years","year"
]);

const toText = (value: unknown) => typeof value === "string" ? value : value == null ? "" : String(value);
const toList = <T,>(value: T[] | undefined | null): T[] => Array.isArray(value) ? value : [];

// --- Lightweight stemming (Porter-ish: strip common suffixes) ---
function stem(word: string): string {
  let w = word.toLowerCase();
  if (w.length <= 3) return w;
  // Preserve tech tokens with symbols (c++, c#, node.js, ci/cd-ish)
  if (/[+#./]/.test(w)) return w;
  const suffixes = ["ization", "izations", "ational", "ization", "fulness", "ousness", "iveness",
    "tional", "ement", "ments", "ement", "ness", "able", "ible", "ings", "ing", "edly", "ed",
    "ies", "ied", "ier", "iest", "ly", "es", "s"];
  for (const suf of suffixes) {
    if (w.length - suf.length >= 3 && w.endsWith(suf)) {
      w = w.slice(0, -suf.length);
      break;
    }
  }
  // Normalize common endings: develope -> develop, manag -> manag (ok)
  if (w.endsWith("e") && w.length > 4) w = w.slice(0, -1);
  // Collapse double consonant: running -> runn -> run
  if (w.length > 3 && w[w.length - 1] === w[w.length - 2] && !/[aeiou]/.test(w[w.length - 1])) {
    w = w.slice(0, -1);
  }
  return w;
}

// --- Synonym groups: any term in a group counts as a match for the others ---
const SYNONYM_GROUPS: string[][] = [
  ["js", "javascript", "ecmascript"],
  ["ts", "typescript"],
  ["py", "python"],
  ["node", "nodejs", "node.js"],
  ["react", "reactjs", "react.js"],
  ["next", "nextjs", "next.js"],
  ["vue", "vuejs", "vue.js"],
  ["angular", "angularjs"],
  ["postgres", "postgresql", "psql"],
  ["mongo", "mongodb"],
  ["k8s", "kubernetes"],
  ["aws", "amazon-web-services", "amazon"],
  ["gcp", "google-cloud"],
  ["ci", "cd", "ci/cd", "continuous-integration", "continuous-delivery", "continuous-deployment"],
  ["ml", "machine-learning"],
  ["ai", "artificial-intelligence"],
  ["nlp", "natural-language-processing"],
  ["db", "database", "databases"],
  ["ui", "user-interface", "frontend", "front-end"],
  ["ux", "user-experience"],
  ["backend", "back-end", "server-side"],
  ["fullstack", "full-stack"],
  ["rest", "restful", "rest-api"],
  ["api", "apis"],
  ["devops", "sre", "site-reliability"],
  ["agile", "scrum", "kanban"],
  ["lead", "led", "leading", "leadership"],
  ["manage", "managed", "managing", "management"],
  ["develop", "developed", "developing", "developer", "development"],
  ["build", "built", "building", "builder"],
  ["design", "designed", "designing", "designer"],
  ["test", "tested", "testing", "qa", "quality-assurance"],
  ["deploy", "deployed", "deployment", "deployments"],
  ["optimize", "optimise", "optimized", "optimization", "optimisation"],
  ["analyze", "analyse", "analyzed", "analysis", "analytics", "analytical"],
  ["communicate", "communication", "communicator"],
  ["collaborate", "collaboration", "collaborative", "teamwork"],
  ["customer", "client", "stakeholder"],
  ["docker", "containers", "containerization", "containerisation"],
  ["git", "github", "gitlab", "version-control"],
  ["sql", "queries", "querying"],
  ["nosql", "non-relational"],
  ["html", "html5", "markup"],
  ["css", "css3", "styling"],
  ["tailwind", "tailwindcss"],
  ["graphql", "gql"],
  ["microservice", "microservices"],
  ["scale", "scaled", "scaling", "scalable", "scalability"],
];

// Map every term (and its stem) -> canonical synonym key
const SYNONYM_INDEX = new Map<string, string>();
for (const group of SYNONYM_GROUPS) {
  const canon = group[0];
  for (const term of group) {
    SYNONYM_INDEX.set(term, canon);
    SYNONYM_INDEX.set(stem(term), canon);
  }
}

/** Normalize a single token to a canonical form for matching. */
export function canonical(token: string): string {
  const lower = token.toLowerCase();
  return SYNONYM_INDEX.get(lower) ?? SYNONYM_INDEX.get(stem(lower)) ?? stem(lower);
}

function tokens(text: unknown): string[] {
  return (toText(text).toLowerCase().match(/[a-z][a-z0-9+.#-]{1,}/g) || []).filter(t => !STOP.has(t) && t.length > 2);
}

/** Canonical-form keyword set extracted from a job description, suitable for
 *  auto-highlighting matches in resume body text. */
export function jdKeywordSet(jd: unknown): Set<string> {
  return new Set(tokens(jd).map(canonical));
}

/** Common ATS / resume power-words that get auto-bolded in the preview even
 *  when no job description is provided. Kept intentionally generic so it
 *  helps any role without skewing toward a specific domain. */
const COMMON_ATS_KEYWORDS = [
  // impact / leadership verbs
  "led","managed","built","designed","developed","launched","shipped","drove",
  "delivered","owned","created","implemented","architected","optimized",
  "improved","reduced","increased","grew","scaled","automated","streamlined",
  "spearheaded","mentored","coordinated","executed","achieved","established",
  // outcomes / business
  "revenue","growth","performance","efficiency","productivity","roi","kpi",
  "stakeholders","strategy","roadmap","cross-functional","collaboration",
  "leadership","ownership","impact","results",
  // generic tech / process
  "api","apis","rest","sql","cloud","aws","gcp","azure","docker","kubernetes",
  "ci","cd","agile","scrum","testing","analytics","data","metrics",
  "automation","integration","deployment","architecture","frontend","backend",
  "fullstack","microservices","devops","security",
];

export const COMMON_ATS_KEYWORD_SET: Set<string> = new Set(
  COMMON_ATS_KEYWORDS.map(canonical),
);

/** True if `word` (as it appears in resume text) matches a JD keyword. */
export function isJdKeyword(word: string, set: Set<string>): boolean {
  const lower = word.toLowerCase();
  if (lower.length <= 2 || STOP.has(lower)) return false;
  return set.has(canonical(lower));
}

/** Tokenize + canonicalize for stemming/synonym-aware matching. */
function canonTokens(text: unknown): string[] {
  return tokens(text).map(canonical);
}

export type ScoreResult = {
  score: number;
  checks: { label: string; pass: boolean; weight: number; hint?: string }[];
  matched: string[];
  missing: string[];
  coverage: number;
  keywordStats: { keyword: string; resume: number; jd: number; matched: boolean }[];
};

export function computeScore(r: Partial<ResumeData>): ScoreResult {
  const experience = toList(r.experience);
  const education = toList(r.education);
  const resumeText = [
    r.name, r.headline, r.email, r.phone, r.location, r.summary,
    ...experience.flatMap(e => [e.title, e.company, e.bullets]),
    ...education.flatMap(e => [e.degree, e.school]),
    r.skills,
    ...toList(r.projects).flatMap(p => [p.name, p.bullets]),
    ...toList(r.certifications).flatMap(c => [c.name, c.issuer]),
    ...toList(r.awards).flatMap(a => [a.name, a.issuer]),
    ...toList(r.languages).map(l => l.name),
    r.extraKeywords ?? "",
  ].join(" \n ");
  const resumeTokensRaw = tokens(resumeText);
  const resumeCanonSet = new Set(resumeTokensRaw.map(canonical));

  const jobDescription = toText(r.jobDescription);
  // Deduplicate JD keywords by canonical form, but keep the original display token.
  const jdRaw = tokens(jobDescription);
  const seenCanon = new Set<string>();
  const jdTokens: string[] = [];
  for (const t of jdRaw) {
    const c = canonical(t);
    if (seenCanon.has(c)) continue;
    seenCanon.add(c);
    jdTokens.push(t);
    if (jdTokens.length >= 60) break;
  }
  const isMatch = (t: string) => resumeCanonSet.has(canonical(t));
  const matched = jdTokens.filter(isMatch);
  const missing = jdTokens.filter(t => !isMatch(t));
  let coverage = jdTokens.length ? matched.length / jdTokens.length : 0;
  // Fallback when no JD is pasted: score the resume against a generic
  // ATS keyword set so users still see a meaningful number.
  if (!jdTokens.length) {
    const common = Array.from(COMMON_ATS_KEYWORD_SET);
    const hit = common.filter(c => resumeCanonSet.has(c)).length;
    coverage = common.length ? hit / common.length : 0;
  }

  const experienceBullets = experience.map(e => toText(e.bullets)).join(" ");
  const totalBullets = experience.reduce((n, e) => n + toText(e.bullets).split("\n").filter(Boolean).length, 0);
  const hasNumbers = /\d/.test(experienceBullets);
  const wordCount = resumeText.split(/\s+/).filter(Boolean).length;
  const actionVerbs = /\b(led|built|shipped|launched|designed|drove|grew|reduced|improved|owned|managed|created|delivered|scaled|architected|implemented|optimized)\b/i;
  const keywordScore = Math.round(Math.min(1, coverage) * 25);

  const checks = [
    { label: "Contact info present", pass: !!(r.email && r.phone), weight: 10, hint: "Add email and phone." },
    { label: "Professional summary", pass: toText(r.summary).trim().split(/\s+/).filter(Boolean).length >= 20, weight: 10, hint: "Write at least 20 words." },
    { label: "Has measurable impact (numbers)", pass: hasNumbers, weight: 15, hint: "Quantify outcomes with %, $, or counts." },
    { label: "Strong action verbs", pass: actionVerbs.test(experienceBullets), weight: 10, hint: "Start bullets with verbs like Led, Built, Shipped." },
    { label: "3+ experience bullets", pass: totalBullets >= 3, weight: 10, hint: "Add at least 3 accomplishment bullets." },
    { label: "Skills section", pass: parseSkills(toText(r.skills)).length >= 5, weight: 10, hint: "List at least 5 relevant skills." },
    { label: "Concise length (250–800 words)", pass: wordCount >= 250 && wordCount <= 800, weight: 10, hint: `Current: ${wordCount} words.` },
    { label: `Job keyword match (${keywordScore}/25)`, pass: keywordScore > 0, weight: keywordScore, hint: jdTokens.length ? `Match: ${(coverage * 100).toFixed(0)}%` : "Add a job description to score keyword match." },
  ];

  const score = Math.min(100, Math.round(checks.reduce((s, c) => s + (c.pass ? c.weight : 0), 0)));

  // Per-keyword counts in resume vs JD (compared by canonical form so
  // "managing" in the JD counts hits from "managed" in the resume).
  const resumeCanonList = resumeTokensRaw.map(canonical);
  const jdCanonList = canonTokens(jobDescription);
  const countIn = (arr: string[], k: string) => arr.filter(t => t === k).length;
  const keywordStats = jdTokens.map(k => {
    const c = canonical(k);
    return {
      keyword: k,
      resume: countIn(resumeCanonList, c),
      jd: countIn(jdCanonList, c),
      matched: resumeCanonSet.has(c),
    };
  }).sort((a, b) => Number(a.matched) - Number(b.matched) || b.jd - a.jd);

  return { score, checks, matched, missing, coverage, keywordStats };
}