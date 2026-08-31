"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { productSchema, variantSchema, stockAdjustmentSchema } from "@pv/backend/domain/schemas";
import { kobo } from "@pv/backend/domain/money";
import * as products from "@pv/backend/services/products";
import { requirePermission } from "@/server/session";
import { toActionError, type ActionState } from "@/lib/action-state";

function parseProductInput(formData: FormData) {
  return productSchema.safeParse({
    name: formData.get("name"),
    slug: formData.get("slug"),
    summary: formData.get("summary") || null,
    description: formData.get("description") || null,
    brandId: formData.get("brandId") || null,
    categoryIds: formData.getAll("categoryIds"),
  });
}

export async function createProductAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const principal = await requirePermission("product.manage");
  const parsed = parseProductInput(formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form." };

  let id: string;
  try {
    id = await products.createProduct(parsed.data, { staffId: principal.staffId });
  } catch (error) {
    return toActionError(error, "The product could not be created.");
  }
  redirect(`/admin/products/${id}/edit`);
}

export async function updateProductAction(
  id: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const principal = await requirePermission("product.manage");
  const parsed = parseProductInput(formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form." };

  try {
    await products.updateProduct(id, parsed.data, { staffId: principal.staffId });
  } catch (error) {
    return toActionError(error, "The product could not be saved.");
  }
  revalidatePath(`/admin/products/${id}/edit`);
  return { error: null, message: "Product saved." };
}

export async function setProductStatusAction(
  id: string,
  status: products.ProductStatus,
): Promise<ActionState> {
  const principal = await requirePermission("product.manage");
  try {
    await products.setProductStatus(id, status, { staffId: principal.staffId });
  } catch (error) {
    return toActionError(error, "The status could not be changed.");
  }
  revalidatePath(`/admin/products/${id}/edit`);
  revalidatePath("/admin/products");
  return { error: null };
}

export async function deleteProductAction(id: string, reason: string) {
  const principal = await requirePermission("product.manage");
  await products.softDeleteProduct(id, reason, { staffId: principal.staffId });
  revalidatePath("/admin/products");
  redirect("/admin/products");
}

function parseVariantInput(formData: FormData) {
  const axes: Record<string, string> = {};
  for (const axis of ["colour", "size", "model"]) {
    const value = formData.get(`axis.${axis}`);
    if (typeof value === "string" && value.trim()) axes[axis] = value.trim();
  }
  return variantSchema.safeParse({
    sku: formData.get("sku"),
    priceKobo: formData.get("priceNaira") ? Number(formData.get("priceNaira")) * 100 : 0,
    compareAtKobo: formData.get("compareAtNaira")
      ? Number(formData.get("compareAtNaira")) * 100
      : null,
    sortOrder: formData.get("sortOrder") || 0,
    axes,
  });
}

export async function saveVariantAction(
  productId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const principal = await requirePermission("product.manage");
  const parsed = parseVariantInput(formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form." };

  const input = {
    ...parsed.data,
    priceKobo: kobo(parsed.data.priceKobo),
    compareAtKobo: parsed.data.compareAtKobo === null ? null : kobo(parsed.data.compareAtKobo),
  };
  const id = formData.get("id");
  try {
    if (typeof id === "string" && id) {
      await products.updateVariant(id, input, { staffId: principal.staffId });
    } else {
      await products.createVariant(productId, input, { staffId: principal.staffId });
    }
  } catch (error) {
    return toActionError(error, "The variant could not be saved.");
  }
  revalidatePath(`/admin/products/${productId}/edit`);
  return { error: null, message: "Variant saved." };
}

export async function setVariantActiveAction(
  productId: string,
  variantId: string,
  isActive: boolean,
) {
  const principal = await requirePermission("product.manage");
  await products.setVariantActive(variantId, isActive, { staffId: principal.staffId });
  revalidatePath(`/admin/products/${productId}/edit`);
}

export async function deleteVariantAction(productId: string, variantId: string) {
  const principal = await requirePermission("product.manage");
  await products.softDeleteVariant(variantId, { staffId: principal.staffId });
  revalidatePath(`/admin/products/${productId}/edit`);
}

export async function adjustStockAction(
  productId: string,
  variantId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const principal = await requirePermission("product.manage");
  const parsed = stockAdjustmentSchema.safeParse({
    delta: formData.get("delta"),
    reason: formData.get("reason"),
    note: formData.get("note") || null,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form." };

  try {
    await products.adjustStock(variantId, parsed.data.delta, parsed.data.reason, parsed.data.note, {
      staffId: principal.staffId,
    });
  } catch (error) {
    return toActionError(error, "The stock entry could not be recorded.");
  }
  revalidatePath(`/admin/products/${productId}/edit`);
  return { error: null, message: "Stock updated." };
}
