import type { ResumeData } from "./types";

const KEY = "resumeforge.history.v1";
const MAX_PER_RESUME = 30;

export type HistorySnapshot = {
  id: string;
  resumeId: string;
  at: number;
  label: string;
  data: ResumeData;
};

type Store = Record<string, HistorySnapshot[]>;

function read(): Store {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as Store) : {};
  } catch {
    return {};
  }
}

function write(store: Store) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    // Storage quota — drop oldest globally and retry once.
    try {
      const trimmed: Store = {};
      for (const [k, v] of Object.entries(store)) trimmed[k] = v.slice(0, 10);
      localStorage.setItem(KEY, JSON.stringify(trimmed));
    } catch {
      /* give up */
    }
  }
}

function snapshotId() {
  return `h_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

export const historyStore = {
  list(resumeId: string): HistorySnapshot[] {
    if (!resumeId) return [];
    const all = read()[resumeId] ?? [];
    return [...all].sort((a, b) => b.at - a.at);
  },
  push(resumeId: string, data: ResumeData, label: string): HistorySnapshot | null {
    if (!resumeId) return null;
    const store = read();
    const list = store[resumeId] ?? [];
    // Skip if identical to most recent snapshot.
    const lastSnap = list[list.length - 1];
    try {
      if (lastSnap && JSON.stringify(lastSnap.data) === JSON.stringify(data)) {
        return lastSnap;
      }
    } catch {
      /* fall through */
    }
    const snap: HistorySnapshot = {
      id: snapshotId(),
      resumeId,
      at: Date.now(),
      label: label || "Saved",
      data: JSON.parse(JSON.stringify(data)),
    };
    const next = [...list, snap].slice(-MAX_PER_RESUME);
    store[resumeId] = next;
    write(store);
    return snap;
  },
  remove(resumeId: string, snapshotIdToRemove: string) {
    const store = read();
    const list = store[resumeId] ?? [];
    store[resumeId] = list.filter((s) => s.id !== snapshotIdToRemove);
    write(store);
  },
  clear(resumeId: string) {
    const store = read();
    delete store[resumeId];
    write(store);
  },
};
