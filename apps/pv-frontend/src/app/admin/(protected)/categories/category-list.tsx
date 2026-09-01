"use client";

import { useState } from "react";
import type { AdminCategory } from "@pv/backend/services/categories";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { CategoryForm } from "./category-form";
import { setCategoryActiveAction, deleteCategoryAction } from "./actions";

export function CategoryList({ categories }: { categories: AdminCategory[] }) {
  const [editingId, setEditingId] = useState<string | "new" | null>(null);
  const roots = categories.filter((category) => category.parentId === null);
  const childrenOf = (parentId: string) =>
    categories.filter((category) => category.parentId === parentId);

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">Categories</h2>
        <button
          type="button"
          onClick={() => setEditingId(editingId === "new" ? null : "new")}
          className="min-h-11 rounded-xl border border-(--pv-line) px-4 text-sm font-bold"
        >
          {editingId === "new" ? "Cancel" : "Add category"}
        </button>
      </div>

      {editingId === "new" ? (
        <CategoryForm parents={categories} onDone={() => setEditingId(null)} />
      ) : null}

      {roots.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-(--pv-line) p-6 text-sm text-(--pv-muted)">
          No categories yet.
        </p>
      ) : (
        <ul className="grid gap-3">
          {roots.map((parent) => (
            <li
              key={parent.id}
              className="rounded-2xl border border-(--pv-line) bg-(--pv-surface) p-4"
            >
              <CategoryRow
                category={parent}
                categories={categories}
                editingId={editingId}
                setEditingId={setEditingId}
              />
              {childrenOf(parent.id).length > 0 ? (
                <ul className="mt-3 ml-4 grid gap-2 border-l border-(--pv-line) pl-4">
                  {childrenOf(parent.id).map((child) => (
                    <li key={child.id}>
                      <CategoryRow
                        category={child}
                        categories={categories}
                        editingId={editingId}
                        setEditingId={setEditingId}
                      />
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

function CategoryRow({
  category,
  categories,
  editingId,
  setEditingId,
}: {
  category: AdminCategory;
  categories: AdminCategory[];
  editingId: string | "new" | null;
  setEditingId: (id: string | "new" | null) => void;
}) {
  if (editingId === category.id) {
    return (
      <CategoryForm parents={categories} editing={category} onDone={() => setEditingId(null)} />
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <p className="font-bold">
          {category.name}
          {!category.isActive ? (
            <span className="ml-2 rounded-full bg-(--pv-wash) px-2 py-0.5 text-xs font-semibold text-(--pv-muted)">
              Hidden
            </span>
          ) : null}
        </p>
        <p className="text-xs text-(--pv-muted)">/{category.slug}</p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setEditingId(category.id)}
          className="min-h-11 text-sm font-bold text-(--pv-red)"
        >
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
    </div>
  );
}
