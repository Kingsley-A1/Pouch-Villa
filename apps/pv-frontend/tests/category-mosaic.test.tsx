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
 * The bug this pins: `.pv-cat-photo` paints at `z-index: -2`, which only stays
 * above its parent's own background while that parent is a stacking context.
 * The mobile card was `relative` with a solid background and no `isolate`, so
 * every category on a phone rendered as a flat red square — no photograph, and
 * no lettered fallback either, since the fallback carries the same class.
 */
describe("category mosaic", () => {
  afterEach(cleanup);

  it("gives the phone card a stacking context, so its artwork can paint", () => {
    const { container } = render(<CategoryMosaic categories={[withPhoto]} />);

    const photo = container.querySelector(".pv-cat-photo");
    expect(photo).not.toBeNull();

    const frame = photo?.closest("a");
    expect(frame?.className).toContain("isolate");
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

  it("scrims the photograph on the phone as well as the deck", () => {
    const { container } = render(<CategoryMosaic categories={[withPhoto]} />);
    expect(container.querySelector(".pv-cat-scrim")).not.toBeNull();
  });

  it("shows nothing at all when the shop has no top categories", () => {
    const { container } = render(<CategoryMosaic categories={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
