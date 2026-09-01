import { beforeEach, describe, expect, it, vi } from "vitest";

const { getStaffPrincipal, searchAdmin, assertWithinRateLimit, recordRateLimitHit } = vi.hoisted(
  () => ({
    getStaffPrincipal: vi.fn(),
    searchAdmin: vi.fn(),
    assertWithinRateLimit: vi.fn(),
    recordRateLimitHit: vi.fn(),
  }),
);

vi.mock("@/server/session", () => ({ getStaffPrincipal }));
vi.mock("@pv/backend/services/admin-search", () => ({ searchAdmin }));
vi.mock("@pv/backend/services/rate-limit", () => ({
  assertWithinRateLimit,
  recordRateLimitHit,
}));

import { GET } from "@/app/api/v1/admin/search/route";

describe("admin search route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getStaffPrincipal.mockResolvedValue({ staffId: "staff-1" });
    searchAdmin.mockResolvedValue([]);
  });

  it("requires a staff session", async () => {
    getStaffPrincipal.mockResolvedValue(null);
    const response = await GET(new Request("https://example.test/api/v1/admin/search?q=case"));
    expect(response.status).toBe(401);
    expect(searchAdmin).not.toHaveBeenCalled();
  });

  it("validates bounded input", async () => {
    const response = await GET(
      new Request(`https://example.test/api/v1/admin/search?q=${"x".repeat(121)}`),
    );
    expect(response.status).toBe(422);
    expect(searchAdmin).not.toHaveBeenCalled();
  });

  it("returns permission-filtered service results without caching", async () => {
    const results = [
      {
        entity: "product",
        entityId: "product-1",
        title: "Clear Case",
        context: "published",
        requiredPermission: "product.view",
      },
    ];
    searchAdmin.mockResolvedValue(results);

    const response = await GET(
      new Request("https://example.test/api/v1/admin/search?q=case&limit=20"),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(searchAdmin).toHaveBeenCalledWith("staff-1", { query: "case", limit: 20 });
    expect(await response.json()).toEqual({ ok: true, data: { results } });
  });

  it("does not leak service failures", async () => {
    searchAdmin.mockRejectedValue(new Error("password=secret driver failure"));
    const response = await GET(new Request("https://example.test/api/v1/admin/search?q=case"));
    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain("secret");
  });
});
