"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { AdminBrand } from "@pv/backend/services/brands";
import type { AdminCategory } from "@pv/backend/services/categories";
import type { AdminDevice } from "@pv/backend/services/devices";
import type { ActionState } from "@/lib/action-state";
import { LoadingLine } from "@/components/loading-line";
import { ProductForm } from "../product-form";
import type { PickedFile } from "../media-picker";
import { beginUploadAction, finaliseUploadAction } from "../media-actions";

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
  const [failures, setFailures] = useState<string[]>([]);
  /**
   * Set the moment the row exists, and never cleared.
   *
   * If images fail we stay on this screen to say so — but the product has
   * already been created, and leaving the form submittable would make the
   * obvious next action ("press it again") silently create a duplicate. Once
   * this is set the form is replaced by the outcome.
   */
  const [createdId, setCreatedId] = useState<string | null>(null);

  async function createThenUpload(prev: ActionState, formData: FormData): Promise<CreateResult> {
    const created = await action(prev, formData);
    if (created.productId === undefined) return created;

    const productId = created.productId;
    setCreatedId(productId);
    const failed: string[] = [];
    setFailures([]);
    setUploading({ done: 0, total: files.length });

    // Sequential, not parallel: five concurrent multi-megabyte PUTs on a mobile
    // connection contend with each other and are more likely to time out than
    // the same five sent one after another.
    for (const [index, picked] of files.entries()) {
      try {
        const began = await beginUploadAction(productId, picked.file.type);
        if (!began.ok) {
          failed.push(picked.file.name);
          continue;
        }
        const put = await fetch(began.upload.url, {
          method: "PUT",
          body: picked.file,
          headers: { "Content-Type": picked.file.type },
        });
        if (!put.ok) {
          failed.push(picked.file.name);
          continue;
        }
        const finalised = await finaliseUploadAction(
          productId,
          began.upload.uploadId,
          picked.file.name,
        );
        if (finalised.error !== null) failed.push(picked.file.name);
      } catch {
        failed.push(picked.file.name);
      }
      setUploading({ done: index + 1, total: files.length });
    }

    setUploading(null);

    if (failed.length > 0) {
      setFailures(failed);
      return {
        error: `The product was created, but ${failed.length} image${
          failed.length === 1 ? "" : "s"
        } did not upload. Add ${failed.length === 1 ? "it" : "them"} again below.`,
      };
    }

    router.push(`/admin/products/${productId}/edit`);
    return { error: null, message: "Product created." };
  }

  // The product exists but some images did not make it. Re-submitting would
  // create a second product, so the form is gone and the only way on is the
  // edit screen, where the missing images can be added to the row that exists.
  if (createdId !== null && failures.length > 0) {
    return (
      <div className="panel-bracket grid gap-4 p-5">
        <h2 className="text-lg font-bold">Product created, but some images did not upload</h2>
        <p className="text-sm text-(--pv-muted)">
          The product was saved as a draft. Nothing is public yet. These files did not upload:
        </p>
        <ul className="grid gap-1 text-sm text-(--pv-danger)">
          {failures.map((name) => (
            <li key={name}>{name}</li>
          ))}
        </ul>
        <p className="text-sm text-(--pv-muted)">
          Open the product to add them again, along with prices and stock.
        </p>
        <button
          type="button"
          className="button-primary justify-self-start"
          onClick={() => router.push(`/admin/products/${createdId}/edit`)}
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
