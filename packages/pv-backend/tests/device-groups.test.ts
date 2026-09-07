import { describe, expect, it } from "vitest";
import { groupByDeviceClass } from "../src/domain/device-groups";

// A function rather than inline literals: `ClassifiedDevice` carries only an
// optional property, so a fresh literal at the call site trips TypeScript's
// excess-property check — which is the type doing its job on real callers.
const device = (name: string, lineName: string | null) => ({ name, lineName });

describe("grouping models by device class", () => {
  /**
   * The queries already sort by the class order the CEO set in the admin, so
   * re-sorting here would quietly override them.
   */
  it("keeps the order it was handed", () => {
    const groups = groupByDeviceClass([
      device("iPhone 15", "iPhone"),
      device("iPhone 14", "iPhone"),
      device("iPad Air", "iPad"),
    ]);

    expect(groups.map((group) => group.lineName)).toEqual(["iPhone", "iPad"]);
    expect(groups[0]?.devices.map((d) => d.name)).toEqual(["iPhone 15", "iPhone 14"]);
  });

  /** A class is optional per brand, so unfiled is a bucket and not an error. */
  it("keeps unfiled models as their own group, in place", () => {
    const groups = groupByDeviceClass([
      device("Galaxy A54", null),
      device("Galaxy Tab S9", "Galaxy Tab"),
    ]);

    expect(groups.map((group) => group.lineName)).toEqual([null, "Galaxy Tab"]);
  });

  /** The guard every caller would otherwise have to write for itself. */
  it("returns one unlabelled group when nothing is classified", () => {
    const groups = groupByDeviceClass([device("Galaxy A54", null), device("Galaxy S23", null)]);

    expect(groups).toHaveLength(1);
    expect(groups[0]?.lineName).toBeNull();
    expect(groups[0]?.devices).toHaveLength(2);
  });

  /**
   * The property is optional but `exactOptionalPropertyTypes` forbids setting it
   * to `undefined`, so a caller either supplies a class or omits the field —
   * which the `?? null` in the implementation folds into the unfiled group.
   */
  it("has nothing to say about an empty list", () => {
    expect(groupByDeviceClass([])).toEqual([{ lineName: null, devices: [] }]);
  });
});
