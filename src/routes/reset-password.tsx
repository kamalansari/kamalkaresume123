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

  useEffect(() => {
    // Supabase parses the recovery hash and fires PASSWORD_RECOVERY.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
    // If the user is already in a session (link just consumed), allow update.
    supabase.auth.getSession().then(({ data }) => { if (data.session) setReady(true); });
    return () => subscription.unsubscribe();
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
            {ready ? "Update password" : "Waiting for reset link…"}
          </Button>
        </form>
      </Card>
    </div>
  );
}