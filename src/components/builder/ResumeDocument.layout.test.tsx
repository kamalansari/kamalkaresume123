import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { ResumeDocument } from "./ResumeDocument";
import { defaultResume } from "./types";
import { SIDEBAR_MAX_IN } from "./sidebarAutoFit";

/**
 * Render-level guard: the ResumeDocument grid template and the
 * `--print-sidebar-width` CSS variable used by the printed PDF must both
 * reflect the resolved sidebar width. The pure-math regression tests in
 * sidebarAutoFit.test.ts prove the resolver itself never produces a
 * clipping width; these tests prove the renderer actually consumes it.
 *
 * happy-dom does no layout, so we don't try to assert visual overflow here.
 */

afterEach(cleanup);

function renderTwoCol(overrides: Partial<typeof defaultResume>) {
  return render(
    <ResumeDocument data={{ ...defaultResume, template: "two-column", ...overrides }} />,
  );
}

describe("ResumeDocument two-column layout", () => {
  it("uses the default sidebar width (2.55in) when none is set", () => {
    const { container } = renderTwoCol({});
    const grid = container.querySelector(".resume-layout-grid") as HTMLElement;
    expect(grid).toBeTruthy();
    expect(grid.style.gridTemplateColumns).toBe("2.55in 1fr");
  });

  it("passes the user-chosen sidebar width into the grid and print CSS var", () => {
    const { container } = renderTwoCol({ sidebarWidth: 3.0, sidebarAutoFit: false });
    const grid = container.querySelector(".resume-layout-grid") as HTMLElement;
    expect(grid.style.gridTemplateColumns).toBe("3in 1fr");
    const doc = container.querySelector(".resume-document") as HTMLElement;
    expect(doc.style.getPropertyValue("--print-sidebar-width")).toBe("3in");
  });

  it("flips the sidebar onto the right for sidebar-right templates", () => {
    const { container } = render(
      <ResumeDocument
        data={{
          ...defaultResume,
          template: "sidebar-right",
          sidebarWidth: 2.8,
          sidebarAutoFit: false,
        }}
      />,
    );
    const grid = container.querySelector(".resume-layout-grid") as HTMLElement;
    expect(grid.classList.contains("resume-layout-sidebar-right")).toBe(true);
    expect(grid.style.gridTemplateColumns).toBe("1fr 2.8in");
  });

  it("clamps a sidebar width above the max into the rendered grid", () => {
    const { container } = renderTwoCol({ sidebarWidth: 99, sidebarAutoFit: false });
    const grid = container.querySelector(".resume-layout-grid") as HTMLElement;
    expect(grid.style.gridTemplateColumns).toBe(`${SIDEBAR_MAX_IN}in 1fr`);
  });

  it("clamps a sidebar width below the min into the rendered grid", () => {
    const { container } = renderTwoCol({ sidebarWidth: 0.5, sidebarAutoFit: false });
    const grid = container.querySelector(".resume-layout-grid") as HTMLElement;
    expect(grid.style.gridTemplateColumns).toBe("1.8in 1fr");
  });
});