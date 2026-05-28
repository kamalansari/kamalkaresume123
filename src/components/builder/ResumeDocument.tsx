import { createContext, useContext, useEffect, useMemo } from "react";
import { Mail, Phone, MapPin, Link as LinkIcon, Sparkles, Loader2 } from "lucide-react";
import { FONT_PRESETS, getSidebarSectionIds, type ResumeData, type SectionId } from "./types";
import { parseSkills } from "@/lib/parseSkills";
import { parseInline } from "@/lib/inlineFormat";
import { jdKeywordSet, isJdKeyword, COMMON_ATS_KEYWORD_SET } from "./atsScore";

const KeywordContext = createContext<Set<string> | null>(null);

const WORD_RE = /[A-Za-z][A-Za-z0-9+.#-]{2,}/g;

function renderWithKeywords(text: string, set: Set<string>): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  WORD_RE.lastIndex = 0;
  while ((m = WORD_RE.exec(text)) !== null) {
    if (isJdKeyword(m[0], set)) {
      if (m.index > last) parts.push(text.slice(last, m.index));
      parts.push(<strong key={m.index} style={{ fontWeight: 700 }}>{m[0]}</strong>);
      last = m.index + m[0].length;
    }
  }
  if (last === 0) return text;
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts}</>;
}

function InlineText({ text }: { text: string }) {
  const set = useContext(KeywordContext);
  return (
    <>
      {parseInline(text).map((r, i) => {
        const inner = r.bold
          ? r.text
          : set && set.size
            ? renderWithKeywords(r.text, set)
            : r.text;
        const style: React.CSSProperties = {};
        if (r.bold) style.fontWeight = 700;
        if (r.italic) style.fontStyle = "italic";
        if (r.underline) style.textDecoration = "underline";
        if (r.bold || r.italic || r.underline) {
          return <span key={i} style={style}>{inner}</span>;
        }
        return <span key={i}>{inner}</span>;
      })}
    </>
  );
}

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

function splitLinks(s: string): string[] {
  return s.split(/[·,|]/g).map(x => x.trim()).filter(Boolean);
}

export type EditableRewriteKind = "summary" | "skills" | "experience-bullets";

export type EditableHandlers = {
  onUpdate: (patch: Partial<ResumeData>) => void;
  onUpdateExperienceBullets: (id: string, bullets: string) => void;
  onRewrite: (kind: EditableRewriteKind, refId?: string) => void;
  rewritingKey?: string | null;
};

