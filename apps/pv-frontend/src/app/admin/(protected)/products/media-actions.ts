"use server";

import { revalidatePath } from "next/cache";
import {
  beginUpload,
  deleteMedia,
  finaliseUpload,
  reorderMedia,
  updateMediaAlt,
  type BeganUpload,
} from "@pv/backend/services/media";
import { requirePermission } from "@/server/session";
import { toActionError, type ActionState } from "@/lib/action-state";

const ACCEPTED = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);

export type BeginUploadResult = { ok: true; upload: BeganUpload } | { ok: false; error: string };

export async function beginUploadAction(
  productId: string,
  contentType: string,
  contentLength: number,
): Promise<BeginUploadResult> {
  const principal = await requirePermission("media.manage");
  // The declared type only decides whether to issue a URL at all; what the file
  // actually is gets settled from its bytes when the upload is finalised. The
  // size is different: it is signed into the URL, so a browser that sends a
  // different number of bytes fails at R2 rather than here.
  if (!ACCEPTED.has(contentType)) {
    return { ok: false, error: "Choose a JPEG, PNG, WebP or AVIF image." };
  }
  try {
    return {
      ok: true,
      upload: await beginUpload(productId, contentType, contentLength, principal),
    };
  } catch (error) {
    const state = toActionError(error, "Uploading is not available right now.");
    return { ok: false, error: state.error ?? "Uploading is not available right now." };
  }
}

export async function finaliseUploadAction(
  productId: string,
  uploadId: string,
  alt: string | null,
): Promise<ActionState> {
  const principal = await requirePermission("media.manage");
  try {
    await finaliseUpload(uploadId, alt, principal);
  } catch (error) {
    return toActionError(error, "That image could not be processed.");
  }
  revalidatePath(`/admin/products/${productId}/edit`);
  return { error: null, message: "Image added." };
}

/**
 * Swaps a freshly uploaded image into an existing one's place, keeping its
 * position in the gallery.
 *
 * A separate action rather than "delete then add" from the browser: two calls
 * from a phone on a dropping connection can land half-done, and the half that
 * lands first is the delete. The service does both in one transaction.
 */
export async function replaceMediaAction(
  productId: string,
  mediaId: string,
  uploadId: string,
  alt: string | null,
): Promise<ActionState> {
  const principal = await requirePermission("media.manage");
  try {
    await finaliseUpload(uploadId, alt, principal, { replacesMediaId: mediaId });
  } catch (error) {
    return toActionError(error, "That image could not be replaced.");
  }
  revalidatePath(`/admin/products/${productId}/edit`);
  return { error: null, message: "Image replaced." };
}

export async function deleteMediaAction(productId: string, mediaId: string): Promise<ActionState> {
  const principal = await requirePermission("media.manage");
  try {
    await deleteMedia(mediaId, principal);
  } catch (error) {
    return toActionError(error, "That image could not be removed.");
  }
  revalidatePath(`/admin/products/${productId}/edit`);
  return { error: null };
}

export async function updateMediaAltAction(
  productId: string,
  mediaId: string,
  alt: string,
): Promise<ActionState> {
  const principal = await requirePermission("media.manage");
  try {
    await updateMediaAlt(mediaId, alt, principal);
  } catch (error) {
    return toActionError(error, "That description could not be saved.");
  }
  revalidatePath(`/admin/products/${productId}/edit`);
  return { error: null, message: "Description saved." };
}

export async function reorderMediaAction(
  productId: string,
  orderedIds: string[],
): Promise<ActionState> {
  const principal = await requirePermission("media.manage");
  try {
    await reorderMedia(productId, orderedIds, principal);
  } catch (error) {
    return toActionError(error, "The order could not be saved.");
  }
  revalidatePath(`/admin/products/${productId}/edit`);
  return { error: null };
}
