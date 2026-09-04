import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AdminMobileNav } from "@/app/admin/(protected)/admin-mobile-nav";

vi.mock("next/navigation", () => ({ usePathname: () => "/admin/products" }));
vi.mock("@/app/admin/(protected)/actions", () => ({ logoutAction: vi.fn() }));

const sections = [
  { href: "/admin", label: "Dashboard", permission: "dashboard.view" },
  { href: "/admin/products", label: "Products", permission: "product.manage" },
] as const;

const account = { name: "Kingsley M", role: "ceo", monogram: "KM" };

function openDrawer() {
  render(<AdminMobileNav sections={[...sections]} account={account} />);
  fireEvent.click(screen.getByRole("button", { name: "Open admin menu" }));
}

/**
 * The avatar and "Sign out" used to sit in the header. On a 360 px bar that put
 * a destructive action immediately beside the menu button a thumb reaches for,
 * and named neither of them.
 */
describe("admin mobile drawer", () => {
  afterEach(cleanup);

  it("carries the account, named, with its role", () => {
    openDrawer();

    const profile = screen.getByRole("link", { name: /Kingsley M/ });
    expect(profile).toHaveAttribute("href", "/admin/profile");
    expect(screen.getByText("ceo")).toBeVisible();
  });

  it("carries sign out", () => {
    openDrawer();
    expect(screen.getByRole("button", { name: "Sign out" })).toBeVisible();
  });

  it("still carries the sections and the way back to the shop", () => {
    openDrawer();

    expect(screen.getByRole("link", { name: "Products" })).toHaveAttribute(
      "href",
      "/admin/products",
    );
    expect(screen.getByRole("link", { name: /View store/ })).toHaveAttribute("href", "/");
  });
});