export function ResumeDocument({
  data,
  onSectionClick,
  editable,
  handlers,
  flashSection,
}: {
  data: ResumeData;
  onSectionClick?: (id: SectionId | "header") => void;
  editable?: boolean;
  handlers?: EditableHandlers;
  flashSection?: SectionId | null;
}) {
  useFont(data.fontId);
  const preset = FONT_PRESETS.find(f => f.id === data.fontId) ?? FONT_PRESETS[0];
  const headingFont = `${preset.heading}, system-ui, sans-serif`;
  const bodyFont = `${preset.body}, system-ui, sans-serif`;
  // Per-template accent overrides. New templates get a distinct hue so the
  // user immediately sees a visual difference even when they share a layout.
  const TEMPLATE_ACCENT: Partial<Record<typeof data.template, string>> = {
    minimal: "#1f1f1f",
    iconic: "#0d8a8a",
    creative: "#7c3aed",
    technical: "#334155",
    academic: "#7a1f3d",
    startup: "#ea580c",
    corporate: "#0f2a52",
  };
  const accent = TEMPLATE_ACCENT[data.template] ?? data.accentHex;
  const fs = data.fontSize ?? 10.5;
  // Map new template ids onto base layouts while preserving distinct vibes.
  const VARIANT_MAP: Record<typeof data.template, "classic" | "modern" | "two-column" | "sidebar-right" | "compact-two"> = {
    classic: "classic",
    "two-column": "two-column",
    modern: "modern",
    "sidebar-right": "sidebar-right",
    "compact-two": "compact-two",
    professional: "classic",
    minimal: "classic",
    elegant: "classic",
    executive: "modern",
    bold: "modern",
    fresher: "compact-two",
    contemporary: "sidebar-right",
    iconic: "two-column",
    creative: "sidebar-right",
    technical: "modern",
    academic: "classic",
    startup: "compact-two",
    corporate: "classic",
  };
  const variant = VARIANT_MAP[data.template] ?? "classic";

  const ed = editable && handlers ? handlers : undefined;
  const kwSet = useMemo(() => {
    const set = new Set<string>(COMMON_ATS_KEYWORD_SET);
    for (const k of jdKeywordSet(data.jobDescription || "")) set.add(k);
    return set;
  }, [data.jobDescription]);

  const wrap = (id: SectionId, node: React.ReactNode) => (
    <ClickableSection key={id} id={id} onClick={onSectionClick} flash={flashSection === id}>{node}</ClickableSection>
  );

  const sections: Record<SectionId, React.ReactNode> = {
    summary: (data.summary || ed) ? wrap("summary", <SummarySection data={data} accent={accent} headingFont={headingFont} ed={ed} />) : null,
    experience: data.experience.length ? wrap("experience", <ExperienceSection data={data} accent={accent} headingFont={headingFont} ed={ed} />) : null,
    education: data.education.length ? wrap("education", <EducationSection data={data} accent={accent} headingFont={headingFont} />) : null,
    skills: (data.skills || ed) ? wrap("skills", <SkillsSection data={data} accent={accent} headingFont={headingFont} template={variant} ed={ed} />) : null,
    projects: data.projects?.length ? wrap("projects", <ProjectsSection data={data} accent={accent} headingFont={headingFont} />) : null,
    certifications: data.certifications?.length ? wrap("certifications", <CertSection data={data} accent={accent} headingFont={headingFont} />) : null,
    awards: data.awards?.length ? wrap("awards", <AwardsSection data={data} accent={accent} headingFont={headingFont} />) : null,
    languages: data.languages?.length ? wrap("languages", <LanguagesSection data={data} accent={accent} headingFont={headingFont} template={variant} />) : null,
  };

  const ordered = data.sectionOrder.map(id => sections[id]);

  const customBlocks = (data.customSections ?? []).filter(c => (c.title?.trim() || c.content?.trim())).map(c => (
    <section key={c.id} style={{ marginTop: 14 }}>
      <h2 style={{ fontFamily: headingFont, fontSize: `${fs + 1.5}pt`, fontWeight: 700, color: accent, textTransform: "uppercase", letterSpacing: "0.06em", borderBottom: `1px solid ${accent}33`, paddingBottom: 4, marginBottom: 6 }}>{c.title || "Custom section"}</h2>
      <div style={{ whiteSpace: "pre-wrap" }}><InlineText text={c.content || ""} /></div>
    </section>
  ));

  const base = {
    width: "8.5in",
    minHeight: "11in",
    fontFamily: bodyFont,
    fontSize: `${fs}pt`,
    lineHeight: 1.45,
    color: "#1a1a1a",
    background: data.bgHex || "#ffffff",
    textAlign: data.justifyText ? "justify" : "left",
    fontWeight: data.boldBody ? 600 : 400,
    hyphens: "auto",
    WebkitHyphens: "auto",
    msHyphens: "auto",
    textJustify: "inter-word",
  } as React.CSSProperties;

  const contactLine = (
    <ContactRow data={data} color="#5a5a5a" />
  );

  const headerClickProps = onSectionClick
    ? { onClick: () => onSectionClick("header"), className: "preview-clickable", title: "Click to edit personal details" }
    : {};

  if (variant === "two-column" || variant === "sidebar-right" || variant === "compact-two") {
    const sidebarRight = variant === "sidebar-right";
    const compact = variant === "compact-two";
    const sidebarBg = compact ? "#f4f3ef" : accent;
    const sidebarText = compact ? "#1a1a1a" : "#ffffff";
    const sidebarSectionIds = getSidebarSectionIds(data);
    const sidebarRenderers: Partial<Record<SectionId, React.ReactNode>> = {
      skills: data.skills ? (
        <SidebarFlashWrap key="skills" flash={flashSection === "skills"}><SidebarBlock title="Skills" headingFont={headingFont} dark={!compact}>
          <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
            {parseSkills(data.skills).map((s, i) => (
              <li key={i} style={{ marginBottom: 3 }}>• {s}</li>
            ))}
          </ul>
        </SidebarBlock></SidebarFlashWrap>
      ) : null,
      languages: data.languages?.length ? (
        <SidebarFlashWrap key="languages" flash={flashSection === "languages"}><SidebarBlock title="Languages" headingFont={headingFont} dark={!compact}>
          {data.languages.map(l => (
            <div key={l.id} style={{ marginBottom: 3 }}>{l.name}{l.level ? ` — ${l.level}` : ""}</div>
          ))}
        </SidebarBlock></SidebarFlashWrap>
      ) : null,
      education: data.education.length ? (
        <SidebarFlashWrap key="education" flash={flashSection === "education"}><SidebarBlock title="Education" headingFont={headingFont} dark={!compact}>
          {data.education.map(ed => (
            <div key={ed.id} style={{ marginBottom: 6 }}>
              <div style={{ fontWeight: 600 }}>{ed.degree}</div>
              <div style={{ opacity: 0.9 }}>{ed.school}</div>
              <div style={{ opacity: 0.75, fontSize: `${fs - 1.5}pt` }}>{ed.date}</div>
            </div>
          ))}
        </SidebarBlock></SidebarFlashWrap>
      ) : null,
      certifications: data.certifications?.length ? (
        <SidebarFlashWrap key="certifications" flash={flashSection === "certifications"}><SidebarBlock title="Certifications" headingFont={headingFont} dark={!compact}>
          {data.certifications.map(c => (
            <div key={c.id} style={{ marginBottom: 6 }}>
              <div style={{ fontWeight: 600 }}>{c.name}</div>
              <div style={{ opacity: 0.9 }}>{c.issuer}</div>
              {c.date && <div style={{ opacity: 0.75, fontSize: `${fs - 1.5}pt` }}>{c.date}</div>}
            </div>
          ))}
        </SidebarBlock></SidebarFlashWrap>
      ) : null,
      awards: data.awards?.length ? (
        <SidebarFlashWrap key="awards" flash={flashSection === "awards"}><SidebarBlock title="Awards" headingFont={headingFont} dark={!compact}>
          {data.awards.map(a => (
            <div key={a.id} style={{ marginBottom: 6 }}>
              <div style={{ fontWeight: 600 }}>{a.name}</div>
              <div style={{ opacity: 0.9 }}>{a.issuer}</div>
              {a.date && <div style={{ opacity: 0.75, fontSize: `${fs - 1.5}pt` }}>{a.date}</div>}
            </div>
          ))}
        </SidebarBlock></SidebarFlashWrap>
      ) : null,
    };
    const sidebar = (
      <aside {...headerClickProps} style={{ background: sidebarBg, color: sidebarText, padding: "0.55in 0.4in", cursor: onSectionClick ? "pointer" : undefined }}>
        <h1 style={{ fontFamily: headingFont, fontSize: `${fs * 2}pt`, lineHeight: 1.1, fontWeight: 700, color: compact ? accent : sidebarText }}>{data.name || "Your Name"}</h1>
        <div style={{ fontSize: `${fs}pt`, opacity: compact ? 0.85 : 0.9, marginTop: 4 }}>{data.headline}</div>
        <div style={{ height: 1, background: compact ? "rgba(0,0,0,0.12)" : "rgba(255,255,255,0.3)", margin: "16px 0" }} />
        <SidebarBlock title="Contact" headingFont={headingFont} dark={!compact}>
          <SidebarContact data={data} dark={!compact} />
        </SidebarBlock>
        {data.sectionOrder.filter(id => sidebarSectionIds.includes(id)).map(id => sidebarRenderers[id])}
      </aside>
    );
    const main = (
      <main style={{ padding: "0.55in 0.5in" }}>
        {data.sectionOrder.filter(id => !sidebarSectionIds.includes(id)).map(id => sections[id])}
        {customBlocks}
      </main>
    );
    return (
      <KeywordContext.Provider value={kwSet}>
      <div lang="en" className="print-area mx-auto shadow-[var(--shadow-soft)]" style={base}>
        <div className="grid" style={{ gridTemplateColumns: sidebarRight ? "1fr 2.6in" : "2.6in 1fr", minHeight: "11in" }}>
          {sidebarRight ? main : sidebar}
          {sidebarRight ? sidebar : main}
        </div>
      </div>
      </KeywordContext.Provider>
    );
  }

  if (variant === "modern") {
    const exec = data.template === "executive" || data.template === "bold";
    return (
      <KeywordContext.Provider value={kwSet}>
      <div lang="en" className="print-area mx-auto shadow-[var(--shadow-soft)]" style={base}>
        <header {...headerClickProps} style={{ padding: "0.5in 0.6in", background: accent, color: "#fff", cursor: onSectionClick ? "pointer" : undefined, borderBottom: exec ? "4px solid rgba(0,0,0,0.35)" : undefined }}>
          <h1 style={{ fontFamily: headingFont, fontSize: `${fs * 2.6}pt`, fontWeight: 800, letterSpacing: exec ? "0.08em" : "-0.01em", textTransform: exec ? "uppercase" : undefined }}>{data.name || "Your Name"}</h1>
          <div style={{ fontSize: `${fs + 1.5}pt`, opacity: 0.92, marginTop: 2 }}>{data.headline}</div>
          <div style={{ marginTop: 8, color: "#fff", opacity: 0.92 }}><ContactRow data={data} color="#ffffff" /></div>
        </header>
        <div style={{ padding: "0.35in 0.6in 0.6in" }}>{ordered}</div>
        <div style={{ padding: "0 0.6in 0.6in" }}>{customBlocks}</div>
      </div>
      </KeywordContext.Provider>
    );
  }

  // classic (also used for "professional" and "minimal")
  const isProfessional = data.template === "professional";
  const isMinimal = data.template === "minimal";
  return (
    <KeywordContext.Provider value={kwSet}>
    <div lang="en" className="print-area mx-auto shadow-[var(--shadow-soft)]" style={{ ...base, padding: "0.6in" }}>
      <header {...headerClickProps} style={{ textAlign: isMinimal ? "left" : "center", borderBottom: isMinimal ? `1px solid #d4d4d4` : `2px solid ${accent}`, paddingBottom: 10, cursor: onSectionClick ? "pointer" : undefined }}>
        <h1 style={{ fontFamily: headingFont, fontSize: `${fs * (isMinimal ? 2.1 : 2.45)}pt`, fontWeight: isMinimal ? 600 : 700, letterSpacing: isProfessional ? "0.12em" : "-0.01em", textTransform: isProfessional ? "uppercase" : undefined, color: isMinimal ? "#1a1a1a" : accent }}>{data.name || "Your Name"}</h1>
        <div style={{ fontSize: `${fs + 0.5}pt`, color: "#4a4a4a", marginTop: 2 }}>{data.headline}</div>
        <div style={{ marginTop: 6, display: "flex", justifyContent: isMinimal ? "flex-start" : "center" }}>{contactLine}</div>
      </header>
      {ordered}
      {customBlocks}
    </div>
    </KeywordContext.Provider>
  );
}

