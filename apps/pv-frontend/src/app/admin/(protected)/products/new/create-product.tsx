"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { AdminBrand } from "@pv/backend/services/brands";
import type { AdminCategory } from "@pv/backend/services/categories";
import type { AdminDevice } from "@pv/backend/services/devices";
import type { ActionState } from "@/lib/action-state";
import { CheckCircle, Plus } from "@phosphor-icons/react";
import { LoadingLine } from "@/components/loading-line";
import { ProductForm } from "../product-form";
import type { PickedFile } from "../media-picker";
import { uploadProductImage } from "../upload-image";

type CreateResult = ActionState & { productId?: string };

/**
 * Creates the product, then uploads the images that were chosen alongside it.
 *
 * The two cannot be one request: an R2 key is scoped by product id, so there is
 * nothing to upload to until the row exists. Rather than exposing that ordering
 * to staff as "save, then come back for pictures", it is sequenced here — the
 * product is created, its pictures follow, and only then does the screen move on.
 *
 * If an upload fails the product is *not* rolled back. It exists as a draft with
 * fewer pictures than intended, which is recoverable on the edit screen, whereas
 * discarding a product because the fourth photo timed out on mobile data would
 * throw away everything already typed. What matters is that the person is told
 * exactly which files did not make it.
 */
export function CreateProduct({
  action,
  brands,
  categories,
  devices,
  collections,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<CreateResult>;
  brands: AdminBrand[];
  categories: AdminCategory[];
  devices: AdminDevice[];
  collections: { id: string; title: string }[];
}) {
  const router = useRouter();
  const [files, setFiles] = useState<PickedFile[]>([]);
  const [uploading, setUploading] = useState<{ done: number; total: number } | null>(null);
  /**
   * The finished result, set once and only once the uploads have run.
   *
   * One piece of state rather than three, because the three had an order they
   * had to be written in and no way to express it. In particular the id was set
   * the moment the row existed — before the images were sent — so anything
   * keyed on "was it created" was briefly true while uploads were still going.
   *
   * Until this is set the form is on screen. After it, the form is gone: the
   * product exists, and leaving it submittable would make the obvious next
   * action ("press it again") quietly create a duplicate.
   */
  const [outcome, setOutcome] = useState<{ productId: string; failures: string[] } | null>(null);

  async function createThenUpload(prev: ActionState, formData: FormData): Promise<CreateResult> {
    const created = await action(prev, formData);
    if (created.productId === undefined) return created;

    const productId = created.productId;
    const failed: string[] = [];
    setUploading({ done: 0, total: files.length });

    // Sequential, not parallel: five concurrent multi-megabyte PUTs on a mobile
    // connection contend with each other and are more likely to time out than
    // the same five sent one after another.
    for (const [index, picked] of files.entries()) {
      // Every failure mode is a returned value — see `uploadProductImage`. The
      // reason is kept rather than only the filename: "storage refused it" and
      // "that file is 30MB" need different things done about them.
      const outcome = await uploadProductImage(productId, picked.file);
      if (!outcome.ok) failed.push(outcome.error);
      setUploading({ done: index + 1, total: files.length });
    }

    setUploading(null);

    /**
     * Written after the uploads, whether they worked or not.
     *
     * The confirmation below replaces the form. It used to redirect straight to
     * the edit screen instead, which answered the wrong question: somebody who
     * has just filled in a product wants to know it saved and to start the next
     * one, and instead landed on a screen that looks like the form they were on
     * and had to work out whether they were creating or editing. Uploading a
     * batch meant navigating back for every single one.
     */
    setOutcome({ productId, failures: failed });

    if (failed.length > 0) {
      return {
        error: `The product was created, but ${failed.length} image${
          failed.length === 1 ? "" : "s"
        } did not upload. Add ${failed.length === 1 ? "it" : "them"} again on the edit screen.`,
      };
    }
    return { error: null, message: "Product created." };
  }

  /** Clears everything this screen holds, so the next product starts empty. */
  function startAnother() {
    for (const picked of files) URL.revokeObjectURL(picked.previewUrl);
    setFiles([]);
    setOutcome(null);
    // Re-runs the page's data loading, so a brand or category added since this
    // screen opened is in the next product's lists.
    router.refresh();
  }

  // Everything worked. The form is replaced rather than left on screen: it has
  // already done its job, and the next thing this person does is either open
  // what they made or make another.
  if (outcome !== null && outcome.failures.length === 0) {
    return (
      <div className="panel-bracket grid gap-4 p-5 text-center">
        <CheckCircle
          size={44}
          weight="fill"
          aria-hidden="true"
          className="justify-self-center text-(--pv-success)"
        />
        {/* `role="status"` so the outcome is announced, not just drawn. */}
        <div role="status">
          <h2 className="text-lg font-bold">Product created</h2>
          <p className="mt-1 text-sm text-(--pv-muted)">
            Saved as a <strong>draft</strong>. Nothing is public until you publish it, and you can
            add prices, stock and more pictures on the product itself.
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-3">
          <button type="button" className="button-primary" onClick={startAnother}>
            <Plus size={17} weight="bold" aria-hidden="true" />
            Add another product
          </button>
          <button
            type="button"
            className="button-secondary"
            onClick={() => router.push(`/admin/products/${outcome.productId}/edit`)}
          >
            Open this product
          </button>
          <button
            type="button"
            className="button-ghost"
            onClick={() => router.push("/admin/products")}
          >
            All products
          </button>
        </div>
      </div>
    );
  }

  // The product exists but some images did not make it. Re-submitting would
  // create a second product, so the form is gone and the only way on is the
  // edit screen, where the missing images can be added to the row that exists.
  if (outcome !== null) {
    return (
      <div className="panel-bracket grid gap-4 p-5">
        <h2 className="text-lg font-bold">Product created, but some images did not upload</h2>
        <p className="text-sm text-(--pv-muted)">
          The product was saved as a draft. Nothing is public yet. These did not upload:
        </p>
        <ul className="grid gap-1 text-sm text-(--pv-danger)">
          {outcome.failures.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
        <p className="text-sm text-(--pv-muted)">
          Open the product to add them again, along with prices and stock.
        </p>
        <button
          type="button"
          className="button-primary justify-self-start"
          onClick={() => router.push(`/admin/products/${outcome.productId}/edit`)}
        >
          Open the product
        </button>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      {uploading ? (
        <div className="grid gap-2" aria-live="polite">
          <LoadingLine label="Uploading images" />
          <p className="text-sm text-(--pv-muted)">
            Uploading image {Math.min(uploading.done + 1, uploading.total)} of {uploading.total}…
          </p>
        </div>
      ) : null}

      <ProductForm
        action={createThenUpload}
        brands={brands}
        categories={categories}
        devices={devices}
        collections={collections}
        submitLabel="Create product"
        pickedFiles={files}
        onPickedFilesChange={setFiles}
      />
    </div>
  );
}
