import { cleanup, render, screen } from "@testing-library/react";
import axe from "axe-core";
import { afterEach, describe, expect, it } from "vitest";
import type { CategoryNode } from "@pv/backend/services/catalogue";
import { CategoryFilter } from "@/components/category-filter";

const leaf = (slug: string, name: string, children: CategoryNode[] = []): CategoryNode => ({
  id: `id-${slug}`,
  slug,
  name,
  description: null,
  children,
});

const categories: CategoryNode[] = [
  leaf("pouches", "Pouches", [leaf("protective", "Protective")]),
  leaf("accessories", "Accessories"),
];

/**
 * The selected pill rendered as a white shape with nothing written on it.
 *
 * The class was always there — `text-(--pv-on-brand)` — but globals.css declared
 * `a { color: inherit }` outside any cascade layer, and unlayered styles beat
 * every Tailwind utility no matter how specific. The pill inherited `--pv-ink`,
 * which on the red storefront is white, and painted white on white.
 *
 * These assertions cover the component's half of that contract; the layering it
 * depends on is asserted in `stylesheet-layers.test.ts`, because a component
 * test in jsdom cannot see a stylesheet Next compiles at build time.
 */
describe("category filter", () => {
  afterEach(cleanup);

  it("gives the selected pill a label colour, not just a background", () => {
    render(<CategoryFilter categories={categories} activeSlug="pouches" />);

    const selected = screen.getByRole("link", { name: "Pouches" });
    expect(selected).toHaveAttribute("aria-current", "page");
    // The pair is the point: a filled pill that never states its own text colour
    // is a pill that inherits whatever the surrounding theme happens to be.
    expect(selected.className).toContain("bg-(--pv-red)");
    expect(selected.className).toContain("text-(--pv-on-brand)");
  });

  it("marks exactly one pill as current, and flattens both tiers into the row", () => {
    render(<CategoryFilter categories={categories} activeSlug="protective" />);

    const links = screen.getAllByRole("link");
    expect(links.map((link) => link.textContent)).toEqual([
      "All",
      "Pouches",
      "Protective",
      "Accessories",
    ]);
    expect(links.filter((link) => link.ariaCurrent === "page")).toHaveLength(1);
  });

  it("selects All when nothing is filtered", () => {
    render(<CategoryFilter categories={categories} />);

    expect(screen.getByRole("link", { name: "All" })).toHaveAttribute("aria-current", "page");
  });

  /**
   * The row bleeds past the page measure so the pills reach the screen edge. It
   * has to bleed by exactly the container's gutter: `-mx-4` was 1rem against a
   * 0.625rem gutter below 768 px, so the row hung 6 px off each edge and gave
   * every shop page a horizontal scrollbar at 360 px — §2 forbids that at any
   * width.
   */
  it("bleeds by the container's own gutter rather than a hardcoded margin", () => {
    const { container } = render(<CategoryFilter categories={categories} />);

    const nav = container.querySelector("nav");
    expect(nav?.className).toContain("bleed-gutter");
    expect(nav?.className).not.toMatch(/-mx-\d/);
  });

  it("renders nothing when the shop has no categories", () => {
    const { container } = render(<CategoryFilter categories={[]} />);

    expect(container).toBeEmptyDOMElement();
  });

  it("has no automated accessibility violations", async () => {
    const { container } = render(<CategoryFilter categories={categories} activeSlug="pouches" />);

    const results = await axe.run(container);
    expect(results.violations).toEqual([]);
  });
});
