import { createFileRoute } from "@tanstack/react-router";
import { Builder } from "@/components/builder/Builder";

export const Route = createFileRoute("/builder")({
  head: () => ({
    meta: [
      { title: "Resume Builder — ResumeForge" },
      { name: "description", content: "Build your ATS-friendly resume with live preview, real-time ATS scoring, and instant PDF export." },
      { property: "og:title", content: "Resume Builder — ResumeForge" },
      { property: "og:description", content: "Live editor with ATS scoring and clean PDF export." },
    ],
  }),
  component: Builder,
});