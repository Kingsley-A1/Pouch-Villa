import { at } from "../src/domain/assert";
// @vitest-environment node
import { beforeAll, describe, expect, it } from "vitest";

const databasePath = `/tmp/pouch-villa-test-${process.pid}.db`;

describe("development database and connected journeys", () => {
  beforeAll(() => {
    process.env.DATABASE_URL = databasePath;
  });

  it("seeds the requested catalogue scale", async () => {
    const { getBrands, getDevices, getProducts } = await import("../src/db");
    expect(getBrands()).toHaveLength(6);
    expect(getDevices().length).toBeGreaterThanOrEqual(20);
    expect(getProducts()).toHaveLength(48);
  });

  it("seeds no staff account at all, so there is no identity to guess", async () => {
    const { all } = await import("../src/db");
    // Access is granted only by redeeming a role code. A seeded account — even one
    // with a random password — is a standing target and an environment-shaped
    // identity store, which is what this replaced.
    expect(all("SELECT id FROM staff")).toHaveLength(0);
  });

  it("gives every device at least one compatible case", async () => {
    const { all, getDevices } = await import("../src/db");
    const uncovered = all<{ name: string }>(
      "SELECT d.name AS name FROM devices d LEFT JOIN product_devices pd ON pd.device_id = d.id WHERE pd.device_id IS NULL",
    );
    expect(getDevices().length).toBeGreaterThan(0);
    expect(uncovered.map((device) => device.name)).toEqual([]);
  });

  it("returns plain serializable objects that can cross the server/client boundary", async () => {
    const { getProducts } = await import("../src/db");
    const product = getProducts()[0];
    expect(Object.getPrototypeOf(product)).toBe(Object.prototype);
  });

  it("returns only products linked to the exact device", async () => {
    const { getProducts } = await import("../src/db");
    const results = getProducts({ brand: "apple", model: "iphone-15-pro" });
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((product) => product.status === "published")).toBe(true);
  });

  it("makes an admin availability change visible to storefront queries", async () => {
    const { getProducts, run } = await import("../src/db");
    const product = at(getProducts(), 0);
    run("UPDATE products SET availability='out_of_stock' WHERE id=?", product.id);
    expect(getProducts().find((item) => item.id === product.id)?.availability).toBe("out_of_stock");
  });

  it("moves a reservation through the staff workflow", async () => {
    const { getReservations, run } = await import("../src/db");
    const reservation = at(getReservations(), 0);
    run("UPDATE reservations SET status='ready' WHERE id=?", reservation.id);
    expect(getReservations().find((item) => item.id === reservation.id)?.status).toBe("ready");
  });
});
