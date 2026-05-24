export type TargetBrief = {
  role: string;
  level: "fresher" | "junior" | "mid" | "senior" | "lead";
  location: string;
  salaryMin: number; // LPA
  salaryMax: number;
  timelineWeeks: number;
  focus: string; // free text — companies, stack, notes
  updatedAt: number;
};

const KEY = "resumeforge.target-brief.v1";

export const defaultBrief: TargetBrief = {
  role: "",
  level: "mid",
  location: "",
  salaryMin: 8,
  salaryMax: 20,
  timelineWeeks: 8,
  focus: "",
  updatedAt: 0,
};

export const targetBriefStore = {
  get(): TargetBrief {
    if (typeof window === "undefined") return defaultBrief;
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return defaultBrief;
      return { ...defaultBrief, ...(JSON.parse(raw) as TargetBrief) };
    } catch { return defaultBrief; }
  },
  save(brief: TargetBrief) {
    if (typeof window === "undefined") return;
    localStorage.setItem(KEY, JSON.stringify({ ...brief, updatedAt: Date.now() }));
  },
};