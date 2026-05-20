import { createFileRoute } from "@tanstack/react-router";
import { Landing } from "@/components/landing/Landing";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ResumeForge — ATS-Optimized Resumes That Get Interviews" },
      { name: "description", content: "Build a recruiter-ready, ATS-optimized resume in minutes. Live preview, instant ATS score, and clean PDF export." },
      { property: "og:title", content: "ResumeForge — ATS-Optimized Resume Builder" },
      { property: "og:description", content: "Beat the bots. Land the interview. Free ATS resume builder with live preview and scoring." },
    ],
  }),
  component: Landing,
});