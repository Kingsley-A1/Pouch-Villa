"use client";

import { ImageSquare } from "@phosphor-icons/react";
import type { AdminCategory } from "@pv/backend/services/categories";
import { CategoryForm } from "./category-form";
import { CategoryRowActions, HiddenPill } from "./category-row-actions";
import type { TreeRow } from "./category-tree";

/*
  Indent classes are spelled out, not built from `depth`, so Tailwind sees each
  one at build time — and never a `style` attribute, which the CSP refuses
  (`style-src-attr`, AGENTS.md §5). Past three levels the indent stops growing:
  at 360 px a deeper step would leave the name no room.
*/
const INDENT = ["", "pl-4", "pl-8", "pl-12"] as const;
const indentFor = (depth: number) => INDENT[Math.min(depth, INDENT.length - 1)] ?? "";

/**
 * One row per category under a section, every depth, each with its own
 * Edit / Hide / Remove.
 *
 * Shared by both category screens so that nothing filed under a section can be
 * left without a row: the dashboard counts every category, and one that is
 * counted but listed nowhere cannot be renamed, hidden or removed — nor can
 * the section above it, since the server refuses to remove a category that
 * still has subcategories.
 */
export function SubcategoryRows({
  rows,
  categories,
  editingId,
  onEdit,
  onDone,
}: {
  rows: TreeRow[];
  /** Every category, for the edit form's parent dropdown. */
  categories: AdminCategory[];
  editingId: string | null;
  onEdit: (id: string) => void;
  onDone: () => void;
}) {
  return (
    <ul className="mt-3 grid gap-2 border-t border-(--pv-line) pt-3">
      {rows.map(({ category, depth }) => (
        // A hairline between rows, absent after the last, the same rhythm
        // the type list uses: names and action rows that wrap at 360 px
        // otherwise run into the next one with no seam.
        <li
          key={category.id}
          data-filter-label={category.name}
          className={`border-b border-(--pv-line) pb-2 last:border-0 ${indentFor(depth)}`}
        >
          {editingId === category.id ? (
            <CategoryForm parents={categories} editing={category} onDone={onDone} />
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-bold break-words">
                  {depth > 0 ? (
                    <span aria-hidden="true" className="mr-1 text-(--pv-muted)">
                      ↳
                    </span>
                  ) : null}
                  {category.name}
                  {!category.isActive ? <HiddenPill /> : null}
                </p>
                <p className="flex items-center gap-1.5 text-xs text-(--pv-muted)">
                  /{category.slug}
                  {/*
                    A category with no photograph draws a lettered panel on
                    the shop; this is the only way to see which ones still do
                    without opening each.
                  */}
                  {category.image === null ? (
                    <>
                      <span aria-hidden="true">·</span>
                      <ImageSquare aria-hidden="true" size={13} weight="bold" />
                      no picture yet
                    </>
                  ) : null}
                </p>
              </div>
              <CategoryRowActions category={category} onEdit={() => onEdit(category.id)} />
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
