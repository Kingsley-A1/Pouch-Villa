"use server";

import { revalidatePath } from "next/cache";
import { homeSectionSchema } from "@pv/backend/domain/schemas";
import * as sections from "@pv/backend/services/home-sections";
import { requirePermission } from "@/server/session";
import { toActionError, type ActionState } from "@/lib/action-state";

/**
 * Gated by `product.manage` rather than a new permission of its own.
 *
 * Arranging the home page is a merchandising decision about products, made by
 * the same people who publish them. A new permission code would mean a migration
 * to the catalogue and a grant the CEO has to remember to hand out before anyone
 * can use the screen — cost with no separation gained, since anyone who can
 * unpublish a product can already decide what the shop shows.
 */
const PERMISSION = "product.manage" as const;

/** Both storefront reads live on the home page, so both are revalidated. */
function revalidateStorefront() {
  revalidatePath("/admin/storefront");
  revalidatePath("/");
}

export async function saveSectionAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const principal = await requirePermission(PERMISSION);

  const parsed = homeSectionSchema.safeParse({
    kind: formData.get("kind"),
    layout: formData.get("layout") ?? "grid",
    title: formData.get("title"),
    subtitle: formData.get("subtitle") || null,
    categoryId: formData.get("categoryId") || null,
    brandId: formData.get("brandId") || null,
    maxItems: formData.get("maxItems") || 8,
    sortOrder: formData.get("sortOrder") || 0,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form." };

  const id = formData.get("id");
  try {
    if (typeof id === "string" && id) {
      await sections.updateHomeSection(id, parsed.data, { staffId: principal.staffId });
    } else {
      await sections.createHomeSection(parsed.data, { staffId: principal.staffId });
    }
  } catch (error) {
    return toActionError(error, "The section could not be saved.");
  }
  revalidateStorefront();
  return { error: null, message: "Section saved." };
}

export async function setSectionActiveAction(id: string, isActive: boolean) {
  const principal = await requirePermission(PERMISSION);
  await sections.setHomeSectionActive(id, isActive, { staffId: principal.staffId });
  revalidateStorefront();
}

export async function moveSectionAction(id: string, direction: "up" | "down") {
  const principal = await requirePermission(PERMISSION);
  await sections.moveHomeSection(id, direction, { staffId: principal.staffId });
  revalidateStorefront();
}

export async function deleteSectionAction(id: string, reason: string): Promise<ActionState> {
  const principal = await requirePermission(PERMISSION);
  try {
    await sections.softDeleteHomeSection(id, reason, { staffId: principal.staffId });
  } catch (error) {
    return toActionError(error, "The section could not be removed.");
  }
  revalidateStorefront();
  return { error: null };
}
