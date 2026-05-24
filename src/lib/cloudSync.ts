import { supabase } from "@/integrations/supabase/client";
import { resumeStore, type SavedResume } from "@/components/builder/resumeStore";

let currentUserId: string | null = null;
let initialized = false;
let suppressPush = false;
let realtimeChannel: ReturnType<typeof supabase.channel> | null = null;

export function isSyncSuppressed() { return suppressPush; }

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

  // Merge by id, last-write-wins on updatedAt. Push back whichever side is newer.
  const local = resumeStore.list();
  const localById: Record<string, SavedResume> = {};
  for (const r of local) localById[r.id] = r;
  const cloudById: Record<string, SavedResume> = {};
  for (const r of cloud) cloudById[r.id] = r;
  const allIds = Array.from(new Set([...Object.keys(localById), ...Object.keys(cloudById)]));

  const merged: Record<string, SavedResume> = {};
  const pushBack: SavedResume[] = [];
  const primaryCloudId = (data ?? []).find(r => r.is_primary)?.id ?? null;

  for (const id of allIds) {
    const l = localById[id];
    const c = cloudById[id];
    if (l && c) {
      if (l.updatedAt > c.updatedAt) {
        merged[id] = l;
        pushBack.push(l);
      } else if (c.updatedAt > l.updatedAt) {
        merged[id] = c;
      } else {
        merged[id] = c;
      }
    } else if (c) {
      merged[id] = c;
    } else if (l) {
      merged[id] = l;
      pushBack.push(l);
    }
  }

  suppressPush = true;
  try {
    for (const r of Object.values(merged)) resumeStore.upsert(r);
    if (primaryCloudId && merged[primaryCloudId]) {
      resumeStore.setPrimary(primaryCloudId);
    }
  } finally { suppressPush = false; }

  // Push the locally-newer (or local-only) entries back to the cloud
  for (const r of pushBack) {
    await pushOne(userId, r, primaryCloudId === r.id);
  }

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
  if (!currentUserId || suppressPush) return;
  const primaryId = resumeStore.getPrimaryId();
  await pushOne(currentUserId, r, primaryId === r.id);
}

export async function syncDelete(id: string) {
  if (!currentUserId || suppressPush) return;
  const { error } = await supabase.from("resumes").delete().eq("id", id).eq("user_id", currentUserId);
  if (error) console.error("[cloudSync] delete failed", error);
}

export async function syncSetPrimary(id: string | null) {
  if (!currentUserId || suppressPush) return;
  // Clear all then set one
  await supabase.from("resumes").update({ is_primary: false }).eq("user_id", currentUserId);
  if (id) await supabase.from("resumes").update({ is_primary: true }).eq("user_id", currentUserId).eq("id", id);
}

function subscribeRealtime(userId: string) {
  if (realtimeChannel) {
    supabase.removeChannel(realtimeChannel);
    realtimeChannel = null;
  }
  realtimeChannel = supabase
    .channel(`resumes:${userId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "resumes", filter: `user_id=eq.${userId}` },
      (payload) => {
        // A change came in from another device — reconcile.
        suppressPush = true;
        try {
          if (payload.eventType === "DELETE") {
            const id = (payload.old as { id?: string })?.id;
            if (id) resumeStore.remove(id);
          } else {
            const row = payload.new as {
              id: string; name: string; data: SavedResume["data"];
              updated_at: string; is_primary: boolean;
            };
            const incoming: SavedResume = {
              id: row.id,
              name: row.name,
              data: row.data,
              updatedAt: new Date(row.updated_at).getTime(),
            };
            const existing = resumeStore.get(incoming.id);
            // Last-write-wins: only adopt if remote is newer (or new)
            if (!existing || existing.updatedAt < incoming.updatedAt) {
              resumeStore.upsert(incoming);
            }
            if (row.is_primary) resumeStore.setPrimary(row.id);
          }
        } finally { suppressPush = false; }
        window.dispatchEvent(new Event("resumeforge:refresh"));
      },
    )
    .subscribe();
}

function unsubscribeRealtime() {
  if (realtimeChannel) {
    supabase.removeChannel(realtimeChannel);
    realtimeChannel = null;
  }
}

export function initCloudSync() {
  if (initialized || typeof window === "undefined") return;
  initialized = true;

  supabase.auth.getSession().then(({ data }) => {
    const uid = data.session?.user.id ?? null;
    currentUserId = uid;
    if (uid) {
      pullAll(uid).then(() => subscribeRealtime(uid));
    }
  });

  supabase.auth.onAuthStateChange((_event, session) => {
    const uid = session?.user.id ?? null;
    const changed = uid !== currentUserId;
    currentUserId = uid;
    if (uid && changed) {
      pullAll(uid).then(() => subscribeRealtime(uid));
    }
    if (!uid) {
      unsubscribeRealtime();
      window.dispatchEvent(new Event("resumeforge:refresh"));
    }
  });

  // Re-pull when the tab becomes visible again so device A picks up edits
  // made on device B while it was in the background.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && currentUserId) {
      pullAll(currentUserId);
    }
  });
}