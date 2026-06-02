import { describe, it, expect } from "vitest";
import {
  clampSidebarWidth,
  computeAutoFitExtra,
  resolveSidebarWidth,
  worstOverflowPx,
  CSS_PX_PER_INCH,
  SIDEBAR_AUTOFIT_PAD_IN,
  SIDEBAR_DEFAULT_IN,
  SIDEBAR_MAX_IN,
  SIDEBAR_MIN_IN,
} from "./sidebarAutoFit";

/**
 * These tests are the canonical regression guard against the bug class
 * "two-column resume clips a sidebar heading or contact row in the preview
 * or generated PDF". They feed the auto-fit math representative
 * measurements (e.g. a long applicant name, an overflowing email link)
 * and assert that:
 *   1. The computed sidebar width is wide enough to swallow the overflow
 *      (plus a safety pad).
 *   2. The result is clamped within the document's hard min/max.
 *   3. Auto-fit never shrinks below the user's chosen baseline.
 *
 * Layout-engine-free: happy-dom returns 0 for scrollWidth/clientWidth, so
 * "render and look" tests can't catch real clipping. The math here is the
 * single source of truth the renderer consumes.
 */

describe("clampSidebarWidth", () => {
  it("clamps below the min", () => {
    expect(clampSidebarWidth(1.2)).toBe(SIDEBAR_MIN_IN);
  });
  it("clamps above the max", () => {
    expect(clampSidebarWidth(99)).toBe(SIDEBAR_MAX_IN);
  });
  it("passes through in-range values", () => {
    expect(clampSidebarWidth(2.55)).toBe(2.55);
  });
  it("returns the default for non-finite input", () => {
    expect(clampSidebarWidth(Number.NaN)).toBe(SIDEBAR_DEFAULT_IN);
    expect(clampSidebarWidth(Number.POSITIVE_INFINITY)).toBe(SIDEBAR_DEFAULT_IN);
  });
});

describe("worstOverflowPx", () => {
  it("returns 0 when nothing overflows", () => {
    expect(
      worstOverflowPx([
        { scrollWidthPx: 120, clientWidthPx: 200 },
        { scrollWidthPx: 0, clientWidthPx: 0 },
      ]),
    ).toBe(0);
  });
  it("returns the largest positive diff", () => {
    expect(
      worstOverflowPx([
        { scrollWidthPx: 210, clientWidthPx: 200 }, // +10
        { scrollWidthPx: 290, clientWidthPx: 200 }, // +90
        { scrollWidthPx: 100, clientWidthPx: 200 }, // negative — ignored
      ]),
    ).toBe(90);
  });
});

