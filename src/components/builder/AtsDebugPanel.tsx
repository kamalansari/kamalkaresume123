import { useMemo, useState } from "react";
import { ChevronDown, Bug, Copy } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { computeScore, jdKeywordSet, canonical, COMMON_ATS_KEYWORD_SET } from "./atsScore";
import { parseSkills } from "@/lib/parseSkills";
import type { ResumeData } from "./types";

/**
 * Collapsible developer panel that exposes every raw input and intermediate
 * value fed into `computeScore`. Useful when an ATS / Resume score does not
 * look right — every check, weight, keyword, and total is visible here.
 */
export function AtsDebugPanel({
  data,
  className,
  defaultOpen = false,
}: {
  data: ResumeData;
  className?: string;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const score = useMemo(() => computeScore(data), [data]);

  const jd = (data.jobDescription ?? "").trim();
  const resumeText = useMemo(() => [
    data.name, data.headline, data.email, data.phone, data.location, data.summary,
    ...(data.experience ?? []).flatMap(e => [e.title, e.company, e.bullets]),
    ...(data.education ?? []).flatMap(e => [e.degree, e.school]),
    data.skills,
    ...(data.projects ?? []).flatMap(p => [p.name, p.bullets]),
    ...(data.certifications ?? []).flatMap(c => [c.name, c.issuer]),
    ...(data.awards ?? []).flatMap(a => [a.name, a.issuer]),
    ...(data.languages ?? []).map(l => l.name),
    data.extraKeywords ?? "",
  ].filter(Boolean).join(" \n "), [data]);

  const resumeWordCount = resumeText.split(/\s+/).filter(Boolean).length;
  const jdWordCount = jd ? jd.split(/\s+/).filter(Boolean).length : 0;
  const skillsList = parseSkills(data.skills ?? "");
  const totalBullets = (data.experience ?? []).reduce(
    (n, e) => n + String(e.bullets ?? "").split("\n").filter(Boolean).length, 0,
  );
  const hasNumbers = /\d/.test((data.experience ?? []).map(e => e.bullets).join(" "));

  const weightSum = score.checks.reduce((s, c) => s + c.weight, 0);
  const earned = score.checks.reduce((s, c) => s + (c.pass ? c.weight : 0), 0);

  const baseline = !jd;
  const jdKw = useMemo(() => Array.from(jdKeywordSet(jd)), [jd]);
  const commonKw = useMemo(() => Array.from(COMMON_ATS_KEYWORD_SET), []);
  const activeKeywordPool = baseline ? commonKw : jdKw;

  const copyJson = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify({
        inputs: {
          baseline,
          resumeWordCount,
          jdWordCount,
          totalBullets,
          hasNumbers,
          skills: skillsList,
        },
        totals: {
          score: score.score,
          earned,
          weightSum,
          coverage: score.coverage,
          matched: score.matched.length,
          missing: score.missing.length,
        },
        checks: score.checks,
        keywordStats: score.keywordStats,
      }, null, 2));
      toast.success("Debug snapshot copied");
    } catch { toast.error("Clipboard unavailable"); }
  };

  return (
    <div className={cn("rounded-xl border border-dashed border-border bg-card/60", className)}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground hover:text-foreground"
      >
        <span className="inline-flex items-center gap-1.5">
          <Bug className="h-3.5 w-3.5" /> ATS score debug
          <span className="ml-1 rounded bg-secondary px-1.5 py-0.5 text-[10px] normal-case tracking-normal text-foreground">
            {score.score}/100 · {Math.round(score.coverage * 100)}% cov
          </span>
        </span>
        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="border-t border-border px-3 py-3 space-y-4 text-xs">
          {/* Totals */}
          <Section title="Computed totals">
            <Grid rows={[
              ["Overall score", `${score.score} / 100`],
              ["Weighted earned / total", `${earned} / ${weightSum}`],
              ["JD coverage", `${(score.coverage * 100).toFixed(1)}%`],
              ["Matched keywords", String(score.matched.length)],
              ["Missing keywords", String(score.missing.length)],
              ["Scoring mode", baseline ? "Generic baseline (no JD)" : "JD-tailored"],
            ]} />
          </Section>

          {/* Inputs */}
          <Section title="Raw inputs">
            <Grid rows={[
              ["Resume word count", String(resumeWordCount)],
              ["JD word count", String(jdWordCount)],
              ["Experience bullets", String(totalBullets)],
              ["Has numbers in bullets", hasNumbers ? "yes" : "no"],
              ["Skills parsed", String(skillsList.length)],
              ["Contact (email+phone)", `${data.email ? "✓" : "✗"} / ${data.phone ? "✓" : "✗"}`],
              ["Summary words", String((data.summary ?? "").trim().split(/\s+/).filter(Boolean).length)],
            ]} />
            {skillsList.length > 0 && (
              <ChipRow label="Skills" items={skillsList} tone="neutral" />
            )}
          </Section>

          {/* Per-check breakdown */}
          <Section title="Check-by-check breakdown">
            <div className="overflow-hidden rounded-md border border-border">
              <table className="w-full text-[11px]">
                <thead className="bg-secondary/50 text-muted-foreground">
                  <tr>
                    <th className="text-left px-2 py-1 font-medium">Check</th>
                    <th className="text-right px-2 py-1 font-medium w-14">Weight</th>
                    <th className="text-right px-2 py-1 font-medium w-14">Earned</th>
                    <th className="text-right px-2 py-1 font-medium w-12">Pass</th>
                  </tr>
                </thead>
                <tbody>
                  {score.checks.map((c, i) => (
                    <tr key={i} className="border-t border-border align-top">
                      <td className="px-2 py-1">
                        <div className="font-medium">{c.label}</div>
                        {c.hint && <div className="text-muted-foreground">{c.hint}</div>}
                      </td>
                      <td className="px-2 py-1 text-right tabular-nums">{c.weight}</td>
                      <td className="px-2 py-1 text-right tabular-nums">{c.pass ? c.weight : 0}</td>
                      <td className={cn("px-2 py-1 text-right font-semibold", c.pass ? "text-emerald-600" : "text-rose-600")}>
                        {c.pass ? "✓" : "✗"}
                      </td>
                    </tr>
                  ))}
                  <tr className="border-t border-border bg-secondary/30 font-semibold">
                    <td className="px-2 py-1">Total</td>
                    <td className="px-2 py-1 text-right tabular-nums">{weightSum}</td>
                    <td className="px-2 py-1 text-right tabular-nums">{earned}</td>
                    <td className="px-2 py-1 text-right">{score.score}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Section>

          {/* Keyword diagnostics */}
          <Section title={baseline ? "Common ATS keyword pool" : "JD keyword diagnostics"}>
            <div className="text-muted-foreground mb-2">
              {baseline
                ? `${activeKeywordPool.length} generic keywords (no JD pasted). Resume hits shown below.`
                : `${jdKw.length} canonicalized keywords extracted from the JD.`}
            </div>
            {!baseline && score.keywordStats.length > 0 && (
              <div className="overflow-hidden rounded-md border border-border max-h-64 overflow-y-auto">
                <table className="w-full text-[11px]">
                  <thead className="bg-secondary/50 text-muted-foreground sticky top-0">
                    <tr>
                      <th className="text-left px-2 py-1 font-medium">Keyword</th>
                      <th className="text-left px-2 py-1 font-medium w-20">Canonical</th>
                      <th className="text-right px-2 py-1 font-medium w-12">JD</th>
                      <th className="text-right px-2 py-1 font-medium w-14">Resume</th>
                      <th className="text-right px-2 py-1 font-medium w-12">Hit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {score.keywordStats.map(s => (
                      <tr key={s.keyword} className="border-t border-border">
                        <td className="px-2 py-1 font-mono">{s.keyword}</td>
                        <td className="px-2 py-1 font-mono text-muted-foreground">{canonical(s.keyword)}</td>
                        <td className="px-2 py-1 text-right tabular-nums">{s.jd}</td>
                        <td className="px-2 py-1 text-right tabular-nums">{s.resume}</td>
                        <td className={cn("px-2 py-1 text-right font-semibold", s.matched ? "text-emerald-600" : "text-rose-600")}>
                          {s.matched ? "✓" : "✗"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {baseline && (
              <ChipRow label="Pool" items={activeKeywordPool.slice(0, 60)} tone="neutral" />
            )}
          </Section>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={copyJson}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1 text-[11px] font-medium hover:border-[var(--navy-light)]"
            >
              <Copy className="h-3 w-3" /> Copy debug JSON
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">{title}</div>
      {children}
    </div>
  );
}

function Grid({ rows }: { rows: [string, string][] }) {
  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-1">
      {rows.map(([k, v]) => (
        <div key={k} className="flex justify-between border-b border-dashed border-border/60 py-0.5">
          <span className="text-muted-foreground">{k}</span>
          <span className="font-mono tabular-nums">{v}</span>
        </div>
      ))}
    </div>
  );
}

function ChipRow({ label, items, tone }: { label: string; items: string[]; tone: "neutral" }) {
  return (
    <div className="mt-2">
      <div className="text-[10px] text-muted-foreground mb-1">{label} ({items.length})</div>
      <div className="flex flex-wrap gap-1">
        {items.map(i => (
          <span key={i} className={cn(
            "rounded px-1.5 py-0.5 text-[10px] font-mono border",
            tone === "neutral" && "bg-secondary text-foreground border-border",
          )}>{i}</span>
        ))}
      </div>
    </div>
  );
}