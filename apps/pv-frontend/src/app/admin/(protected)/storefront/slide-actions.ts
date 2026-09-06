"use server";

import { revalidatePath } from "next/cache";
import { heroSlideSchema } from "@pv/backend/domain/schemas";
import * as slides from "@pv/backend/services/hero-slides";
import {
  beginCatalogueUpload,
  deleteCatalogueImage,
  finaliseCatalogueUpload,
  type BeganCatalogueUpload,
} from "@pv/backend/services/catalogue-media";
import { requirePermission } from "@/server/session";
import { toActionError, type ActionState } from "@/lib/action-state";

const ACCEPTED = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);

/**
 * Both the home page and this admin list are revalidated on every write.
 *
 * The hero is the first thing a shopper sees, so a slide the CEO just changed
 * has to be the slide the next visitor gets — not the one cached from before it.
 */
function revalidate() {
  revalidatePath("/admin/storefront");
  revalidatePath("/");
}

function parse(formData: FormData) {
  return heroSlideSchema.safeParse({
    kicker: formData.get("kicker") || null,
    headline: formData.get("headline"),
    href: formData.get("href"),
    ctaLabel: formData.get("ctaLabel") || null,
    sortOrder: formData.get("sortOrder") || 0,
  });
}

export async function saveSlideAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const principal = await requirePermission("product.manage");
  const parsed = parse(formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form." };

  const id = formData.get("id");
  try {
    if (typeof id === "string" && id) {
      await slides.updateHeroSlide(id, parsed.data, { staffId: principal.staffId });
    } else {
      await slides.createHeroSlide(parsed.data, { staffId: principal.staffId });
    }
  } catch (error) {
    return toActionError(error, "The slide could not be saved.");
  }
  revalidate();
  return { error: null, message: "Slide saved." };
}

export async function setSlideActiveAction(id: string, isActive: boolean) {
  const principal = await requirePermission("product.manage");
  await slides.setHeroSlideActive(id, isActive, { staffId: principal.staffId });
  revalidate();
}

export async function deleteSlideAction(id: string, reason: string): Promise<ActionState> {
  const principal = await requirePermission("product.manage");
  try {
    await slides.softDeleteHeroSlide(id, reason, { staffId: principal.staffId });
  } catch (error) {
    return toActionError(error, "The slide could not be removed.");
  }
  revalidate();
  return { error: null };
}

export async function moveSlideAction(id: string, direction: "up" | "down") {
  const principal = await requirePermission("product.manage");
  await slides.moveHeroSlide(id, direction, { staffId: principal.staffId });
  revalidate();
}

export type BeginSlideUploadResult =
  { ok: true; upload: BeganCatalogueUpload } | { ok: false; error: string };

export async function beginSlideUploadAction(
  slideId: string,
  contentType: string,
  contentLength: number,
): Promise<BeginSlideUploadResult> {
  const principal = await requirePermission("product.manage");
  if (!ACCEPTED.has(contentType)) {
    return { ok: false, error: "Choose a JPEG, PNG, WebP or AVIF image." };
  }
  try {
    return {
      ok: true,
      upload: await beginCatalogueUpload("hero", slideId, contentType, contentLength, {
        staffId: principal.staffId,
      }),
    };
  } catch (error) {
    const state = toActionError(error, "Uploading is not available right now.");
    return { ok: false, error: state.error ?? "Uploading is not available right now." };
  }
}

export async function finaliseSlideUploadAction(uploadId: string): Promise<ActionState> {
  const principal = await requirePermission("product.manage");
  try {
    await finaliseCatalogueUpload(uploadId, { staffId: principal.staffId });
  } catch (error) {
    return toActionError(error, "That image could not be processed.");
  }
  revalidate();
  return { error: null, message: "Image saved." };
}

export async function deleteSlideImageAction(slideId: string): Promise<ActionState> {
  const principal = await requirePermission("product.manage");
  try {
    await deleteCatalogueImage("hero", slideId, { staffId: principal.staffId });
  } catch (error) {
    return toActionError(error, "That image could not be removed.");
  }
  revalidate();
  return { error: null, message: "Image removed." };
}
