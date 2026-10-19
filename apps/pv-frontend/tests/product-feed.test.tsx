import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CatalogueListItem } from "@pv/backend/services/catalogue";
import { kobo } from "@pv/backend/domain/money";
import { ProductFeed } from "@/components/product-feed";

vi.mock("next/image", () => ({
  // eslint-disable-next-line @next/next/no-img-element
  default: ({ alt }: { alt: string }) => <img alt={alt} />,
}));

const item = (n: number): CatalogueListItem => ({
  id: `id-${n}`,
  slug: `product-${n}`,
  name: `Product ${n}`,
  brandName: null,
  fromKobo: kobo(100_000),
  inStock: 5,
  primaryImage: null,
});

const page = (from: number, to: number, nextCursor: string | null, total: number) => ({
  products: Array.from({ length: to - from + 1 }, (_, i) => item(from + i)),
  nextCursor,
  total,
  likes: {},
});

const respond = (body: unknown) =>
  vi.fn<(url: string) => Promise<Response>>(
    async () => new Response(JSON.stringify(body), { status: 200 }),
  );

describe("product feed", () => {
  beforeEach(() => vi.stubGlobal("fetch", vi.fn()));
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("says how many are showing out of how many there are, and offers more", () => {
    render(<ProductFeed initial={page(1, 2, "c1", 5)} filters={{}} emptyMessage="none" />);

    expect(screen.getByText("Showing 2 of 5 products")).toBeVisible();
    expect(screen.getByRole("button", { name: "Show more" })).toBeVisible();
  });

  it("offers nothing more once everything is on screen", () => {
    render(<ProductFeed initial={page(1, 3, null, 3)} filters={{}} emptyMessage="none" />);

    expect(screen.getByText("Showing all 3 products")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Show more" })).toBeNull();
  });

  it("appends the next page, handing back the cursor and the filters", async () => {
    const fetchMock = respond({ ok: true, data: page(3, 4, null, 4) });
    vi.stubGlobal("fetch", fetchMock);
    render(
      <ProductFeed
        initial={page(1, 2, "c1", 4)}
        filters={{ category: "cases", device: "iphone-15" }}
        emptyMessage="none"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Show more" }));

    await waitFor(() => expect(screen.getByText("Showing all 4 products")).toBeVisible());
    const url = new URL(String(fetchMock.mock.calls[0]?.[0]), "http://shop.test");
    expect(url.pathname).toBe("/api/v1/products");
    expect(url.searchParams.get("cursor")).toBe("c1");
    expect(url.searchParams.get("category")).toBe("cases");
    expect(url.searchParams.get("device")).toBe("iphone-15");
    for (const n of [1, 2, 3, 4]) expect(screen.getByText(`Product ${n}`)).toBeVisible();
  });

  it("never shows one product twice if a page overlaps the last", async () => {
    vi.stubGlobal("fetch", respond({ ok: true, data: page(2, 3, null, 3) }));
    render(<ProductFeed initial={page(1, 2, "c1", 3)} filters={{}} emptyMessage="none" />);

    fireEvent.click(screen.getByRole("button", { name: "Show more" }));

    await waitFor(() => expect(screen.getByText("Showing all 3 products")).toBeVisible());
    expect(screen.getAllByText("Product 2")).toHaveLength(1);
  });

  it("says so and offers a retry when the connection drops, keeping what is shown", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("offline");
      }),
    );
    render(<ProductFeed initial={page(1, 2, "c1", 5)} filters={{}} emptyMessage="none" />);

    fireEvent.click(screen.getByRole("button", { name: "Show more" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/could not load more/i);
    expect(screen.getByRole("button", { name: "Try again" })).toBeVisible();
    expect(screen.getByText("Product 1")).toBeVisible();
  });

  it("shows the server's own message when it refuses the request", async () => {
    vi.stubGlobal(
      "fetch",
      respond({ ok: false, error: { message: "That page of results is no longer valid." } }),
    );
    render(<ProductFeed initial={page(1, 2, "c1", 5)} filters={{}} emptyMessage="none" />);

    fireEvent.click(screen.getByRole("button", { name: "Show more" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("no longer valid");
  });

  it("says what emptied an empty list rather than showing a bare button", () => {
    render(
      <ProductFeed
        initial={page(1, 0, null, 0)}
        filters={{}}
        emptyMessage="Nothing published fits the Apple iPhone 15 yet."
      />,
    );

    expect(screen.getByText(/Nothing published fits/)).toBeVisible();
    expect(screen.queryByRole("button")).toBeNull();
  });
});
