export type ReadinessTrack = "resume" | "coding" | "design" | "communication";

export type InterviewAttempt = {
  id: string;
  round: "dsa" | "system_design" | "behavioral";
  score: number; // 0-100
  rubric: { label: string; score: number; note?: string }[];
  question: string;
  answer: string;
  feedback: string;
  createdAt: number;
};

const ATTEMPTS_KEY = "resumeforge.interview-attempts.v1";

function readAttempts(): InterviewAttempt[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(ATTEMPTS_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as InterviewAttempt[];
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}

function writeAttempts(list: InterviewAttempt[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(ATTEMPTS_KEY, JSON.stringify(list.slice(-50)));
}

function avg(nums: number[]): number {
  if (!nums.length) return 0;
  return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length);
}

export const readinessStore = {
  attempts(): InterviewAttempt[] {
    return readAttempts().sort((a, b) => b.createdAt - a.createdAt);
  },
  recordAttempt(a: Omit<InterviewAttempt, "id" | "createdAt">): InterviewAttempt {
    const entry: InterviewAttempt = {
      ...a,
      id: `att_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      createdAt: Date.now(),
    };
    const list = readAttempts();
    list.push(entry);
    writeAttempts(list);
    return entry;
  },
  clear() { writeAttempts([]); },
  /** Aggregate per-track readiness from recorded attempts + a provided resume score. */
  aggregate(resumeScore: number): Record<ReadinessTrack, number> {
    const list = readAttempts();
    const dsa = list.filter(a => a.round === "dsa").map(a => a.score);
    const sys = list.filter(a => a.round === "system_design").map(a => a.score);
    const beh = list.filter(a => a.round === "behavioral").map(a => a.score);
    return {
      resume: resumeScore,
      coding: avg(dsa),
      design: avg(sys),
      communication: avg(beh),
    };
  },
};