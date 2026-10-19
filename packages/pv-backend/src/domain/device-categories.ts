/**
 * Which categories are worth offering to someone who has named their device.
 *
 * "What are you looking for?" must only list things the shop actually has for
 * that phone. A shopper who picks an iPhone and is offered "Power Banks" has
 * been sent down a path that ends on an empty shelf, and a guided path must
 * never do that.
 *
 * Pure, and run over data the storefront already loads: the category tree, and
 * for each device the categories that hold a published product fitting it.
 */

export type FittingNode = { slug: string; name: string; children: readonly FittingNode[] };

/** Device slug → the slugs of the categories its compatible products are filed in. */
export type CategoriesByDevice = Readonly<Record<string, readonly string[]>>;

export type FittingOption = {
  slug: string;
  name: string;
  /** Types under a section the device has stock in, in the tree's own order. */
  children: { slug: string; name: string }[];
};

/**
 * The sections, and the types beneath them, that hold something for any of the
 * given devices — in the order staff arranged them.
 *
 * A section is kept when its own slug is filed against a device *or* one of its
 * types is. Products are filed under a section and at most one type, but a
 * product filed only under a type is still in the section, so the parent has to
 * follow its child or "All of this section" would vanish from a shop that has it.
 *
 * `deviceSlugs` is a set rather than one slug because a brand without a model
 * chosen means "any of this make's devices".
 */
export function categoriesFittingDevices(
  tree: readonly FittingNode[],
  byDevice: CategoriesByDevice,
  deviceSlugs: readonly string[],
): FittingOption[] {
  const filed = new Set<string>();
  for (const deviceSlug of deviceSlugs) {
    for (const categorySlug of byDevice[deviceSlug] ?? []) filed.add(categorySlug);
  }

  const options: FittingOption[] = [];
  for (const section of tree) {
    const children = section.children
      .filter((child) => filed.has(child.slug))
      .map((child) => ({ slug: child.slug, name: child.name }));
    if (children.length > 0 || filed.has(section.slug)) {
      options.push({ slug: section.slug, name: section.name, children });
    }
  }
  return options;
}

/** Whether a category slug appears anywhere in a set of options. */
export function optionsContain(options: readonly FittingOption[], slug: string): boolean {
  return options.some(
    (option) => option.slug === slug || option.children.some((child) => child.slug === slug),
  );
}
