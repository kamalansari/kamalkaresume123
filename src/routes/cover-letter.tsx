import { createFileRoute } from "@tanstack/react-router";
import { Mail } from "lucide-react";

export const Route = createFileRoute("/cover-letter")({
  head: () => ({
    meta: [
      { title: "Cover Letter — ResumeForge" },
      { name: "description", content: "Draft tailored cover letters." },
    ],
  }),
  component: CoverLetterPage,
});

function CoverLetterPage() {
  return (
    <div className="p-6 md:p-8 max-w-3xl mx-auto">
      <div className="flex items-center gap-2">
        <Mail className="h-5 w-5 text-primary" />
        <h1 className="text-3xl font-semibold tracking-tight">Cover Letter</h1>
      </div>
      <p className="mt-2 text-muted-foreground">
        Coming soon — generate tailored cover letters from your resume and a job description.
      </p>
    </div>
  );
}
