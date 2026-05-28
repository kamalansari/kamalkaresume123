export type Experience = { id: string; title: string; company: string; date: string; bullets: string };
export type Education = {
  id: string;
  degree: string;
  school: string;
  date: string;
  field?: string;
  location?: string;
  gpa?: string;
  honors?: string;
};
export type Project = { id: string; name: string; link: string; date: string; bullets: string };
export type Certification = {
  id: string;
  name: string;
  issuer: string;
  date: string;
  expires?: string;
  noExpiry?: boolean;
  credentialId?: string;
  url?: string;
};
export type Award = { id: string; name: string; issuer: string; date: string };
export type Language = { id: string; name: string; level: string };

export type CustomSection = { id: string; title: string; content: string };

export type TemplateId =
  | "classic"
  | "two-column"
  | "modern"
  | "sidebar-right"
  | "compact-two"
  | "professional"
  | "executive"
  | "minimal"
  | "fresher"
  | "elegant"
  | "contemporary"
  | "bold"
  | "iconic"
  | "creative"
  | "technical"
  | "academic"
  | "startup"
  | "corporate";
export type SectionId =
  | "summary"
  | "experience"
  | "education"
  | "skills"
  | "projects"
  | "certifications"
  | "awards"
  | "languages";

// Which section types are allowed to render in a sidebar column.
// Summary/experience need full width; projects + custom sections have layouts
// that don't fit a narrow rail (kept in main for now).
export const SIDEBAR_ELIGIBLE: SectionId[] = [
  "skills",
  "languages",
  "education",
  "certifications",
  "awards",
];

// Per-template default sidebar assignment. Templates not listed here have no
// sidebar (single-column layouts) and the helper returns [].
export const TEMPLATE_SIDEBAR_DEFAULTS: Partial<Record<TemplateId, SectionId[]>> = {
  "two-column":    ["skills", "languages", "education"],
  "sidebar-right": ["skills", "languages", "education"],
  "compact-two":   ["skills", "languages", "certifications"],
  "fresher":       ["skills", "languages", "education"],
  "contemporary":  ["skills", "languages", "education"],
  "iconic":        ["skills", "languages", "education", "certifications"],
  "creative":      ["skills", "languages", "education"],
  "startup":       ["skills", "languages", "certifications"],
};

// Templates that render a sidebar column at all.
export function templateHasSidebar(template: TemplateId): boolean {
  return TEMPLATE_SIDEBAR_DEFAULTS[template] !== undefined;
}

export type FontPreset = {
  id: string;
  label: string;
  heading: string;
  body: string;
  googleHref?: string;
};

