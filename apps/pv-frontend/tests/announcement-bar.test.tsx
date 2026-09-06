import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { AnnouncementBar, type Announcement } from "@/components/announcement-bar";

const EMPTY: Announcement = {
  message: null,
  whatsappNumber: null,
  instagramUrl: null,
  xUrl: null,
  locations: [],
};

function announcement(overrides: Partial<Announcement> = {}): Announcement {
  return { ...EMPTY, ...overrides };
}

/**
 * The bar the client asked for, and the two rules it has to keep while it is
 * there: §0 rule 2 — nothing renders until the CEO has written it — and §2's
 * reduced-motion requirement, which a running marquee is the first real test of.
 */
describe("announcement bar", () => {
  afterEach(cleanup);

  it("renders nothing at all until the CEO has written a message", () => {
    const { container } = render(<AnnouncementBar announcement={EMPTY} dismissed={false} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("treats a message of only whitespace as no message", () => {
    // A field the CEO cleared by pressing space is not an announcement, and an
    // empty red strip above the header is furniture with nothing in it.
    const { container } = render(
      <AnnouncementBar announcement={announcement({ message: "   " })} dismissed={false} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing once the visitor has closed it", () => {
    const { container } = render(
      <AnnouncementBar announcement={announcement({ message: "Open late" })} dismissed />,
    );
    // Absent from the HTML rather than hidden by it: that is what keeps the
    // page from reflowing on the next request.
    expect(container).toBeEmptyDOMElement();
  });

  it("runs the message twice but announces it once", () => {
    render(
      <AnnouncementBar announcement={announcement({ message: "Open late" })} dismissed={false} />,
    );

    // Two copies make the loop seamless; a screen reader must still hear one.
    expect(screen.getAllByText(/Open late/)).toHaveLength(2);
    const spoken = screen
      .getAllByText(/Open late/)
      .filter((node) => node.getAttribute("aria-hidden") !== "true");
    expect(spoken).toHaveLength(1);
  });

  it("marks the running track as a loop so reduced motion stops it", () => {
    const { container } = render(
      <AnnouncementBar announcement={announcement({ message: "Open late" })} dismissed={false} />,
    );

    // `pv-loop` is the opt-in half of the reduced-motion kill switch. Without it
    // the marquee is accelerated to 0.01ms rather than stopped — a strobe.
    const track = container.querySelector(".pv-marquee-track");
    expect(track).not.toBeNull();
    expect(track?.classList.contains("pv-loop")).toBe(true);
  });

  it("shows no contact row when the shop has supplied no contact details", () => {
    render(
      <AnnouncementBar announcement={announcement({ message: "Open late" })} dismissed={false} />,
    );
    expect(screen.queryByRole("link", { name: /Contact us/ })).toBeNull();
  });

  it("builds the WhatsApp link from the stored number rather than storing a link", () => {
    render(
      <AnnouncementBar
        announcement={announcement({ message: "Open late", whatsappNumber: "234 800 000 0000" })}
        dismissed={false}
      />,
    );

    expect(screen.getByRole("link", { name: /WhatsApp/ })).toHaveAttribute(
      "href",
      "https://wa.me/2348000000000",
    );
  });

  it("lists every branch the CEO entered", () => {
    render(
      <AnnouncementBar
        announcement={announcement({ message: "Open late", locations: ["Lagos", "Port Harcourt"] })}
        dismissed={false}
      />,
    );

    expect(screen.getByText(/Lagos · Port Harcourt/)).toBeVisible();
  });

  it("gives the close control a real accessible name", () => {
    render(
      <AnnouncementBar announcement={announcement({ message: "Open late" })} dismissed={false} />,
    );
    expect(screen.getByRole("button", { name: /Dismiss announcement/ })).toBeVisible();
  });
});
