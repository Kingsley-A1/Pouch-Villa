import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DevicesWorkspace } from "@/app/admin/(protected)/devices/devices-workspace";

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
/**
 * Only one add-form opens at a time, so the two are rendered separately and
 * their ids checked against each other — which is the collision that matters:
 * the class form's inline editor can be open in the list below while the device
 * form is open at the top.
 */
function renderWorkspace() {
  return render(<DevicesWorkspace devices={[]} brands={brands as never} lines={lines as never} />);
}

function openAddForm(which: "device" | "class") {
  const view = renderWorkspace();
  fireEvent.click(screen.getByRole("button", { name: `Add ${which}` }));
  return view;
}

afterEach(cleanup);

describe("the devices screen", () => {
  it.each(["device", "class"] as const)(
    "points every label in the %s form at a control that exists",
    (which) => {
      const { container } = openAddForm(which);

      const orphaned = [...container.querySelectorAll("label[for]")]
        .filter(
          (label) => container.querySelector(`#${CSS.escape(label.getAttribute("for")!)}`) === null,
        )
        .map((label) => `${label.textContent} -> ${label.getAttribute("for")}`);

      expect(orphaned).toEqual([]);
    },
  );

  it("gives the two forms distinct ids, so a label cannot reach the wrong one", () => {
    // Every id either form can put on the page, gathered across both.
    const ids: string[] = [];
    for (const which of ["device", "class"] as const) {
      const { container } = openAddForm(which);
      ids.push(...[...container.querySelectorAll("[id]")].map((node) => node.id));
      cleanup();
    }

    const duplicated = ids.filter((id, index) => ids.indexOf(id) !== index);
    expect(duplicated).toEqual([]);
  });

  it("still submits the names the server action reads", () => {
    openAddForm("class");

    // The fix moved ids, never names. `saveDeviceLineAction` parses brandId,
    // name and sortOrder off the FormData, so renaming a field to fix a label
    // would break the save instead.
    const names = [...document.querySelectorAll("form")]
      .flatMap((element) => [...element.querySelectorAll("input,select")])
      .map((node) => node.getAttribute("name"));

    expect(names).toContain("brandId");
    expect(names).toContain("name");
    expect(names).toContain("sortOrder");
  });

  /**
   * The reason this screen was reworked. Both ways of adding something have to
   * be reachable without scrolling past a list that grows with the catalogue.
   */
  it("offers both add buttons before either list", () => {
    const { container } = renderWorkspace();

    const order = [...container.querySelectorAll("button,h2")].map(
      (node) => node.textContent?.trim() ?? "",
    );
    const addDevice = order.indexOf("Add device");
    const addClass = order.indexOf("Add class");
    const firstHeading = order.indexOf("Devices");

    expect(addDevice).toBeGreaterThanOrEqual(0);
    expect(addClass).toBeGreaterThanOrEqual(0);
    expect(Math.max(addDevice, addClass)).toBeLessThan(firstHeading);
  });

  it("opens the new-class form at the top rather than below the device list", () => {
    const { container } = openAddForm("class");

    const form = container.querySelector("form");
    const devicesHeading = [...container.querySelectorAll("h2")].find(
      (node) => node.textContent === "Devices",
    );

    expect(form).not.toBeNull();
    // DOCUMENT_POSITION_FOLLOWING: the heading comes after the form.
    expect(
      form!.compareDocumentPosition(devicesHeading!) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("shows one add-form at a time", () => {
    renderWorkspace();
    fireEvent.click(screen.getByRole("button", { name: "Add device" }));
    fireEvent.click(screen.getByRole("button", { name: "Add class" }));

    expect(document.querySelectorAll("form")).toHaveLength(1);
  });
});