describe("computeAutoFitExtra", () => {
  const baseline = 2.0; // a moderately narrow user-chosen sidebar

  it("does nothing when nothing overflows", () => {
    const r = computeAutoFitExtra({
      userSidebarWidthIn: baseline,
      currentExtraIn: 0,
      measurements: [{ scrollWidthPx: 150, clientWidthPx: 180 }],
    });
    expect(r.didGrow).toBe(false);
    expect(r.nextExtraIn).toBe(0);
  });

  it("ignores overflow within the 1px rounding tolerance", () => {
    const r = computeAutoFitExtra({
      userSidebarWidthIn: baseline,
      currentExtraIn: 0,
      measurements: [{ scrollWidthPx: 181, clientWidthPx: 180 }],
    });
    expect(r.didGrow).toBe(false);
  });

  it("grows enough to cover the overflow plus the safety pad", () => {
    // 48px overflow ≈ 0.5in. With ~0.08in pad → +0.58in.
    const r = computeAutoFitExtra({
      userSidebarWidthIn: baseline,
      currentExtraIn: 0,
      measurements: [{ scrollWidthPx: 228, clientWidthPx: 180 }],
    });
    expect(r.didGrow).toBe(true);
    const expected = 48 / CSS_PX_PER_INCH + SIDEBAR_AUTOFIT_PAD_IN;
    expect(r.nextExtraIn).toBeCloseTo(expected, 5);
    // Effective width swallows the overflow with margin to spare.
    const effective = baseline + r.nextExtraIn;
    const requiredIn = 48 / CSS_PX_PER_INCH;
    expect(effective).toBeGreaterThanOrEqual(baseline + requiredIn);
  });

  it("respects the per-pass headroom and never exceeds SIDEBAR_MAX_IN", () => {
    // Huge overflow: 1000px ≈ 10.4in. Headroom from 2.0in baseline = 1.4in.
    const r = computeAutoFitExtra({
      userSidebarWidthIn: baseline,
      currentExtraIn: 0,
      measurements: [{ scrollWidthPx: 1180, clientWidthPx: 180 }],
    });
    expect(r.didGrow).toBe(true);
    expect(r.nextExtraIn).toBeLessThanOrEqual(SIDEBAR_MAX_IN - baseline + 1e-9);
    expect(baseline + r.nextExtraIn).toBeLessThanOrEqual(SIDEBAR_MAX_IN + 1e-9);
  });

  it("does not grow when already at the max", () => {
    const r = computeAutoFitExtra({
      userSidebarWidthIn: SIDEBAR_MAX_IN,
      currentExtraIn: 0,
      measurements: [{ scrollWidthPx: 1000, clientWidthPx: 100 }],
    });
    expect(r.didGrow).toBe(false);
    expect(r.nextExtraIn).toBe(0);
  });

  it("monotonically grows across multiple passes (never shrinks)", () => {
    let extra = 0;
    for (let pass = 0; pass < 5; pass++) {
      const r = computeAutoFitExtra({
        userSidebarWidthIn: baseline,
        currentExtraIn: extra,
        // Simulate the overflow getting smaller each pass as the column grows.
        // Even when overflow disappears, the previous extra must be retained.
        measurements: [{ scrollWidthPx: 200 - pass * 60, clientWidthPx: 180 }],
      });
      expect(r.nextExtraIn).toBeGreaterThanOrEqual(extra);
      extra = r.nextExtraIn;
    }
    expect(extra).toBeGreaterThan(0);
    expect(baseline + extra).toBeLessThanOrEqual(SIDEBAR_MAX_IN);
  });

  it("picks the worst-clipping element when several are measured", () => {
    // Use a small baseline so headroom is large enough not to cap growth,
    // isolating the "biggest overflow wins" behaviour from the MAX clamp.
    const smallBaseline = 1.8;
    const r = computeAutoFitExtra({
      userSidebarWidthIn: smallBaseline,
      currentExtraIn: 0,
      measurements: [
        // Section heading: small overflow.
        { scrollWidthPx: 190, clientWidthPx: 180 },
        // Long applicant name: biggest overflow — must drive the growth.
        { scrollWidthPx: 260, clientWidthPx: 180 },
        // Email row: medium overflow.
        { scrollWidthPx: 220, clientWidthPx: 180 },
      ],
    });
    const expected = (260 - 180) / CSS_PX_PER_INCH + SIDEBAR_AUTOFIT_PAD_IN;
    expect(r.nextExtraIn).toBeCloseTo(expected, 5);
  });

  it("clamps the user baseline before doing any math", () => {
    const r = computeAutoFitExtra({
      userSidebarWidthIn: 0.5, // below MIN
      currentExtraIn: 0,
      measurements: [{ scrollWidthPx: 400, clientWidthPx: 180 }],
    });
    // Headroom is computed from clamped MIN, not the raw 0.5.
    expect(r.nextExtraIn).toBeLessThanOrEqual(SIDEBAR_MAX_IN - SIDEBAR_MIN_IN + 1e-9);
  });
});

describe("resolveSidebarWidth", () => {
  it("returns the user width when auto-fit is off", () => {
    expect(
      resolveSidebarWidth({
        userSidebarWidthIn: 2.55,
        autoExtraIn: 0.5,
        autoFitActive: false,
      }),
    ).toBe(2.55);
  });
  it("adds the auto extra when auto-fit is active", () => {
    expect(
      resolveSidebarWidth({
        userSidebarWidthIn: 2.55,
        autoExtraIn: 0.3,
        autoFitActive: true,
      }),
    ).toBeCloseTo(2.85, 5);
  });
  it("never exceeds SIDEBAR_MAX_IN even if extra is huge", () => {
    expect(
      resolveSidebarWidth({
        userSidebarWidthIn: 3.0,
        autoExtraIn: 99,
        autoFitActive: true,
      }),
    ).toBe(SIDEBAR_MAX_IN);
  });
  it("ignores a negative autoExtraIn (defensive)", () => {
    expect(
      resolveSidebarWidth({
        userSidebarWidthIn: 2.55,
        autoExtraIn: -10,
        autoFitActive: true,
      }),
    ).toBe(2.55);
  });
});

