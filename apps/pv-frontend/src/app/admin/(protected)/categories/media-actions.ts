"use server";

import { revalidatePath } from "next/cache";
import {
  beginCatalogueUpload,
  deleteCatalogueImage,
  finaliseCatalogueUpload,
  type BeganCatalogueUpload,
} from "@pv/backend/services/catalogue-media";
import type { CatalogueMediaOwner } from "@pv/backend/storage/media-key";
import { requirePermission } from "@/server/session";
import { toActionError, type ActionState } from "@/lib/action-state";

const ACCEPTED = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);

export type BeginCatalogueUploadResult =
  { ok: true; upload: BeganCatalogueUpload } | { ok: false; error: string };

/**
 * The three steps of putting a photograph on a category or a logo on a brand,
 * behind the same permission that lets someone edit the row itself.
 *
 * `media.manage` gates product images; this is `category.manage`, because the
 * picture is part of the category rather than part of the media library — and
 * someone allowed to rename a category but not to change its photograph would
 * be a distinction with nothing behind it.
 */
export async function beginCatalogueUploadAction(
  owner: CatalogueMediaOwner,
  ownerId: string,
  contentType: string,
  contentLength: number,
): Promise<BeginCatalogueUploadResult> {
  const principal = await requirePermission("category.manage");
  // The declared type only decides whether a URL is issued at all. What the file
  // actually is gets settled from its bytes when the upload is finalised.
  if (!ACCEPTED.has(contentType)) {
    return { ok: false, error: "Choose a JPEG, PNG, WebP or AVIF image." };
  }
  try {
    return {
      ok: true,
      upload: await beginCatalogueUpload(owner, ownerId, contentType, contentLength, {
        staffId: principal.staffId,
      }),
    };
  } catch (error) {
    const state = toActionError(error, "Uploading is not available right now.");
    return { ok: false, error: state.error ?? "Uploading is not available right now." };
  }
}

export async function finaliseCatalogueUploadAction(uploadId: string): Promise<ActionState> {
  const principal = await requirePermission("category.manage");
  try {
    await finaliseCatalogueUpload(uploadId, { staffId: principal.staffId });
  } catch (error) {
    return toActionError(error, "That image could not be processed.");
  }
  revalidatePath("/admin/categories");
  // The storefront reads these on every browse step, so a photograph the CEO
  // just set has to appear without waiting for a deployment or a cache expiry.
  revalidatePath("/", "layout");
  return { error: null, message: "Image saved." };
}

export async function deleteCatalogueImageAction(
  owner: CatalogueMediaOwner,
  ownerId: string,
): Promise<ActionState> {
  const principal = await requirePermission("category.manage");
  try {
    await deleteCatalogueImage(owner, ownerId, { staffId: principal.staffId });
  } catch (error) {
    return toActionError(error, "That image could not be removed.");
  }
  revalidatePath("/admin/categories");
  revalidatePath("/", "layout");
  return { error: null, message: "Image removed." };
}
