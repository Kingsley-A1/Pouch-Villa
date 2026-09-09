import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DeviceList } from "@/app/admin/(protected)/devices/device-list";
import { DeviceLineList } from "@/app/admin/(protected)/devices/device-line-list";

vi.mock("@/app/admin/(protected)/devices/actions", () => ({
  saveDeviceAction: vi.fn(),
  deleteDeviceAction: vi.fn(),
  saveDeviceLineAction: vi.fn(),
  deleteDeviceLineAction: vi.fn(),
}));

const brands = [{ id: "b1", name: "Apple", slug: "apple", sortOrder: 0, logo: null }];
const lines = [
  {
    id: "l1",
    brandId: "b1",
    brandName: "Apple",
    name: "iPhone",
    slug: "iphone",
    sortOrder: 0,
    deviceCount: 2,
  },
];

/**
 * Both device forms, as `/admin/devices` renders them.
 *
 * The bug this pins is what the client reported as the device class input being
 * "missing": every label in the class form pointed at an id that did not exist,
 * so tapping "Class name" on a phone focused nothing and a screen reader
 * announced three unlabelled controls.
 *
 * The cause was an id collision half-fixed. Both forms carry a Brand select and
 * a Sort order box, `TextInput`/`Select` derived their id from their `name`, and
 * the two forms are open on the same screen at once — so the author renamed the
 * `Field` to dodge the duplicate id and detached the label instead of moving it.
 *
 * Both halves are therefore asserted together. Fixing the labels by pointing
 * them back at the shared names would satisfy the first assertion and reintroduce
 * the collision the prefixes existed to avoid.
 */
function renderBothFormsOpen() {
  const view = render(
    <>
      <DeviceList devices={[]} brands={brands as never} lines={lines as never} />
      <DeviceLineList lines={lines as never} brands={brands as never} />
    </>,
  );
  for (const button of screen.getAllByRole("button", { name: /^Add (device|class)$/ })) {
    fireEvent.click(button);
  }
  return view;
}

afterEach(cleanup);

describe("the devices screen", () => {
  it("points every label at a control that exists", () => {
    const { container } = renderBothFormsOpen();

    const orphaned = [...container.querySelectorAll("label[for]")]
      .filter(
        (label) => container.querySelector(`#${CSS.escape(label.getAttribute("for")!)}`) === null,
      )
      .map((label) => `${label.textContent} -> ${label.getAttribute("for")}`);

    expect(orphaned).toEqual([]);
  });

  it("gives the two forms distinct ids, so a label cannot reach the wrong one", () => {
    const { container } = renderBothFormsOpen();

    const ids = [...container.querySelectorAll("[id]")].map((node) => node.id);
    const duplicated = ids.filter((id, index) => ids.indexOf(id) !== index);

    expect(duplicated).toEqual([]);
  });

  it("still submits the names the server action reads", () => {
    renderBothFormsOpen();

    // The fix moves ids, never names. `saveDeviceLineAction` parses brandId,
    // name and sortOrder off the FormData, so renaming a field to fix a label
    // would break the save instead.
    const classForm = screen.getByRole("button", { name: "Add class" }).closest("div");
    const form = within(classForm as HTMLElement).queryAllByRole("combobox");
    expect(form.length).toBeGreaterThan(0);

    const names = [...document.querySelectorAll("form")]
      .flatMap((element) => [...element.querySelectorAll("input,select")])
      .map((node) => node.getAttribute("name"));

    expect(names).toContain("brandId");
    expect(names).toContain("name");
    expect(names).toContain("sortOrder");
  });
});