/**
 * Property-style sweep across a realistic spread of (user width, overflow)
 * combinations representative of long names, long emails, and long section
 * titles in two-column templates. The invariant under test is the
 * end-to-end one users care about:
 *
 *   "after applying the auto-fit result, the sidebar is either wide enough
 *    to swallow the worst measured overflow, or it has hit SIDEBAR_MAX_IN
 *    (in which case the renderer falls back to overflow-wrap: anywhere)."
 */
describe("auto-fit invariant: no clipping unless at MAX", () => {
  const userWidths = [1.8, 2.0, 2.2, 2.55, 2.8, 3.0, 3.2];
  const sidebarContainerPx = 180; // representative clientWidth before growth
  const overflowingScrollPx = [185, 200, 240, 320, 480, 760];

  for (const u of userWidths) {
    for (const sw of overflowingScrollPx) {
      it(`user=${u}in, scrollWidth=${sw}px → either fits or hits MAX`, () => {
        const result = computeAutoFitExtra({
          userSidebarWidthIn: u,
          currentExtraIn: 0,
          measurements: [{ scrollWidthPx: sw, clientWidthPx: sidebarContainerPx }],
        });
        const finalWidthIn = resolveSidebarWidth({
          userSidebarWidthIn: u,
          autoExtraIn: result.nextExtraIn,
          autoFitActive: true,
        });
        const requiredExtraIn =
          Math.max(0, sw - sidebarContainerPx) / CSS_PX_PER_INCH;
        const atMax = Math.abs(finalWidthIn - SIDEBAR_MAX_IN) < 1e-6;
        const fits = finalWidthIn - u + 1e-6 >= requiredExtraIn;
        expect(atMax || fits).toBe(true);
      });
    }
  }
});

/**
 * Realistic content-shaped edge cases. Each fixture models a sidebar full
 * of plausibly-clipping elements: very long applicant names, multi-line
 * section headers (the wrap point shifts intrinsic width), and dense
 * contact rows (email + phone + location + 3 links). The invariant is the
 * same as above — fits, or pinned to MAX with the renderer's overflow-wrap
 * fallback owning the rest.
 */
