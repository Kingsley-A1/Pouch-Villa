import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { HeroSlide } from "@pv/backend/services/hero-slides";
import { HeroDeck } from "@/components/hero-deck";

function slide(overrides: Partial<HeroSlide> = {}): HeroSlide {
  return {
    id: "slide-1",
    kicker: "New in",
    headline: "Cases that fit your phone",
    href: "/shop",
    ctaLabel: null,
    image: { url: "https://cdn.example/hero.webp", width: 1600, height: 900 },
    ...overrides,
  };
}

/**
 * The deck is the client's headline ask — "exactly the one in the Tomi Case
 * hero" — and it is also the single riskiest thing on the page: its photograph
 * becomes the LCP element on the route furthest from its budget. These assert
 * the decisions that protect that, which are the ones a later refactor is most
 * likely to undo without noticing.
 */
describe("hero deck", () => {
  afterEach(cleanup);

  it("renders nothing where the CEO has built no slides", () => {
    // The home page falls back to its headline; an empty band would be furniture.
    const { container } = render(<HeroDeck slides={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("loads the first photograph eagerly and the rest lazily", () => {
    render(<HeroDeck slides={[slide(), slide({ id: "slide-2" })]} />);

    const photos = screen.getAllByRole("presentation", { hidden: true });
    expect(photos[0]).toHaveAttribute("loading", "eager");
    expect(photos[1]).toHaveAttribute("loading", "lazy");
  });

  it("never fades the photograph in", () => {
    // Only the text animates. An LCP image that fades is an LCP that lands late,
    // and this is the route already furthest from the 2.5s budget.
    render(<HeroDeck slides={[slide()]} />);
    const photo = screen.getAllByRole("presentation", { hidden: true })[0];
    expect(photo?.className).not.toMatch(/rise-in|animate|fade/);
  });

  it("writes no style attribute of its own", () => {
    // `style-src-attr` cannot be addressed by a nonce, so `security-headers.ts`
    // permits exactly next/image's own declarations by hash and nothing else —
    // and `verify-routes.mjs` fails the build on any attribute not in that list.
    // A per-word `animation-delay` written as a style attribute would therefore
    // break the build, which is why the delays are classes.
    //
    // The image's own attribute is the one that is allowed, so it is excluded
    // here rather than the assertion being weakened to nothing.
    const { container } = render(<HeroDeck slides={[slide()]} />);
    const ours = [...container.querySelectorAll("[style]")].filter(
      (element) => element.tagName !== "IMG",
    );
    expect(ours).toEqual([]);
  });

  it("staggers the headline word by word using delay classes", () => {
    const { container } = render(<HeroDeck slides={[slide({ headline: "One two three" })]} />);
    const words = container.querySelectorAll(".pv-w");
    expect(words).toHaveLength(3);
    expect(words[1]?.className).toContain("animation-delay");
  });

  it("uses the CEO's button label when they wrote one", () => {
    render(<HeroDeck slides={[slide({ ctaLabel: "See the sale" })]} />);
    expect(screen.getByRole("link", { name: /See the sale/ })).toHaveAttribute("href", "/shop");
  });

  it("falls back to a sensible label when they did not", () => {
    render(<HeroDeck slides={[slide()]} />);
    expect(screen.getByRole("link", { name: /Shop now/ })).toBeVisible();
  });

  it("offers no arrows or dots for a single slide", () => {
    // Controls for a deck that cannot move are a lie about what is there.
    render(<HeroDeck slides={[slide()]} />);
    expect(screen.queryByRole("button", { name: /Next slide/ })).toBeNull();
  });

  it("marks only the first slide as the one showing", () => {
    const { container } = render(<HeroDeck slides={[slide(), slide({ id: "slide-2" })]} />);
    const on = container.querySelectorAll(".pv-slide.is-on");
    expect(on).toHaveLength(1);
  });
});
