import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MediaPicker, type PickedFile } from "@/app/admin/(protected)/products/media-picker";
import { MAX_IMAGE_BYTES } from "@/app/admin/(protected)/products/upload-image";

/**
 * The create screen's picker holds files in the browser until the product row
 * exists. Two things must hold: a whole selection is taken, not just its first
 * file, and every preview URL that stops being shown is revoked — five 6MB
 * photos left in memory is what actually kills a mid-range phone.
 */
function fileOf(name: string, type = "image/jpeg", size = 1000): File {
  const file = new File(["x"], name, { type });
  Object.defineProperty(file, "size", { value: size });
  return file;
}

function selectInto(label: string, files: File[]) {
  const input = screen.getByLabelText(label, { selector: "input" });
  fireEvent.change(input, { target: { files } });
}

const created: string[] = [];
const revoked: string[] = [];

beforeEach(() => {
  created.length = 0;
  revoked.length = 0;
  let counter = 0;
  vi.stubGlobal("URL", {
    ...URL,
    createObjectURL: vi.fn(() => {
      const url = `blob:preview-${(counter += 1)}`;
      created.push(url);
      return url;
    }),
    revokeObjectURL: vi.fn((url: string) => revoked.push(url)),
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  cleanup();
});

function Harness({ initial = [] as PickedFile[] }) {
  const files = initial;
  return <MediaPicker files={files} onChange={() => {}} />;
}

describe("media picker", () => {
  it("takes a whole selection, not just its first file", () => {
    const onChange = vi.fn();
    render(<MediaPicker files={[]} onChange={onChange} />);

    selectInto("Add images", [fileOf("a.jpg"), fileOf("b.jpg"), fileOf("c.jpg")]);

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0]?.[0]).toHaveLength(3);
  });

  it("stops at the five-image limit and says why", () => {
    const onChange = vi.fn();
    render(<MediaPicker files={[]} onChange={onChange} />);

    selectInto(
      "Add images",
      Array.from({ length: 7 }, (_, index) => fileOf(`${index}.jpg`)),
    );

    expect(onChange.mock.calls[0]?.[0]).toHaveLength(5);
    expect(screen.getByRole("alert")).toHaveTextContent("the limit is 5 images");
  });

  it("refuses an oversized file by name rather than silently dropping it", () => {
    const onChange = vi.fn();
    render(<MediaPicker files={[]} onChange={onChange} />);

    selectInto("Add images", [fileOf("huge.jpg", "image/jpeg", MAX_IMAGE_BYTES + 1)]);

    expect(screen.getByRole("alert")).toHaveTextContent("huge.jpg");
    expect(onChange.mock.calls[0]?.[0]).toHaveLength(0);
  });

  it("refuses a file that is not an image we can process", () => {
    render(<MediaPicker files={[]} onChange={vi.fn()} />);

    selectInto("Add images", [fileOf("notes.pdf", "application/pdf")]);

    expect(screen.getByRole("alert")).toHaveTextContent("notes.pdf");
  });

  it("swaps a chosen file in place and frees the preview it replaced", () => {
    const onChange = vi.fn();
    const picked: PickedFile[] = [
      { id: "one", file: fileOf("old.jpg"), previewUrl: "blob:old" },
      { id: "two", file: fileOf("keep.jpg"), previewUrl: "blob:keep" },
    ];
    render(<MediaPicker files={picked} onChange={onChange} />);

    selectInto("Replace old.jpg", [fileOf("new.jpg")]);

    const next = onChange.mock.calls[0]?.[0] as PickedFile[];
    expect(next).toHaveLength(2);
    expect(next[0]?.id).toBe("one");
    expect(next[0]?.file.name).toBe("new.jpg");
    expect(next[1]?.file.name).toBe("keep.jpg");
    // The discarded photo must not stay in memory for the life of the tab.
    expect(revoked).toContain("blob:old");
  });

  it("removes a chosen file and frees its preview", () => {
    const onChange = vi.fn();
    const picked: PickedFile[] = [{ id: "one", file: fileOf("gone.jpg"), previewUrl: "blob:gone" }];
    render(<MediaPicker files={picked} onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: "Remove gone.jpg" }));

    expect(onChange.mock.calls[0]?.[0]).toHaveLength(0);
    expect(revoked).toContain("blob:gone");
  });

  it("frees every remaining preview when the screen goes away", () => {
    const picked: PickedFile[] = [
      { id: "one", file: fileOf("a.jpg"), previewUrl: "blob:a" },
      { id: "two", file: fileOf("b.jpg"), previewUrl: "blob:b" },
    ];
    const view = render(<Harness initial={picked} />);
    view.unmount();

    expect(revoked).toContain("blob:a");
    expect(revoked).toContain("blob:b");
  });
});
