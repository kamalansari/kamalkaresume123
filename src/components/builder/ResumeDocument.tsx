import { useEffect } from "react";
import { FONT_PRESETS, type ResumeData, type SectionId } from "./types";

const loadedFonts = new Set<string>();

function useFont(fontId: string) {
  useEffect(() => {
    const preset = FONT_PRESETS.find(f => f.id === fontId);
    if (!preset?.googleHref || loadedFonts.has(preset.googleHref)) return;
    loadedFonts.add(preset.googleHref);
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = preset.googleHref;
    document.head.appendChild(link);
  }, [fontId]);
}

export function ResumeDocument({ data }: { data: ResumeData }) {
  useFont(data.fontId);
  const preset = FONT_PRESETS.find(f => f.id === data.fontId) ?? FONT_PRESETS[0];
  const headingFont = `${preset.heading}, system-ui, sans-serif`;
  const bodyFont = `${preset.body}, system-ui, sans-serif`;
  const accent = data.accentHex;

  const sections: Record<SectionId, React.ReactNode> = {
    summary: data.summary ? <SummarySection key="summary" data={data} accent={accent} headingFont={headingFont} /> : null,
    experience: data.experience.length ? <ExperienceSection key="experience" data={data} accent={accent} headingFont={headingFont} /> : null,
    education: data.education.length ? <EducationSection key="education" data={data} accent={accent} headingFont={headingFont} /> : null,
    skills: data.skills ? <SkillsSection key="skills" data={data} accent={accent} headingFont={headingFont} template={data.template} /> : null,
  };

  const ordered = data.sectionOrder.map(id => sections[id]);

  const base = {
    width: "8.5in",
    minHeight: "11in",
    fontFamily: bodyFont,
    fontSize: "10.5pt",
    lineHeight: 1.45,
    color: "#1a1a1a",
  } as React.CSSProperties;

  if (data.template === "two-column") {
    return (
      <div className="print-area mx-auto bg-white shadow-[var(--shadow-soft)]" style={base}>
        <div className="grid" style={{ gridTemplateColumns: "2.6in 1fr", minHeight: "11in" }}>
          <aside style={{ background: accent, color: "#fff", padding: "0.55in 0.4in" }}>
            <h1 style={{ fontFamily: headingFont, fontSize: "22pt", lineHeight: 1.1, fontWeight: 700 }}>{data.name || "Your Name"}</h1>
            <div style={{ fontSize: "10.5pt", opacity: 0.9, marginTop: 4 }}>{data.headline}</div>
            <div style={{ height: 1, background: "rgba(255,255,255,0.3)", margin: "16px 0" }} />
            <SidebarBlock title="Contact" headingFont={headingFont}>
              {[data.email, data.phone, data.location].filter(Boolean).map((l, i) => (
                <div key={i} style={{ marginBottom: 4, wordBreak: "break-word" }}>{l}</div>
              ))}
              {data.links && <div style={{ marginTop: 4, wordBreak: "break-word" }}>{data.links}</div>}
            </SidebarBlock>
            {data.skills && (
              <SidebarBlock title="Skills" headingFont={headingFont}>
                <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
                  {data.skills.split(",").map(s => s.trim()).filter(Boolean).map((s, i) => (
                    <li key={i} style={{ marginBottom: 3 }}>• {s}</li>
                  ))}
                </ul>
              </SidebarBlock>
            )}
            {data.education.length > 0 && (
              <SidebarBlock title="Education" headingFont={headingFont}>
                {data.education.map(ed => (
                  <div key={ed.id} style={{ marginBottom: 6 }}>
                    <div style={{ fontWeight: 600 }}>{ed.degree}</div>
                    <div style={{ opacity: 0.9 }}>{ed.school}</div>
                    <div style={{ opacity: 0.75, fontSize: "9pt" }}>{ed.date}</div>
                  </div>
                ))}
              </SidebarBlock>
            )}
          </aside>
          <main style={{ padding: "0.55in 0.5in" }}>
            {data.sectionOrder
              .filter(id => id === "summary" || id === "experience")
              .map(id => sections[id])}
          </main>
        </div>
      </div>
    );
  }

  if (data.template === "modern") {
    return (
      <div className="print-area mx-auto bg-white shadow-[var(--shadow-soft)]" style={base}>
        <header style={{ padding: "0.5in 0.6in", background: accent, color: "#fff" }}>
          <h1 style={{ fontFamily: headingFont, fontSize: "28pt", fontWeight: 800, letterSpacing: "-0.01em" }}>{data.name || "Your Name"}</h1>
          <div style={{ fontSize: "12pt", opacity: 0.92, marginTop: 2 }}>{data.headline}</div>
          <div style={{ fontSize: "9.5pt", opacity: 0.85, marginTop: 8 }}>
            {[data.email, data.phone, data.location, data.links].filter(Boolean).join("  ·  ")}
          </div>
        </header>
        <div style={{ padding: "0.35in 0.6in 0.6in" }}>{ordered}</div>
      </div>
    );
  }

  // classic
  return (
    <div className="print-area mx-auto bg-white shadow-[var(--shadow-soft)]" style={{ ...base, padding: "0.6in" }}>
      <header style={{ textAlign: "center", borderBottom: `2px solid ${accent}`, paddingBottom: 10 }}>
        <h1 style={{ fontFamily: headingFont, fontSize: "26pt", fontWeight: 700, letterSpacing: "-0.01em", color: accent }}>{data.name || "Your Name"}</h1>
        <div style={{ fontSize: "11pt", color: "#4a4a4a", marginTop: 2 }}>{data.headline}</div>
        <div style={{ fontSize: "9pt", color: "#5a5a5a", marginTop: 6 }}>
          {[data.email, data.phone, data.location, data.links].filter(Boolean).join(" · ")}
        </div>
      </header>
      {ordered}
    </div>
  );
}

