import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { CARD_SHELL_CLASS } from "@/components/product-card";

const css = readFileSync(resolve(process.cwd(), "src/app/globals.css"), "utf8");

/** The declared `border-radius` of a class, as written in the stylesheet. */
function radiusOf(className: string): string | undefined {
  const rule = css.match(
    new RegExp(`(?:^|[,\\s])\\.${className}\\b[^{}]*\\{([^{}]*)\\}`, "m"),
  )?.[1];
  return rule?.match(/border-radius:\s*([^;]+);/)?.[1]?.trim();
}

/**
 * The client's rule, in one sentence: **square everything that holds content,
 * keep the radius on everything you press or type into.**
 *
 * Worth a test rather than a comment because it is a decision, not a taste —
 * "make it all square" was the obvious reading and is the wrong one, since the
 * reference the client pointed at keeps a pill on its call to action and a
 * rounded search field. Without this, the next person to square a stray corner
 * has nothing telling them where the line is.
 */
describe("corner radius", () => {
  it("squares the surfaces that hold content", () => {
    expect(radiusOf("card-surface")).toBe("0");
    expect(CARD_SHELL_CLASS).toContain("rounded-none");
    expect(CARD_SHELL_CLASS).not.toContain("rounded-2xl");
  });

  it("keeps the radius on everything you press or type into", () => {
    // Buttons and fields are the half of the rule that is easy to lose to a
    // find-and-replace, which is precisely why it is asserted.
    expect(radiusOf("button-primary")).toBeDefined();
    expect(radiusOf("button-primary")).not.toBe("0");
    expect(radiusOf("field")).toBeDefined();
    expect(radiusOf("field")).not.toBe("0");
  });
});
