"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react";
import type { AdminCategory } from "@pv/backend/services/categories";
import { cn } from "@/lib/utils";
import { CategoryForm } from "./category-form";
import { CategoryRowActions, HiddenPill } from "./category-row-actions";

/** Which form is open: nothing, a new section, or editing an existing one. */
type Editing = { kind: "none" } | { kind: "section" } | { kind: "edit"; id: string };

/**
 * The shop's sections, and how each one is browsed.
 *
 * This used to also carry every by-type section's types, nested underneath it
 * with their own "Add type" button — including under Pouches, which is browsed
 * by device and has no use for a type at all. That put a control that does
 * nothing useful on the section staff open most, and buried the rare job of
 * shaping the shop under the frequent one of stocking it. Types now live at
 * Admin → Categories → Types, reading and writing the same rows through the
 * same actions; this screen only decides what a section *is*.
 */
export function CategoryList({ categories }: { categories: AdminCategory[] }) {
  const [editing, setEditing] = useState<Editing>({ kind: "none" });
  const sections = categories.filter((category) => category.parentId === null);
  const typeCount = (parentId: string) =>
    categories.filter((category) => category.parentId === parentId).length;

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
                    <CategoryRowActions
                      category={section}
                      onEdit={() => setEditing({ kind: "edit", id: section.id })}
                    />
                  </div>

                  <p className="help mt-2">
                    {section.fitsDevices
                      ? "Shoppers pick a make, then a model. Staff are asked for a brand and the devices a product fits."
                      : "Shoppers pick a type. Staff are asked for a type and nothing about devices."}
                  </p>

                  {/*
                    Only for a by-type section, and only a link — never the
                    types themselves. A device-fitting section like Pouches has
                    no type concept at all, so nothing about types appears on
                    it here, not even an empty count.
                  */}
                  {!section.fitsDevices ? (
                    <Link
                      href="/admin/categories/types"
                      className="mt-3 inline-flex min-h-11 items-center gap-1.5 border-t border-(--pv-line) pt-3 text-sm font-bold text-(--pv-red)"
                    >
                      {typeCount(section.id) === 0
                        ? "No types yet — add one"
                        : `${typeCount(section.id)} type${typeCount(section.id) === 1 ? "" : "s"}`}
                      <ArrowRight aria-hidden="true" size={14} weight="bold" />
                    </Link>
                  ) : null}
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
