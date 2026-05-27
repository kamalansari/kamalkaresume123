import { defaultResume, type ResumeData } from "./types";
import { syncUpsert, syncDelete, syncSetPrimary } from "@/lib/cloudSync";

const KEY = "resumeforge.saved.v1";
const PRIMARY_KEY = "resumeforge.primary.v1";
const DRAFT_KEY = "resumeforge.draft.v1";
const BACKUP_KEY = "resumeforge.saved.backup.v1";
const EMPTY_CONFIRMED_KEY = "resumeforge.saved.empty-confirmed.v1";
const LEGACY_KEYS = ["resumeforge.resumes.v1", "resumeforge.savedResumes.v1"];

export type SavedResume = {
  id: string;
  name: string;
  updatedAt: number;
  data: ResumeData;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseStored(raw: string | null): unknown {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function deriveName(data: ResumeData, fallback = "Recovered draft") {
  const name = data.name?.trim();
  if (name && name !== defaultResume.name) return `${name}'s resume`;
  const headline = data.headline?.trim();
  if (headline && headline !== defaultResume.headline) return headline;
  return fallback;
}

function looksLikeResumeData(value: Record<string, unknown>) {
  return "summary" in value || "experience" in value || "skills" in value || "headline" in value;
}

function normalizeEntry(value: unknown): SavedResume | null {
  if (!isRecord(value)) return null;
  const rawData = isRecord(value.data) ? value.data : looksLikeResumeData(value) ? value : null;
  if (!rawData) return null;
  const data = { ...defaultResume, ...(rawData as Partial<ResumeData>) };
  const id = typeof value.id === "string" && value.id.trim() ? value.id : newId();
  const name =
    isRecord(value.data) && typeof value.name === "string" && value.name.trim()
      ? value.name.trim()
      : deriveName(data, "Untitled resume");
  const rawUpdatedAt = value.updatedAt ?? value.updated_at;
  const updatedAt =
    typeof rawUpdatedAt === "number"
      ? rawUpdatedAt
      : typeof rawUpdatedAt === "string"
        ? new Date(rawUpdatedAt).getTime()
        : Date.now();
  return { id, name, updatedAt: Number.isFinite(updatedAt) ? updatedAt : Date.now(), data };
}

function compactList(list: SavedResume[]) {
  const byId = new Map<string, SavedResume>();
  for (const item of list) {
    const existing = byId.get(item.id);
    if (!existing || existing.updatedAt <= item.updatedAt) byId.set(item.id, item);
  }
  return Array.from(byId.values());
}

function readListFromKey(key: string): SavedResume[] {
  if (typeof window === "undefined") return [];
  const parsed = parseStored(localStorage.getItem(key));
  const rawList = Array.isArray(parsed)
    ? parsed
    : isRecord(parsed) && Array.isArray(parsed.resumes)
      ? parsed.resumes
      : isRecord(parsed)
        ? Object.values(parsed)
        : [];
  return compactList(
    rawList.map(normalizeEntry).filter((entry): entry is SavedResume => Boolean(entry)),
  );
}

function hasMeaningfulResumeData(data: ResumeData) {
  const merged = { ...defaultResume, ...data };
  const textKeys: Array<keyof ResumeData> = [
    "name",
    "headline",
    "email",
    "phone",
    "location",
    "links",
    "summary",
    "skills",
    "jobDescription",
    "extraKeywords",
  ];
  if (
    textKeys.some(
      (key) =>
        String(merged[key] ?? "").trim() &&
        String(merged[key] ?? "").trim() !== String(defaultResume[key] ?? "").trim(),
    )
  )
    return true;
  const arrayKeys: Array<keyof ResumeData> = [
    "experience",
    "education",
    "projects",
    "certifications",
    "awards",
    "languages",
  ];
  return arrayKeys.some(
    (key) => JSON.stringify(merged[key] ?? []) !== JSON.stringify(defaultResume[key] ?? []),
  );
}

function recoverList(list: SavedResume[]) {
  const recovered = compactList(list);
  write(recovered);
  for (const entry of recovered) void syncUpsert(entry);
  return recovered;
}

function recoverDraftIfNeeded(): SavedResume[] {
  if (typeof window === "undefined" || localStorage.getItem(EMPTY_CONFIRMED_KEY) === "1") return [];
  const draft = readDraft();
  if (!draft || !hasMeaningfulResumeData(draft)) return [];
  const entry: SavedResume = {
    id: newId(),
    name: deriveName({ ...defaultResume, ...draft }),
    updatedAt: Date.now(),
    data: { ...defaultResume, ...draft },
  };
  return recoverList([entry]);
}

function read(): SavedResume[] {
  if (typeof window === "undefined") return [];
  const current = readListFromKey(KEY);
  if (current.length > 0) return current;
  if (localStorage.getItem(EMPTY_CONFIRMED_KEY) === "1") return [];
  const backup = readListFromKey(BACKUP_KEY);
  if (backup.length > 0) return recoverList(backup);
  for (const legacyKey of LEGACY_KEYS) {
    const legacy = readListFromKey(legacyKey);
    if (legacy.length > 0) return recoverList(legacy);
  }
  return recoverDraftIfNeeded();
}

function write(list: SavedResume[]) {
  if (typeof window === "undefined") return;
  const safeList = compactList(list);
  localStorage.setItem(KEY, JSON.stringify(safeList));
  if (safeList.length > 0) {
    localStorage.setItem(BACKUP_KEY, JSON.stringify(safeList));
    localStorage.removeItem(EMPTY_CONFIRMED_KEY);
  } else {
    localStorage.setItem(EMPTY_CONFIRMED_KEY, "1");
  }
}

function readDraft(): ResumeData | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? (JSON.parse(raw) as ResumeData) : null;
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
  try {
    return localStorage.getItem(PRIMARY_KEY);
  } catch {
    return null;
  }
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
    return read().find((r) => r.id === id);
  },
  upsert(entry: SavedResume) {
    const list = read();
    const idx = list.findIndex((r) => r.id === entry.id);
    if (idx >= 0) list[idx] = entry;
    else list.push(entry);
    write(list);
    void syncUpsert(entry);
  },
  remove(id: string) {
    write(read().filter((r) => r.id !== id));
    if (readPrimary() === id) writePrimary(null);
    void syncDelete(id);
  },
  rename(id: string, name: string) {
    const list = read();
    const item = list.find((r) => r.id === id);
    if (!item) return;
    item.name = name;
    item.updatedAt = Date.now();
    write(list);
    void syncUpsert(item);
  },
  duplicate(id: string, name?: string): SavedResume | undefined {
    const list = read();
    const item = list.find((r) => r.id === id);
    if (!item) return undefined;
    const copy: SavedResume = {
      id: newId(),
      name: (name && name.trim()) || `${item.name} (copy)`,
      updatedAt: Date.now(),
      data: JSON.parse(JSON.stringify(item.data)),
    };
    list.push(copy);
    write(list);
    void syncUpsert(copy);
    return copy;
  },
  getPrimaryId(): string | null {
    return readPrimary();
  },
  getPrimary(): SavedResume | undefined {
    const id = readPrimary();
    return id ? read().find((r) => r.id === id) : undefined;
  },
  setPrimary(id: string | null) {
    writePrimary(id);
    void syncSetPrimary(id);
  },
  getDraft(): ResumeData | null {
    return readDraft();
  },
  saveDraft(data: ResumeData) {
    writeDraft(data);
  },
};

export function newId() {
  return `r_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}
