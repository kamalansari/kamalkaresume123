import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({
    meta: [
      { title: "Forgot password — ResumeForge" },
      { name: "description", content: "Reset your ResumeForge password." },
    ],
  }),
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setSent(true);
      toast.success("Check your email for the reset link");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send reset email");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-3rem)] flex items-center justify-center px-4 py-10">
      <Card className="w-full max-w-md p-6 space-y-5">
        <div className="space-y-1 text-center">
          <h1 className="text-2xl font-display font-semibold">Reset your password</h1>
          <p className="text-sm text-muted-foreground">
            We'll email you a secure link to set a new password.
          </p>
        </div>

        {sent ? (
          <div className="text-sm text-muted-foreground text-center">
            If an account exists for <span className="font-medium text-foreground">{email}</span>,
            a reset link is on its way.
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required value={email}
                onChange={e => setEmail(e.target.value)} autoComplete="email" />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              Send reset link
            </Button>
          </form>
        )}

        <div className="text-center text-sm text-muted-foreground">
          <Link to="/auth" className="text-primary underline">Back to sign in</Link>
        </div>
      </Card>
    </div>
  );
}