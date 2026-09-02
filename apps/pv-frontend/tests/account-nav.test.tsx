import { cleanup, render, screen } from "@testing-library/react";
import axe from "axe-core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AccountNav } from "@/app/(store)/account/account-nav";

vi.mock("next/navigation", () => ({ usePathname: () => "/account/orders" }));

/**
 * The account navigation used to be a rail that scrolled sideways below `sm`,
 * which put "Your details" off the right edge of a 360 px screen with nothing to
 * say it was there. These assertions are what stop that coming back: every
 * destination present, every one describing itself, and no horizontal scroll
 * container anywhere in the nav.
 */
describe("account navigation", () => {
  afterEach(cleanup);

  it("shows every destination as a card that says what it holds", () => {
    render(<AccountNav />);

    for (const label of ["Overview", "Orders", "Saved", "Your details"]) {
      expect(screen.getByRole("link", { name: new RegExp(label) })).toBeVisible();
    }
    expect(screen.getByRole("link", { name: /Your details/ })).toHaveTextContent(
      "Name, phone, password",
    );
  });

  it("marks the current page and no other", () => {
    render(<AccountNav />);

    const current = screen.getAllByRole("link").filter((link) => link.ariaCurrent === "page");
    expect(current).toHaveLength(1);
    expect(current[0]).toHaveTextContent("Orders");
  });

  it("does not hide any destination behind a horizontal scroll", () => {
    const { container } = render(<AccountNav />);

    const scrollers = container.querySelectorAll("[class*='overflow-x']");
    expect(scrollers).toHaveLength(0);
  });

  it("has no automated accessibility violations", async () => {
    render(
      <main>
        <h1>Your account</h1>
        <AccountNav />
      </main>,
    );

    const result = await axe.run(document.body, {
      rules: { "color-contrast": { enabled: false } },
    });
    expect(result.violations).toEqual([]);
  });
});
