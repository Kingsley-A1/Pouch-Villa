import type { AdminCategory } from "@pv/backend/services/categories";

export type TreeRow = { category: AdminCategory; depth: number };

/**
 * Every category beneath `rootId`, at any depth, in reading order: each
 * category followed by its own subcategories before its next sibling.
 *
 * Flat rather than nested so a long branch can be filtered row by row, and so
 * each row carries its depth for indenting. Siblings keep the order the server
 * sent (sort order, then name). `seen` guards against a parent loop already in
 * the data — the walk would otherwise never end.
 */
export function descendantsOf(categories: AdminCategory[], rootId: string): TreeRow[] {
  const rows: TreeRow[] = [];
  const seen = new Set<string>([rootId]);

  const walk = (parentId: string, depth: number) => {
    for (const category of categories) {
      if (category.parentId !== parentId || seen.has(category.id)) continue;
      seen.add(category.id);
      rows.push({ category, depth });
      walk(category.id, depth + 1);
    }
  };

  walk(rootId, 0);
  return rows;
}

/**
 * The categories a given one may be moved under: anything except itself and
 * its own subcategories, either of which would leave the branch with no top
 * level. The server refuses that too; this keeps it out of the dropdown.
 */
export function possibleParents(
  categories: AdminCategory[],
  editingId: string | undefined,
): AdminCategory[] {
  if (editingId === undefined) return categories;
  const excluded = new Set([
    editingId,
    ...descendantsOf(categories, editingId).map((row) => row.category.id),
  ]);
  return categories.filter((category) => !excluded.has(category.id));
}
