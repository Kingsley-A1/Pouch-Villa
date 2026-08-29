"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getProductBySlug, makeReference, one, run } from "@pv/backend/db";
import type { ProductVariant } from "@pv/backend/domain/types";

export type PublicFormState = { error?: string } | undefined;

const reservationSchema = z.object({
  product: z.string().min(1),
  model: z.string().min(1, "Confirm your exact phone model."),
  variant: z.string().min(1),
  name: z.string().trim().min(2).max(80),
  contact: z.string().trim().min(5).max(100),
  pickupDate: z.string().min(1),
  notes: z.string().trim().max(500).optional(),
  demoConsent: z.literal("yes"),
});

export async function createReservation(
  _: PublicFormState,
  formData: FormData,
): Promise<PublicFormState> {
  const parsed = reservationSchema.safeParse({
    product: formData.get("product"),
    model: formData.get("model"),
    variant: formData.get("variant"),
    name: formData.get("name"),
    contact: formData.get("contact"),
    pickupDate: formData.get("pickupDate"),
    notes: formData.get("notes"),
    demoConsent: formData.get("demoConsent"),
  });
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message || "Check the form and try again." };
  const product = getProductBySlug(parsed.data.product);
  if (!product) return { error: "This demonstration product is no longer available." };
  if (["out_of_stock", "hidden"].includes(product.availability))
    return {
      error:
        "This product cannot currently be reserved. Register interest or choose another compatible case.",
    };
  const compatible = product.devices?.find((device) => device.slug === parsed.data.model);
  if (!compatible)
    return { error: "The selected phone model is not linked as compatible with this product." };
  let variants: ProductVariant[] = [];
  try {
    variants = JSON.parse(product.variants_json) as ProductVariant[];
  } catch {
    return { error: "Product variants need a staff update before this item can be reserved." };
  }
  const variant = variants.find((item) => item.name === parsed.data.variant);
  if (!variant || ["out_of_stock", "hidden"].includes(variant.availability))
    return { error: "That product variant cannot currently be reserved." };
  const reference = makeReference("R");
  run(
    `INSERT INTO reservations (reference, customer_name, contact, phone_model, product_id, variant, pickup_date, notes, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'new')`,
    reference,
    parsed.data.name,
    parsed.data.contact,
    `${compatible.brand_name} ${compatible.name}`,
    product.id,
    parsed.data.variant,
    parsed.data.pickupDate,
    parsed.data.notes || "",
  );
  redirect(`/reservation/success?reference=${encodeURIComponent(reference)}`);
}

const requestSchema = z.object({
  name: z.string().trim().min(2).max(80),
  contact: z.string().trim().min(5).max(100),
  brand: z.string().trim().min(2).max(50),
  model: z.string().trim().min(2).max(80),
  preferences: z.string().trim().min(5).max(500),
  demoConsent: z.literal("yes"),
});

export async function createCaseRequest(
  _: PublicFormState,
  formData: FormData,
): Promise<PublicFormState> {
  const parsed = requestSchema.safeParse({
    name: formData.get("name"),
    contact: formData.get("contact"),
    brand: formData.get("brand"),
    model: formData.get("model"),
    preferences: formData.get("preferences"),
    demoConsent: formData.get("demoConsent"),
  });
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message || "Check the form and try again." };
  const reference = makeReference("C");
  run(
    "INSERT INTO case_requests (reference, customer_name, contact, brand, model, preferences, status) VALUES (?, ?, ?, ?, ?, ?, 'new')",
    reference,
    parsed.data.name,
    parsed.data.contact,
    parsed.data.brand,
    parsed.data.model,
    parsed.data.preferences,
  );
  redirect(`/request-case?submitted=${encodeURIComponent(reference)}`);
}

export async function registerBackInStockInterest(formData: FormData) {
  const productId = Number(formData.get("productId"));
  const contact = String(formData.get("contact") || "").trim();
  if (!Number.isInteger(productId) || contact.length < 5) return;
  const product = one<{ id: number }>("SELECT id FROM products WHERE id = ?", productId);
  if (!product) return;
  run(
    "INSERT OR IGNORE INTO back_in_stock_interests (product_id, contact) VALUES (?, ?)",
    productId,
    contact,
  );
}