function ClickableSection({ id, onClick, children, flash }: { id: SectionId; onClick?: (id: SectionId | "header") => void; children: React.ReactNode; flash?: boolean }) {
  const cls = [onClick ? "preview-clickable" : "", flash ? "preview-flash" : ""].filter(Boolean).join(" ");
  if (!onClick && !flash) return <>{children}</>;
  return (
    <div
      onClick={onClick ? () => onClick(id) : undefined}
      key={flash ? "flash-on" : "flash-off"}
      className={cls}
      style={{ cursor: "pointer", borderRadius: 4 }}
      title={onClick ? "Click to edit this section" : undefined}
    >
      {children}
    </div>
  );
}

function SidebarFlashWrap({ flash, children }: { flash: boolean; children: React.ReactNode }) {
  if (!flash) return <>{children}</>;
  return <div key="flash-on" className="preview-flash">{children}</div>;
}

function ContactRow({ data, color }: { data: ResumeData; color: string }) {
  const iconSize = 11;
  const items: { icon: React.ReactNode; text: string }[] = [];
  if (data.email) items.push({ icon: <Mail size={iconSize} />, text: data.email });
  if (data.phone) items.push({ icon: <Phone size={iconSize} />, text: data.phone });
  if (data.location) items.push({ icon: <MapPin size={iconSize} />, text: data.location });
  splitLinks(data.links).forEach(l => items.push({ icon: <LinkIcon size={iconSize} />, text: l }));
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 14px", color, fontSize: "9.5pt", alignItems: "center" }}>
      {items.map((it, i) => (
        <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
          <span style={{ display: "inline-flex" }}>{it.icon}</span>{it.text}
        </span>
      ))}
    </div>
  );
}

