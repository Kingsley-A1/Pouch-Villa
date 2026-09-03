import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const uploadProductImage = vi.fn();
const deleteMediaAction = vi.fn();
const reorderMediaAction = vi.fn();
const updateMediaAltAction = vi.fn();

vi.mock("@/app/admin/(protected)/products/upload-image", async () => {
  const actual = await vi.importActual<
    typeof import("@/app/admin/(protected)/products/upload-image")
  >("@/app/admin/(protected)/products/upload-image");
  return { ...actual, uploadProductImage };
});
vi.mock("@/app/admin/(protected)/products/media-actions", () => ({
  deleteMediaAction,
  reorderMediaAction,
  updateMediaAltAction,
}));

const { MediaSection } = await import("@/app/admin/(protected)/products/media-section");

/**
 * The edit screen used to read `files[0]` from the picker, so choosing four
 * images uploaded one — while the backend had always allowed five. It also had
 * no way to swap an image without deleting it, which sent the replacement to the
 * back of the gallery.
 */
const media = [
  {
    id: "m1",
    alt: "Red pouch, front",
    width: 800,
    height: 800,
    sortOrder: 0,
    urls: { thumb: "/t1.webp", card: "/c1.webp", hero: "/h1.webp" },
  },
  {
    id: "m2",
    alt: null,
    width: 800,
    height: 800,
    sortOrder: 1,
    urls: { thumb: "/t2.webp", card: "/c2.webp", hero: "/h2.webp" },
  },
];

function fileOf(name: string): File {
  const file = new File(["x"], name, { type: "image/jpeg" });
  Object.defineProperty(file, "size", { value: 1000 });
  return file;
}

beforeEach(() => {
  uploadProductImage.mockResolvedValue({ ok: true, message: "Image added." });
  deleteMediaAction.mockResolvedValue({ error: null });
  reorderMediaAction.mockResolvedValue({ error: null });
  updateMediaAltAction.mockResolvedValue({ error: null });
});

afterEach(() => {
  vi.clearAllMocks();
  cleanup();
});

function renderSection(items = media) {
  return render(<MediaSection productId="p1" media={items} storageConfigured />);
}

describe("product media section", () => {
  it("uploads every file in a selection, not just the first", async () => {
    renderSection([]);

    fireEvent.change(screen.getByLabelText("Add images", { selector: "input" }), {
      target: { files: [fileOf("a.jpg"), fileOf("b.jpg"), fileOf("c.jpg")] },
    });

    await waitFor(() => expect(uploadProductImage).toHaveBeenCalledTimes(3));
    expect(await screen.findByText("3 images added.")).toBeVisible();
  });

  it("takes only what fits and says how many did not", async () => {
    renderSection(media);

    fireEvent.change(screen.getByLabelText("Add images", { selector: "input" }), {
      target: { files: Array.from({ length: 5 }, (_, i) => fileOf(`${i}.jpg`)) },
    });

    await waitFor(() => expect(uploadProductImage).toHaveBeenCalledTimes(3));
    expect(await screen.findByText(/2 more did not fit/)).toBeVisible();
  });

  it("reports the reason a file failed rather than a generic message", async () => {
    uploadProductImage.mockResolvedValue({ ok: false, error: "huge.jpg is 30MB." });
    renderSection([]);

    fireEvent.change(screen.getByLabelText("Add images", { selector: "input" }), {
      target: { files: [fileOf("huge.jpg")] },
    });

    expect(await screen.findByText(/huge.jpg is 30MB./)).toBeVisible();
  });

  /**
   * Replacing must keep the image's place. Swapping the primary photo for a
   * better shot should not send it to the back of the gallery, which is what
   * delete-then-add does.
   */
  it("replaces an image in place, carrying its description over", async () => {
    renderSection(media);

    fireEvent.change(screen.getByLabelText(/Replace image 1/, { selector: "input" }), {
      target: { files: [fileOf("better.jpg")] },
    });

    await waitFor(() => expect(uploadProductImage).toHaveBeenCalledTimes(1));
    expect(uploadProductImage).toHaveBeenCalledWith("p1", expect.any(File), {
      replacesMediaId: "m1",
      alt: "Red pouch, front",
    });
    expect(deleteMediaAction).not.toHaveBeenCalled();
  });

  it("removes an image on a confirmed press, never on the first", async () => {
    const { container } = renderSection(media);
    // Scoped to the first card: once its trigger is pressed the confirm button
    // shares the same label, and the second card still has a trigger of its own.
    const firstCard = within(container.querySelectorAll("li")[0] as HTMLElement);

    fireEvent.click(firstCard.getByRole("button", { name: "Remove" }));
    expect(deleteMediaAction).not.toHaveBeenCalled();

    fireEvent.click(firstCard.getByRole("button", { name: "Remove" }));
    await waitFor(() => expect(deleteMediaAction).toHaveBeenCalledWith("p1", "m1"));
  });

  it("saves an edited description when the field is left", async () => {
    renderSection(media);

    const field = screen.getAllByLabelText(/Description, for screen readers/)[1]!;
    fireEvent.change(field, { target: { value: "Black pouch, side view" } });
    fireEvent.blur(field);

    await waitFor(() =>
      expect(updateMediaAltAction).toHaveBeenCalledWith("p1", "m2", "Black pouch, side view"),
    );
  });

  it("does not save a description that was not touched", () => {
    renderSection(media);

    fireEvent.blur(screen.getAllByLabelText(/Description, for screen readers/)[0]!);

    expect(updateMediaAltAction).not.toHaveBeenCalled();
  });

  it("says so, and offers nothing, when storage is not configured", () => {
    render(<MediaSection productId="p1" media={[]} storageConfigured={false} />);

    expect(screen.getByText(/Object storage is not configured/)).toBeVisible();
    expect(screen.queryByLabelText("Add images", { selector: "input" })).toBeNull();
  });
});
