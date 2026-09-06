import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

// Resolved from the Vitest root for the same reason `stylesheet-layers.test.ts`
// does it: `import.meta.url` is not a file URL under jsdom.
const cssPath = resolve(process.cwd(), "src/app/globals.css");
const css = readFileSync(cssPath, "utf8");
const sourceRoot = resolve(process.cwd(), "src");

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

/**
 * Every class in the stylesheet that starts an animation which never ends.
 *
 * Matched on the rule rather than on `@keyframes`, because the iteration count
 * lives on the `animation` shorthand and the same keyframes could legitimately
 * be used once elsewhere.
 */
function loopingClasses(source: string): string[] {
  const stripped = source.replace(/\/\*[\s\S]*?\*\//g, "");
  const classes: string[] = [];
  const rulePattern = /([^{}]+)\{([^{}]*)\}/g;
  let rule: RegExpExecArray | null;

  while ((rule = rulePattern.exec(stripped)) !== null) {
    const [, prelude = "", body = ""] = rule;
    if (!/\banimation\b[^;]*\binfinite\b/.test(body)) continue;
    for (const selector of prelude.split(",")) {
      const name = selector.trim().match(/^\.([a-z0-9-]+)$/);
      if (name?.[1] !== undefined) classes.push(name[1]);
    }
  }

  return [...new Set(classes)];
}

/**
 * The accessibility guarantee behind §2's "honour `prefers-reduced-motion`".
 *
 * The rule these tests protect was, until this change, actively harmful: a
 * blanket `animation-duration: 0.01ms` stops a one-shot but turns an infinite
 * loop into a strobe. The fix is opt-in, so it only holds while every looping
 * class is actually paired with `pv-loop` — which is what is asserted here
 * rather than left to whoever adds the next marquee to remember.
 */
describe("prefers-reduced-motion", () => {
  it("stops a looping animation instead of accelerating it", () => {
    const block = css.match(/@media \(prefers-reduced-motion: reduce\) \{[\s\S]*?\n\}\n/)?.[0];

    expect(block).toBeDefined();
    expect(block).toContain(".pv-loop");
    expect(block).toMatch(/\.pv-loop[\s\S]*?animation: none !important/);
  });

  it("still collapses one-shot animations and transitions", () => {
    // The blanket cap is correct for everything that runs once and is what keeps
    // `rise-in` and every Tailwind transition from moving. Only loops opt out.
    expect(css).toMatch(/animation-duration: 0\.01ms !important/);
    expect(css).toMatch(/transition-duration: 0\.01ms !important/);
  });

  it("pairs every looping class in the stylesheet with pv-loop where it is used", () => {
    const looping = loopingClasses(css);
    // If this is empty the test is asserting nothing, which would pass silently.
    expect(looping.length).toBeGreaterThan(0);

    const unpaired: string[] = [];
    for (const file of sourceFiles(sourceRoot)) {
      const contents = readFileSync(file, "utf8");
      for (const className of looping) {
        const pattern = new RegExp(
          `className=\\{?["'\`][^"'\`]*\\b${className}\\b[^"'\`]*["'\`]`,
          "g",
        );
        for (const usage of contents.match(pattern) ?? []) {
          if (!/\bpv-loop\b/.test(usage)) unpaired.push(`${file}: ${usage}`);
        }
      }
    }

    expect(unpaired).toEqual([]);
  });
});
