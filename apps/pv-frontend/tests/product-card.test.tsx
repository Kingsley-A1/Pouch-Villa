import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { kobo } from "@pv/backend/domain/money";
import type { CatalogueListItem } from "@pv/backend/services/catalogue";
import { ProductCard } from "@/components/product-card";

/**
 * Which derivative a card renders decides whether it looks sharp. `card` is
 * 960px; a feature tile can render at up to 100vw on a phone, which at 2x
 * device pixels needs more than that — the exact gap that made every product
 * image on the storefront look soft. This pins the rule in place: a regular
 * tile gets `card`, a feature tile gets the wider `hero`.
 */
const image = {
  thumbUrl: "https://cdn.test/thumb.webp",
  cardUrl: "https://cdn.test/card.webp",
  heroUrl: "https://cdn.test/hero.webp",
  alt: "A red pouch",
  width: 1600,
  height: 1600,
};

function product(overrides: Partial<CatalogueListItem> = {}): CatalogueListItem {
  return {
    id: "p1",
    slug: "red-pouch",
    name: "Red Pouch",
    brandName: null,
    fromKobo: kobo(500000),
    inStock: 3,
    primaryImage: image,
    ...overrides,
  };
}

describe("product card image resolution", () => {
  afterEach(cleanup);

  it("uses the card derivative for a regular grid tile", () => {
    render(<ProductCard product={product()} />);

    expect(screen.getByRole("img")).toHaveAttribute("src", expect.stringContaining("card.webp"));
  });

  it("uses the wider hero derivative for a feature tile", () => {
    render(<ProductCard product={product()} size="feature" />);

    expect(screen.getByRole("img")).toHaveAttribute("src", expect.stringContaining("hero.webp"));
  });

  it("falls back to a placeholder rather than rendering a broken image", () => {
    render(<ProductCard product={product({ primaryImage: null })} />);

    expect(screen.queryByRole("img")).toBeNull();
    expect(screen.getByText("No image yet")).toBeVisible();
  });
});
