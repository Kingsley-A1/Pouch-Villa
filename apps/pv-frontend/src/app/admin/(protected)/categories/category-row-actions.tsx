"use client";

import type { AdminCategory } from "@pv/backend/services/categories";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { setCategoryActiveAction, deleteCategoryAction } from "./actions";

/**
 * Shared by the section list and the type list — a section and a type are the
 * same underlying row, shown and hidden the same way, so the controls for
 * doing that live once rather than being kept in step by hand in two files.
 */

export function HiddenPill() {
  return (
    <span className="ml-2 rounded-full bg-(--pv-wash) px-2 py-0.5 text-xs font-semibold text-(--pv-muted)">
      Hidden
    </span>
  );
}

export function CategoryRowActions({
  category,
  onEdit,
}: {
  category: AdminCategory;
  onEdit: () => void;
}) {
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
