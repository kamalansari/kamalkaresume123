export type Experience = { id: string; title: string; company: string; date: string; bullets: string };
export type Education = { id: string; degree: string; school: string; date: string };

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
};