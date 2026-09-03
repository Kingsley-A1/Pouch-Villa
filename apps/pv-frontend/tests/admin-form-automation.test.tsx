import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ZoneForm } from "@/app/admin/(protected)/delivery/zone-form";
import { VariantForm } from "@/app/admin/(protected)/products/variant-form";

vi.mock("@/app/admin/(protected)/delivery/actions", () => ({
  saveZoneAction: async () => ({ error: null }),
}));

describe("automatic admin form fields", () => {
  afterEach(cleanup);

  it("uses a location dropdown and example delivery timeframes without sort order", () => {
    render(<ZoneForm />);

    expect(screen.getByRole("combobox", { name: "Local government area" })).toHaveTextContent(
      "Outside Calabar",
    );
    expect(screen.getByLabelText("Min days")).toHaveAttribute("placeholder", "e.g. 1");
    expect(screen.getByLabelText("Max days")).toHaveAttribute("placeholder", "e.g. 3");
    expect(screen.queryByLabelText("Sort order")).not.toBeInTheDocument();
  });

  it("explains generated SKUs and omits technical variant ordering", () => {
    render(<VariantForm action={async () => ({ error: null })} />);

    expect(screen.getByText(/SKU will be generated from the product name/i)).toBeVisible();
    expect(screen.queryByLabelText("SKU")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Sort order")).not.toBeInTheDocument();
  });
});
