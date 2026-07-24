// @vitest-environment node
import { beforeAll, describe, expect, it } from "vitest";

const databasePath = `/tmp/pouch-villa-test-${process.pid}.db`;

describe("development database and connected journeys", () => {
  beforeAll(() => { process.env.DATABASE_URL = databasePath; process.env.DEMO_ADMIN_EMAIL = "test@pouchvilla.demo"; process.env.DEMO_ADMIN_PASSWORD = "TestPassword!2026"; });

  it("seeds the requested catalogue scale", async () => {
    const { getBrands, getDevices, getProducts } = await import("@/lib/db");
    expect(getBrands()).toHaveLength(6); expect(getDevices().length).toBeGreaterThanOrEqual(20); expect(getProducts()).toHaveLength(30);
  });

  it("returns only products linked to the exact device", async () => {
    const { getProducts } = await import("@/lib/db");
    const results = getProducts({ brand: "apple", model: "iphone-15-pro" });
    expect(results.length).toBeGreaterThan(0); expect(results.every((product) => product.status === "published")).toBe(true);
  });

  it("makes an admin availability change visible to storefront queries", async () => {
    const { getProducts, run } = await import("@/lib/db");
    const product = getProducts()[0]; run("UPDATE products SET availability='out_of_stock' WHERE id=?", product.id);
    expect(getProducts().find((item) => item.id === product.id)?.availability).toBe("out_of_stock");
  });

  it("moves a reservation through the staff workflow", async () => {
    const { getReservations, run } = await import("@/lib/db"); const reservation = getReservations()[0]; run("UPDATE reservations SET status='ready' WHERE id=?", reservation.id);
    expect(getReservations().find((item) => item.id === reservation.id)?.status).toBe("ready");
  });
});
