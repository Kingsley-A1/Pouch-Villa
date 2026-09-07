import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { BrandLink } from "@pv/backend/services/catalogue";
import { StoreSidebar } from "@/components/store-sidebar";

vi.mock("next/navigation", () => ({ usePathname: () => "/" }));

const css = readFileSync(resolve(process.cwd(), "src/app/globals.css"), "utf8");

const brands: BrandLink[] = [
  { id: "brand-1", slug: "apple", name: "Apple" },
  { id: "brand-2", slug: "samsung", name: "Samsung" },
];

/**
 * The brand menu appearing *in front of* the page, which took two goes to get
 * right and would silently regress on a third.
 *
 * The first fix moved the menu out of the sidebar's scrolling `<nav>`, which
 * stopped `overflow-y-auto` clipping it. It was still being painted over by the
 * hero's category slides — those carry `isolation: isolate`, so each opens a
 * stacking context of its own, and two contexts at `z-index: auto` are painted
 * in document order. `<main>` comes after `<aside>`, so the slide won every
 * time, however high the panel's own `z-index` went: a z-index ranks siblings
 * inside one context, and the panel was never in the slide's.
 *
 * jsdom computes no stacking, so this cannot assert what paints on top. What it
 * can do is hold the three facts the fix rests on, so that removing any one of
 * them fails here with the reason attached rather than in front of a customer.
 */
describe("the sidebar brand menu", () => {
  afterEach(cleanup);

  it("sits in a stacking context of its own, above the page", () => {
    const { container } = render(<StoreSidebar signedIn={false} brands={brands} />);
    const aside = container.querySelector("aside");

    // Both halves matter: `z-30` does nothing without `relative` to position it.
    expect(aside?.className).toContain("relative");
    expect(aside?.className).toContain("z-30");
  });

  it("stays below the header, which must keep covering it on scroll", () => {
    const header = readFileSync(resolve(process.cwd(), "src/components/store-header.tsx"), "utf8");

    // The header is `sticky z-40`. If the sidebar were ever raised to match, the
    // brand panel would slide over the header instead of under it.
    expect(header).toContain("z-40");
  });

  it("is not inside the element that scrolls", () => {
    const { container } = render(<StoreSidebar signedIn={false} brands={brands} />);
    const scroller = container.querySelector(".overflow-y-auto");
    const trigger = screen.getByRole("button", { name: /shop by brand/i });

    expect(scroller).not.toBeNull();
    // Inside it, `overflow-y-auto` clips the open panel back to the rail.
    expect(scroller?.contains(trigger)).toBe(false);
  });

  it("records why the page competes for the same layer", () => {
    // The slides' `isolation: isolate` is not a mistake — it keeps each slide's
    // own wash and caption self-contained. It is simply the reason the sidebar
    // has to name a level rather than relying on document order.
    const slide = css.match(/\.pv-cat-slide\s*\{([^}]*)\}/)?.[1];
    expect(slide).toContain("isolation: isolate");
  });

  it("renders no control at all where the shop has no brands", () => {
    render(<StoreSidebar signedIn={false} brands={[]} />);
    expect(screen.queryByRole("button", { name: /shop by brand/i })).toBeNull();
  });
});
