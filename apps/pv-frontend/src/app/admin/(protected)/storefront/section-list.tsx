"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp } from "@phosphor-icons/react";
import type { AdminHomeSection } from "@pv/backend/services/home-sections";
import type { AdminCategory } from "@pv/backend/services/categories";
import type { AdminBrand } from "@pv/backend/services/brands";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { SectionForm } from "./section-form";
import { deleteSectionAction, moveSectionAction, setSectionActiveAction } from "./actions";

export function SectionList({
  sections,
  categories,
  brands,
}: {
  sections: AdminHomeSection[];
  categories: AdminCategory[];
  brands: AdminBrand[];
}) {
  const [editingId, setEditingId] = useState<string | "new" | null>(null);

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold">Home page sections</h2>
        <button
          type="button"
          onClick={() => setEditingId(editingId === "new" ? null : "new")}
          className="min-h-11 rounded-xl border border-(--pv-line) px-4 text-sm font-bold"
        >
          {editingId === "new" ? "Cancel" : "Add section"}
        </button>
      </div>

      {editingId === "new" ? (
        <SectionForm categories={categories} brands={brands} onDone={() => setEditingId(null)} />
      ) : null}

      {sections.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-(--pv-line) p-6 text-sm text-(--pv-muted)">
          No sections yet. Until you add one, the home page shows your newest products in a single
          grid.
        </p>
      ) : (
        <ul className="grid gap-3">
          {sections.map((section, index) => (
            <li key={section.id}>
              <SectionRow
                section={section}
                categories={categories}
                brands={brands}
                isFirst={index === 0}
                isLast={index === sections.length - 1}
                editing={editingId === section.id}
                onToggleEdit={() => setEditingId(editingId === section.id ? null : section.id)}
                onDone={() => setEditingId(null)}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SectionRow({
  section,
  categories,
  brands,
  isFirst,
  isLast,
  editing,
  onToggleEdit,
  onDone,
}: {
  section: AdminHomeSection;
  categories: AdminCategory[];
  brands: AdminBrand[];
  isFirst: boolean;
  isLast: boolean;
  editing: boolean;
  onToggleEdit: () => void;
  onDone: () => void;
}) {
  const [pending, start] = useTransition();

  /**
   * What this section will actually show, said plainly. A section whose source
   * has been deleted, or a collection nobody has filed a product into, renders
   * nothing on the storefront — and the only place that is visible is here.
   */
  const source =
    section.kind === "collection"
      ? `${section.pickedCount} hand-picked ${section.pickedCount === 1 ? "product" : "products"}`
      : section.sourceName === null
        ? "Its source has been deleted — this section will not appear"
        : `${section.kind === "category" ? "Category" : "Brand"}: ${section.sourceName}`;

  const willBeEmpty =
    section.sourceName === null || (section.kind === "collection" && section.pickedCount === 0);

  return (
    <div className="rounded-2xl border border-(--pv-line) bg-(--pv-surface) p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 font-bold">
            {section.title}
            {!section.isActive ? (
              <span className="rounded-full bg-(--pv-wash) px-2 py-0.5 text-xs font-bold text-(--pv-muted)">
                Hidden
              </span>
            ) : null}
          </p>
          {section.subtitle ? (
            <p className="mt-0.5 text-sm text-(--pv-muted)">{section.subtitle}</p>
          ) : null}
          <p
            className={`mt-1 text-xs ${willBeEmpty ? "text-(--pv-warning)" : "text-(--pv-muted)"}`}
          >
            {source} · up to {section.maxItems}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <MoveButton
            label="Move up"
            disabled={isFirst || pending}
            onClick={() => start(() => moveSectionAction(section.id, "up"))}
          >
            <ArrowUp aria-hidden="true" size={17} />
          </MoveButton>
          <MoveButton
            label="Move down"
            disabled={isLast || pending}
            onClick={() => start(() => moveSectionAction(section.id, "down"))}
          >
            <ArrowDown aria-hidden="true" size={17} />
          </MoveButton>
        </div>
      </div>

      {section.kind === "collection" ? (
        <p className="mt-2 text-xs text-(--pv-muted)">
          Add products to this collection from{" "}
          <Link href="/admin/products" className="font-semibold underline">
            each product&rsquo;s own page
          </Link>
          , under &ldquo;Where it appears&rdquo;.
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-4">
        <button type="button" onClick={onToggleEdit} className="text-sm font-bold">
          {editing ? "Close" : "Edit"}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => start(() => setSectionActiveAction(section.id, !section.isActive))}
          className="text-sm font-bold"
        >
          {section.isActive ? "Hide from home page" : "Show on home page"}
        </button>
        <ConfirmButton
          label="Remove"
          onConfirm={async () => {
            await deleteSectionAction(section.id, "Removed from the admin storefront screen");
          }}
        />
      </div>

      {editing ? (
        <div className="mt-3">
          <SectionForm categories={categories} brands={brands} editing={section} onDone={onDone} />
        </div>
      ) : null}
    </div>
  );
}

function MoveButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="grid h-11 w-11 place-items-center rounded-xl border border-(--pv-line) disabled:opacity-40"
    >
      {children}
    </button>
  );
}
