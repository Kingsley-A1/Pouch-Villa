import { describe, expect, it } from "vitest";
import {
  categoriesFittingDevices,
  optionsContain,
  type FittingNode,
} from "../src/domain/device-categories";

const leaf = (slug: string, name: string): FittingNode => ({ slug, name, children: [] });

const tree: FittingNode[] = [
  {
    slug: "cases",
    name: "Cases",
    children: [leaf("clear", "Clear"), leaf("rugged", "Rugged")],
  },
  { slug: "guards", name: "Screen Guards", children: [] },
  { slug: "power", name: "Power", children: [leaf("banks", "Power Banks")] },
];

const byDevice = {
  "iphone-15": ["cases", "clear", "guards"],
  "iphone-14": ["rugged", "cases"],
  "galaxy-a54": ["guards"],
};

describe("categories fitting a device", () => {
  it("offers only what the named device has something in", () => {
    expect(categoriesFittingDevices(tree, byDevice, ["galaxy-a54"])).toEqual([
      { slug: "guards", name: "Screen Guards", children: [] },
    ]);
  });

  it("lists the types under a section, and only the ones that fit", () => {
    const [cases] = categoriesFittingDevices(tree, byDevice, ["iphone-15"]);
    expect(cases).toEqual({
      slug: "cases",
      name: "Cases",
      children: [{ slug: "clear", name: "Clear" }],
    });
  });

  it("unions across a make's devices when no model is chosen", () => {
    const options = categoriesFittingDevices(tree, byDevice, ["iphone-15", "iphone-14"]);
    expect(options.map((option) => option.slug)).toEqual(["cases", "guards"]);
    expect(options[0]?.children.map((child) => child.slug)).toEqual(["clear", "rugged"]);
  });

  it("keeps a section whose product is filed only under one of its types", () => {
    const options = categoriesFittingDevices(tree, { "iphone-14": ["rugged"] }, ["iphone-14"]);
    expect(options).toEqual([
      { slug: "cases", name: "Cases", children: [{ slug: "rugged", name: "Rugged" }] },
    ]);
  });

  it("never offers a category no device fits, such as a power bank", () => {
    const everything = categoriesFittingDevices(tree, byDevice, [
      "iphone-15",
      "iphone-14",
      "galaxy-a54",
    ]);
    expect(optionsContain(everything, "banks")).toBe(false);
    expect(optionsContain(everything, "power")).toBe(false);
  });

  it("keeps the order staff arranged", () => {
    const options = categoriesFittingDevices(tree, byDevice, ["iphone-15", "iphone-14"]);
    expect(options.map((option) => option.slug)).toEqual(["cases", "guards"]);
  });

  it("offers nothing for an unknown device or an empty scope", () => {
    expect(categoriesFittingDevices(tree, byDevice, ["nokia-3310"])).toEqual([]);
    expect(categoriesFittingDevices(tree, byDevice, [])).toEqual([]);
  });

  it("finds a type or a section among the options", () => {
    const options = categoriesFittingDevices(tree, byDevice, ["iphone-15"]);
    expect(optionsContain(options, "clear")).toBe(true);
    expect(optionsContain(options, "cases")).toBe(true);
    expect(optionsContain(options, "rugged")).toBe(false);
  });
});
