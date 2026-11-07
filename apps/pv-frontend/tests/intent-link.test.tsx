import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Next's Link, reduced to what this test needs: the anchor, and the `prefetch`
 * value it was handed, which is the whole of what IntentLink decides.
 */
vi.mock("next/link", () => ({
  default: ({
    prefetch,
    href,
    children,
    ...rest
  }: {
    prefetch?: boolean | null;
    href: string;
    children: React.ReactNode;
  }) => (
    <a href={href} data-prefetch={String(prefetch)} {...rest}>
      {children}
    </a>
  ),
}));

const { IntentLink } = await import("@/components/intent-link");

afterEach(cleanup);

describe("IntentLink", () => {
  it("does not prefetch a link that has only scrolled into view", () => {
    render(<IntentLink href="/shop">Shop</IntentLink>);
    expect(screen.getByRole("link", { name: "Shop" }).dataset.prefetch).toBe("false");
  });

  it.each([
    ["a pointer reaches it", fireEvent.mouseEnter],
    ["a finger lands on it", fireEvent.touchStart],
    ["keyboard focus arrives", fireEvent.focus],
  ])("hands prefetching back to Next once %s", (_, event) => {
    render(<IntentLink href="/shop">Shop</IntentLink>);
    const link = screen.getByRole("link", { name: "Shop" });
    event(link);
    expect(link.dataset.prefetch).toBe("null");
  });

  it("keeps the caller's own handler", () => {
    const onMouseEnter = vi.fn();
    render(
      <IntentLink href="/shop" onMouseEnter={onMouseEnter}>
        Shop
      </IntentLink>,
    );
    fireEvent.mouseEnter(screen.getByRole("link", { name: "Shop" }));
    expect(onMouseEnter).toHaveBeenCalledOnce();
  });

  it("never prefetches where the caller turned it off", () => {
    render(
      <IntentLink href="/shop" prefetch={false}>
        Shop
      </IntentLink>,
    );
    const link = screen.getByRole("link", { name: "Shop" });
    fireEvent.touchStart(link);
    expect(link.dataset.prefetch).toBe("false");
  });
});
