import type { ResumeData } from "./types";

const KEY = "resumeforge.profile.v1";

export type ProfileFields = Pick<
  ResumeData,
  "name" | "headline" | "email" | "phone" | "location" | "links" | "education"
>;

export const PROFILE_KEYS: (keyof ProfileFields)[] = [
  "name", "headline", "email", "phone", "location", "links", "education",
];

export const profileStore = {
  get(): Partial<ProfileFields> | null {
    if (typeof window === "undefined") return null;
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? (JSON.parse(raw) as Partial<ProfileFields>) : null;
    } catch { return null; }
  },
  save(data: ResumeData) {
    if (typeof window === "undefined") return;
    const p: ProfileFields = {
      name: data.name,
      headline: data.headline,
      email: data.email,
      phone: data.phone,
      location: data.location,
      links: data.links,
      education: data.education,
    };
    try { localStorage.setItem(KEY, JSON.stringify(p)); } catch {}
  },
  clear() {
    if (typeof window === "undefined") return;
    try { localStorage.removeItem(KEY); } catch {}
  },
};
