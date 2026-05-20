export function ResumePreviewMock() {
  return (
    <div className="font-sans text-[10px] leading-snug text-[oklch(0.18_0.06_260)]" style={{ aspectRatio: "8.5/11" }}>
      <div className="text-center pb-3 border-b border-[oklch(0.8_0.02_250)]">
        <div className="font-display text-xl font-bold tracking-tight">ALEX MORGAN</div>
        <div className="text-[9px] text-[oklch(0.45_0.04_258)] mt-0.5">
          Senior Product Designer · alex@morgan.com · linkedin.com/in/alexmorgan
        </div>
      </div>
      <Section title="EXPERIENCE">
        <Role company="Stripe" title="Senior Product Designer" date="2022 — Present" bullets={[
          "Led redesign of checkout flow, lifting conversion 18% across 14 markets.",
          "Built design system adopted by 40+ engineers and 12 product teams.",
        ]} />
        <Role company="Airbnb" title="Product Designer" date="2019 — 2022" bullets={[
          "Shipped host onboarding overhaul, reducing time-to-list by 34%.",
          "Partnered with research to define 6 new evaluation metrics.",
        ]} />
      </Section>
      <Section title="EDUCATION">
        <div className="flex justify-between"><span className="font-semibold">B.S. Human-Computer Interaction</span><span>2019</span></div>
        <div className="text-[oklch(0.45_0.04_258)]">Carnegie Mellon University</div>
      </Section>
      <Section title="SKILLS">
        <div className="text-[oklch(0.3_0.04_258)]">Figma · Design Systems · User Research · Prototyping · A/B Testing · SQL</div>
      </Section>
    </div>
  );
}
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-3">
      <div className="font-display font-bold text-[10px] tracking-widest text-[oklch(0.22_0.08_265)] border-b border-[oklch(0.85_0.02_250)] pb-0.5 mb-1.5">{title}</div>
      {children}
    </div>
  );
}
function Role({ company, title, date, bullets }: { company: string; title: string; date: string; bullets: string[] }) {
  return (
    <div className="mb-2">
      <div className="flex justify-between">
        <span className="font-semibold">{title} · <span className="font-normal">{company}</span></span>
        <span className="text-[oklch(0.45_0.04_258)]">{date}</span>
      </div>
      <ul className="mt-0.5 ml-3 list-disc text-[oklch(0.3_0.04_258)]">
        {bullets.map((b, i) => <li key={i}>{b}</li>)}
      </ul>
    </div>
  );
}