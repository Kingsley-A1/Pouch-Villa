import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MobileNav } from "@/components/mobile-nav";

vi.mock("next/navigation", () => ({ usePathname: () => "/shop" }));

/**
 * Below `lg` the header no longer carries a user icon for someone who is signed
 * in — the drawer does. That trade only holds if the drawer actually reaches the
 * account, so this asserts it in both session states.
 */
describe("mobile navigation drawer", () => {
  afterEach(cleanup);

  function open() {
    fireEvent.click(screen.getByRole("button", { name: "Open menu" }));
  }

  it("names the signed-in customer and links to their account", () => {
    render(
      <MobileNav
        account={{ name: "Kingsley", monogram: "KA", email: "kingsley@example.com" }}
        brands={[]}
      />,
    );
    open();

    const account = screen.getByRole("link", { name: /Hi, Kingsley/ });
    expect(account).toHaveAttribute("href", "/account");
    expect(account).toHaveTextContent("kingsley@example.com");
    expect(screen.queryByRole("link", { name: "Sign in" })).toBeNull();
  });

  it("invites a visitor to sign in instead", () => {
    render(<MobileNav account={null} brands={[]} />);
    open();

    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/account");
    expect(screen.queryByText("kingsley@example.com")).toBeNull();
  });

  it("still reaches the shopping and information links", () => {
    render(
      <MobileNav
        account={{ name: null, monogram: null, email: "kingsley@example.com" }}
        brands={[]}
      />,
    );
    open();

    expect(screen.getByRole("link", { name: "Shop" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Returns & warranty" })).toBeVisible();
    // No name stored, so the card falls back to a neutral label rather than
    // rendering an empty greeting.
    expect(screen.getByRole("link", { name: /Your account/ })).toBeVisible();
  });
});
