import { render } from "@testing-library/react";
import axe from "axe-core";
import { describe, expect, it } from "vitest";
import { BrandMark } from "@/components/brand-mark";
import { StoreHeader } from "@/components/store-header";

describe("component accessibility", () => {
  it("has no automated violations in the branded identity region", async () => {
    render(<main><h1>Pouch Hub prototype</h1><BrandMark /></main>);
    const result = await axe.run(document.body, { rules: { "color-contrast": { enabled: false } } });
    expect(result.violations).toEqual([]);
  });

  it("provides named, keyboard-reachable storefront navigation controls", async () => {
    render(<StoreHeader />);
    const result = await axe.run(document.body, { rules: { "color-contrast": { enabled: false } } });
    expect(result.violations).toEqual([]);
  });
});
