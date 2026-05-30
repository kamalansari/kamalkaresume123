import { createClient } from "@supabase/supabase-js";

/**
 * Validates the Authorization: Bearer <token> header on a server route request.
 * Returns the user id on success, or a Response (401/500) to short-circuit the handler.
 */
export async function requireAuth(request: Request): Promise<{ userId: string } | Response> {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    return new Response("Server auth not configured", { status: 500 });
  }
  const authHeader = request.headers.get("authorization") ?? request.headers.get("Authorization");
  if (!authHeader || !authHeader.toLowerCase().startsWith("bearer ")) {
    return new Response("Unauthorized", { status: 401 });
  }
  const token = authHeader.slice(7).trim();
  if (!token) return new Response("Unauthorized", { status: 401 });

  const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
  });
  const { data, error } = await supabase.auth.getClaims(token);
  if (error || !data?.claims?.sub) {
    return new Response("Unauthorized", { status: 401 });
  }
  return { userId: data.claims.sub as string };
}