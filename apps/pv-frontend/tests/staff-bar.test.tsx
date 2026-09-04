import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { StaffBar } from "@/components/staff-bar";

/**
 * The bar exists because the storefront cannot see a staff session by design,
 * and the CEO read that as being logged out. What it must never become is a
 * claim that they are signed in *as a customer* — see
 * docs/decisions/0014-staff-visibility-on-the-storefront.md.
 */
describe("staff bar", () => {
  afterEach(cleanup);

  it("shows a shopper nothing at all", () => {
    const { container } = render(<StaffBar name={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("names the staff member and offers the way back to the admin", () => {
    render(<StaffBar name="Kingsley M" />);

    expect(screen.getByText("Kingsley M")).toBeVisible();
    expect(screen.getByRole("link", { name: /Back to admin/ })).toHaveAttribute("href", "/admin");
  });

  /**
   * "Signed in" unqualified would promise a customer account this person does
   * not have, and the first tap on an order history would be a worse surprise
   * than the one this replaces.
   */
  it("says which side they are signed in to", () => {
    render(<StaffBar name="Kingsley M" />);
    expect(screen.getByText(/Signed in to the admin as/)).toBeVisible();
  });
});
