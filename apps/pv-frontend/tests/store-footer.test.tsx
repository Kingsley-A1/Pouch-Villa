import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { StoreFooter } from "@/components/store-footer";

/**
 * SVG geometry attributes take a `<length>`, and `auto` is not one.
 *
 * The footer wordmark carried `height="auto"`, which Chromium rejects with
 * `<svg> attribute height: Expected length, "auto"`. The footer is on every
 * storefront page, so that was one console error per page view — and it is what
 * scored Lighthouse's `errors-in-console` audit 0 on all four measured URLs, on
 * the first CI run that ever got far enough to measure anything.
 *
 * The intent — scale to the container, take the height from the `viewBox`'s
 * ratio — is expressed in CSS instead, where `auto` is legal.
 */
describe("store footer", () => {
  afterEach(cleanup);

  it("gives every SVG a valid length, or no attribute at all", () => {
    const { container } = render(<StoreFooter />);
    const svgs = container.querySelectorAll("svg");
    expect(svgs.length).toBeGreaterThan(0);

    for (const svg of svgs) {
      for (const attribute of ["width", "height", "x", "y"]) {
        const value = svg.getAttribute(attribute);
        if (value === null) continue;
        expect(
          value,
          `<svg ${attribute}="${value}"> is not a length — size it in CSS instead`,
        ).toMatch(/^-?\d*\.?\d+(?:px|em|ex|pt|pc|cm|mm|in|%)?$/);
      }
    }
  });

  it("still scales the wordmark to its container", () => {
    // The behaviour the attributes were there for. `viewBox` supplies the ratio,
    // so `w-full` plus `h-auto` in CSS reproduces it exactly.
    const { container } = render(<StoreFooter />);
    const wordmark = container.querySelector("svg[viewBox]");

    expect(wordmark).not.toBeNull();
    expect(wordmark?.getAttribute("class")).toContain("w-full");
    expect(wordmark?.getAttribute("class")).toContain("h-auto");
  });

  it("keeps the decorative wordmark out of the accessibility tree", () => {
    // The footer's heading already says the shop's name; hearing it twice tells
    // a screen-reader user nothing new.
    const { container } = render(<StoreFooter />);
    const wordmark = container.querySelector("svg[viewBox]");

    expect(wordmark?.getAttribute("aria-hidden")).toBe("true");
    expect(wordmark?.getAttribute("focusable")).toBe("false");
  });
});
