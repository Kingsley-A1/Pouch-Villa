import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { adminSearchResultHref } from "@/components/admin/admin-search-routes";
import { AdminSearch } from "@/components/admin/admin-search";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const sections = [
  { label: "Products", href: "/admin/products", permission: "product.view" as const },
  { label: "Orders", href: "/admin/orders", permission: "order.view" as const },
];

describe("admin search", () => {
  beforeEach(() => {
    cleanup();
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn());
    push.mockReset();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("maps record results to their owning admin screen", () => {
    expect(adminSearchResultHref("product", "abc")).toBe("/admin/products/abc/edit");
    expect(adminSearchResultHref("order", "abc")).toBe("/admin/orders/abc");
    expect(adminSearchResultHref("setting", "store.address")).toBe("/admin/settings");
  });

  it("matches authorized navigation without waiting for the network", () => {
    render(<AdminSearch sections={sections} />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "prod" } });
    expect(screen.getByRole("option", { name: /Products/ })).toBeInTheDocument();
  });

  it("waits for two characters and debounces remote search", async () => {
    const fetchMock = vi
      .mocked(fetch)
      .mockResolvedValue(
        new Response(JSON.stringify({ ok: true, data: { results: [] } }), { status: 200 }),
      );
    render(<AdminSearch sections={sections} />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "p" } });
    await act(() => vi.advanceTimersByTimeAsync(300));
    expect(fetchMock).not.toHaveBeenCalled();

    fireEvent.change(screen.getByRole("combobox"), { target: { value: "case" } });
    await act(() => vi.advanceTimersByTimeAsync(249));
    expect(fetchMock).not.toHaveBeenCalled();
    await act(() => vi.advanceTimersByTimeAsync(1));
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/admin/search?q=case",
      expect.objectContaining({ cache: "no-store" }),
    );
  });
});
