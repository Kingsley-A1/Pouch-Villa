"use server";

import { revalidatePath } from "next/cache";
import {
  beginUpload,
  deleteMedia,
  finaliseUpload,
  reorderMedia,
  type BeganUpload,
} from "@pv/backend/services/media";
import { requirePermission } from "@/server/session";
import { toActionError, type ActionState } from "@/lib/action-state";

const ACCEPTED = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);

export type BeginUploadResult = { ok: true; upload: BeganUpload } | { ok: false; error: string };

export async function beginUploadAction(
  productId: string,
  contentType: string,
): Promise<BeginUploadResult> {
  const principal = await requirePermission("media.manage");
  // The declared type only decides whether to issue a URL at all; what the file
  // actually is gets settled from its bytes when the upload is finalised.
  if (!ACCEPTED.has(contentType)) {
    return { ok: false, error: "Choose a JPEG, PNG, WebP or AVIF image." };
  }
  try {
    return { ok: true, upload: await beginUpload(productId, contentType, principal) };
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