function SidebarBlock({ title, headingFont, children }: { title: string; headingFont: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 18, fontSize: "9.5pt" }}>
      <div style={{ fontFamily: headingFont, fontSize: "9pt", fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: 6, opacity: 0.95 }}>{title}</div>
      {children}
    </div>
  );
}

function Section({ title, accent, headingFont, children }: { title: string; accent: string; headingFont: string; children: React.ReactNode }) {
  return (
    <section style={{ marginTop: 16 }}>
      <h2 style={{ fontFamily: headingFont, fontSize: "10.5pt", fontWeight: 700, letterSpacing: "0.18em", color: accent, textTransform: "uppercase", borderBottom: `1px solid ${accent}33`, paddingBottom: 4, marginBottom: 8 }}>{title}</h2>
      {children}
    </section>
  );
}

function SummarySection({ data, accent, headingFont }: { data: ResumeData; accent: string; headingFont: string }) {
  return <Section title="Summary" accent={accent} headingFont={headingFont}><p>{data.summary}</p></Section>;
}

function ExperienceSection({ data, accent, headingFont }: { data: ResumeData; accent: string; headingFont: string }) {
  return (
    <Section title="Experience" accent={accent} headingFont={headingFont}>
      {data.experience.map(e => (
        <div key={e.id} style={{ marginBottom: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
            <div style={{ fontWeight: 600 }}>
              {e.title || "Role"} <span style={{ fontWeight: 400, color: "#4a4a4a" }}>· {e.company}</span>
            </div>
            <div style={{ color: "#666", whiteSpace: "nowrap" }}>{e.date}</div>
          </div>
          <ul style={{ marginTop: 4, marginLeft: 18, listStyle: "disc" }}>
            {e.bullets.split("\n").filter(Boolean).map((b, i) => <li key={i}>{b}</li>)}
          </ul>
        </div>
      ))}
    </Section>
  );
}

function EducationSection({ data, accent, headingFont }: { data: ResumeData; accent: string; headingFont: string }) {
  return (
    <Section title="Education" accent={accent} headingFont={headingFont}>
      {data.education.map(ed => (
        <div key={ed.id} style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 4 }}>
          <div><span style={{ fontWeight: 600 }}>{ed.degree}</span> · {ed.school}</div>
          <div style={{ color: "#666", whiteSpace: "nowrap" }}>{ed.date}</div>
        </div>
      ))}
    </Section>
  );
}

function SkillsSection({ data, accent, headingFont, template }: { data: ResumeData; accent: string; headingFont: string; template: string }) {
  if (template === "two-column") return null; // skills live in sidebar
  return <Section title="Skills" accent={accent} headingFont={headingFont}><p>{data.skills}</p></Section>;
}