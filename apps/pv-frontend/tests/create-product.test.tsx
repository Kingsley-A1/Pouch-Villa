import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CreateProduct } from "@/app/admin/(protected)/products/new/create-product";

/**
 * The complaint this covers: staff filled in a product, saw a screen saying it
 * had been created, and found nothing in the shop. Creating always wrote a
 * draft and nothing ever published it.
 *
 * So the assertions here are about the sequence and about what the screen then
 * claims — publishing must happen after the pictures have gone up, and the
 * confirmation must say what actually happened rather than one fixed sentence.
 */

// `vi.mock` is hoisted above every other statement in the file, so the spies it
// closes over have to be created in a hoisted block too.
const spies = vi.hoisted(() => ({
  // Args are asserted with `toHaveBeenCalledWith`, so the stub itself declares
  // none — a named-but-unused parameter is a lint failure here.
  setProductStatusAction: vi.fn(async () => ({ error: null as string | null })),
  uploadProductImage: vi.fn(async () => ({ ok: true, message: null }) as UploadResult),
  push: vi.fn(),
}));

type UploadResult = { ok: true; message: string | null } | { ok: false; error: string };

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: spies.push, refresh: vi.fn() }),
}));

vi.mock("@/app/admin/(protected)/products/actions", () => ({
  setProductStatusAction: spies.setProductStatusAction,
}));

// Mocked whole rather than partially: the real module reaches the database
// through its Server Actions, which a component test has no business loading.
vi.mock("@/app/admin/(protected)/products/upload-image", () => ({
  uploadProductImage: spies.uploadProductImage,
  ACCEPTED_MEDIA: "image/jpeg",
  ACCEPTED_MEDIA_TYPES: ["image/jpeg"],
  rejectionReason: () => null,
  MAX_IMAGE_BYTES: 10 * 1024 * 1024,
}));

const { setProductStatusAction, uploadProductImage } = spies;

const createProductAction = vi.fn(async () => ({ error: null, productId: "prod-1" }));

function renderScreen() {
  render(
    <CreateProduct
      action={createProductAction}
      brands={[]}
      categories={[]}
      devices={[]}
      collections={[]}
    />,
  );
}

function fillAndSubmit({ publish }: { publish: boolean }) {
  fireEvent.change(screen.getByLabelText("Product name"), { target: { value: "Leather pouch" } });
  fireEvent.change(screen.getByLabelText(/^Price/), { target: { value: "25000" } });

  const image = new File(["x"], "front.jpg", { type: "image/jpeg" });
  Object.defineProperty(image, "size", { value: 1000 });
  fireEvent.change(screen.getByLabelText("Add images", { selector: "input" }), {
    target: { files: [image] },
  });

  if (!publish) fireEvent.click(screen.getByRole("radio", { name: /Save as a draft/ }));
  fireEvent.click(screen.getByRole("button", { name: /Publish product|Save as draft/ }));
}

beforeEach(() => {
  // Implementations, not just call history: `clearAllMocks` leaves a
  // `mockResolvedValue` from an earlier test in place, which silently changes
  // what the next one is testing.
  setProductStatusAction.mockReset().mockResolvedValue({ error: null });
  uploadProductImage.mockReset().mockResolvedValue({ ok: true, message: null });

  vi.stubGlobal("URL", {
    ...URL,
    createObjectURL: () => "blob:preview",
    revokeObjectURL: () => {},
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  cleanup();
});

describe("creating a product", () => {
  it("publishes by default, and says the product is in the shop", async () => {
    renderScreen();
    fillAndSubmit({ publish: true });

    await waitFor(() => expect(setProductStatusAction).toHaveBeenCalledWith("prod-1", "published"));
    expect(await screen.findByText("Published — it is in the shop")).toBeVisible();
  });

  /** A published product with an empty picture box is worse than a slow one. */
  it("uploads the pictures before it publishes", async () => {
    const order: string[] = [];
    uploadProductImage.mockImplementation(async () => {
      order.push("upload");
      return { ok: true, message: null };
    });
    setProductStatusAction.mockImplementation(async () => {
      order.push("publish");
      return { error: null };
    });

    renderScreen();
    fillAndSubmit({ publish: true });

    await waitFor(() => expect(order).toEqual(["upload", "publish"]));
  });

  it("leaves a draft alone when a draft is what was asked for", async () => {
    renderScreen();
    fillAndSubmit({ publish: false });

    expect(await screen.findByText("Saved as a draft")).toBeVisible();
    expect(setProductStatusAction).not.toHaveBeenCalled();
  });

  /**
   * The failure the old screen hid: publishing was refused and the product sat
   * as a draft with nothing on screen saying so.
   */
  it("says why it is still a draft when publishing is refused", async () => {
    setProductStatusAction.mockResolvedValue({ error: "Add a price before publishing." });

    renderScreen();
    fillAndSubmit({ publish: true });

    expect(await screen.findByText("Saved as a draft")).toBeVisible();
    expect(screen.getByText("Add a price before publishing.")).toBeVisible();
  });

  it("names the pictures that did not upload, without losing the product", async () => {
    uploadProductImage.mockResolvedValue({ ok: false, error: "front.jpg is too large." });

    renderScreen();
    fillAndSubmit({ publish: true });

    expect(await screen.findByText("Published, but some pictures did not upload")).toBeVisible();
    expect(screen.getByText("front.jpg is too large.")).toBeVisible();
  });
});
