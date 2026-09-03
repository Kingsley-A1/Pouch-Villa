import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ZoneForm } from "@/app/admin/(protected)/delivery/zone-form";
import { VariantForm } from "@/app/admin/(protected)/products/variant-form";

vi.mock("@/app/admin/(protected)/delivery/actions", () => ({
  saveZoneAction: async () => ({ error: null }),
}));

describe("automatic admin form fields", () => {
  afterEach(cleanup);

  it("suggests known areas without limiting delivery to a fixed list", () => {
    render(<ZoneForm knownAreas={["Calabar Municipal", "Obudu"]} />);

    // Free text with a datalist, not a <select>. Three areas were once hardcoded
    // as options here, which made the places Pouch Villa serves a fact only a
    // deployment could change.
    const area = screen.getByLabelText("Local government area");
    expect(area).toHaveAttribute("list", "delivery-areas");
    expect(area.tagName).toBe("INPUT");

    // The suggestions are the areas already in use, so a new one can be typed.
    for (const known of ["Calabar Municipal", "Obudu"]) {
      expect(document.querySelector(`#delivery-areas option[value="${known}"]`)).not.toBeNull();
    }

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
