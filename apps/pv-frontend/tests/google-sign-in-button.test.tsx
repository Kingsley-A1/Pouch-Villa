import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { GoogleSignInButton } from "@/components/google-sign-in-button";

/**
 * The button replaced Google's own widget, which built itself with inline styles
 * a strict Content Security Policy refuses — so it rendered as a 448px logo.
 *
 * These assertions guard the two properties that made the replacement worth
 * doing: it posts rather than links, so a role code never reaches a URL, and it
 * is ordinary markup that needs no third-party script to appear.
 */
describe("Google sign-in button", () => {
  afterEach(cleanup);

  function form() {
    // The form is the accessible container; queried by role to avoid asserting
    // on markup this component is free to change.
    return screen.getByRole("button", { name: /Continue with Google/ }).closest("form");
  }

  it("posts to the redirect flow rather than linking to Google", () => {
    render(<GoogleSignInButton flow="customer" />);
    // A GET would put a role code in the URL bar, the browser history and every
    // proxy log between here and Google.
    // Case-insensitively: HTML does not care, and the DOM returns whatever the
    // JSX wrote, so asserting an exact case would test the spelling not the verb.
    expect(form()?.getAttribute("method")?.toLowerCase()).toBe("post");
    expect(form()).toHaveAttribute("action", "/api/v1/auth/google/start");
  });

  it("names which of the three sign-ins it starts", () => {
    render(<GoogleSignInButton flow="staff" />);
    const field = form()?.querySelector('input[name="flow"]');
    // The callback reads the flow from a cookie, not this field — but sending
    // the wrong one here would start the wrong sign-in.
    expect(field).toHaveValue("staff");
  });

  it("carries the role code in the body for a claim", () => {
    render(<GoogleSignInButton flow="claim" roleCode="ABCD-1234" />);
    expect(form()?.querySelector('input[name="roleCode"]')).toHaveValue("ABCD-1234");
  });

  it("sends no role code field when there is no code", () => {
    render(<GoogleSignInButton flow="customer" next="/account/orders" />);
    expect(form()?.querySelector('input[name="roleCode"]')).toBeNull();
    expect(form()?.querySelector('input[name="next"]')).toHaveValue("/account/orders");
  });

  it("renders without any third-party script", () => {
    const { container } = render(<GoogleSignInButton flow="customer" />);
    // The whole point: no <script>, and the mark is inline SVG we ship.
    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("svg")).not.toBeNull();
  });
});
