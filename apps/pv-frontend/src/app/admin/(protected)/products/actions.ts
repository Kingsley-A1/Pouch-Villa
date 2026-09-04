"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { productSchema, variantSchema, stockAdjustmentSchema } from "@pv/backend/domain/schemas";
import { kobo, parseNairaToKobo } from "@pv/backend/domain/money";
import * as products from "@pv/backend/services/products";
import { setProductCollections } from "@pv/backend/services/home-sections";
import { requirePermission } from "@/server/session";
import { toActionError, type ActionState } from "@/lib/action-state";

function parseProductInput(formData: FormData) {
  return productSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") || null,
    brandId: formData.get("brandId") || null,
    categoryIds: formData.getAll("categoryIds"),
    deviceIds: formData.getAll("deviceIds"),
  });
}

/**
 * Collection membership is stored separately from the product, because it is a
 * merchandising decision rather than a fact about the product — the same product
 * can leave a collection without any edit to what it *is*. Reading the ticked
 * boxes here keeps the product schema about the product.
 *
 * The service ignores ids that are not live collections, so a stale checkbox
 * from a section deleted in another tab cannot resurrect it.
 */
function collectionIdsFrom(formData: FormData): string[] {
  return formData
    .getAll("collectionIds")
    .filter((value): value is string => typeof value === "string");
}

export type CreateProductState = ActionState & { productId?: string };

/**
 * Returns the new id rather than redirecting.
 *
 * The images chosen on the create screen can only be uploaded once the product
 * exists, so the client needs the id to carry on with. Redirecting here would
 * end the request before a single picture had been sent.
 */
export async function createProductAction(
  _prev: ActionState,
  formData: FormData,
): Promise<CreateProductState> {
  const principal = await requirePermission("product.manage");
  const parsed = parseProductInput(formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form." };

  let id: string;
  /**
   * Price and opening stock, taken on the same screen as the product.
   *
   * They used to be two further steps — add a variant, then adjust its stock —
   * and both were easy to miss, which is why every product in the catalogue
   * read "Out of stock" and refused to publish. A shop that sells one version
   * of a thing should be able to say what it costs and how many there are
   * without learning what a variant is.
   *
   * Variants remain for the case they are actually for: the same product sold
   * in several colours or sizes, added afterwards on the edit screen.
   */
  const priceRaw = formData.get("priceNaira");
  const stockRaw = formData.get("openingStock");

  try {
    id = await products.createProduct(parsed.data, { staffId: principal.staffId });
    await setProductCollections(id, collectionIdsFrom(formData), { staffId: principal.staffId });

    if (typeof priceRaw === "string" && priceRaw.trim() !== "") {
      const variantId = await products.createVariant(
        id,
        { priceKobo: parseNairaToKobo(priceRaw), compareAtKobo: null, axes: {} },
        { staffId: principal.staffId },
      );

      // `createVariant` answers null when the product is gone, which cannot
      // happen a line after creating it — but the stock call needs a real id and
      // narrowing is cheaper than explaining a non-null assertion.
      const opening = Number(typeof stockRaw === "string" ? stockRaw.trim() : "");
      if (variantId !== null && Number.isInteger(opening) && opening > 0) {
        await products.adjustStock(
          variantId,
          opening,
          "received",
          "Opening stock, entered when the product was created",
          { staffId: principal.staffId },
        );
      }
    }
  } catch (error) {
    return toActionError(error, "The product could not be created.");
  }
  revalidatePath("/admin/products");
  revalidatePath("/");
  return { error: null, productId: id };
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
    await setProductCollections(id, collectionIdsFrom(formData), { staffId: principal.staffId });
  } catch (error) {
    return toActionError(error, "The product could not be saved.");
  }
  revalidatePath(`/admin/products/${id}/edit`);
  revalidatePath("/");
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
  // Publishing and unpublishing are the two changes a *customer* sees, so the
  // storefront entry points are revalidated too. Without this the admin agreed
  // the product was live while the shop still had the cached page without it.
  revalidatePath("/");
  revalidatePath("/shop");
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
    priceKobo: parseNairaToKobo(String(formData.get("priceNaira") ?? "")),
    compareAtKobo: formData.get("compareAtNaira")
      ? parseNairaToKobo(String(formData.get("compareAtNaira")))
      : null,
    axes,
  });
}

export async function saveVariantAction(
  productId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const principal = await requirePermission("product.manage");
  let parsed: ReturnType<typeof parseVariantInput>;
  try {
    parsed = parseVariantInput(formData);
  } catch {
    return { error: "Enter valid prices using naira and up to two decimal places." };
  }
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
