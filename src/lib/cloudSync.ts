import { supabase } from "@/integrations/supabase/client";
import { resumeStore, type SavedResume } from "@/components/builder/resumeStore";

let currentUserId: string | null = null;
let initialized = false;

export function getCurrentUserId() { return currentUserId; }

async function pullAll(userId: string) {
  const { data, error } = await supabase
    .from("resumes")
    .select("id, name, data, is_primary, updated_at")
    .eq("user_id", userId);
  if (error) { console.error("[cloudSync] pull failed", error); return; }

  const cloud: SavedResume[] = (data ?? []).map(r => ({
    id: r.id,
    name: r.name,
    updatedAt: new Date(r.updated_at).getTime(),
    data: r.data as SavedResume["data"],
  }));

  // Merge cloud into local (cloud wins on conflict by updated_at)
  const local = resumeStore.list();
  const byId = new Map<string, SavedResume>();
  for (const r of local) byId.set(r.id, r);
  for (const r of cloud) {
    const existing = byId.get(r.id);
    if (!existing || existing.updatedAt < r.updatedAt) byId.set(r.id, r);
  }
  // Push local-only items to the cloud
  const cloudIds = new Set(cloud.map(r => r.id));
  for (const r of local) {
    if (!cloudIds.has(r.id)) {
      await pushOne(userId, r, false);
    }
  }
  // Persist merged
  for (const r of byId.values()) resumeStore.upsert(r);

  // Sync primary
  const primaryRow = (data ?? []).find(r => r.is_primary);
  if (primaryRow) resumeStore.setPrimary(primaryRow.id);

  window.dispatchEvent(new Event("resumeforge:refresh"));
}

async function pushOne(userId: string, r: SavedResume, isPrimary: boolean) {
  const { error } = await supabase.from("resumes").upsert({
    id: r.id,
    user_id: userId,
    name: r.name,
    data: r.data as never,
    is_primary: isPrimary,
    updated_at: new Date(r.updatedAt).toISOString(),
  });
  if (error) console.error("[cloudSync] push failed", error);
}

export async function syncUpsert(r: SavedResume) {
  if (!currentUserId) return;
  const primaryId = resumeStore.getPrimaryId();
  await pushOne(currentUserId, r, primaryId === r.id);
}

export async function syncDelete(id: string) {
  if (!currentUserId) return;
  const { error } = await supabase.from("resumes").delete().eq("id", id).eq("user_id", currentUserId);
  if (error) console.error("[cloudSync] delete failed", error);
}

export async function syncSetPrimary(id: string | null) {
  if (!currentUserId) return;
  // Clear all then set one
  await supabase.from("resumes").update({ is_primary: false }).eq("user_id", currentUserId);
  if (id) await supabase.from("resumes").update({ is_primary: true }).eq("user_id", currentUserId).eq("id", id);
}

export function initCloudSync() {
  if (initialized || typeof window === "undefined") return;
  initialized = true;

  supabase.auth.getSession().then(({ data }) => {
    const uid = data.session?.user.id ?? null;
    currentUserId = uid;
    if (uid) pullAll(uid);
  });

  supabase.auth.onAuthStateChange((_event, session) => {
    const uid = session?.user.id ?? null;
    const changed = uid !== currentUserId;
    currentUserId = uid;
    if (uid && changed) pullAll(uid);
    if (!uid) window.dispatchEvent(new Event("resumeforge:refresh"));
  });
}