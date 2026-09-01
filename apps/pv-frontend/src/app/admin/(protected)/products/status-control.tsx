"use client";

import { useTransition } from "react";
import { ConfirmButton } from "@/components/admin/confirm-button";
import type { ProductStatus } from "@pv/backend/services/products";
import { setProductStatusAction, deleteProductAction } from "./actions";

const NEXT_ACTIONS: Record<ProductStatus, { label: string; to: ProductStatus }[]> = {
  draft: [{ label: "Publish", to: "published" }],
  published: [{ label: "Unpublish", to: "unpublished" }],
  unpublished: [
    { label: "Publish", to: "published" },
    { label: "Archive", to: "archived" },
  ],
  archived: [{ label: "Restore to draft", to: "draft" }],
};

export function StatusControl({ productId, status }: { productId: string; status: ProductStatus }) {
  const [pending, start] = useTransition();

  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="rounded-full bg-(--pv-wash) px-3 py-1 text-xs font-bold tracking-wide uppercase">
        {status}
      </span>
      {NEXT_ACTIONS[status].map((action) => (
        <button
          key={action.to}
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              await setProductStatusAction(productId, action.to);
            })
          }
          className="min-h-11 rounded-xl border border-(--pv-line) px-4 text-sm font-bold disabled:opacity-60"
        >
          {action.label}
        </button>
      ))}
      {status !== "archived" ? (
        <ConfirmButton
          label="Delete product"
          confirmLabel="Delete"
          onConfirm={() => deleteProductAction(productId, "Removed from admin")}
        />
      ) : null}
    </div>
  );
}
