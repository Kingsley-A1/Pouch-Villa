import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CategoryMosaic } from "@/components/category-mosaic";

vi.mock("@/components/deck-controls", () => ({ DeckControls: () => null }));

const withPhoto = {
  id: "1",
  slug: "pouches",
  name: "Pouches",
  description: null,
  parentName: null,
  productCount: 4,
  image: { thumbUrl: "/p.jpg", cardUrl: "/p.jpg", heroUrl: "/p.jpg", width: 800, height: 800 },
};

const withoutPhoto = {
  ...withPhoto,
  id: "2",
  slug: "accessories",
  name: "Accessories",
  image: null,
};

/**
 * Read once: several of these assert a CSS rule the markup depends on.
 *
 * From the working directory rather than `import.meta.url`, which jsdom does not
 * give as a `file:` URL. Vitest runs from the package root.
 */
const css = readFileSync(resolve(process.cwd(), "src/app/globals.css"), "utf8");

/** The declarations inside one selector's block, whitespace collapsed. */
function ruleBody(selector: string): string {
  const at = css.indexOf(`${selector} {`);
  if (at < 0) return "";
  return css.slice(at, css.indexOf("}", at)).replace(/\s+/g, " ");
}

describe("category mosaic", () => {
  afterEach(cleanup);

  /**
   * The bug this pins: `.pv-cat-photo` paints at `z-index: -2`, which only stays
   * above its parent's own background while that parent is a stacking context.
   * The old phone card was `relative` with a solid background and no `isolate`,
   * so every category on a phone rendered as a flat red square — no photograph,
   * and no lettered fallback either, since the fallback carries the same class.
   *
   * The card is gone and the slide is the frame at every width now, so the pairing
   * is asserted across both halves: the photo really sits inside a slide, and the
   * slide really carries the isolation. Checking only the markup would have
   * missed the original bug, which lived in the stylesheet.
   */
  it("frames the artwork in a slide that is a stacking context", () => {
    const { container } = render(<CategoryMosaic categories={[withPhoto]} />);

    const photo = container.querySelector(".pv-cat-photo");
    expect(photo).not.toBeNull();
    expect(photo?.closest(".pv-cat-slide")).not.toBeNull();

    expect(ruleBody(".pv-cat-slide")).toContain("isolation: isolate");
  });

  it("draws a letter where no photograph has been set", () => {
    render(<CategoryMosaic categories={[withoutPhoto]} />);
    expect(screen.getAllByText("A").length).toBeGreaterThan(0);
  });

  /**
   * The halo loops forever. The global reduced-motion rule collapses every
   * duration to 0.01ms, which on an infinite animation is a strobe aimed at
   * exactly the people who asked for less motion — `pv-loop` is the opt-in that
   * stops it properly, so losing it is worse than losing the animation.
   */
  it("keeps the pulsing button opted in to the reduced-motion stop", () => {
    const { container } = render(<CategoryMosaic categories={[withPhoto]} />);

    const haloed = container.querySelectorAll(".pv-cta-halo");
    expect(haloed.length).toBeGreaterThan(0);
    for (const element of haloed) expect(element.className).toContain("pv-loop");
  });

  /** White name over an arbitrary photograph is only legible because of this. */
  it("scrims every slide's photograph", () => {
    expect(ruleBody(".pv-cat-slide::after")).toContain("radial-gradient");
  });

  /**
   * The client asked for the deck on the phone too. It used to be a deck above
   * `lg` and a stack of cards below, which meant both trees shipped in the HTML
   * and a phone downloaded markup for a layout it would never show.
   */
  it("renders one deck rather than a second layout for phones", () => {
    const { container } = render(<CategoryMosaic categories={[withPhoto, withoutPhoto]} />);

    expect(container.querySelectorAll(".pv-cat-slide")).toHaveLength(2);
    // No width-switching wrappers left: one presentation, sized by CSS.
    expect(container.querySelector(".lg\\:hidden")).toBeNull();
    expect(container.querySelector(".hidden.lg\\:block")).toBeNull();
  });

  /** A deck a visitor can swipe with the controls island stripped out. */
  it("keeps the track a scroll-snap strip, not a JavaScript carousel", () => {
    const { container } = render(<CategoryMosaic categories={[withPhoto, withoutPhoto]} />);

    expect(container.querySelector(".pv-deck-track")).not.toBeNull();
    expect(ruleBody(".pv-deck-track")).toContain("scroll-snap-type: x mandatory");
  });

  it("shows nothing at all when the shop has no top categories", () => {
    const { container } = render(<CategoryMosaic categories={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
