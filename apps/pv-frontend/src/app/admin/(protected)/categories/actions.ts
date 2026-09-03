"use server";

import { revalidatePath } from "next/cache";
import { categorySchema, brandSchema } from "@pv/backend/domain/schemas";
import * as categories from "@pv/backend/services/categories";
import * as brands from "@pv/backend/services/brands";
import { requirePermission } from "@/server/session";
import { toActionError, type ActionState } from "@/lib/action-state";

function parseCategoryInput(formData: FormData) {
  return categorySchema.safeParse({
    parentId: formData.get("parentId") || null,
    name: formData.get("name"),
    description: formData.get("description") || null,
    sortOrder: formData.get("sortOrder") || 0,
  });
}

export async function saveCategoryAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const principal = await requirePermission("category.manage");
  const parsed = parseCategoryInput(formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form." };

  const id = formData.get("id");
  try {
    if (typeof id === "string" && id) {
      await categories.updateCategory(id, parsed.data, { staffId: principal.staffId });
    } else {
      await categories.createCategory(parsed.data, { staffId: principal.staffId });
    }
  } catch (error) {
    return toActionError(error, "The category could not be saved.");
  }
  revalidatePath("/admin/categories");
  return { error: null, message: "Category saved." };
}

export async function setCategoryActiveAction(id: string, isActive: boolean) {
  const principal = await requirePermission("category.manage");
  await categories.setCategoryActive(id, isActive, { staffId: principal.staffId });
  revalidatePath("/admin/categories");
}

export async function deleteCategoryAction(id: string, reason: string): Promise<ActionState> {
  const principal = await requirePermission("category.manage");
  try {
    await categories.softDeleteCategory(id, reason, { staffId: principal.staffId });
  } catch (error) {
    return toActionError(error, "The category could not be removed.");
  }
  revalidatePath("/admin/categories");
  return { error: null };
}

function parseBrandInput(formData: FormData) {
  return brandSchema.safeParse({
    name: formData.get("name"),
    sortOrder: formData.get("sortOrder") || 0,
  });
}

export async function saveBrandAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const principal = await requirePermission("category.manage");
  const parsed = parseBrandInput(formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form." };

  const id = formData.get("id");
  try {
    if (typeof id === "string" && id) {
      await brands.updateBrand(id, parsed.data, { staffId: principal.staffId });
    } else {
      await brands.createBrand(parsed.data, { staffId: principal.staffId });
    }
  } catch (error) {
    return toActionError(error, "The brand could not be saved.");
  }
  revalidatePath("/admin/categories");
  return { error: null, message: "Brand saved." };
}

export async function setBrandActiveAction(id: string, isActive: boolean) {
  const principal = await requirePermission("category.manage");
  await brands.setBrandActive(id, isActive, { staffId: principal.staffId });
  revalidatePath("/admin/categories");
}

export async function deleteBrandAction(id: string, reason: string): Promise<ActionState> {
  const principal = await requirePermission("category.manage");
  try {
    await brands.softDeleteBrand(id, reason, { staffId: principal.staffId });
  } catch (error) {
    return toActionError(error, "The brand could not be removed.");
  }
  revalidatePath("/admin/categories");
  return { error: null };
}
