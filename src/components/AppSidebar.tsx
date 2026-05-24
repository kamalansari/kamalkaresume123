import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { LayoutDashboard, FileText, Mail, Mic, Briefcase, FlaskConical, Map as MapIcon, LogIn, LogOut, Cloud } from "lucide-react";
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
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

const navGroups = [
  {
    label: "Overview",
    items: [{ title: "Dashboard", url: "/dashboard", icon: LayoutDashboard }],
  },
  {
    label: "Resume",
    items: [
      { title: "Resume Builder", url: "/builder", icon: FileText },
      { title: "Resume Lab", url: "/resume-lab", icon: FlaskConical },
      { title: "Cover Letter", url: "/cover-letter", icon: Mail },
    ],
  },
  {
    label: "Career Prep",
    items: [
      { title: "Interview", url: "/interview", icon: Mic },
      { title: "Roadmap", url: "/roadmap", icon: MapIcon },
    ],
  },
  {
    label: "Opportunities",
    items: [{ title: "Job & Network Tracker", url: "/jobs", icon: Briefcase }],
  },
] as const;

export function AppSidebar() {
  const currentPath = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setEmail(data.session?.user.email ?? null));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setEmail(session?.user.email ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  const isActive = (path: string) =>
    currentPath === path || currentPath.startsWith(path + "/");

  const signOut = async () => {
    await supabase.auth.signOut();
    toast.success("Signed out");
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        {navGroups.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
                      <Link to={item.url} className="flex items-center gap-2">
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          {email ? (
            <>
              <SidebarMenuItem>
                <div className="flex items-center gap-2 px-2 py-1 text-xs text-muted-foreground">
                  <Cloud className="h-3.5 w-3.5 text-emerald-500" />
                  <span className="truncate">{email}</span>
                </div>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton onClick={signOut}>
                  <LogOut className="h-4 w-4" />
                  <span>Sign out</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </>
          ) : (
            <SidebarMenuItem>
              <SidebarMenuButton onClick={() => navigate({ to: "/auth" })}>
                <LogIn className="h-4 w-4" />
                <span>Sign in to sync</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}