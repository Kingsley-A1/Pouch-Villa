"use client";

import Link from "next/link";
import { useState } from "react";
import { Plus } from "@phosphor-icons/react";
import type { AdminCategory } from "@pv/backend/services/categories";
import { CategoryForm } from "../category-form";
import { descendantsOf } from "../category-tree";
import { SubcategoryRows } from "../subcategory-rows";

/** Which form is open: nothing, a new type under a section, or editing an existing one. */
type Editing = { kind: "none" } | { kind: "add"; parentId: string } | { kind: "edit"; id: string };

/**
 * One card per section that is browsed by type, each with its own types.
 *
 * Grouped by section rather than shown as one flat list, because a type
 * belongs to exactly one section and the form that adds one needs to know
 * which — the same reason Admin → Devices groups models under a make. Today
 * that is one card, Accessories; nothing here assumes there is only ever one.
 *
 * Reads and writes the same `category` rows Brands & Categories does, through
 * the same `CategoryForm` and the same server actions — a type added here is a
 * category with a parent, exactly as one added there would have been.
 */
export function TypeList({ categories }: { categories: AdminCategory[] }) {
  const [editing, setEditing] = useState<Editing>({ kind: "none" });

  const typeSections = categories.filter(
    (category) => category.parentId === null && !category.fitsDevices,
  );
  const typesOf = (parentId: string) =>
    categories.filter((category) => category.parentId === parentId);

  const close = () => setEditing({ kind: "none" });

  if (typeSections.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-(--pv-line) p-6 text-sm text-(--pv-muted)">
        No section is browsed by type yet. Create one, or switch an existing section to
        &ldquo;browsed by type&rdquo;, in{" "}
        <Link href="/admin/categories" className="font-bold text-(--pv-red) underline">
          Brands &amp; Categories
        </Link>
        .
      </p>
    );
  }

  return (
    <ul className="grid gap-3">
      {typeSections.map((section) => {
        const types = typesOf(section.id);
        const adding = editing.kind === "add" && editing.parentId === section.id;

        return (
          <li
            key={section.id}
            className="rounded-2xl border border-(--pv-line) bg-(--pv-surface) p-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-bold">{section.name}</p>
                <p className="text-xs text-(--pv-muted)">
                  {types.length === 0
                    ? "No types yet"
                    : `${types.length} type${types.length === 1 ? "" : "s"}`}
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  setEditing((current) =>
                    current.kind === "add" && current.parentId === section.id
                      ? { kind: "none" }
                      : { kind: "add", parentId: section.id },
                  )
                }
                // Named for the section, the same reason a screen with more
                // than one of these buttons needs each distinguishable
                // (WCAG 2.2 AA) — today there is one section, but the label
                // must not silently stop making sense the day a second exists.
                aria-label={
                  adding
                    ? `Cancel adding a type to ${section.name}`
                    : `Add a type to ${section.name}`
                }
                className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-(--pv-line) px-4 text-sm font-bold hover:border-(--pv-red)"
              >
                {adding ? (
                  "Cancel"
                ) : (
                  <>
                    <Plus aria-hidden="true" size={15} weight="bold" />
                    Add type
                  </>
                )}
              </button>
            </div>

            {adding ? (
              <div className="mt-3">
                <CategoryForm parents={categories} fixedParentId={section.id} onDone={close} />
              </div>
            ) : null}

            {/*
              Every depth, not only the direct types: a category filed under a
              type is still something staff must be able to find, rename and
              remove, and the type above it cannot be removed while it exists.
            */}
            {types.length > 0 ? (
              <SubcategoryRows
                rows={descendantsOf(categories, section.id)}
                categories={categories}
                editingId={editing.kind === "edit" ? editing.id : null}
                onEdit={(id) => setEditing({ kind: "edit", id })}
                onDone={close}
              />
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
