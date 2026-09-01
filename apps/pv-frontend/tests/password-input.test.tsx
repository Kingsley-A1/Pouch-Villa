import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Field, PasswordInput } from "@/components/admin/form-controls";

describe("password input", () => {
  afterEach(cleanup);

  it("toggles visibility without becoming a form submit control", () => {
    render(
      <Field label="Password" name="password">
        <PasswordInput name="password" required autoComplete="current-password" />
      </Field>,
    );

    const input = screen.getByLabelText("Password");
    const show = screen.getByRole("button", { name: "Show password" });

    expect(input).toHaveAttribute("type", "password");
    expect(input).toHaveAttribute("name", "password");
    expect(input).toHaveAttribute("autocomplete", "current-password");
    expect(show).toHaveAttribute("type", "button");

    fireEvent.click(show);

    expect(input).toHaveAttribute("type", "text");
    const hide = screen.getByRole("button", { name: "Hide password" });

    fireEvent.click(hide);

    expect(input).toHaveAttribute("type", "password");
    expect(screen.getByRole("button", { name: "Show password" })).toBeVisible();
  });
});
