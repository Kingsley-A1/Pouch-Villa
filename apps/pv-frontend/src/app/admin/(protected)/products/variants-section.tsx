"use client";

import { useState, useTransition } from "react";
import type { AdminVariant } from "@pv/backend/services/products";
import { formatKobo } from "@pv/backend/domain/money";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { VariantForm } from "./variant-form";
import { StockForm } from "./stock-form";
import {
  saveVariantAction,
  setVariantActiveAction,
  deleteVariantAction,
  adjustStockAction,
} from "./actions";
import type { ActionState } from "@/lib/action-state";

export function VariantsSection({
  productId,
  variants,
}: {
  productId: string;
  variants: AdminVariant[];
}) {
  const [editingId, setEditingId] = useState<string | "new" | null>(null);
  const [expandedStockId, setExpandedStockId] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const boundSave = saveVariantAction.bind(null, productId) as (
    prev: ActionState,
    formData: FormData,
  ) => Promise<ActionState>;

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">Variants</h2>
        <button
          type="button"
          onClick={() => setEditingId(editingId === "new" ? null : "new")}
          className="min-h-11 rounded-xl border border-(--pv-line) px-4 text-sm font-bold"
        >
          {editingId === "new" ? "Cancel" : "Add variant"}
        </button>
      </div>

      {editingId === "new" ? (
        <VariantForm action={boundSave} onDone={() => setEditingId(null)} />
      ) : null}

      {variants.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-(--pv-line) p-6 text-sm text-(--pv-muted)">
          No variants yet. A product needs at least one active, priced variant before it can be
          published.
        </p>
      ) : (
        <ul className="grid gap-3">
          {variants.map((variant) =>
            editingId === variant.id ? (
              <li key={variant.id}>
                <VariantForm
                  action={boundSave}
                  editing={variant}
                  onDone={() => setEditingId(null)}
                />
              </li>
            ) : (
              <li
                key={variant.id}
                className="rounded-2xl border border-(--pv-line) bg-(--pv-surface) p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-bold">
                      {variant.sku}
                      {!variant.isActive ? (
                        <span className="ml-2 rounded-full bg-(--pv-wash) px-2 py-0.5 text-xs font-semibold text-(--pv-muted)">
                          Inactive
                        </span>
                      ) : null}
                    </p>
                    <p className="text-xs text-(--pv-muted)">
                      {Object.values(variant.axes).join(" · ") || "No options set"} ·{" "}
                      {formatKobo(variant.priceKobo)} · stock {variant.inStock}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedStockId(expandedStockId === variant.id ? null : variant.id)
                      }
                      className="min-h-11 text-sm font-bold text-(--pv-ink)"
                    >
                      Stock
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(variant.id)}
                      className="min-h-11 text-sm font-bold text-(--pv-red)"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() =>
                        start(async () => {
                          await setVariantActiveAction(productId, variant.id, !variant.isActive);
                        })
                      }
                      className="min-h-11 text-sm font-semibold disabled:opacity-60"
                    >
                      {variant.isActive ? "Deactivate" : "Activate"}
                    </button>
                    <ConfirmButton
                      label="Remove"
                      confirmLabel="Remove"
                      onConfirm={() => deleteVariantAction(productId, variant.id)}
                    />
                  </div>
                </div>
                {expandedStockId === variant.id ? (
                  <div className="mt-3">
                    <StockForm
                      currentStock={variant.inStock}
                      action={
                        adjustStockAction.bind(null, productId, variant.id) as (
                          prev: ActionState,
                          formData: FormData,
                        ) => Promise<ActionState>
                      }
                    />
                  </div>
                ) : null}
              </li>
            ),
          )}
        </ul>
      )}
    </div>
  );
}
