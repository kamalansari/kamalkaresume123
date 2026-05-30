import { supabase } from "@/integrations/supabase/client";

/**
 * fetch() wrapper that automatically attaches the current Supabase session's
 * bearer token as Authorization header. Use for calls to protected /api/* routes.
 */
export async function authFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const headers = new Headers(init.headers);
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  return fetch(input, { ...init, headers });
}