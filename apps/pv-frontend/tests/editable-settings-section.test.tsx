import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { EditableSettingsSection } from "@/app/admin/(protected)/settings/editable-settings-section";

describe("editable settings section", () => {
  afterEach(cleanup);

  it("is closed by default and exposes a named edit control", () => {
    render(
      <EditableSettingsSection title="Store details" summary="Contact details.">
        <label htmlFor="address">Address</label>
        <input id="address" />
      </EditableSettingsSection>,
    );

    const disclosure = screen.getByText("Store details").closest("details");
    expect(disclosure).not.toHaveAttribute("open");
    expect(screen.getByText("Edit Store details")).toHaveClass("sr-only");
  });
});
