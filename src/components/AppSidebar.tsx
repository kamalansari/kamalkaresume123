import { Link, useRouterState, useNavigate, type LinkProps } from "@tanstack/react-router";
import {
  LayoutDashboard,
  FileStack,
  PlusCircle,
  Gauge,
  Target,
  Mail,
  Zap,
  Settings,
  Mic,
  FlaskConical,
  Map as MapIcon,
  LogIn,
  LogOut,
  Cloud,
  Sparkles,
  BookOpen,
} from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

type NavItem = {
  title: string;
  url: LinkProps["to"];
  icon: typeof LayoutDashboard;
  match?: string;
  hash?: string;
  scrollTo?: string;
};

const navGroups: { label: string; items: NavItem[] }[] = [
  {
    label: "Workspace",
    items: [
      { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
      { title: "My Resumes", url: "/dashboard", icon: FileStack, hash: "my-resumes", scrollTo: "my-resumes", match: "/dashboard#my-resumes" },
      { title: "Create Resume", url: "/builder", icon: PlusCircle },
    ],
  },
  {
    label: "Optimize",
    items: [
      { title: "ATS Score", url: "/ats", icon: Gauge },
      { title: "Job Match", url: "/jobs", icon: Target },
      { title: "Cover Letter", url: "/cover-letter", icon: Mail },
      { title: "Auto Apply", url: "/jobs", icon: Zap, match: "/jobs/auto" },
    ],
  },
  {
    label: "Career Prep",
    items: [
      { title: "Interview", url: "/interview", icon: Mic },
      { title: "Roadmap", url: "/roadmap", icon: MapIcon },
      { title: "Resume Lab", url: "/resume-lab", icon: FlaskConical },
    ],
  },
  {
    label: "Admin",
    items: [
      { title: "Skill Dictionary", url: "/admin/skill-dictionary", icon: BookOpen },
    ],
  },
];

export function AppSidebar() {
  const currentPath = useRouterState({ select: (s) => s.location.pathname });
  const currentHash = useRouterState({ select: (s) => s.location.hash });
  const navigate = useNavigate();
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setEmail(data.session?.user.email ?? null));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setEmail(session?.user.email ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  const isActive = (item: NavItem) => {
    // Items with a hash anchor are active only when the hash matches.
    if (item.hash) {
      return currentPath === item.url && currentHash === item.hash;
    }
    const target = item.match ?? item.url;
    // Plain dashboard link should NOT light up when a hash-anchored sibling is selected.
    if (item.url === "/dashboard" && currentPath === "/dashboard" && currentHash) {
      return false;
    }
    return currentPath === target || currentPath.startsWith(target + "/");
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    toast.success("Signed out");
  };

  const initial = (email?.[0] ?? "U").toUpperCase();

  return (
    <Sidebar collapsible="icon" className="border-r">
      <SidebarHeader className="border-b">
        <Link
          to="/dashboard"
          className="flex items-center gap-2 px-2 py-2 group-data-[collapsible=icon]:justify-center"
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-sm">
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="flex flex-col leading-tight group-data-[collapsible=icon]:hidden">
            <span className="text-sm font-semibold tracking-tight">ResumeForge</span>
            <span className="text-[10px] text-muted-foreground">ATS Resume Studio</span>
          </div>
        </Link>
      </SidebarHeader>
      <SidebarContent className="gap-1 py-2">
        {navGroups.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
              {group.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="gap-0.5">
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive(("match" in item && item.match) || item.url)}
                      tooltip={item.title}
                      className="h-9 rounded-lg transition-all data-[active=true]:bg-primary/10 data-[active=true]:text-primary data-[active=true]:font-medium hover:translate-x-0.5"
                    >
                      <Link to={item.url} className="flex items-center gap-3">
                        <item.icon className="h-[18px] w-[18px]" />
                        <span className="text-sm">{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={isActive("/settings")}
                  tooltip="Settings"
                  className="h-9 rounded-lg transition-all hover:translate-x-0.5"
                >
                  <Link to="/auth" className="flex items-center gap-3">
                    <Settings className="h-[18px] w-[18px]" />
                    <span className="text-sm">Settings</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t">
        <SidebarMenu>
          {email ? (
            <>
              <SidebarMenuItem>
                <div className="flex items-center gap-2 px-1.5 py-1.5 group-data-[collapsible=icon]:justify-center">
                  <Avatar className="h-7 w-7 shrink-0">
                    <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                      {initial}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex min-w-0 flex-col leading-tight group-data-[collapsible=icon]:hidden">
                    <span className="truncate text-xs font-medium">{email}</span>
                    <span className="flex items-center gap-1 text-[10px] text-emerald-600">
                      <Cloud className="h-2.5 w-2.5" /> Synced
                    </span>
                  </div>
                </div>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton onClick={signOut} tooltip="Sign out" className="h-8 rounded-lg text-muted-foreground hover:text-foreground">
                  <LogOut className="h-[18px] w-[18px]" />
                  <span>Sign out</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </>
          ) : (
            <SidebarMenuItem>
              <SidebarMenuButton onClick={() => navigate({ to: "/auth" })} tooltip="Sign in" className="h-8 rounded-lg">
                <LogIn className="h-[18px] w-[18px]" />
                <span>Sign in to sync</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}