export const FONT_PRESETS: FontPreset[] = [
  { id: "sora-manrope", label: "Sora · Manrope", heading: "Sora", body: "Manrope" },
  { id: "inter", label: "Inter", heading: "Inter", body: "Inter", googleHref: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" },
  { id: "serif-source", label: "Source Serif · Source Sans", heading: "'Source Serif 4'", body: "'Source Sans 3'", googleHref: "https://fonts.googleapis.com/css2?family=Source+Sans+3:wght@400;500;600;700&family=Source+Serif+4:wght@500;600;700&display=swap" },
  { id: "plex", label: "IBM Plex Serif · Sans", heading: "'IBM Plex Serif'", body: "'IBM Plex Sans'", googleHref: "https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Serif:wght@500;600;700&display=swap" },
  { id: "playfair", label: "Playfair · Lato", heading: "'Playfair Display'", body: "Lato", googleHref: "https://fonts.googleapis.com/css2?family=Lato:wght@400;700&family=Playfair+Display:wght@600;700&display=swap" },
  { id: "dm-serif-inter", label: "DM Serif Display · Inter", heading: "'DM Serif Display'", body: "Inter", googleHref: "https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=Inter:wght@400;500;600;700&display=swap" },
  { id: "fraunces-poppins", label: "Fraunces · Poppins", heading: "Fraunces", body: "Poppins", googleHref: "https://fonts.googleapis.com/css2?family=Fraunces:wght@500;600;700&family=Poppins:wght@400;500;600;700&display=swap" },
  { id: "cormorant-jakarta", label: "Cormorant Garamond · Plus Jakarta", heading: "'Cormorant Garamond'", body: "'Plus Jakarta Sans'", googleHref: "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" },
  { id: "montserrat-lora", label: "Montserrat · Lora", heading: "Montserrat", body: "Lora", googleHref: "https://fonts.googleapis.com/css2?family=Lora:wght@400;500;600&family=Montserrat:wght@500;600;700;800&display=swap" },
  { id: "raleway-nunito", label: "Raleway · Nunito Sans", heading: "Raleway", body: "'Nunito Sans'", googleHref: "https://fonts.googleapis.com/css2?family=Nunito+Sans:wght@400;500;600;700&family=Raleway:wght@500;600;700;800&display=swap" },
  { id: "spacegrotesk-dmsans", label: "Space Grotesk · DM Sans", heading: "'Space Grotesk'", body: "'DM Sans'", googleHref: "https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap" },
  { id: "bricolage-figtree", label: "Bricolage Grotesque · Figtree", heading: "'Bricolage Grotesque'", body: "Figtree", googleHref: "https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@500;600;700;800&family=Figtree:wght@400;500;600;700&display=swap" },
];

export type ColorPreset = { id: string; label: string; hex: string };

export const COLOR_PRESETS: ColorPreset[] = [
  { id: "navy", label: "Navy", hex: "#1f3a68" },
  { id: "emerald", label: "Emerald", hex: "#0f6b4d" },
  { id: "burgundy", label: "Burgundy", hex: "#7a1f2b" },
  { id: "slate", label: "Slate", hex: "#334155" },
  { id: "teal", label: "Teal", hex: "#0d6e7a" },
  { id: "plum", label: "Plum", hex: "#5a2a6b" },
  { id: "ink", label: "Ink", hex: "#111827" },
  { id: "rust", label: "Rust", hex: "#9a3f1f" },
];

export type ResumeData = {
  name: string;
  headline: string;
  email: string;
  phone: string;
  location: string;
  links: string;
  summary: string;
  experience: Experience[];
  education: Education[];
  skills: string;
  jobDescription: string;
  template: TemplateId;
  fontId: string;
  accentHex: string;
  bgHex: string;
  fontSize: number; // base point size, 9–13
  projects: Project[];
  certifications: Certification[];
  awards: Award[];
  languages: Language[];
  extraKeywords: string; // comma-separated, ATS booster
  sectionOrder: SectionId[];
  justifyText: boolean;
  boldBody: boolean;
  customSections: CustomSection[];
  // Body line-height (unitless) and gap (px) between top-level sections.
  // Controls both the on-screen preview and printed PDF/DOCX output.
  lineHeight?: number;
  sectionSpacing?: number;
  // Separator between skills when rendered inline. Defaults to "|".
  skillSeparator?: "|" | ",";
  // Optional per-resume override of which section ids appear in the sidebar.
  // When undefined, the template default (TEMPLATE_SIDEBAR_DEFAULTS) is used.
  sidebarSections?: SectionId[];
};

export const defaultResume: ResumeData = {
  name: "Alex Morgan",
  headline: "Senior Product Designer",
  email: "alex@morgan.com",
  phone: "+1 (415) 555-0199",
  location: "San Francisco, CA",
  links: "linkedin.com/in/alexmorgan · alexmorgan.design",
  summary:
    "Senior product designer with 7+ years shipping consumer and B2B products at scale. Led design systems, conversion-focused redesigns, and 0-to-1 launches across fintech and travel.",
  experience: [
    {
      id: "e1",
      title: "Senior Product Designer",
      company: "Stripe",
      date: "2022 — Present",
      bullets:
        "Led redesign of checkout flow, lifting conversion 18% across 14 markets.\nBuilt and shipped a unified design system adopted by 40+ engineers.\nMentored 4 designers and ran weekly critiques across two product pods.",
    },
    {
      id: "e2",
      title: "Product Designer",
      company: "Airbnb",
      date: "2019 — 2022",
      bullets:
        "Shipped host onboarding overhaul, reducing time-to-list by 34%.\nPartnered with research to define 6 new evaluation metrics for the host funnel.\nDesigned and launched the trips review experience used by 80M+ guests.",
    },
  ],
  education: [
    { id: "ed1", degree: "B.S. Human-Computer Interaction", school: "Carnegie Mellon University", date: "2019" },
  ],
  skills:
    "Figma, Design Systems, User Research, Prototyping, A/B Testing, SQL, Accessibility, Information Architecture",
  jobDescription: "",
  template: "classic",
  fontId: "sora-manrope",
  accentHex: "#1f3a68",
  bgHex: "#ffffff",
  fontSize: 10.5,
  projects: [],
  certifications: [],
  awards: [],
  languages: [],
  extraKeywords: "",
  sectionOrder: ["summary", "experience", "education", "skills"],
  justifyText: true,
  boldBody: false,
  lineHeight: 1.45,
  sectionSpacing: 16,
  customSections: [],
};

// Resolve the effective sidebar section ids for a resume, respecting:
//  - the user override (data.sidebarSections) when set,
//  - otherwise the template default,
//  - filtered to ids that are currently active (in sectionOrder) and eligible.
export function getSidebarSectionIds(data: ResumeData): SectionId[] {
  const base = data.sidebarSections ?? TEMPLATE_SIDEBAR_DEFAULTS[data.template] ?? [];
  const active = new Set(data.sectionOrder);
  const eligible = new Set(SIDEBAR_ELIGIBLE);
  return base.filter(id => active.has(id) && eligible.has(id));
}