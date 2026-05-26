import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Set a new password — ResumeForge" },
      { name: "description", content: "Choose a new password for your account." },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState<string>("Verifying reset link…");

  useEffect(() => {
    let cancelled = false;

    const markReady = () => { if (!cancelled) { setReady(true); setStatus(""); } };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || (event === "SIGNED_IN" && session)) markReady();
    });

    // Handle the recovery link. Supabase v2 may put tokens in the URL hash
    // (#access_token=...&type=recovery) or as ?code=... (PKCE).
    (async () => {
      const hash = typeof window !== "undefined" ? window.location.hash : "";
      const search = typeof window !== "undefined" ? window.location.search : "";
      try {
        if (hash.includes("access_token")) {
          const params = new URLSearchParams(hash.replace(/^#/, ""));
          const access_token = params.get("access_token");
          const refresh_token = params.get("refresh_token");
          if (access_token && refresh_token) {
            const { error } = await supabase.auth.setSession({ access_token, refresh_token });
            if (error) throw error;
            window.history.replaceState(null, "", window.location.pathname);
            markReady();
            return;
          }
        }
        if (search.includes("code=")) {
          const code = new URLSearchParams(search).get("code");
          if (code) {
            const { error } = await supabase.auth.exchangeCodeForSession(code);
            if (error) throw error;
            window.history.replaceState(null, "", window.location.pathname);
            markReady();
            return;
          }
        }
        const { data } = await supabase.auth.getSession();
        if (data.session) markReady();
        else if (!cancelled) setStatus("Open this page from the reset link in your email.");
      } catch (err) {
        if (!cancelled) setStatus(err instanceof Error ? err.message : "Invalid or expired reset link");
      }
    })();

    return () => { cancelled = true; subscription.unsubscribe(); };
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Password updated — you're signed in");
      navigate({ to: "/dashboard" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update password");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-3rem)] flex items-center justify-center px-4 py-10">
      <Card className="w-full max-w-md p-6 space-y-5">
        <div className="space-y-1 text-center">
          <h1 className="text-2xl font-display font-semibold">Set a new password</h1>
          <p className="text-sm text-muted-foreground">
            Pick something at least 6 characters long.
          </p>
        </div>

        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="password">New password</Label>
            <Input id="password" type="password" required minLength={6} value={password}
              onChange={e => setPassword(e.target.value)} autoComplete="new-password" />
          </div>
          <Button type="submit" className="w-full" disabled={busy || !ready}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {ready ? "Update password" : (status || "Waiting for reset link…")}
          </Button>
        </form>
      </Card>
    </div>
  );
}