import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Bell, Search, ChevronRight, FileText, LogOut, User, Settings, Home } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { resumeStore } from "@/components/builder/resumeStore";
import { toast } from "sonner";

const ROUTE_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  builder: "Create Resume",
  ats: "ATS Score",
  jobs: "Job Match",
  "cover-letter": "Cover Letter",
  interview: "Interview",
  roadmap: "Roadmap",
  "resume-lab": "Resume Lab",
  auth: "Account",
  "forgot-password": "Forgot Password",
  "reset-password": "Reset Password",
};

function useEmail() {
  const [email, setEmail] = useState<string | null>(null);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setEmail(data.session?.user.email ?? null));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      setEmail(s?.user.email ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);
  return email;
}

function useResumeCount() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const refresh = () => setCount(resumeStore.list().length);
    refresh();
    const onStorage = () => refresh();
    window.addEventListener("storage", onStorage);
    window.addEventListener("resumeforge:refresh", onStorage);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("resumeforge:refresh", onStorage);
    };
  }, []);
  return count;
}

export function TopHeader() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const email = useEmail();
  const resumeCount = useResumeCount();

  const crumbs = useMemo(() => {
    const segs = pathname.split("/").filter(Boolean);
    return segs.map((s, i) => ({
      label: ROUTE_LABELS[s] ?? s.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      href: "/" + segs.slice(0, i + 1).join("/"),
      last: i === segs.length - 1,
    }));
  }, [pathname]);

  const initial = (email?.[0] ?? "U").toUpperCase();

  const signOut = async () => {
    await supabase.auth.signOut();
    toast.success("Signed out");
    navigate({ to: "/auth" });
  };

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/80 px-3 backdrop-blur-md no-print sm:px-4">
      <SidebarTrigger className="shrink-0" />
      <div className="hidden h-5 w-px bg-border md:block" />
      {/* Breadcrumb */}
      <nav className="hidden min-w-0 items-center gap-1 text-sm md:flex" aria-label="Breadcrumb">
        <Link to="/dashboard" className="flex items-center gap-1 text-muted-foreground transition-colors hover:text-foreground">
          <Home className="h-3.5 w-3.5" />
        </Link>
        {crumbs.map((c) => (
          <span key={c.href} className="flex min-w-0 items-center gap-1">
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
            {c.last ? (
              <span className="truncate font-medium text-foreground">{c.label}</span>
            ) : (
              <Link to={c.href} className="truncate text-muted-foreground transition-colors hover:text-foreground">
                {c.label}
              </Link>
            )}
          </span>
        ))}
      </nav>

      <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
        {/* Search */}
        <div className="relative hidden lg:block">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search resumes, jobs..."
            className="h-9 w-56 rounded-full bg-muted/50 pl-8 text-sm focus-visible:bg-background"
          />
        </div>

        {/* Resume count */}
        <Link
          to="/dashboard"
          className="hidden items-center gap-1.5 rounded-full border bg-muted/40 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:flex"
        >
          <FileText className="h-3.5 w-3.5" />
          <span>{resumeCount}</span>
          <span className="hidden md:inline">resume{resumeCount === 1 ? "" : "s"}</span>
        </Link>

        {/* Notifications */}
        <Button variant="ghost" size="icon" className="relative h-9 w-9 rounded-full" aria-label="Notifications">
          <Bell className="h-[18px] w-[18px]" />
          <Badge className="absolute -right-0.5 -top-0.5 h-4 min-w-4 rounded-full border-2 border-background bg-primary px-1 text-[9px] tabular-nums" />
        </Button>

        {/* Profile */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 rounded-full p-0.5 outline-none transition-all hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-gradient-to-br from-primary to-primary/70 text-xs font-semibold text-primary-foreground">
                  {initial}
                </AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-0.5">
                <p className="text-sm font-medium">{email ? "Signed in" : "Guest"}</p>
                <p className="truncate text-xs text-muted-foreground">{email ?? "Local only"}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate({ to: "/dashboard" })}>
              <User className="mr-2 h-4 w-4" /> My Resumes
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate({ to: "/auth" })}>
              <Settings className="mr-2 h-4 w-4" /> Account
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {email ? (
              <DropdownMenuItem onClick={signOut} className="text-destructive focus:text-destructive">
                <LogOut className="mr-2 h-4 w-4" /> Sign out
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onClick={() => navigate({ to: "/auth" })}>
                <LogOut className="mr-2 h-4 w-4" /> Sign in
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}