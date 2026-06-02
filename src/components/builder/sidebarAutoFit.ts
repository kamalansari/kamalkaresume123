/**
 * Pure helpers powering the resume sidebar's auto-fit clipping guard.
 *
 * The renderer measures each unbreakable sidebar element (name, section
 * titles, contact rows) and feeds the raw {scrollWidth, clientWidth} pairs
 * here. This module decides how much extra width (in inches) the sidebar
 * column should claim so no measured element overflows its container.
 *
 * Keeping the math in a pure module makes it trivially unit-testable —
 * jsdom/happy-dom can't compute real layout, so the only credible way to
 * verify "headings never clip in preview or PDF" is to assert this math
 * directly against representative measurements.
 */

/** Hard min/max for the sidebar column, in inches. */
export const SIDEBAR_MIN_IN = 1.8;
export const SIDEBAR_MAX_IN = 3.4;
/** Conservative default sidebar column width, in inches. */
export const SIDEBAR_DEFAULT_IN = 2.55;
/** Safety pad added on top of the worst measured overflow, in inches. */
export const SIDEBAR_AUTOFIT_PAD_IN = 0.08;
/** CSS pixels per inch at the canonical 96dpi resume document zoom. */
export const CSS_PX_PER_INCH = 96;
/** Overflow under this many CSS pixels is treated as zero (rounding noise). */
export const OVERFLOW_TOLERANCE_PX = 1;

export function clampSidebarWidth(inches: number): number {
  if (!Number.isFinite(inches)) return SIDEBAR_DEFAULT_IN;
  if (inches < SIDEBAR_MIN_IN) return SIDEBAR_MIN_IN;
  if (inches > SIDEBAR_MAX_IN) return SIDEBAR_MAX_IN;
  return inches;
}

export type SidebarMeasurement = {
  /** Intrinsic width the element wants in CSS px (e.g. `el.scrollWidth`). */
  scrollWidthPx: number;
  /** Width the element actually has in CSS px (e.g. `el.clientWidth`). */
  clientWidthPx: number;
};

/** Worst overflow in CSS pixels across all measurements (>= 0). */
export function worstOverflowPx(measurements: readonly SidebarMeasurement[]): number {
  let worst = 0;
  for (const m of measurements) {
    const diff = m.scrollWidthPx - m.clientWidthPx;
    if (diff > worst) worst = diff;
  }
  return worst;
}

export type AutoFitInput = {
  /** User-chosen sidebar width before any auto-fit growth, in inches. */
  userSidebarWidthIn: number;
  /** Extra inches already applied by previous auto-fit passes (>= 0). */
  currentExtraIn: number;
  /** Measurements collected from the live sidebar DOM. */
  measurements: readonly SidebarMeasurement[];
  /** Optional override for the safety pad (mostly for tests). */
  padIn?: number;
};

export type AutoFitResult = {
  /** Next value for currentExtraIn (>= the previous value, <= remaining headroom). */
  nextExtraIn: number;
  /** Whether the renderer should commit the new value (i.e. it actually grew). */
  didGrow: boolean;
  /** Worst measured overflow in CSS px, exposed for debug/logging. */
  worstOverflowPx: number;
};

/**
 * Decide how much additional width the sidebar needs to swallow the worst
 * measured overflow. Always clamps the final width to [MIN, MAX] and never
 * shrinks below the user's chosen width.
 */
export function computeAutoFitExtra(input: AutoFitInput): AutoFitResult {
  const pad = input.padIn ?? SIDEBAR_AUTOFIT_PAD_IN;
  const user = clampSidebarWidth(input.userSidebarWidthIn);
  const currentExtra = Math.max(0, input.currentExtraIn);
  const headroom = Math.max(0, SIDEBAR_MAX_IN - (user + currentExtra));
  const overflowPx = worstOverflowPx(input.measurements);

  if (overflowPx <= OVERFLOW_TOLERANCE_PX || headroom <= 0) {
    return { nextExtraIn: currentExtra, didGrow: false, worstOverflowPx: overflowPx };
  }

  const neededIn = overflowPx / CSS_PX_PER_INCH + pad;
  const grow = Math.min(neededIn, headroom);
  const nextExtraIn = Math.min(currentExtra + grow, SIDEBAR_MAX_IN - user);
  return {
    nextExtraIn,
    didGrow: nextExtraIn > currentExtra + 1e-6,
    worstOverflowPx: overflowPx,
  };
}

/**
 * Resolve the effective sidebar width (in inches) given the user setting,
 * any accumulated auto-fit extra, and whether auto-fit is currently active.
 */
export function resolveSidebarWidth(opts: {
  userSidebarWidthIn: number;
  autoExtraIn: number;
  autoFitActive: boolean;
}): number {
  const user = clampSidebarWidth(opts.userSidebarWidthIn);
  const extra = opts.autoFitActive ? Math.max(0, opts.autoExtraIn) : 0;
  return clampSidebarWidth(user + extra);
}