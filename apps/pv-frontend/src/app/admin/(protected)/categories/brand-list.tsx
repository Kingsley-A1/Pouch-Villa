"use client";

import { useState } from "react";
import type { AdminBrand } from "@pv/backend/services/brands";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { BrandForm } from "./brand-form";
import { setBrandActiveAction, deleteBrandAction } from "./actions";

export function BrandList({ brands }: { brands: AdminBrand[] }) {
  const [editingId, setEditingId] = useState<string | "new" | null>(null);

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">Brands</h2>
        <button
          type="button"
          onClick={() => setEditingId(editingId === "new" ? null : "new")}
          className="min-h-11 rounded-xl border border-(--pv-line) px-4 text-sm font-bold"
        >
          {editingId === "new" ? "Cancel" : "Add brand"}
        </button>
      </div>

      {editingId === "new" ? <BrandForm onDone={() => setEditingId(null)} /> : null}

      {brands.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-(--pv-line) p-6 text-sm text-(--pv-muted)">
          No brands yet.
        </p>
      ) : (
        <ul className="grid gap-3">
          {brands.map((brand) =>
            editingId === brand.id ? (
              <li key={brand.id}>
                <BrandForm editing={brand} onDone={() => setEditingId(null)} />
              </li>
            ) : (
              <li
                key={brand.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-(--pv-line) bg-(--pv-surface) p-4"
              >
                <div>
                  <p className="font-bold">
                    {brand.name}
                    {!brand.isActive ? (
                      <span className="ml-2 rounded-full bg-(--pv-wash) px-2 py-0.5 text-xs font-semibold text-(--pv-muted)">
                        Hidden
                      </span>
                    ) : null}
                  </p>
                  <p className="text-xs text-(--pv-muted)">/{brand.slug}</p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setEditingId(brand.id)}
                    className="min-h-11 text-sm font-bold text-(--pv-red)"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => setBrandActiveAction(brand.id, !brand.isActive)}
                    className="min-h-11 text-sm font-semibold text-(--pv-ink)"
                  >
                    {brand.isActive ? "Hide" : "Show"}
                  </button>
                  <ConfirmButton
                    label="Remove"
                    confirmLabel="Remove"
                    onConfirm={() =>
                      deleteBrandAction(brand.id, "Removed from admin").then(() => {})
                    }
                  />
                </div>
              </li>
            ),
          )}
        </ul>
      )}
    </div>
  );
}
