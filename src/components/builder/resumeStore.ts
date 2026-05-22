import type { ResumeData } from "./types";

const KEY = "resumeforge.saved.v1";
const PRIMARY_KEY = "resumeforge.primary.v1";
const DRAFT_KEY = "resumeforge.draft.v1";

export type SavedResume = {
  id: string;
  name: string;
  updatedAt: number;
  data: ResumeData;
};

function read(): SavedResume[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SavedResume[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function write(list: SavedResume[]) {
  localStorage.setItem(KEY, JSON.stringify(list));
}

function readDraft(): ResumeData | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? JSON.parse(raw) as ResumeData : null;
  } catch {
    return null;
  }
}

function writeDraft(data: ResumeData) {
  if (typeof window === "undefined") return;
  localStorage.setItem(DRAFT_KEY, JSON.stringify(data));
}

function readPrimary(): string | null {
  if (typeof window === "undefined") return null;
  try { return localStorage.getItem(PRIMARY_KEY); } catch { return null; }
}
function writePrimary(id: string | null) {
  if (id) localStorage.setItem(PRIMARY_KEY, id);
  else localStorage.removeItem(PRIMARY_KEY);
}

export const resumeStore = {
  list(): SavedResume[] {
    return read().sort((a, b) => b.updatedAt - a.updatedAt);
  },
  get(id: string): SavedResume | undefined {
    return read().find(r => r.id === id);
  },
  upsert(entry: SavedResume) {
    const list = read();
    const idx = list.findIndex(r => r.id === entry.id);
    if (idx >= 0) list[idx] = entry; else list.push(entry);
    write(list);
  },
  remove(id: string) {
    write(read().filter(r => r.id !== id));
    if (readPrimary() === id) writePrimary(null);
  },
  rename(id: string, name: string) {
    const list = read();
    const item = list.find(r => r.id === id);
    if (!item) return;
    item.name = name;
    item.updatedAt = Date.now();
    write(list);
  },
  duplicate(id: string): SavedResume | undefined {
    const list = read();
    const item = list.find(r => r.id === id);
    if (!item) return undefined;
    const copy: SavedResume = {
      id: newId(),
      name: `${item.name} (copy)`,
      updatedAt: Date.now(),
      data: JSON.parse(JSON.stringify(item.data)),
    };
    list.push(copy);
    write(list);
    return copy;
  },
  getPrimaryId(): string | null { return readPrimary(); },
  getPrimary(): SavedResume | undefined {
    const id = readPrimary();
    return id ? read().find(r => r.id === id) : undefined;
  },
  setPrimary(id: string | null) { writePrimary(id); },
  getDraft(): ResumeData | null { return readDraft(); },
  saveDraft(data: ResumeData) { writeDraft(data); },
};

export function newId() {
  return `r_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}