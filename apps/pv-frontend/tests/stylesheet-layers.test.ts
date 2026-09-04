import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// `import.meta.url` is not a file URL under the jsdom environment these tests
// run in, so the stylesheet is resolved from the Vitest root instead — which is
// this package, because `vitest.config.mts` sits beside it.
const css = readFileSync(resolve(process.cwd(), "src/app/globals.css"), "utf8");

/**
 * Every selector in the stylesheet that sits outside a cascade layer.
 *
 * Written by hand rather than pulled from a parser because the assertion below
 * is about one structural property — layered or not — and a dependency that
 * only this test uses is a dependency the whole app pays to install.
 */
function unlayeredSelectors(source: string): string[] {
  const stripped = source.replace(/\/\*[\s\S]*?\*\//g, "");
  const selectors: string[] = [];
  const stack: ("layer" | "keyframes" | "block")[] = [];
  let start = 0;

  for (let index = 0; index < stripped.length; index += 1) {
    const character = stripped[index];
    if (character === "{") {
      const prelude = stripped.slice(start, index).trim();
      const isLayer = /^@layer\b/.test(prelude);
      const isKeyframes = /^@(?:-\w+-)?keyframes\b/.test(prelude);
      // A nested at-rule such as `@media` does not itself introduce a layer, so
      // whether its children are layered depends entirely on its ancestors.
      const isAtRule = prelude.startsWith("@");
      const inKeyframes = stack.includes("keyframes");
      if (!isAtRule && !stack.includes("layer") && !inKeyframes) selectors.push(prelude);
      stack.push(isLayer ? "layer" : isKeyframes ? "keyframes" : "block");
      start = index + 1;
    } else if (character === "}") {
      stack.pop();
      start = index + 1;
    } else if (character === ";" && stack.length === 0) {
      start = index + 1;
    }
  }

  return selectors;
}

/**
 * The two things that are unlayered on purpose.
 *
 * `:root` carries the design tokens. Nothing competes with them by specificity,
 * and `.storefront` has to be able to repaint them for its whole subtree.
 *
 * The `prefers-reduced-motion` kill switch has to beat every animation on the
 * page, utilities included — that is the entire point of it — so layering it
 * would break the accessibility guarantee it exists to make.
 */
const DELIBERATELY_UNLAYERED = new Set([":root", "*,\n  *::before,\n  *::after"]);

/**
 * `@import "tailwindcss"` declares `@layer theme, base, components, utilities`
 * and generates every utility into the last of them. In the cascade, unlayered
 * styles beat *all* layered styles regardless of specificity — so a bare
 * `a { color: inherit }` in this file silently defeats `text-(--pv-on-brand)`,
 * `text-(--pv-red)` and `underline` on every link in the app. That is exactly
 * how the shop's selected category pill came to paint white text on a white
 * pill, and how the home page's "Or browse everything" link lost its underline.
 *
 * Element and pseudo-element resets therefore have to live in `@layer base`.
 * Component classes (`.button-primary`, `.field`, …) stay unlayered on purpose:
 * they are complete, self-contained styles that should not be half-overridden
 * by a stray utility, and `.field` documents that it depends on it.
 */
describe("globals.css cascade layers", () => {
  it("keeps every element-level reset inside a cascade layer", () => {
    const elementLike = unlayeredSelectors(css)
      .filter((selector) => !DELIBERATELY_UNLAYERED.has(selector))
      .filter((selector) =>
        selector
          .split(",")
          .map((part) => part.trim())
          .some((part) => part === "*" || /^(?:[a-z][a-z0-9]*|:{1,2}[a-z-]+)$/.test(part)),
      );

    expect(elementLike).toEqual([]);
  });

  it("still declares the shared design tokens outside a layer, where they win", () => {
    // Tokens are not a reset — nothing overrides them by specificity, and
    // `.storefront` has to be able to repaint them for the whole subtree.
    expect(unlayeredSelectors(css)).toContain(".storefront");
    expect(unlayeredSelectors(css)).toContain(":root");
  });

  it("gives every ground its own focus ring rather than one hardcoded red", () => {
    // A translucent brand-red ring is invisible on the storefront's red page,
    // and §2 requires focus to be visible, not merely present.
    const grounds = css.match(/--pv-focus:/g) ?? [];
    expect(grounds.length).toBeGreaterThanOrEqual(4);
    expect(css).toContain("outline: 3px solid var(--pv-focus)");
  });
});
