import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GoogleSignInButton, googleButtonWidth } from "@/components/google-sign-in-button";

vi.mock("next/script", () => ({
  default: ({ onReady }: { onReady: () => void }) => {
    queueMicrotask(onReady);
    return null;
  },
}));

describe("Google sign-in button", () => {
  const renderButton = vi.fn();

  beforeEach(() => {
    renderButton.mockReset();
    window.google = {
      accounts: { id: { initialize: vi.fn(), renderButton } },
    };
  });

  it("caps Google's control to its responsive host", () => {
    expect(googleButtonWidth(280)).toBe(280);
    expect(googleButtonWidth(400)).toBe(320);
    expect(googleButtonWidth(0)).toBe(320);
  });

  it("centres the rendered control and uses the measured width", async () => {
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      width: 280,
      height: 44,
      top: 0,
      right: 280,
      bottom: 44,
      left: 0,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });

    render(<GoogleSignInButton clientId="public-client" onCredential={vi.fn()} />);
    const host = screen.getByLabelText("Continue with Google");
    expect(host).toHaveClass("justify-center", "w-full");
    await waitFor(() => expect(renderButton).toHaveBeenCalled());
    expect(renderButton.mock.calls[0]?.[1]).toEqual(expect.objectContaining({ width: 280 }));
  });
});
