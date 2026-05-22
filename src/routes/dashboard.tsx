import { createFileRoute, Link } from "@tanstack/react-router";
import { FileText, Mail, Mic, Briefcase } from "lucide-react";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — ResumeForge" },
      { name: "description", content: "Your ResumeForge dashboard." },
    ],
  }),
  component: DashboardPage,
});

const cards = [
  { to: "/builder", title: "Resume Builder", desc: "Edit your resume with live preview.", icon: FileText },
  { to: "/cover-letter", title: "Cover Letter", desc: "Draft tailored cover letters.", icon: Mail },
  { to: "/interview", title: "Interview", desc: "Practice interview questions.", icon: Mic },
  { to: "/jobs", title: "Job & Network Tracker", desc: "Track jobs and contacts.", icon: Briefcase },
] as const;

function DashboardPage() {
  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto">
      <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
      <p className="mt-1 text-muted-foreground">Jump back into your workspace.</p>
      <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => (
          <Link key={c.to} to={c.to} className="group rounded-xl border border-border bg-card p-4 hover:shadow-[var(--shadow-soft)] transition-shadow">
            <c.icon className="h-5 w-5 text-primary" />
            <div className="mt-3 font-medium">{c.title}</div>
            <div className="text-sm text-muted-foreground">{c.desc}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
