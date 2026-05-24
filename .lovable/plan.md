# Sidebar section move controls (up / down / left / right)

## Problem

In two-column templates (Two column, Sidebar right, Compact two, Fresher, Contemporary), the sidebar holds Skills, Languages, Education (plus optionally Certifications/Awards). Today the row controls in the Sections popover treat `sectionOrder` as one flat list:

- Up/Down moves the row by ±1 in `sectionOrder`, ignoring which column it's actually rendered in. So clicking Up on a sidebar item can swap it with a main-column item without visibly moving it inside the sidebar.
- Left/Right does the exact same thing as Up/Down (also ±1 in `sectionOrder`), so it has no column meaning.
- Column membership can only be changed via the separate PanelLeft/PanelRight toggle.

## Goal

Sidebar sections (Skills, Languages, Education, and any other sidebar-eligible section currently in the sidebar) get the same intuitive controls as main sections:

- **Up / Down** — reorder *within the same column*, skipping rows from the other column.
- **Left / Right** — move the section to the other column (sidebar ↔ main), matching the template's visual layout.

## Changes

### `src/components/builder/BuilderTopToolbar.tsx`

In `SectionsPopover`, replace the current flat `move(from, to)` wiring for `SortableRow` with column-aware handlers. Logic per row id:

1. Compute `col = sidebarModeFor(id)` — `"sidebar"`, `"main"`, `"off"` (single-col template), or `null` (not sidebar-eligible).
2. **Up/Down**: find the previous/next index in `data.sectionOrder` whose row belongs to the same column.
   - For `"off"` (no sidebar) and `null` (non-eligible section in a two-col template), "same column" = main, so behavior matches today for those.
   - For `"sidebar"` or `"main"` in a two-col template, skip over rows in the opposite column.
   - `canUp` / `canDown` reflect whether a same-column neighbor exists.
3. **Left/Right**: in two-column templates, map to "move to sidebar" or "move to main" based on which side the sidebar is on for the active template (left-sidebar: `two-column`, `compact-two`, `fresher`; right-sidebar: `sidebar-right`, `contemporary`).
   - Only enabled when the section is sidebar-eligible (`SIDEBAR_ELIGIBLE`) and moving would actually change its column.
   - "Move to sidebar" / "Move to main" calls the existing `onToggleSidebar(id)` (already wired through `Builder.tsx`, already pushes history).
   - In single-column templates (`"off"`), keep today's behavior: left/right = up/down equivalent (±1 in `sectionOrder`).

Keep the existing `PanelLeft/PanelRight` toggle button in the row — it still shows the section's current column at a glance and gives a one-click toggle. Left/Right arrows now do the same thing for sidebar-eligible rows; this is intentional symmetry with main sections.

No changes to: drag-and-drop, custom sections, `Add to resume` list, undo/redo plumbing, the toggle button, or the underlying `sectionOrder` / `sidebarSections` data model.

### Out of scope

- A separate explicit `sidebarOrder` array (current model — sidebar order = `sectionOrder` filtered — is preserved).
- Allowing `summary`, `experience`, `projects`, or custom sections in the sidebar.
- Cross-column drag-and-drop.
- Any change to `ResumeDocument.tsx`, `Builder.tsx`, or `types.ts` — all rendering and state already react correctly once `sectionOrder` / `sidebarSections` update.

## Technical detail

```text
sidebarSide(template):
  two-column | compact-two | fresher       -> "left"
  sidebar-right | contemporary             -> "right"
  otherwise                                -> none

sameColumn(idA, idB):
  colA = sidebarIds.has(idA) ? "sidebar" : "main"
  colB = sidebarIds.has(idB) ? "sidebar" : "main"
  return colA === colB  (only meaningful when template has sidebar)

onUp(i):  find largest j < i where sameColumn(order[j], order[i]); if found, arrayMove(order, i, j)
onDown(i): find smallest j > i where sameColumn(order[j], order[i]); if found, arrayMove(order, i, j)

onLeft(i):
  if no sidebar template:    move(i, i-1)
  if sidebarSide === "left"  and eligible and currently "main":    onToggleSidebar(id)
  if sidebarSide === "right" and eligible and currently "sidebar": onToggleSidebar(id)
  else: disabled

onRight(i):  mirror of onLeft
```

`canUp`/`canDown`/`canLeft`/`canRight` are derived from the same predicates so disabled buttons are accurate.
