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

  it("shows nothing at all when the shop has no top categories", () => {
    const { container } = render(<CategoryMosaic categories={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
