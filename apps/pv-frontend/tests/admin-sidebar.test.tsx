import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AdminSidebar } from "@/app/admin/(protected)/admin-sidebar";
import type { NavSection } from "@/app/admin/(protected)/nav-sections";

vi.mock("next/navigation", () => ({ usePathname: () => "/admin/orders" }));

const sections = [
  { label: "Dashboard", href: "/admin", permission: "dashboard.view" },
  { label: "Orders", href: "/admin/orders", permission: "order.view" },
] satisfies NavSection[];

describe("desktop admin sidebar", () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(cleanup);

  it("opens by default with recognizable navigation and persists collapse", () => {
    render(<AdminSidebar sections={sections} />);

    const toggle = screen.getByRole("button", { name: "Collapse sidebar" });
    const orders = screen.getByRole("link", { name: "Orders" });

    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(orders).toHaveAttribute("aria-current", "page");
    expect(orders).not.toHaveAttribute("title");
    expect(orders.querySelector("svg")).not.toBeNull();

    fireEvent.click(toggle);

    expect(screen.getByRole("button", { name: "Expand sidebar" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expect(window.localStorage.getItem("pv-admin-sidebar-open")).toBe("false");
    expect(screen.getByRole("link", { name: "Orders" })).toHaveAttribute("title", "Orders");
  });

  it("restores a collapsed preference without hiding navigation names", () => {
    window.localStorage.setItem("pv-admin-sidebar-open", "false");

    render(<AdminSidebar sections={sections} />);

    expect(screen.getByRole("button", { name: "Expand sidebar" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expect(screen.getByRole("link", { name: "Dashboard" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Orders" })).toBeVisible();
  });
});
