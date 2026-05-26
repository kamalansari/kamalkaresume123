import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, FileStack, Gauge, Target, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { title: "Home", url: "/dashboard", icon: LayoutDashboard },
  { title: "Resumes", url: "/dashboard", icon: FileStack },
  { title: "ATS", url: "/ats", icon: Gauge },
  { title: "Jobs", url: "/jobs", icon: Target },
];

export function MobileBottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isActive = (url: string) => pathname === url || pathname.startsWith(url + "/");

  return (
    <>
      {/* Floating Create button */}
      <Link
        to="/builder"
        aria-label="Create resume"
        className="fixed bottom-20 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-lg shadow-primary/30 transition-all hover:scale-105 active:scale-95 md:hidden no-print"
      >
        <Plus className="h-6 w-6" />
      </Link>

      {/* Bottom nav bar */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-30 flex h-16 items-center justify-around border-t bg-background/95 px-2 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden no-print"
        aria-label="Mobile navigation"
      >
        {items.map((item) => {
          const active = isActive(item.url);
          return (
            <Link
              key={item.title}
              to={item.url}
              className={cn(
                "flex flex-1 flex-col items-center justify-center gap-1 rounded-xl py-1.5 text-[10px] font-medium transition-all",
                active ? "text-primary" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <div
                className={cn(
                  "flex h-7 w-12 items-center justify-center rounded-full transition-all",
                  active && "bg-primary/10",
                )}
              >
                <item.icon className="h-[18px] w-[18px]" />
              </div>
              <span>{item.title}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}