describe("auto-fit edge-case fixtures (long names, multi-line headers, dense contacts)", () => {
  type Fixture = {
    name: string;
    userIn: number;
    sidebarPx: number;
    measurements: { label: string; scrollWidthPx: number }[];
  };

  const fixtures: Fixture[] = [
    {
      name: "very long hyphenated applicant name",
      userIn: 2.2,
      sidebarPx: 210,
      measurements: [
        { label: "h1 name", scrollWidthPx: 412 }, // e.g. "Maximilian-Alexander Wojciechowski"
        { label: "headline", scrollWidthPx: 240 },
        { label: "Contact heading", scrollWidthPx: 130 },
      ],
    },
    {
      name: "non-latin script with no break opportunities",
      userIn: 2.0,
      sidebarPx: 190,
      measurements: [
        { label: "h1 name (CJK)", scrollWidthPx: 305 },
        { label: "headline", scrollWidthPx: 215 },
      ],
    },
    {
      name: "multi-line SKILLS / CERTIFICATIONS / EDUCATION headers",
      userIn: 2.55,
      sidebarPx: 245,
      measurements: [
        { label: "PROFESSIONAL CERTIFICATIONS", scrollWidthPx: 298 },
        { label: "TECHNICAL SKILLS & TOOLS", scrollWidthPx: 276 },
        { label: "EDUCATION & TRAINING", scrollWidthPx: 252 },
        { label: "LANGUAGES", scrollWidthPx: 110 },
      ],
    },
    {
      name: "dense contact info (long email + 3 links)",
      userIn: 2.4,
      sidebarPx: 230,
      measurements: [
        { label: "h1 name", scrollWidthPx: 220 },
        { label: "contact-email", scrollWidthPx: 388 }, // alexandra.morgan-thompson@example.io
        { label: "contact-phone", scrollWidthPx: 175 },
        { label: "contact-location", scrollWidthPx: 260 }, // "San Francisco Bay Area, CA"
        { label: "contact-links #1", scrollWidthPx: 352 }, // linkedin.com/in/alexandra-morgan-thompson
        { label: "contact-links #2", scrollWidthPx: 318 }, // github.com/alexandra-morgan-thompson
        { label: "contact-links #3", scrollWidthPx: 296 }, // alexandra-morgan-thompson.dev
      ],
    },
    {
      name: "near-MAX baseline with one borderline overflow",
      userIn: 3.3,
      sidebarPx: 320,
      measurements: [
        { label: "h1 name", scrollWidthPx: 332 }, // 12px overflow, headroom = 0.1in (~9.6px)
      ],
    },
    {
      name: "everything fits comfortably — must not grow",
      userIn: 2.55,
      sidebarPx: 245,
      measurements: [
        { label: "h1 name", scrollWidthPx: 180 },
        { label: "contact-email", scrollWidthPx: 200 },
        { label: "SKILLS", scrollWidthPx: 90 },
      ],
    },
    {
      name: "absurd single overflow exceeding the whole document",
      userIn: 1.8,
      sidebarPx: 170,
      measurements: [
        // 900px would need 9.4+in of column — must pin to MAX without throwing.
        { label: "h1 name (pathological)", scrollWidthPx: 900 },
      ],
    },
    {
      name: "many tiny overflows, none individually large",
      userIn: 2.0,
      sidebarPx: 190,
      measurements: Array.from({ length: 12 }, (_, i) => ({
        label: `row ${i}`,
        scrollWidthPx: 196 + (i % 3) * 2, // 196 / 198 / 200 px → tiny overflows
      })),
    },
  ];

  for (const f of fixtures) {
    it(`${f.name} → no clipping (or pinned to MAX)`, () => {
      const measurements = f.measurements.map((m) => ({
        scrollWidthPx: m.scrollWidthPx,
        clientWidthPx: f.sidebarPx,
      }));
      const r = computeAutoFitExtra({
        userSidebarWidthIn: f.userIn,
        currentExtraIn: 0,
        measurements,
      });
      const finalWidthIn = resolveSidebarWidth({
        userSidebarWidthIn: f.userIn,
        autoExtraIn: r.nextExtraIn,
        autoFitActive: true,
      });

      // 1. Never below the user's baseline.
      expect(finalWidthIn).toBeGreaterThanOrEqual(Math.min(f.userIn, SIDEBAR_MAX_IN) - 1e-9);
      // 2. Never above the hard MAX.
      expect(finalWidthIn).toBeLessThanOrEqual(SIDEBAR_MAX_IN + 1e-9);

      // 3. Either every element fits in the resolved width, or we're at MAX.
      const requiredExtraIn = Math.max(
        0,
        worstOverflowPx(measurements) / CSS_PX_PER_INCH,
      );
      const atMax = Math.abs(finalWidthIn - SIDEBAR_MAX_IN) < 1e-6;
      const fits = finalWidthIn - Math.min(f.userIn, SIDEBAR_MAX_IN) + 1e-6 >= requiredExtraIn;
      expect(atMax || fits).toBe(true);

      // 4. If nothing overflowed, the column must NOT have grown.
      if (worstOverflowPx(measurements) <= 1) {
        expect(r.didGrow).toBe(false);
        expect(finalWidthIn).toBeCloseTo(Math.min(f.userIn, SIDEBAR_MAX_IN), 6);
      }
    });
  }

  it("converges in a single pass for all fixtures (no oscillation)", () => {
    for (const f of fixtures) {
      const measurements = f.measurements.map((m) => ({
        scrollWidthPx: m.scrollWidthPx,
        clientWidthPx: f.sidebarPx,
      }));
      const pass1 = computeAutoFitExtra({
        userSidebarWidthIn: f.userIn,
        currentExtraIn: 0,
        measurements,
      });
      // Simulate the next layout pass: the same elements now have at least
      // as much room as before, so reported overflow can only shrink.
      const grownClient = f.sidebarPx + pass1.nextExtraIn * CSS_PX_PER_INCH;
      const pass2Measurements = f.measurements.map((m) => ({
        scrollWidthPx: m.scrollWidthPx,
        clientWidthPx: grownClient,
      }));
      const pass2 = computeAutoFitExtra({
        userSidebarWidthIn: f.userIn,
        currentExtraIn: pass1.nextExtraIn,
        measurements: pass2Measurements,
      });
      // Second pass should not need to grow further beyond a rounding hair.
      expect(pass2.nextExtraIn).toBeLessThanOrEqual(pass1.nextExtraIn + 1 / CSS_PX_PER_INCH + 1e-9);
      expect(pass2.nextExtraIn).toBeGreaterThanOrEqual(pass1.nextExtraIn);
    }
  });
});