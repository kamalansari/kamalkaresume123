import jsPDF from "jspdf";
import type { ResumeData } from "./types";
import { computeScore } from "./atsScore";

export type AtsReportJob = {
  title: string;
  company?: string;
  location?: string;
  experience?: string;
  salary?: string;
  jd: string;
};

export function downloadAtsReportPdf(job: AtsReportJob, resume: ResumeData) {
  const score = computeScore({ ...resume, jobDescription: jd(job) });
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 40;
  let y = M;

  const ensureRoom = (needed: number) => {
    if (y + needed > H - M) {
      doc.addPage();
      y = M;
    }
  };

  const heading = (text: string, size = 13) => {
    ensureRoom(size + 10);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(size);
    doc.setTextColor(20, 30, 60);
    doc.text(text, M, y);
    y += size + 6;
    doc.setDrawColor(220);
    doc.line(M, y, W - M, y);
    y += 10;
  };

  const body = (text: string, opts: { size?: number; color?: [number, number, number]; bold?: boolean } = {}) => {
    const size = opts.size ?? 10.5;
    doc.setFont("helvetica", opts.bold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.setTextColor(...(opts.color ?? [40, 40, 40]));
    const lines = doc.splitTextToSize(text, W - M * 2);
    for (const line of lines) {
      ensureRoom(size + 4);
      doc.text(line, M, y);
      y += size + 4;
    }
  };

  // ===== Header =====
  doc.setFillColor(20, 30, 60);
  doc.rect(0, 0, W, 70, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("ATS Match Report", M, 32);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Generated ${new Date().toLocaleString()}`, M, 50);
  y = 90;

  // ===== Job summary =====
  heading("Job");
  body(`${job.title}${job.company ? "  ·  " + job.company : ""}`, { bold: true, size: 12 });
  const meta = [job.location, job.experience, job.salary].filter(Boolean).join("  ·  ");
  if (meta) body(meta, { color: [100, 100, 100] });
  y += 6;

  // ===== Score gauge =====
  heading("ATS Score");
  const gaugeY = y;
  const gaugeW = W - M * 2;
  doc.setFillColor(235, 238, 245);
  doc.roundedRect(M, gaugeY, gaugeW, 14, 7, 7, "F");
  const pct = Math.max(0, Math.min(100, score.score));
  const fill = pct >= 80 ? [16, 185, 129] : pct >= 60 ? [37, 99, 235] : pct >= 40 ? [245, 158, 11] : [220, 38, 38];
  doc.setFillColor(...(fill as [number, number, number]));
  doc.roundedRect(M, gaugeY, (gaugeW * pct) / 100, 14, 7, 7, "F");
  y += 22;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(20, 30, 60);
  doc.text(`${pct}/100`, M, y + 6);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(80, 80, 80);
  const status = pct >= 80 ? "Excellent match" : pct >= 60 ? "Solid match" : pct >= 40 ? "Needs improvement" : "Weak match";
  doc.text(status, M + 90, y + 4);
  y += 28;

  // ===== Score breakdown =====
  heading("Score Breakdown");
  for (const c of score.checks) {
    ensureRoom(16);
    const dot = c.pass ? [16, 185, 129] : [180, 60, 60];
    doc.setFillColor(...(dot as [number, number, number]));
    doc.circle(M + 4, y - 3, 3, "F");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10.5);
    doc.setTextColor(40, 40, 40);
    doc.text(c.label, M + 14, y);
    const points = c.pass ? `+${c.weight}` : `0 / ${c.weight}`;
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...(c.pass ? [16, 110, 80] : [120, 120, 120]));
    doc.text(points, W - M, y, { align: "right" });
    y += 16;
    if (!c.pass && c.hint) {
      body(`   ${c.hint}`, { size: 9, color: [120, 120, 120] });
    }
  }
  y += 4;

  // ===== Matched keywords =====
  heading(`Matched Keywords (${score.matched.length})`);
  if (score.matched.length === 0) {
    body("No keyword matches yet — add the suggestions below to your resume.", { color: [120, 120, 120] });
  } else {
    body(score.matched.join(", "), { color: [16, 110, 80] });
  }
  y += 4;

  // ===== Missing keywords =====
  heading(`Missing Keywords (${score.missing.length})`);
  if (score.missing.length === 0) {
    body("Your resume covers all detected keywords. Great job!", { color: [16, 110, 80] });
  } else {
    body(score.missing.join(", "), { color: [170, 50, 50] });
  }
  y += 4;

  // ===== Improvement suggestions =====
  heading("Improvement Suggestions");
  const suggestions = buildSuggestions(score, job);
  suggestions.forEach((s, i) => {
    body(`${i + 1}. ${s}`);
  });

  // ===== Footer on every page =====
  const pageCount = doc.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(150);
    doc.text("ResumeForge · ATS Match Report", M, H - 18);
    doc.text(`Page ${p} of ${pageCount}`, W - M, H - 18, { align: "right" });
  }

  const safe = (job.title || "ats-report").replace(/[^a-z0-9]+/gi, "_").toLowerCase();
  doc.save(`ats-report_${safe}.pdf`);
}

function jd(job: AtsReportJob): string {
  return [job.jd, job.title, job.company, job.experience].filter(Boolean).join(". ");
}

function buildSuggestions(score: ReturnType<typeof computeScore>, job: AtsReportJob): string[] {
  const out: string[] = [];
  const failed = score.checks.filter(c => !c.pass);
  for (const c of failed.slice(0, 5)) {
    if (c.hint) out.push(`${c.label}: ${c.hint}`);
  }
  if (score.missing.length > 0) {
    out.push(
      `Weave these missing keywords from "${job.title}" naturally into your summary, skills, or experience bullets: ${score.missing.slice(0, 12).join(", ")}.`
    );
  }
  if (score.matched.length > 0 && score.coverage < 0.6) {
    out.push(
      `You're matching ${Math.round(score.coverage * 100)}% of detected keywords. Aim for 70%+ by repeating top terms in measurable accomplishment bullets.`
    );
  }
  if (out.length === 0) {
    out.push("Your resume is well-aligned with this job. Tailor the summary with a one-line value statement referencing this role to push the score higher.");
  }
  return out;
}