"use client";

import { useState } from "react";
import { ImageSquare, Plus } from "@phosphor-icons/react";
import type { AdminCategory } from "@pv/backend/services/categories";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { cn } from "@/lib/utils";
import { CategoryForm } from "./category-form";
import { setCategoryActiveAction, deleteCategoryAction } from "./actions";

/** Which form is open: nothing, a new section, a new type under a section, or an edit. */
type Editing =
  | { kind: "none" }
  | { kind: "section" }
  | { kind: "type"; parentId: string }
  | { kind: "edit"; id: string };

/**
 * The catalogue's shape, as the shop's own two tiers rather than a flat tree.
 *
 * It was one list with a single "Add category" button and a parent dropdown
 * inside the form, which made two things invisible. Nothing said how a section
 * is browsed — so Accessories could sit set to "by device" and go on asking
 * shoppers which phone they own, with no sign of it on this screen. And adding a
 * type meant knowing that a type *is* a category with a parent, which is our
 * word for it, not the client's.
 *
 * Each section now says how it is browsed and carries its own "Add type", so
 * both are answered by looking at the page.
 */
export function CategoryList({ categories }: { categories: AdminCategory[] }) {
  const [editing, setEditing] = useState<Editing>({ kind: "none" });
  const sections = categories.filter((category) => category.parentId === null);
  const typesOf = (parentId: string) =>
    categories.filter((category) => category.parentId === parentId);

  const close = () => setEditing({ kind: "none" });

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">Categories</h2>
          <p className="mt-1 text-sm text-(--pv-muted)">
            A section is a top-level part of the shop. How it is browsed decides what staff are
            asked for when filing a product into it.
          </p>
        </div>
        <button
          type="button"
          onClick={() =>
            setEditing((current) =>
              current.kind === "section" ? { kind: "none" } : { kind: "section" },
            )
          }
          className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl border border-(--pv-line) px-4 text-sm font-bold"
        >
          {editing.kind === "section" ? "Cancel" : "Add section"}
        </button>
      </div>

      {editing.kind === "section" ? <CategoryForm parents={categories} onDone={close} /> : null}

      {sections.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-(--pv-line) p-6 text-sm text-(--pv-muted)">
          No sections yet. Add one — Pouches, Accessories — and everything else hangs off it.
        </p>
      ) : (
        <ul className="grid gap-3">
          {sections.map((section) => (
            <li
              key={section.id}
              className="rounded-2xl border border-(--pv-line) bg-(--pv-surface) p-4"
            >
              {editing.kind === "edit" && editing.id === section.id ? (
                <CategoryForm parents={categories} editing={section} onDone={close} />
              ) : (
                <>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-bold">
                        {section.name}
                        {!section.isActive ? <HiddenPill /> : null}
                      </p>
                      <p className="text-xs text-(--pv-muted)">/{section.slug}</p>
                      {/*
                        The whole point of the row. Stated in words, not by
                        colour alone (WCAG 2.2 AA), and on the section rather
                        than buried in its edit form — a shop whose Accessories
                        still says "by device" can see that from here.
                      */}
                      <p className="mt-1.5">
                        <span
                          className={cn(
                            "inline-flex rounded-full px-2 py-0.5 text-xs font-bold",
                            section.fitsDevices
                              ? "bg-[color-mix(in_srgb,var(--pv-red)_12%,var(--pv-surface))] text-(--pv-red)"
                              : "bg-(--pv-wash) text-(--pv-ink)",
                          )}
                        >
                          {section.fitsDevices ? "Browsed by device" : "Browsed by type"}
                        </span>
                      </p>
                    </div>
                    <RowActions
                      category={section}
                      onEdit={() => setEditing({ kind: "edit", id: section.id })}
                    />
                  </div>

                  <p className="help mt-2">
                    {section.fitsDevices
                      ? "Shoppers pick a make, then a model. Staff are asked for a brand and the devices a product fits."
                      : "Shoppers pick a type. Staff are asked for a type and nothing about devices."}
                  </p>
                </>
              )}

              <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-(--pv-line) pt-3">
                <p className="text-sm font-semibold">
                  {typesOf(section.id).length === 0
                    ? "No types yet"
                    : `${typesOf(section.id).length} type${typesOf(section.id).length === 1 ? "" : "s"}`}
                </p>
                <button
                  type="button"
                  onClick={() =>
                    setEditing((current) =>
                      current.kind === "type" && current.parentId === section.id
                        ? { kind: "none" }
                        : { kind: "type", parentId: section.id },
                    )
                  }
                  // Named for the section it belongs to. Three "Add type"
                  // buttons on one screen are indistinguishable to anyone not
                  // seeing which card they sit in (WCAG 2.2 AA), and the visible
                  // label stays inside the accessible one (2.5.3).
                  aria-label={
                    editing.kind === "type" && editing.parentId === section.id
                      ? `Cancel adding a type to ${section.name}`
                      : `Add type to ${section.name}`
                  }
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-(--pv-line) px-4 text-sm font-bold hover:border-(--pv-red)"
                >
                  {editing.kind === "type" && editing.parentId === section.id ? (
                    "Cancel"
                  ) : (
                    <>
                      <Plus aria-hidden="true" size={15} weight="bold" />
                      Add type
                    </>
                  )}
                </button>
              </div>

              {/*
                Opens under the section it belongs to, with the parent already
                chosen. Adding a type used to mean knowing a type is a category
                with a parent, which is our word for it rather than the client's.
              */}
              {editing.kind === "type" && editing.parentId === section.id ? (
                <div className="mt-3">
                  <CategoryForm parents={categories} fixedParentId={section.id} onDone={close} />
                </div>
              ) : null}

              {typesOf(section.id).length > 0 ? (
                <ul className="mt-3 ml-1 grid gap-2 border-l border-(--pv-line) pl-4">
                  {typesOf(section.id).map((type) => (
                    <li key={type.id}>
                      {editing.kind === "edit" && editing.id === type.id ? (
                        <CategoryForm parents={categories} editing={type} onDone={close} />
                      ) : (
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-bold break-words">
                              {type.name}
                              {!type.isActive ? <HiddenPill /> : null}
                            </p>
                            <p className="flex items-center gap-1.5 text-xs text-(--pv-muted)">
                              /{type.slug}
                              {/*
                                Said on the row, because a type with no
                                photograph draws a lettered panel on the shop
                                and there was no way to see which ones were
                                still doing that short of visiting each.
                              */}
                              {type.image === null ? (
                                <>
                                  <span aria-hidden="true">·</span>
                                  <ImageSquare aria-hidden="true" size={13} weight="bold" />
                                  no picture yet
                                </>
                              ) : null}
                            </p>
                          </div>
                          <RowActions
                            category={type}
                            onEdit={() => setEditing({ kind: "edit", id: type.id })}
                          />
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function HiddenPill() {
  return (
    <span className="ml-2 rounded-full bg-(--pv-wash) px-2 py-0.5 text-xs font-semibold text-(--pv-muted)">
      Hidden
    </span>
  );
}

function RowActions({ category, onEdit }: { category: AdminCategory; onEdit: () => void }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button type="button" onClick={onEdit} className="min-h-11 text-sm font-bold text-(--pv-red)">
        Edit
      </button>
      <button
        type="button"
        onClick={() => setCategoryActiveAction(category.id, !category.isActive)}
        className="min-h-11 text-sm font-semibold text-(--pv-ink)"
      >
        {category.isActive ? "Hide" : "Show"}
      </button>
      <ConfirmButton
        label="Remove"
        confirmLabel="Remove"
        onConfirm={() => deleteCategoryAction(category.id, "Removed from admin").then(() => {})}
      />
    </div>
  );
}
