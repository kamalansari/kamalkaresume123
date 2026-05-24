import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, FileText, Mail, Mic, Briefcase, FlaskConical, Map } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

const items = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Resume Builder", url: "/builder", icon: FileText },
  { title: "Resume Lab", url: "/resume-lab", icon: FlaskConical },
  { title: "Cover Letter", url: "/cover-letter", icon: Mail },
  { title: "Interview", url: "/interview", icon: Mic },
  { title: "Roadmap", url: "/roadmap", icon: Map },
  { title: "Job & Network Tracker", url: "/jobs", icon: Briefcase },
] as const;

export function AppSidebar() {
  const currentPath = useRouterState({ select: (s) => s.location.pathname });
  const isActive = (path: string) =>
    currentPath === path || currentPath.startsWith(path + "/");

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Platform</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)}>
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
      </SidebarContent>
    </Sidebar>
  );
}