function SidebarContact({ data, dark }: { data: ResumeData; dark: boolean }) {
  const items: { icon: React.ReactNode; text: string }[] = [];
  if (data.email) items.push({ icon: <Mail size={11} />, text: data.email });
  if (data.phone) items.push({ icon: <Phone size={11} />, text: data.phone });
  if (data.location) items.push({ icon: <MapPin size={11} />, text: data.location });
  splitLinks(data.links).forEach(l => items.push({ icon: <LinkIcon size={11} />, text: l }));
  return (
    <div>
      {items.map((it, i) => (
        <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 6, marginBottom: 4, wordBreak: "break-word", opacity: dark ? 0.95 : 1 }}>
          <span style={{ display: "inline-flex", marginTop: 2 }}>{it.icon}</span>
          <span style={{ flex: 1 }}>{it.text}</span>
        </div>
      ))}
    </div>
  );
}

function SidebarBlock({ title, headingFont, children, dark }: { title: string; headingFont: string; children: React.ReactNode; dark: boolean }) {
  return (
    <div style={{ marginBottom: 18, fontSize: "9.5pt" }}>
      <div style={{ fontFamily: headingFont, fontSize: "9pt", fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: 6, opacity: dark ? 0.95 : 0.7 }}>{title}</div>
      {children}
    </div>
  );
}

