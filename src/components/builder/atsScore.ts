import type { ResumeData } from "./types";
import { parseSkills } from "@/lib/parseSkills";

const STOP = new Set([
  "the","a","an","and","or","of","to","in","for","on","with","at","by","from","is","are","be","as","that","this","it","you","we","our","your","their","they","will","have","has","had","not","but","if","than","then","into","over","per","via","up","down","out","about","across","also","more","most","such","including","including:","each","both","any","all","other","its","etc","using","use","used","high","low","new","work","working","strong","ability","able","experience","experiences","skills","skill","preferred","required","plus","years","year"
]);

function tokens(text: string): string[] {
  return (text.toLowerCase().match(/[a-z][a-z0-9+.#-]{1,}/g) || []).filter(t => !STOP.has(t) && t.length > 2);
}

export type ScoreResult = {
  score: number;
  checks: { label: string; pass: boolean; weight: number; hint?: string }[];
  matched: string[];
  missing: string[];
  coverage: number;
  keywordStats: { keyword: string; resume: number; jd: number; matched: boolean }[];
};

export function computeScore(r: ResumeData): ScoreResult {
  const resumeText = [
    r.name, r.headline, r.email, r.phone, r.location, r.summary,
    ...r.experience.flatMap(e => [e.title, e.company, e.bullets]),
    ...r.education.flatMap(e => [e.degree, e.school]),
    r.skills,
    ...(r.projects ?? []).flatMap(p => [p.name, p.bullets]),
    ...(r.certifications ?? []).flatMap(c => [c.name, c.issuer]),
    ...(r.awards ?? []).flatMap(a => [a.name, a.issuer]),
    ...(r.languages ?? []).map(l => l.name),
    r.extraKeywords ?? "",
  ].join(" \n ");
  const resumeTokens = new Set(tokens(resumeText));

  const jdTokens = Array.from(new Set(tokens(r.jobDescription))).slice(0, 60);
  const matched = jdTokens.filter(t => resumeTokens.has(t));
  const missing = jdTokens.filter(t => !resumeTokens.has(t));
  const coverage = jdTokens.length ? matched.length / jdTokens.length : 0;

  const totalBullets = r.experience.reduce((n, e) => n + e.bullets.split("\n").filter(Boolean).length, 0);
  const hasNumbers = /\d/.test(r.experience.map(e => e.bullets).join(" "));
  const wordCount = resumeText.split(/\s+/).filter(Boolean).length;
  const actionVerbs = /\b(led|built|shipped|launched|designed|drove|grew|reduced|improved|owned|managed|created|delivered|scaled|architected|implemented|optimized)\b/i;

  const checks = [
    { label: "Contact info present", pass: !!(r.email && r.phone), weight: 10, hint: "Add email and phone." },
    { label: "Professional summary", pass: r.summary.trim().split(/\s+/).length >= 20, weight: 10, hint: "Write at least 20 words." },
    { label: "Has measurable impact (numbers)", pass: hasNumbers, weight: 15, hint: "Quantify outcomes with %, $, or counts." },
    { label: "Strong action verbs", pass: actionVerbs.test(r.experience.map(e => e.bullets).join(" ")), weight: 10, hint: "Start bullets with verbs like Led, Built, Shipped." },
    { label: "3+ experience bullets", pass: totalBullets >= 3, weight: 10, hint: "Add at least 3 accomplishment bullets." },
    { label: "Skills section", pass: parseSkills(r.skills).length >= 5, weight: 10, hint: "List at least 5 relevant skills." },
    { label: "Concise length (250–800 words)", pass: wordCount >= 250 && wordCount <= 800, weight: 10, hint: `Current: ${wordCount} words.` },
    { label: "Job description match ≥ 60%", pass: r.jobDescription ? coverage >= 0.6 : false, weight: 25, hint: r.jobDescription ? `Match: ${(coverage * 100).toFixed(0)}%` : "Paste a job description to score keyword match." },
  ];

  const score = Math.min(100, Math.round(checks.reduce((s, c) => s + (c.pass ? c.weight : 0), 0)));

  // Per-keyword counts in resume vs JD
  const resumeTokensList = tokens(resumeText);
  const jdTokensList = tokens(r.jobDescription);
  const countIn = (arr: string[], k: string) => arr.filter(t => t === k).length;
  const keywordStats = jdTokens.map(k => ({
    keyword: k,
    resume: countIn(resumeTokensList, k),
    jd: countIn(jdTokensList, k),
    matched: resumeTokens.has(k),
  })).sort((a, b) => Number(a.matched) - Number(b.matched) || b.jd - a.jd);

  return { score, checks, matched, missing, coverage, keywordStats };
}