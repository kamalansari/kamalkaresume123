import type { ResumeData } from "./types";

export function ResumeDocument({ data }: { data: ResumeData }) {
  return (
    <div className="print-area mx-auto bg-white text-[oklch(0.15_0.04_260)] shadow-[var(--shadow-soft)]"
      style={{ width: "8.5in", minHeight: "11in", padding: "0.6in", fontFamily: "Manrope, system-ui, sans-serif", fontSize: "10.5pt", lineHeight: 1.45 }}>
      <header className="text-center border-b border-[oklch(0.85_0.02_250)] pb-3">
        <h1 style={{ fontFamily: "Sora, sans-serif" }} className="text-[26pt] font-bold tracking-tight">{data.name || "Your Name"}</h1>
        <div className="text-[11pt] text-[oklch(0.4_0.04_258)] mt-1">{data.headline}</div>
        <div className="text-[9pt] text-[oklch(0.4_0.04_258)] mt-1.5">
          {[data.email, data.phone, data.location, data.links].filter(Boolean).join(" · ")}
        </div>
      </header>

      {data.summary && (
        <Section title="Summary">
          <p>{data.summary}</p>
        </Section>
      )}

      {data.experience.length > 0 && (
        <Section title="Experience">
          {data.experience.map(e => (
            <div key={e.id} className="mb-3">
              <div className="flex justify-between gap-3">
                <div className="font-semibold">{e.title || "Role"} · <span className="font-normal">{e.company}</span></div>
                <div className="text-[oklch(0.45_0.04_258)] whitespace-nowrap">{e.date}</div>
              </div>
              <ul className="mt-1 ml-4 list-disc">
                {e.bullets.split("\n").filter(Boolean).map((b, i) => <li key={i}>{b}</li>)}
              </ul>
            </div>
          ))}
        </Section>
      )}

      {data.education.length > 0 && (
        <Section title="Education">
          {data.education.map(ed => (
            <div key={ed.id} className="mb-1.5 flex justify-between gap-3">
              <div><span className="font-semibold">{ed.degree}</span> · {ed.school}</div>
              <div className="text-[oklch(0.45_0.04_258)] whitespace-nowrap">{ed.date}</div>
            </div>
          ))}
        </Section>
      )}

      {data.skills && (
        <Section title="Skills">
          <p>{data.skills}</p>
        </Section>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-4">
      <h2 style={{ fontFamily: "Sora, sans-serif" }} className="text-[10.5pt] font-bold tracking-[0.18em] text-[oklch(0.22_0.08_265)] uppercase border-b border-[oklch(0.85_0.02_250)] pb-1 mb-2">{title}</h2>
      {children}
    </section>
  );
}