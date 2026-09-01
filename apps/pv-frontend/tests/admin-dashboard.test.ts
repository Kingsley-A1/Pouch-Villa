import { describe, expect, it } from "vitest";
import { kobo } from "@pv/backend/domain/money";
import { buildDashboardCards } from "@/app/admin/(protected)/dashboard-view-model";

describe("admin dashboard cards", () => {
  it("keeps all overview KPIs while adding operational sales figures", () => {
    const sections = buildDashboardCards({
      totals: {
        ordersToday: 2,
        ordersThisWeek: 8,
        revenueTodayKobo: kobo(25_000),
        revenueThisWeekKobo: kobo(92_000),
        openOrders: 3,
        awaitingPayment: 4,
      },
      products: { published: 7, total: 9 },
      categories: 4,
      brands: 3,
      activeStaff: 2,
      customers: 21,
    });

    expect(sections.sales.map((card) => card.label)).toEqual([
      "Taken today",
      "Taken this week",
      "Open orders",
      "Awaiting payment",
    ]);
    expect(sections.overview.map((card) => card.label)).toEqual([
      "Products",
      "Categories",
      "Brands",
      "Active staff",
      "Customers",
    ]);
  });

  it("does not create cards for data the role cannot read", () => {
    const sections = buildDashboardCards({
      totals: null,
      products: null,
      categories: null,
      brands: null,
      activeStaff: null,
      customers: 2,
    });
    expect(sections.sales).toEqual([]);
    expect(sections.overview.map((card) => card.label)).toEqual(["Customers"]);
  });
});
