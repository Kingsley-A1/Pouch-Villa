import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ProductGallery } from "@/components/product-gallery";

/**
 * A photograph that fails to load used to leave the browser's own broken-image
 * glyph and the raw alt text in the top corner of the frame — what customers on
 * the live product page actually saw. The gallery now owns each image's load
 * state, so these pin what a customer sees while waiting and after a failure.
 */
const images = [
  {
    thumbUrl: "https://cdn.test/a-thumb.webp",
    cardUrl: "https://cdn.test/a-card.webp",
    heroUrl: "https://cdn.test/a-hero.webp",
    width: 1600,
    height: 1600,
  },
  {
    thumbUrl: "https://cdn.test/b-thumb.webp",
    cardUrl: "https://cdn.test/b-card.webp",
    heroUrl: "https://cdn.test/b-hero.webp",
    width: 1600,
    height: 1600,
  },
];

function mainImage() {
  const found = screen
    .getAllByRole("img", { hidden: true })
    .find((element) => element.getAttribute("alt") === "Red Pouch");
  if (found === undefined) throw new Error("main image not rendered");
  return found;
}

describe("product gallery load states", () => {
  afterEach(cleanup);

  it("marks the frame busy until the main image has loaded", async () => {
    render(<ProductGallery images={images} productName="Red Pouch" />);
    const frame = screen.getByTestId("gallery-frame");
    expect(frame.getAttribute("aria-busy")).toBe("true");

    // next/image reports a load only after `img.decode()` settles, a tick later.
    fireEvent.load(mainImage());
    await waitFor(() => expect(frame.getAttribute("aria-busy")).toBe("false"));
  });

  it("replaces a failed image with a message and a retry, not a broken glyph", () => {
    render(<ProductGallery images={images} productName="Red Pouch" />);
    fireEvent.error(mainImage());

    expect(screen.getByText("This photo didn't load.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    // Retrying mounts a fresh image and returns the frame to its loading state.
    expect(screen.queryByText("This photo didn't load.")).toBeNull();
    expect(screen.getByTestId("gallery-frame").getAttribute("aria-busy")).toBe("true");
  });

  it("remembers a loaded image when the customer steps back to it", async () => {
    render(<ProductGallery images={images} productName="Red Pouch" />);
    fireEvent.load(mainImage());
    const frame = screen.getByTestId("gallery-frame");
    await waitFor(() => expect(frame.getAttribute("aria-busy")).toBe("false"));
    fireEvent.click(screen.getByRole("button", { name: "Next image" }));
    expect(screen.getByTestId("gallery-frame").getAttribute("aria-busy")).toBe("true");

    fireEvent.click(screen.getByRole("button", { name: "Previous image" }));
    expect(screen.getByTestId("gallery-frame").getAttribute("aria-busy")).toBe("false");
  });
});
