import { useEffect, useState } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

// Routes that require an authenticated user.
const PROTECTED_PREFIXES = [
  "/dashboard",
  "/builder",
  "/ats",
  "/cover-letter",
  "/interview",
  "/jobs",
  "/resume-lab",
  "/roadmap",
];

function isProtected(pathname: string) {
  return PROTECTED_PREFIXES.some(p => pathname === p || pathname.startsWith(p + "/"));
}

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "authed" | "anon">("loading");

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setStatus(data.session ? "authed" : "anon");
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setStatus(session ? "authed" : "anon");
    });
    return () => { mounted = false; subscription.unsubscribe(); };
  }, []);

  const needsAuth = isProtected(pathname);

  useEffect(() => {
    if (status === "anon" && needsAuth) {
      navigate({ to: "/auth", search: { redirect: pathname } as never });
    }
  }, [status, needsAuth, pathname, navigate]);

  if (needsAuth && status === "loading") {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }
  if (needsAuth && status === "anon") return null;

  return <>{children}</>;
}