function Section({ title, accent, headingFont, children, ed, kind }: { title: string; accent: string; headingFont: string; children: React.ReactNode; ed?: EditableHandlers; kind?: EditableRewriteKind }) {
  return (
    <section style={{ marginTop: 16 }}>
      <h2 style={{ fontFamily: headingFont, fontSize: "10.5pt", fontWeight: 700, letterSpacing: "0.18em", color: accent, textTransform: "uppercase", borderBottom: `1px solid ${accent}33`, paddingBottom: 4, marginBottom: 8, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span>{title}</span>
        {ed && kind && kind !== "experience-bullets" && (
          <RewriteButton busy={ed.rewritingKey === kind} onClick={() => ed.onRewrite(kind)} />
        )}
      </h2>
      {children}
    </section>
  );
}

function SummarySection({ data, accent, headingFont, ed }: { data: ResumeData; accent: string; headingFont: string; ed?: EditableHandlers }) {
  return (
    <Section title="Summary" accent={accent} headingFont={headingFont} ed={ed} kind="summary">
      {ed ? (
        <p
          key={`summary-${data.summary}`}
          contentEditable
          suppressContentEditableWarning
          data-preview-edit="summary"
          className="preview-editable"
          onClick={e => e.stopPropagation()}
          onBlur={e => ed.onUpdate({ summary: e.currentTarget.innerText })}
          style={{ textAlign: "justify" }}
        >{data.summary}</p>
      ) : (
        <p style={{ textAlign: "justify" }}><InlineText text={data.summary} /></p>
      )}
    </Section>
  );
}

function ExperienceSection({ data, accent, headingFont, ed }: { data: ResumeData; accent: string; headingFont: string; ed?: EditableHandlers }) {
  return (
    <Section title="Experience" accent={accent} headingFont={headingFont}>
      {data.experience.map(e => (
        <div key={e.id} style={{ marginBottom: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
            <div style={{ fontWeight: 600 }}>
              {e.title || "Role"} <span style={{ fontWeight: 400, color: "#4a4a4a" }}>· {e.company}</span>
            </div>
            <div style={{ color: "#666", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 6 }}>
              <span>{e.date}</span>
              {ed && <RewriteButton busy={ed.rewritingKey === `exp-${e.id}`} onClick={() => ed.onRewrite("experience-bullets", e.id)} />}
            </div>
          </div>
          {ed ? (
            <div
              key={`exp-${e.id}-${e.bullets}`}
              contentEditable
              suppressContentEditableWarning
              data-preview-edit="experience-bullets"
              data-preview-exp-id={e.id}
              className="preview-editable"
              style={{ marginTop: 4, marginLeft: 18, whiteSpace: "pre-wrap", textAlign: "justify" }}
              onClick={ev => ev.stopPropagation()}
              onBlur={ev => ed.onUpdateExperienceBullets(e.id, ev.currentTarget.innerText.replace(/^•\s*/gm, ""))}
            >
              {e.bullets.split("\n").filter(Boolean).map((b, i) => (
                <div key={i}>• {b}</div>
              ))}
            </div>
          ) : (
            <ul style={{ marginTop: 4, marginLeft: 18, listStyle: "disc", textAlign: "justify" }}>
              {e.bullets.split("\n").filter(Boolean).map((b, i) => <li key={i}><InlineText text={b} /></li>)}
            </ul>
          )}
        </div>
      ))}
    </Section>
  );
}

function EducationSection({ data, accent, headingFont }: { data: ResumeData; accent: string; headingFont: string }) {
  return (
    <Section title="Education" accent={accent} headingFont={headingFont}>
      {data.education.map(ed => {
        const degreeLine = [ed.degree, ed.field].filter(Boolean).join(", ");
        const meta = [ed.gpa ? `GPA ${ed.gpa}` : "", ed.honors ?? ""].filter(Boolean).join(" · ");
        return (
          <div key={ed.id} style={{ marginBottom: 6 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
              <div>
                <span style={{ fontWeight: 600 }}>{degreeLine || ed.degree}</span>
                {ed.school ? <> · {ed.school}</> : null}
                {ed.location ? <span style={{ color: "#666" }}> · {ed.location}</span> : null}
              </div>
              <div style={{ color: "#666", whiteSpace: "nowrap" }}>{ed.date}</div>
            </div>
            {meta && <div style={{ color: "#555", fontSize: "0.92em", marginTop: 2 }}>{meta}</div>}
          </div>
        );
      })}
    </Section>
  );
}

function SkillsSection({ data, accent, headingFont, template, ed }: { data: ResumeData; accent: string; headingFont: string; template: string; ed?: EditableHandlers }) {
  if (template === "two-column" || template === "sidebar-right" || template === "compact-two") return null;
  return (
    <Section title="Skills" accent={accent} headingFont={headingFont} ed={ed} kind="skills">
      {ed ? (
        <p
          key={`skills-${data.skills}`}
          contentEditable
          suppressContentEditableWarning
          data-preview-edit="skills"
          className="preview-editable"
          onClick={e => e.stopPropagation()}
          onBlur={e => ed.onUpdate({ skills: e.currentTarget.innerText })}
        >{parseSkills(data.skills).join(" | ")}</p>
      ) : (
        <p>{parseSkills(data.skills).join(" | ")}</p>
      )}
    </Section>
  );
}

function ProjectsSection({ data, accent, headingFont }: { data: ResumeData; accent: string; headingFont: string }) {
  return (
    <Section title="Projects" accent={accent} headingFont={headingFont}>
      {data.projects.map(p => (
        <div key={p.id} style={{ marginBottom: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
            <div style={{ fontWeight: 600 }}>{p.name}{p.link ? <span style={{ fontWeight: 400, color: "#4a4a4a" }}> · {p.link}</span> : null}</div>
            <div style={{ color: "#666", whiteSpace: "nowrap" }}>{p.date}</div>
          </div>
          {p.bullets && (
            <ul style={{ marginTop: 4, marginLeft: 18, listStyle: "disc" }}>
              {p.bullets.split("\n").filter(Boolean).map((b, i) => <li key={i}><InlineText text={b} /></li>)}
            </ul>
          )}
        </div>
      ))}
    </Section>
  );
}

function CertSection({ data, accent, headingFont }: { data: ResumeData; accent: string; headingFont: string }) {
  return (
    <Section title="Certifications" accent={accent} headingFont={headingFont}>
      {data.certifications.map(c => {
        const dateLine = c.noExpiry
          ? c.date
          : c.expires
          ? `${c.date}${c.date ? " — " : ""}${c.expires}`
          : c.date;
        const meta = [c.credentialId ? `ID: ${c.credentialId}` : "", c.url ?? ""].filter(Boolean).join(" · ");
        return (
          <div key={c.id} style={{ marginBottom: 6 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
              <div><span style={{ fontWeight: 600 }}>{c.name}</span>{c.issuer ? ` · ${c.issuer}` : ""}</div>
              <div style={{ color: "#666", whiteSpace: "nowrap" }}>{dateLine}</div>
            </div>
            {meta && <div style={{ color: "#555", fontSize: "0.92em", marginTop: 2 }}>{meta}</div>}
          </div>
        );
      })}
    </Section>
  );
}

function AwardsSection({ data, accent, headingFont }: { data: ResumeData; accent: string; headingFont: string }) {
  return (
    <Section title="Awards" accent={accent} headingFont={headingFont}>
      {data.awards.map(a => (
        <div key={a.id} style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 4 }}>
          <div><span style={{ fontWeight: 600 }}>{a.name}</span>{a.issuer ? ` · ${a.issuer}` : ""}</div>
          <div style={{ color: "#666", whiteSpace: "nowrap" }}>{a.date}</div>
        </div>
      ))}
    </Section>
  );
}

function LanguagesSection({ data, accent, headingFont, template }: { data: ResumeData; accent: string; headingFont: string; template: string }) {
  if (template === "two-column" || template === "sidebar-right" || template === "compact-two") return null;
  return (
    <Section title="Languages" accent={accent} headingFont={headingFont}>
      <p>{data.languages.map(l => `${l.name}${l.level ? ` (${l.level})` : ""}`).join(" · ")}</p>
    </Section>
  );
}

function RewriteButton({ onClick, busy }: { onClick: () => void; busy?: boolean }) {
  return (
    <button
      onClick={e => { e.stopPropagation(); onClick(); }}
      title="AI rewrite this section"
      className="no-print"
      style={{
        display: "inline-flex", alignItems: "center", gap: 3, fontSize: "8pt",
        padding: "2px 6px", borderRadius: 4, border: "1px solid currentColor",
        opacity: 0.75, cursor: "pointer", background: "transparent", color: "inherit",
        letterSpacing: 0, textTransform: "none", fontWeight: 500,
      }}
    >
      {busy ? <Loader2 size={9} className="animate-spin" /> : <Sparkles size={9} />} AI
    </button>
  );
}