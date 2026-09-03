import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { MoneyInput } from "@/components/admin/money-input";

describe("money input", () => {
  afterEach(cleanup);

  it("shows grouping commas and submits an ungrouped naira value", () => {
    render(<MoneyInput name="feeNaira" defaultValue="2500" required />);

    const visible = screen.getByRole("textbox");
    expect(visible).toHaveValue("2,500");
    expect(document.querySelector<HTMLInputElement>('input[name="feeNaira"]')).toHaveValue("2500");

    fireEvent.change(visible, { target: { value: "12500.75" } });

    expect(visible).toHaveValue("12,500.75");
    expect(document.querySelector<HTMLInputElement>('input[name="feeNaira"]')).toHaveValue(
      "12500.75",
    );
  });
});
