# Highlight moved section in preview

## Goal

When a section is reordered (up/down within a column) or moved between columns (left/right / sidebar toggle), briefly highlight it in the live preview so the user can immediately confirm where it landed.

## Approach

Track the most-recently-moved section id with a short-lived state in `Builder.tsx`, pass it into `ResumeDocument`, and have `ClickableSection` (which already wraps every section) apply a temporary highlight class.

### `src/components/builder/Builder.tsx`

- Add `const [flashSection, setFlashSection] = useState<SectionId | null>(null)`.
- Add a helper `flash(id: SectionId)` that sets the state and clears it after ~1200 ms via `setTimeout` (cancel previous timer with a ref so rapid moves restart the animation cleanly).
- Call `flash(id)` from the SectionsPopover callbacks:
  - `onUpdate(order)` — diff old vs new `sectionOrder`; the moved id is the one whose index changed the most (or simply the first id whose index differs). Flash it.
  - `onToggleSidebar(id)` — flash `id`.
  - `onAdd(id)` — flash `id` so newly added sections also pulse.
- Pass `flashSection` to `<ResumeDocument flashSection={flashSection} ... />` (one preview at a time; if multiple ResumeDocument instances exist for print/preview, only the visible editing one needs it).

### `src/components/builder/ResumeDocument.tsx`

- Add optional prop `flashSection?: SectionId | null`.
- Forward to `ClickableSection` via the existing `wrap(id, node)` helper: add a `flash` boolean (`flashSection === id`).
- In `ClickableSection`, when `flash` is true add a CSS class like `preview-flash` alongside `preview-clickable`. Use `key={\`flash-${flash}\`}` (or a small `useEffect` toggle) so the animation re-triggers each time the flag flips on.
- Sidebar-rendered sections in two-column templates render via `sidebarRenderers` (not via `ClickableSection`). Wrap each sidebar block in a thin `<div data-section-id={id} className={flash ? "preview-flash" : undefined}>` so sidebar reorder/toggle also highlights.

### `src/styles.css` (or the existing builder stylesheet — locate the `preview-clickable` rule and add next to it)

Add a keyframe + class:

```css
@keyframes preview-flash {
  0%   { background-color: color-mix(in oklab, var(--primary) 28%, transparent); box-shadow: 0 0 0 2px color-mix(in oklab, var(--primary) 40%, transparent); }
  100% { background-color: transparent; box-shadow: 0 0 0 0 transparent; }
}
.preview-flash {
  animation: preview-flash 1.1s ease-out;
  border-radius: 4px;
}
```

(Uses existing `--primary` token; no hard-coded colors.)

## Out of scope

- A "moved to position N" text label or toast — the visual pulse on the new location is enough confirmation.
- Animating the actual position transition (would require layout animation infrastructure not currently in the preview).
- Highlighting custom-section reorders (can be added later with the same pattern if needed).

## Technical notes

- A single `useRef<number | null>` holds the active timeout so consecutive moves restart cleanly without leaking timers.
- Sidebar sections currently render through plain `<SidebarBlock>` calls (no `ClickableSection`); the wrapper div above adds the highlight without changing layout or click behavior.
- No data-model changes; `flashSection` is pure transient UI state.
