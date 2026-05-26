import { defaultResume, type ResumeData, type Experience, type Education, type Project, type Certification, type Award, type Language } from "@/components/builder/types";
import { newId } from "@/components/builder/resumeStore";

async function extractPdfText(file: File): Promise<string> {
  const pdfjs: any = await import("pdfjs-dist/build/pdf.mjs");
  // Use the bundled worker URL so Vite ships it.
  const workerUrl = (await import("pdfjs-dist/build/pdf.worker.mjs?url")).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  const buf = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buf }).promise;
  const parts: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const line = content.items.map((it: any) => ("str" in it ? it.str : "")).join(" ");
    parts.push(line);
  }
  return parts.join("\n");
}

async function extractDocxText(file: File): Promise<string> {
  const mammoth: any = await import("mammoth/mammoth.browser.js");
  const buf = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer: buf });
  return String(result?.value ?? "");
}

export async function extractResumeText(file: File): Promise<string> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".pdf") || file.type === "application/pdf") return extractPdfText(file);
  if (
    name.endsWith(".docx") ||
    file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  )
    return extractDocxText(file);
  if (name.endsWith(".txt") || file.type.startsWith("text/")) return file.text();
  throw new Error("Unsupported file type. Upload a PDF, DOCX, or TXT resume.");
}

function arr<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}
function str(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

/** Convert the AI parse-resume payload into a full ResumeData by merging onto defaults. */
export function aiToResumeData(parsed: any): ResumeData {
  const experience: Experience[] = arr<any>(parsed.experience).map((e) => ({
    id: newId(),
    title: str(e?.title),
    company: str(e?.company),
    date: str(e?.date),
    bullets: str(e?.bullets),
  }));
  const education: Education[] = arr<any>(parsed.education).map((e) => ({
    id: newId(),
    degree: str(e?.degree),
    school: str(e?.school),
    date: str(e?.date),
    field: str(e?.field, undefined as any) || undefined,
    location: str(e?.location, undefined as any) || undefined,
    gpa: str(e?.gpa, undefined as any) || undefined,
    honors: str(e?.honors, undefined as any) || undefined,
  }));
  const projects: Project[] = arr<any>(parsed.projects).map((p) => ({
    id: newId(),
    name: str(p?.name),
    link: str(p?.link),
    date: str(p?.date),
    bullets: str(p?.bullets),
  }));
  const certifications: Certification[] = arr<any>(parsed.certifications).map((c) => ({
    id: newId(),
    name: str(c?.name),
    issuer: str(c?.issuer),
    date: str(c?.date),
  }));
  const awards: Award[] = arr<any>(parsed.awards).map((a) => ({
    id: newId(),
    name: str(a?.name),
    issuer: str(a?.issuer),
    date: str(a?.date),
  }));
  const languages: Language[] = arr<any>(parsed.languages).map((l) => ({
    id: newId(),
    name: str(l?.name),
    level: str(l?.level),
  }));

  return {
    ...defaultResume,
    name: str(parsed.name, defaultResume.name),
    headline: str(parsed.headline, ""),
    email: str(parsed.email, ""),
    phone: str(parsed.phone, ""),
    location: str(parsed.location, ""),
    links: str(parsed.links, ""),
    summary: str(parsed.summary, ""),
    skills: str(parsed.skills, ""),
    experience: experience.length ? experience : [],
    education: education.length ? education : [],
    projects,
    certifications,
    awards,
    languages,
  };
}

export async function importResumeFile(file: File): Promise<ResumeData> {
  const text = await extractResumeText(file);
  const trimmed = text.trim();
  if (!trimmed) throw new Error("Could not read any text from this file.");
  const res = await fetch("/api/parse-resume", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ text: trimmed.slice(0, 60000) }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(t || `Parse failed (${res.status})`);
  }
  const parsed = await res.json();
  return aiToResumeData(parsed);
}