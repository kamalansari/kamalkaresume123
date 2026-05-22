import { createFileRoute } from "@tanstack/react-router";
import { Mic } from "lucide-react";

export const Route = createFileRoute("/interview")({
  head: () => ({
    meta: [
      { title: "Interview — ResumeForge" },
      { name: "description", content: "Practice interview questions." },
    ],
  }),
  component: InterviewPage,
});

function InterviewPage() {
  return (
    <div className="p-6 md:p-8 max-w-3xl mx-auto">
      <div className="flex items-center gap-2">
        <Mic className="h-5 w-5 text-primary" />
        <h1 className="text-3xl font-semibold tracking-tight">Interview</h1>
      </div>
      <p className="mt-2 text-muted-foreground">
        Coming soon — practice role-specific interview questions with AI feedback.
      </p>
    </div>
  );
}
