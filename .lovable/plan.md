# Build plan — ATS Resume Builder mega-update

Your message bundles ~30 distinct features. To keep quality high I'll ship them in 4 waves. Each wave is testable on its own. Tell me to proceed and I'll start with **Wave 1**, or reorder.

## Wave 1 — Builder UX foundation (laptop + mobile)
- Responsive Builder layout (collapsible panels, mobile bottom-sheet for ATS).
- Live preview improvements: real-time updates (already wired), **zoom in/out controls**, **print** button, **shareable link** (URL-encoded resume snapshot).
- PDF export (browser print-to-PDF) + existing DOCX export polished.
- Personal Info form: input validation (zod), auto-save (already in store), profile image upload (base64 → preview/DOCX), LinkedIn/portfolio fields with URL validation.

## Wave 2 — Templates
Add 6 ATS-friendly templates as distinct designs (single + two-column variants):
Professional, Modern, Executive, Minimal, Two-Column, Fresher. Each printable & responsive. Add a template gallery with thumbnails.

## Wave 3 — AI tools
- **AI Resume Assistant chatbot** (extends existing NOVA): review, grammar fix, ATS keyword optimization, achievement bullets, recruiter recommendations — conversational UI with markdown.
- **AI Cover Letter Generator**: role + JD + tone → ATS letter, editable, download as PDF/DOCX.
- **JD Match Analyzer page**: paste/upload JD, match %, missing keywords chart, highlighted keywords, AI suggestions (extends existing `atsScore` + new viz with recharts).

## Wave 4 — Landing + polish
- New landing page: hero "Build ATS-Friendly Resume in Minutes", CTAs (Create Resume, Upload Resume), animated stats, template previews carousel, glassmorphism cards, gradients.
- **Dark/light mode** toggle (next-themes).
- Infinite scroll on Jobs page ("show more on scroll"), click job → real-time ATS score panel (already partly built — wire to drawer).
- LinkedIn optimization tool (AI rewrites headline + About from resume).

## Technical notes
- All AI calls go through existing Lovable AI gateway pattern (`google/gemini-3-flash-preview`).
- Zoom = CSS transform on preview wrapper; Print = `window.print()` + print stylesheet.
- Shareable link = LZ-compressed JSON in URL hash → `/builder#r=...`.
- Profile image stored as data URL in `ResumeData` (no backend needed; Cloud not required for this wave).
- "Unlimited downloads / Advanced ATS" are already unlimited — I'll just remove any gating copy and label features as included.

## Out of scope (flag for confirmation)
- Real auth / paywall / accounts (would need Lovable Cloud — say the word).
- True file upload parsing for "Upload Resume" (needs PDF/DOCX parsing on server — confirm if you want this in Wave 1).

Reply **"go"** to start Wave 1, or tell me which wave to start with.