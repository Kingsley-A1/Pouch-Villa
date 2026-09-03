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
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">Price and options</h2>
          {/*
            "Variants" is our word, not a shop owner's. Most products are sold
            one way and need one price — which the create screen now takes — so
            this section is only worth opening when the same product comes in
            several colours or sizes.
          */}
          <p className="mt-1 max-w-prose text-sm text-(--pv-muted)">
            One price is enough for most products. Add more only if you sell this in several colours
            or sizes.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setEditingId(editingId === "new" ? null : "new")}
          className="min-h-11 rounded-xl border border-(--pv-line) px-4 text-sm font-bold"
        >
          {editingId === "new" ? "Cancel" : "Add a price or option"}
        </button>
      </div>

      {editingId === "new" ? (
        <VariantForm action={boundSave} onDone={() => setEditingId(null)} />
      ) : null}

      {variants.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-(--pv-line) p-6 text-sm text-(--pv-muted)">
          No price set yet. This product cannot go live until it has one.
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
