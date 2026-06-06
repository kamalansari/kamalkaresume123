# Resume Builder Workspace Redesign

A focused redesign of the `/builder` workspace with a warm, friendly Enhancv-inspired aesthetic. Ships in 4 phases so each lands visibly before the next starts.

## Visual direction (Enhancv — warm & friendly)

Updates `src/styles.css` tokens only — does not touch component colors directly.

- Background: warm off-white `oklch(0.985 0.005 80)` (light) / soft charcoal `oklch(0.18 0.01 60)` (dark)
- Primary: warm coral `oklch(0.68 0.16 35)` with glow variant
- Accent: soft sage `oklch(0.78 0.08 160)` for success/score
- Surfaces: layered cream cards with subtle warm shadows
- Type: keep Inter body, add display font for headings (loaded via `<link>` in `__root.tsx`)
- Rounded `1rem` cards, generous padding, soft shadows

## Phase 1 — 3-panel workspace shell + sticky toolbar

**New files**
- `src/components/builder/workspace/WorkspaceShell.tsx` — 3-pane grid (sections rail • editor+preview • insights), collapsible left/right
- `src/components/builder/workspace/StickyToolbar.tsx` — resume name (inline edit), autosave chip, undo/redo, zoom -/+, preview mode toggle (split/editor/preview), share, download PDF
- `src/components/builder/workspace/SectionTabs.tsx` — horizontally scrollable tabs (Basics, Experience, Education, Skills, Projects, Certifications, Achievements, Languages, Custom) with completion dots + validation badges
- `src/components/builder/workspace/PreviewModeContext.tsx` — shared zoom + preview-mode state

**Edits**
- `src/components/builder/Builder.tsx` — swap to `WorkspaceShell`, move existing form sections into tab panels
- `src/routes/builder.tsx` — full-bleed layout (escape default `<main>` padding)

## Phase 2 — Drag-and-drop section management + insights panel

**Deps**: `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`

**New files**
- `src/components/builder/workspace/SectionManager.tsx` — left-rail list with drag handle, eye (hide), copy (duplicate), lock, "+ custom section"
- `src/components/builder/workspace/InsightsPanel.tsx` — right panel with 3 tabs: ATS / AI Review / Job Match (wraps existing `AtsPanel`, adds Job Match summary)
- `src/components/builder/workspace/sectionOrderStore.ts` — local + cloud-synced section order/visibility on the resume record

**Schema**
- Section order/visibility lives inside the existing `resumes.data` JSON (no new table needed). Add a `sectionLayout: { id, hidden, locked }[]` field.

## Phase 3 — Floating AI Assistant + Template Gallery

**New files**
- `src/components/builder/workspace/AiAssistantDock.tsx` — floating button bottom-right, expands to chat dock; reuses existing `/api/nova-chat` route; quick-action chips (Rewrite Summary, Improve Bullets, Generate Skills, ATS Optimize)
- `src/components/builder/workspace/TemplateGallery.tsx` — modal/sheet opened from toolbar; categorizes existing templates into ATS Optimized / Professional / Executive / Modern / Minimal / Creative; live thumbnail + Apply

**Edits**
- `src/components/builder/BuilderTopToolbar.tsx` — categorization metadata per template

## Phase 4 — Version History

**Schema migration** (single new table)

```sql
CREATE TABLE public.resume_versions (
  id uuid primary key default gen_random_uuid(),
  resume_id text not null,
  user_id uuid not null,
  data jsonb not null,
  ats_score int,
  label text,
  created_at timestamptz not null default now()
);
GRANT SELECT, INSERT, DELETE ON public.resume_versions TO authenticated;
GRANT ALL ON public.resume_versions TO service_role;
ALTER TABLE public.resume_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owners manage own versions" ON public.resume_versions
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX ON public.resume_versions (resume_id, created_at DESC);
```

**New files**
- `src/lib/versions.functions.ts` — `snapshotVersion`, `listVersions`, `restoreVersion` server fns (use `requireSupabaseAuth`)
- `src/components/builder/workspace/VersionHistorySheet.tsx` — timeline with ATS score per snapshot, Restore + Compare buttons
- Auto-snapshot on autosave throttled to every 5 min or significant change

## Out of scope (this round)

Dashboard redesign, sidebar/nav redesign, mobile drawer rework, and global app shell stay as-is. Builder workspace is internally mobile-aware (panels collapse, tabs scroll) but the global nav redesign is its own slice.

---

## Technical notes

- Tailwind v4 tokens go in `src/styles.css` `@theme` — no `tailwind.config.js`
- All section order / visibility persists through existing `resumes.data` JSON via `resumeStore`
- Version snapshots are the only new DB surface
- DnD uses `@dnd-kit` (lighter than react-dnd, modern, a11y-friendly)
- AI dock reuses `/api/nova-chat` — no new backend work
- Preview zoom uses CSS `transform: scale()` on `ResumeDocument` wrapper
