"use client";

import { useState, useTransition } from "react";
import { ConfirmButton } from "@/components/admin/confirm-button";
import type { ProductStatus } from "@pv/backend/services/products";
import { setProductStatusAction, deleteProductAction } from "./actions";
import { cn } from "@/lib/utils";

/**
 * Publishing, and everything else that changes a product's state.
 *
 * **Publish is the primary action and is styled as one.** It used to be one
 * bordered button among several beside the heading, which made the single most
 * consequential thing on the screen — putting a product in front of customers —
 * look exactly like "Archive". It is now the filled brand button, and the bar
 * sticks to the top of the screen so it stays reachable while someone scrolls
 * through variants and images rather than only existing above the fold.
 *
 * The state also says what it means. "draft" is a word about our data model;
 * "Not visible to customers" is what a shop owner needs to know.
 */

const NEXT_ACTIONS: Record<
  ProductStatus,
  { label: string; to: ProductStatus; primary: boolean }[]
> = {
  draft: [{ label: "Publish", to: "published", primary: true }],
  published: [{ label: "Unpublish", to: "unpublished", primary: false }],
  unpublished: [
    { label: "Publish", to: "published", primary: true },
    { label: "Archive", to: "archived", primary: false },
  ],
  archived: [{ label: "Restore to draft", to: "draft", primary: true }],
};

const STATUS_MEANING: Record<ProductStatus, string> = {
  draft: "Not visible to customers",
  published: "Live in the shop",
  unpublished: "Hidden from the shop",
  archived: "Archived",
};

export function StatusControl({
  productId,
  status,
  canPublish,
}: {
  productId: string;
  status: ProductStatus;
  /**
   * Whether a priced variant exists. Publishing is refused without one, and
   * being told that before pressing is better than a message afterwards.
   */
  canPublish: boolean;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div
      className={cn(
        "sticky top-16 z-30 -mx-4 border-b border-(--pv-line) px-4 py-3 sm:mx-0 sm:rounded-2xl sm:border sm:px-4",
        "bg-[color-mix(in_srgb,var(--pv-surface)_92%,transparent)] backdrop-blur-sm",
      )}
    >
      <div className="flex flex-wrap items-center gap-3">
        <span
          className={cn(
            "rounded-full px-3 py-1 text-xs font-bold",
            status === "published"
              ? "bg-[color-mix(in_srgb,var(--pv-success)_16%,var(--pv-surface))] text-(--pv-success)"
              : "bg-(--pv-wash) text-(--pv-muted)",
          )}
        >
          {STATUS_MEANING[status]}
        </span>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          {NEXT_ACTIONS[status].map((action) => {
            const blocked = action.to === "published" && !canPublish;
            return (
              <button
                key={action.to}
                type="button"
                disabled={pending || blocked}
                // Says why it cannot be pressed, rather than being inert and silent.
                title={blocked ? "Add a price before publishing" : undefined}
                onClick={() =>
                  start(async () => {
                    setError(null);
                    const result = await setProductStatusAction(productId, action.to);
                    if (result.error !== null) setError(result.error);
                  })
                }
                className={cn(
                  "min-h-11 rounded-xl px-5 text-sm font-bold disabled:opacity-50",
                  action.primary
                    ? "bg-(--pv-red) text-(--pv-on-brand)"
                    : "border border-(--pv-line)",
                )}
              >
                {action.label}
              </button>
            );
          })}

          {status !== "archived" ? (
            <ConfirmButton
              label="Delete"
              confirmLabel="Delete"
              onConfirm={() => deleteProductAction(productId, "Removed from admin")}
            />
          ) : null}
        </div>
      </div>

      {status !== "published" && !canPublish ? (
        <p className="mt-2 text-xs text-(--pv-muted)">
          This product needs a price before it can go live. Add one under Variants below.
        </p>
      ) : null}

      {error ? (
        <p role="alert" className="mt-2 text-xs text-(--pv-danger)">
          {error}
        </p>
      ) : null}
    </div>
  );
}
