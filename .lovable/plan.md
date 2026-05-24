# Template-specific sidebar vs main section assignment

## Goal

Today the two-column templates (`two-column`, `sidebar-right`, `compact-two`) hardcode `["skills", "languages", "education"]` as the sidebar in `ResumeDocument.tsx`. Single-column templates have no sidebar. Reordering a section across the sidebar/main boundary via `sectionOrder` has no visual effect.

We want:
- A **per-template default** for which section types go in the sidebar.
- A **per-resume override** so the user can move a section between sidebar and main.
- `sectionOrder` continues to control the order **within each column**.

## What changes

### 1. Data model (`src/components/builder/types.ts`)

- Add an optional field on `ResumeData`:
  ```ts
  sidebarSections?: SectionId[];   // user override; when omitted, fall back to template default
  ```
- Add a new module-level map keyed by `TemplateId`:
  ```ts
  export const TEMPLATE_SIDEBAR_DEFAULTS: Partial<Record<TemplateId, SectionId[]>> = {
    "two-column":    ["skills", "languages", "education"],
    "sidebar-right": ["skills", "languages", "education"],
    "compact-two":   ["skills", "languages", "certifications"],
    // single-column templates omitted -> [] (no sidebar)
  };
  ```
- Helper: `getSidebarSectionIds(data: ResumeData): SectionId[]` returns `data.sidebarSections ?? TEMPLATE_SIDEBAR_DEFAULTS[data.template] ?? []`. Filtered to ids that actually exist in `data.sectionOrder` so a removed section can't linger in the sidebar.
- Sidebar-eligible types: `skills`, `languages`, `education`, `certifications`, `awards`. `summary` and `experience` stay in main (they need full width). `projects` and `customSections` stay in main for now (mixed media doesn't fit narrow sidebar typography). This list becomes a constant `SIDEBAR_ELIGIBLE: SectionId[]` next to the defaults map so the UI can use the same source of truth.

### 2. Renderer (`src/components/builder/ResumeDocument.tsx`)

- Replace the local `const sidebarSectionIds: SectionId[] = ["skills", "languages", "education"]` with `const sidebarSectionIds = getSidebarSectionIds(data)`.
- Expand `sidebarRenderers` to cover all sidebar-eligible types (add `certifications`, `awards`). Keep the dark/light handling (`dark={!compact}`) consistent with the existing blocks.
- Main column already uses `!sidebarSectionIds.includes(id)`, so it picks up everything else automatically — no further change.
- When the chosen template has no entry in `TEMPLATE_SIDEBAR_DEFAULTS` and the user hasn't set `sidebarSections`, the array is empty and the existing single-column code path runs unchanged.

### 3. Sections panel UI (`src/components/builder/BuilderTopToolbar.tsx`)

Inside the existing active-sections list (the rows with up/down/left/right buttons), add a single inline control per row:

- If the current template supports a sidebar AND the section id is in `SIDEBAR_ELIGIBLE`, render a small "Sidebar" toggle (e.g. a `Switch` or a `PanelLeft` / `PanelRight` icon button) on the right of the row.
- Toggling it calls a new prop `onToggleSidebar(id)` that flips membership in `data.sidebarSections` (initialising it from the template default on first edit). Wired through `Builder.tsx`.
- If the template has no sidebar, the toggle is hidden — no visual noise on single-column templates.

This reuses the existing `pushSectionsHistory` undo/redo machinery in `Builder.tsx` so sidebar moves are undoable like reorder moves.

### 4. Template switch behaviour

When the user changes template:
- Do **not** wipe `sidebarSections` automatically (the user's intent should survive a template swap when possible).
- The renderer already filters the array against `sectionOrder` and `SIDEBAR_ELIGIBLE`, so switching to a single-column template simply hides the sidebar without losing the override.

## Out of scope

- Letting `projects` or custom sections live in the sidebar (typography/spacing tuning is non-trivial).
- A separate `sidebarOrder` array. Sidebar order continues to be derived from `sectionOrder` filtered by membership, which matches the user's prior "respect sectionOrder" instruction.
- Drag-and-drop between columns. The left/right arrows + new toggle cover the same intent without rebuilding the DnD context.

## Files touched

- `src/components/builder/types.ts` — add `sidebarSections`, `TEMPLATE_SIDEBAR_DEFAULTS`, `SIDEBAR_ELIGIBLE`, `getSidebarSectionIds`.
- `src/components/builder/ResumeDocument.tsx` — use helper, extend `sidebarRenderers` to cover certifications + awards.
- `src/components/builder/BuilderTopToolbar.tsx` — sidebar toggle button per row.
- `src/components/builder/Builder.tsx` — `onToggleSidebar` handler, history push, prop wiring.
