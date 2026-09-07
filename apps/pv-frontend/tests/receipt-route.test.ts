import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getOrderById,
  buildOrderDocumentFor,
  staffHasPermission,
  getStaffPrincipal,
  getCustomerPrincipal,
  hasOrderAccess,
} = vi.hoisted(() => ({
  getOrderById: vi.fn(),
  buildOrderDocumentFor: vi.fn(),
  staffHasPermission: vi.fn(),
  getStaffPrincipal: vi.fn(),
  getCustomerPrincipal: vi.fn(),
  hasOrderAccess: vi.fn(),
}));

vi.mock("@pv/backend/services/orders", () => ({ getOrderById }));
vi.mock("@pv/backend/services/order-documents", () => ({ buildOrderDocumentFor }));
vi.mock("@pv/backend/services/roles", () => ({ staffHasPermission }));
vi.mock("@/server/session", () => ({ getStaffPrincipal }));
vi.mock("@/server/customer-session", () => ({ getCustomerPrincipal }));
vi.mock("@/server/order-access", () => ({ hasOrderAccess }));

import { GET } from "@/app/api/v1/orders/[orderId]/receipt/route";

/**
 * Who may download an order's paperwork.
 *
 * The document carries a name, a phone number and a delivery address, and the
 * URL that produces it contains nothing but an order id. So the id must confer
 * nothing on its own, and every way in has to prove something else — which is
 * exactly what these assert, one refusal at a time.
 */

const order = {
  id: "order-1",
  reference: "PV-7Q4K2-M8XZP",
  customerId: "customer-1",
};

function request(kind = "invoice") {
  return new Request(`https://shop.test/api/v1/orders/order-1/receipt?kind=${kind}`);
}

const params = { params: Promise.resolve({ orderId: "order-1" }) };

beforeEach(() => {
  vi.clearAllMocks();
  getOrderById.mockResolvedValue(order);
  getStaffPrincipal.mockResolvedValue(null);
  getCustomerPrincipal.mockResolvedValue(null);
  hasOrderAccess.mockResolvedValue(false);
  staffHasPermission.mockResolvedValue(false);
  buildOrderDocumentFor.mockResolvedValue({
    bytes: Uint8Array.from([0x25, 0x50, 0x44, 0x46]),
    filename: "Pouch-Villa-Invoice-PV-7Q4K2-M8XZP.pdf",
    contentType: "application/pdf",
  });
});

describe("who is refused", () => {
  it("a stranger holding nothing but the order id", async () => {
    const response = await GET(request(), { params: Promise.resolve({ orderId: "order-1" }) });

    expect(response.status).toBe(404);
    expect(buildOrderDocumentFor).not.toHaveBeenCalled();
  });

  it("a different customer's session", async () => {
    getCustomerPrincipal.mockResolvedValue({ customerId: "somebody-else" });

    const response = await GET(request(), { params: Promise.resolve({ orderId: "order-1" }) });

    expect(response.status).toBe(404);
    expect(buildOrderDocumentFor).not.toHaveBeenCalled();
  });

  it("a staff session without order.view", async () => {
    getStaffPrincipal.mockResolvedValue({ staffId: "staff-1" });
    staffHasPermission.mockResolvedValue(false);

    const response = await GET(request(), { params: Promise.resolve({ orderId: "order-1" }) });

    expect(response.status).toBe(404);
    expect(staffHasPermission).toHaveBeenCalledWith("staff-1", "order.view");
  });

  it("a grant naming a different order", async () => {
    // `hasOrderAccess` is asked about *this* reference, so a grant for another
    // order cannot be replayed here.
    hasOrderAccess.mockImplementation(async (reference: string) => reference === "PV-SOMETHING");

    const response = await GET(request(), { params: Promise.resolve({ orderId: "order-1" }) });

    expect(response.status).toBe(404);
    expect(hasOrderAccess).toHaveBeenCalledWith("PV-7Q4K2-M8XZP");
  });

  it("an unknown document kind, without touching the order", async () => {
    const response = await GET(request("bank-details"), {
      params: Promise.resolve({ orderId: "order-1" }),
    });

    expect(response.status).toBe(404);
    expect(getOrderById).not.toHaveBeenCalled();
  });

  it("an order that does not exist — with the same status as one that does", async () => {
    // Answering differently would turn this route into a way of discovering
    // which order ids are real.
    getOrderById.mockResolvedValue(null);

    const response = await GET(request(), { params: Promise.resolve({ orderId: "nope" }) });

    expect(response.status).toBe(404);
  });
});

describe("who is served", () => {
  it("the customer who owns the order", async () => {
    getCustomerPrincipal.mockResolvedValue({ customerId: "customer-1" });

    const response = await GET(request(), params);

    expect(response.status).toBe(200);
    expect(buildOrderDocumentFor).toHaveBeenCalledWith(order, "invoice");
  });

  it("a guest holding the placement grant for this order", async () => {
    hasOrderAccess.mockResolvedValue(true);

    const response = await GET(request("receipt"), params);

    expect(response.status).toBe(200);
    expect(buildOrderDocumentFor).toHaveBeenCalledWith(order, "receipt");
  });

  it("a staff member with order.view", async () => {
    getStaffPrincipal.mockResolvedValue({ staffId: "staff-1" });
    staffHasPermission.mockResolvedValue(true);

    const response = await GET(request(), params);

    expect(response.status).toBe(200);
  });
});

describe("the response", () => {
  beforeEach(() => {
    hasOrderAccess.mockResolvedValue(true);
  });

  it("downloads as a named PDF", async () => {
    const response = await GET(request(), params);

    expect(response.headers.get("Content-Type")).toBe("application/pdf");
    expect(response.headers.get("Content-Disposition")).toBe(
      'attachment; filename="Pouch-Villa-Invoice-PV-7Q4K2-M8XZP.pdf"',
    );
  });

  it("is never cached — it carries a name, a phone number and an address", async () => {
    const response = await GET(request(), params);

    expect(response.headers.get("Cache-Control")).toBe("no-store, private");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
  });

  it("keeps a render failure's message out of the log and out of the reply", async () => {
    buildOrderDocumentFor.mockRejectedValue(new Error("r2://private/proofs/leaky-key"));
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await GET(request(), params);

    expect(response.status).toBe(404);
    expect(await response.text()).not.toContain("leaky-key");
    expect(JSON.stringify(logged.mock.calls)).not.toContain("leaky-key");
  });
});
