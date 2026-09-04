"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { AdminBrand } from "@pv/backend/services/brands";
import type { AdminCategory } from "@pv/backend/services/categories";
import type { AdminDevice } from "@pv/backend/services/devices";
import type { ActionState } from "@/lib/action-state";
import { CheckCircle, Plus, Warning } from "@phosphor-icons/react";
import { LoadingLine } from "@/components/loading-line";
import { ProductForm } from "../product-form";
import type { PickedFile } from "../media-picker";
import { setProductStatusAction } from "../actions";
import { uploadProductImage } from "../upload-image";

type CreateResult = ActionState & { productId?: string };

/** What the screen has to report once the whole sequence has run. */
type Outcome = {
  productId: string;
  /** Whether the product actually reached the shop, not whether it was asked to. */
  published: boolean;
  /** Why it did not, when publishing was asked for and refused. */
  publishError: string | null;
  /** One entry per image that did not upload, with the reason. */
  failures: string[];
};

/**
 * Creates the product, uploads the images chosen alongside it, then publishes.
 *
 * The three cannot be one request. An R2 key is scoped by product id, so there
 * is nothing to upload to until the row exists; and publishing has to come last,
 * because a product that reaches the shop before its pictures do is a card with
 * an empty box in it. Rather than exposing that ordering to staff as three
 * screens, it is sequenced here behind one button.
 *
 * If an upload fails the product is *not* rolled back. It exists with fewer
 * pictures than intended, which is recoverable on the edit screen, whereas
 * discarding a product because the fourth photo timed out on mobile data would
 * throw away everything already typed. What matters is that the person is told
 * exactly which files did not make it — and, now, whether the thing is actually
 * in the shop.
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
   * The finished result, set once and only once the whole sequence has run.
   *
   * One piece of state rather than four, because they had an order they had to
   * be written in and no way to express it. In particular the id was set the
   * moment the row existed — before the images were sent and before anything was
   * published — so anything keyed on "was it created" was briefly true while the
   * rest was still going.
   *
   * Until this is set the form is on screen. After it, the form is gone: the
   * product exists, and leaving it submittable would make the obvious next
   * action ("press it again") quietly create a duplicate.
   */
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  async function createUploadPublish(prev: ActionState, formData: FormData): Promise<CreateResult> {
    const wantsPublish = formData.get("publish") === "now";
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
      const uploaded = await uploadProductImage(productId, picked.file);
      if (!uploaded.ok) failed.push(uploaded.error);
      setUploading({ done: index + 1, total: files.length });
    }

    setUploading(null);

    /**
     * Publishing last, and only if it was asked for.
     *
     * `setProductStatusAction` is the same action the edit screen's publish
     * button calls, so there is one publish path with one authorisation check
     * and one audit record, rather than a second one that only creates.
     *
     * It can still refuse — a product with no price has no active variant to
     * sell — and that refusal is carried into the confirmation rather than
     * swallowed. The product goes back to being a draft, which is the state the
     * client kept landing in without ever being told why.
     */
    let published = false;
    let publishError: string | null = null;
    if (wantsPublish) {
      const result = await setProductStatusAction(productId, "published");
      published = result.error === null;
      publishError = result.error;
    }

    setOutcome({ productId, published, publishError, failures: failed });

    if (failed.length > 0) {
      return {
        error: `The product was created, but ${failed.length} image${
          failed.length === 1 ? "" : "s"
        } did not upload. Add ${failed.length === 1 ? "it" : "them"} again on the edit screen.`,
      };
    }
    return { error: null, message: published ? "Product published." : "Product saved as a draft." };
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

  if (outcome !== null) {
    return (
      <Confirmation
        outcome={outcome}
        onAddAnother={startAnother}
        onOpenProduct={() => router.push(`/admin/products/${outcome.productId}/edit`)}
        onAllProducts={() => router.push("/admin/products")}
      />
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
        action={createUploadPublish}
        brands={brands}
        categories={categories}
        devices={devices}
        collections={collections}
        pickedFiles={files}
        onPickedFilesChange={setFiles}
      />
    </div>
  );
}

/**
 * The one screen that answers "is it in the shop?".
 *
 * It replaces the form rather than sitting above it, because the form has done
 * its job and re-submitting would create a second product. Three outcomes are
 * possible and each is stated in the heading, not buried in a paragraph: live,
 * saved as a draft, or live-but-missing-pictures. The old version said "Saved as
 * a draft" in every case, including the cases it was wrong about.
 */
function Confirmation({
  outcome,
  onAddAnother,
  onOpenProduct,
  onAllProducts,
}: {
  outcome: Outcome;
  onAddAnother: () => void;
  onOpenProduct: () => void;
  onAllProducts: () => void;
}) {
  const clean = outcome.failures.length === 0;
  const heading = outcome.published
    ? clean
      ? "Published — it is in the shop"
      : "Published, but some pictures did not upload"
    : clean
      ? "Saved as a draft"
      : "Saved as a draft, and some pictures did not upload";

  return (
    <div className="panel-bracket grid gap-4 p-5">
      <span className="justify-self-center">
        {outcome.published && clean ? (
          <CheckCircle size={44} weight="fill" aria-hidden="true" className="text-(--pv-success)" />
        ) : (
          <Warning size={44} weight="fill" aria-hidden="true" className="text-(--pv-warning)" />
        )}
      </span>

      {/* `role="status"` so the outcome is announced, not just drawn. */}
      <div role="status" className="grid gap-2 text-center">
        <h2 className="text-lg font-bold">{heading}</h2>
        <p className="text-sm text-(--pv-muted)">
          {outcome.published
            ? "Customers can see and buy it now."
            : outcome.publishError === null
              ? "Only staff can see it. Publish it from the product when you are ready."
              : outcome.publishError}
        </p>
      </div>

      {outcome.failures.length > 0 ? (
        <div className="grid gap-1">
          <p className="text-sm font-bold">These pictures did not upload:</p>
          <ul className="grid gap-1 text-sm text-(--pv-danger)">
            {outcome.failures.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
          <p className="text-sm text-(--pv-muted)">Open the product to add them again.</p>
        </div>
      ) : null}

      <div className="flex flex-wrap justify-center gap-3">
        <button type="button" className="button-primary" onClick={onAddAnother}>
          <Plus size={17} weight="bold" aria-hidden="true" />
          Add another product
        </button>
        <button type="button" className="button-secondary" onClick={onOpenProduct}>
          Open this product
        </button>
        <button type="button" className="button-ghost" onClick={onAllProducts}>
          All products
        </button>
      </div>
    </div>
  );
}
