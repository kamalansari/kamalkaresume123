import type { ResumeData } from "./types";

const KEY_LEGACY = "resumeforge.profile.v1";
const KEY = "resumeforge.profiles.v1";

export type ProfileFields = Pick<
  ResumeData,
  "name" | "headline" | "email" | "phone" | "location" | "links" | "education"
>;

export const PROFILE_KEYS: (keyof ProfileFields)[] = [
  "name", "headline", "email", "phone", "location", "links", "education",
];

export type Profile = { id: string; name: string; fields: ProfileFields };
type Store = { activeId: string | null; profiles: Profile[] };

function newId() { return Math.random().toString(36).slice(2, 10); }

function emptyFields(): ProfileFields {
  return { name: "", headline: "", email: "", phone: "", location: "", links: "", education: [] };
}

function read(): Store {
  if (typeof window === "undefined") return { activeId: null, profiles: [] };
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Store;
      if (parsed && Array.isArray(parsed.profiles)) return parsed;
    }
    // Migrate legacy single-profile blob (resumeforge.profile.v1)
    const legacyRaw = localStorage.getItem(KEY_LEGACY);
    if (legacyRaw) {
      const legacy = JSON.parse(legacyRaw) as Partial<ProfileFields>;
      const id = newId();
      const store: Store = {
        activeId: id,
        profiles: [{ id, name: legacy.name?.toString().trim() || "Default", fields: { ...emptyFields(), ...legacy } }],
      };
      try { localStorage.setItem(KEY, JSON.stringify(store)); } catch {}
      return store;
    }
  } catch {}
  return { activeId: null, profiles: [] };
}

function write(store: Store) {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(KEY, JSON.stringify(store)); } catch {}
}

function pickFields(data: Partial<ResumeData>): ProfileFields {
  return {
    name: data.name ?? "",
    headline: data.headline ?? "",
    email: data.email ?? "",
    phone: data.phone ?? "",
    location: data.location ?? "",
    links: data.links ?? "",
    education: data.education ?? [],
  };
}

export const profileStore = {
  // ---- Multi-profile API ----
  list(): Profile[] {
    return read().profiles;
  },
  getActiveId(): string | null {
    return read().activeId;
  },
  getActive(): Profile | null {
    const s = read();
    return s.profiles.find(p => p.id === s.activeId) ?? null;
  },
  setActive(id: string | null) {
    const s = read();
    write({ ...s, activeId: id });
  },
  create(name: string, fields?: Partial<ProfileFields>): Profile {
    const s = read();
    const id = newId();
    const profile: Profile = {
      id,
      name: name.trim() || "Untitled profile",
      fields: { ...emptyFields(), ...(fields ?? {}) },
    };
    write({ activeId: id, profiles: [...s.profiles, profile] });
    return profile;
  },
  rename(id: string, name: string) {
    const s = read();
    write({
      ...s,
      profiles: s.profiles.map(p => p.id === id ? { ...p, name: name.trim() || p.name } : p),
    });
  },
  remove(id: string) {
    const s = read();
    const profiles = s.profiles.filter(p => p.id !== id);
    const activeId = s.activeId === id ? (profiles[0]?.id ?? null) : s.activeId;
    write({ activeId, profiles });
  },
  updateActive(data: Partial<ResumeData>) {
    const s = read();
    if (!s.activeId) return;
    const fields = pickFields(data);
    write({
      ...s,
      profiles: s.profiles.map(p => p.id === s.activeId ? { ...p, fields } : p),
    });
  },

  // ---- Legacy single-profile API (operates on the active profile) ----
  get(): Partial<ProfileFields> | null {
    const active = profileStore.getActive();
    return active ? active.fields : null;
  },
  save(data: ResumeData) {
    const s = read();
    if (!s.activeId) {
      // First save creates a default profile so the contract still works
      profileStore.create(data.name?.trim() || "Default", pickFields(data));
      return;
    }
    profileStore.updateActive(data);
  },
  clear() {
    const s = read();
    if (!s.activeId) return;
    write({
      ...s,
      profiles: s.profiles.map(p => p.id === s.activeId ? { ...p, fields: emptyFields() } : p),
    });
  },
};
