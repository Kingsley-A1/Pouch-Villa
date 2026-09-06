import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { StorefrontBrand } from "@pv/backend/services/catalogue";
import { BrandCard } from "@/components/brand-card";

function brand(overrides: Partial<StorefrontBrand> = {}): StorefrontBrand {
  return {
    id: "brand-1",
    slug: "apple",
    name: "Apple",
    productCount: 12,
    logo: null,
    ...overrides,
  };
}

/**
 * The brand step is the one the CEO described in the most detail: a square card
 * carrying the logo prominently, the name on one line beneath it. These assert
 * the parts of that which would be silently lost in a refactor.
 */
describe("brand card", () => {
  afterEach(cleanup);

  it("links to the next step of the path", () => {
    render(<BrandCard brand={brand()} href="/browse/pouches/apple" />);
    expect(screen.getByRole("link")).toHaveAttribute("href", "/browse/pouches/apple");
  });

  it("draws the brand initial where no logo has been uploaded yet", () => {
    // Not an empty box: a shop halfway through uploading its logos still has to
    // look deliberate. §0 rule 2 rules out standing in a stock mark instead.
    render(<BrandCard brand={brand()} href="/browse/pouches/apple" />);
    expect(screen.getByText("A")).toBeInTheDocument();
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("renders the logo with its own dimensions so the box is reserved", () => {
    render(
      <BrandCard
        brand={brand({ logo: { url: "https://cdn.example/apple.webp", width: 600, height: 400 } })}
        href="/browse/pouches/apple"
      />,
    );

    const logo = screen.getByRole("presentation", { hidden: true });
    expect(logo).toHaveAttribute("width", "600");
    expect(logo).toHaveAttribute("height", "400");
  });

  it("contains the logo rather than cropping it", () => {
    // A cropped logo is a damaged logo, and the client was explicit that the
    // mark is used exactly. `object-cover` here would quietly trim wordmarks.
    render(
      <BrandCard
        brand={brand({ logo: { url: "https://cdn.example/apple.webp", width: 600, height: 400 } })}
        href="/browse/pouches/apple"
      />,
    );

    const logo = screen.getByRole("presentation", { hidden: true });
    expect(logo.className).toContain("object-contain");
    expect(logo.className).not.toContain("object-cover");
  });

  it("is square, per the client's rule for anything holding content", () => {
    const { container } = render(<BrandCard brand={brand()} href="/browse/pouches/apple" />);
    const link = container.querySelector("a");
    expect(link?.className).toContain("rounded-none");
    expect(link?.className).not.toContain("rounded-2xl");
  });

  it("keeps the name to one line so a row of cards stays level", () => {
    render(<BrandCard brand={brand({ name: "A very long accessory maker name" })} href="/x" />);
    const name = screen.getByText("A very long accessory maker name");
    expect(name.className).toContain("truncate");
  });

  it("counts one item in the singular", () => {
    render(<BrandCard brand={brand({ productCount: 1 })} href="/x" />);
    expect(screen.getByText("1 item")).toBeVisible();
  });
});
