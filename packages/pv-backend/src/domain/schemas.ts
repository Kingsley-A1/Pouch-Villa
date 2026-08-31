import { z } from "zod";
import { MINIMUM_PASSWORD_LENGTH } from "../auth/password";
import { STAFF_ROLES } from "../auth/role-codes";

/**
 * Validation schemas shared between a form (a Server Action) and, eventually, the
 * matching `app/api/v1/*` route — one schema per boundary, per AGENTS.md §3.
 */

const slug = z
  .string()
  .trim()
  .min(1, "Required")
  .max(160)
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Use lowercase letters, numbers and hyphens only");

const koboAmount = z.coerce.number().int().min(0).max(1_000_000_000);

export const passwordSchema = z
  .string()
  .min(MINIMUM_PASSWORD_LENGTH, `At least ${MINIMUM_PASSWORD_LENGTH} characters`);

export const roleCodeMintSchema = z.object({
  role: z.enum(STAFF_ROLES),
  label: z.string().trim().max(200).optional(),
  maxUses: z.coerce.number().int().min(1).max(1000).default(1),
  ttlMinutes: z.coerce
    .number()
    .int()
    .min(1)
    .max(60 * 24 * 30)
    .default(60 * 24 * 7),
});

export const claimRoleCodeSchema = z.object({
  code: z.string().trim().min(4).max(32),
  email: z.string().trim().email().max(320),
  fullName: z.string().trim().min(1).max(200),
  password: passwordSchema,
});

export const staffLoginSchema = z.object({
  email: z.string().trim().email().max(320),
  password: z.string().min(1, "Required"),
});

export const emailCodeSchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Enter the 6-digit code"),
});

export const categorySchema = z.object({
  parentId: z.string().uuid().nullable(),
  name: z.string().trim().min(1).max(120),
  slug,
  description: z.string().trim().max(2000).nullable(),
  sortOrder: z.coerce.number().int().min(0).max(9999).default(0),
});

export const brandSchema = z.object({
  name: z.string().trim().min(1).max(120),
  slug,
  sortOrder: z.coerce.number().int().min(0).max(9999).default(0),
});

export const deliveryZoneSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    lga: z.string().trim().max(120).nullable(),
    feeKobo: koboAmount,
    minDays: z.coerce.number().int().min(0).max(90).nullable(),
    maxDays: z.coerce.number().int().min(0).max(90).nullable(),
    sortOrder: z.coerce.number().int().min(0).max(9999).default(0),
  })
  .refine(
    (value) => value.minDays === null || value.maxDays === null || value.maxDays >= value.minDays,
    {
      message: "Maximum days cannot be less than minimum days",
      path: ["maxDays"],
    },
  );

export const productSchema = z.object({
  name: z.string().trim().min(1).max(200),
  slug,
  summary: z.string().trim().max(500).nullable(),
  description: z.string().trim().max(5000).nullable(),
  brandId: z.string().uuid().nullable(),
  categoryIds: z.array(z.string().uuid()).default([]),
});

/** Not exhaustive — a variant may set any subset of the known axes, or none. */
export const VARIANT_AXES = ["colour", "size", "model"] as const;

export const variantSchema = z.object({
  sku: z
    .string()
    .trim()
    .min(1)
    .max(64)
    .regex(/^[A-Z0-9-]+$/, "Uppercase letters, numbers and hyphens only"),
  priceKobo: koboAmount,
  compareAtKobo: koboAmount.nullable(),
  sortOrder: z.coerce.number().int().min(0).max(9999).default(0),
  axes: z
    .record(z.string(), z.string().trim().max(80))
    .refine(
      (value) =>
        Object.keys(value).every((key) => (VARIANT_AXES as readonly string[]).includes(key)),
      "Unknown variant axis",
    )
    .default({}),
});

export const stockAdjustmentSchema = z.object({
  delta: z.coerce
    .number()
    .int()
    .refine((value) => value !== 0, "Must not be zero"),
  reason: z.enum(["received", "sold", "returned", "adjustment", "damaged", "reserved", "released"]),
  note: z.string().trim().max(500).nullable(),
});

export const settingsFormSchema = z.object({
  "bank.account_name": z.string().trim().max(200),
  "bank.account_number": z.string().trim().max(20),
  "bank.bank_name": z.string().trim().max(120),
});

export const storeSettingsFormSchema = z.object({
  "store.address": z.string().trim().max(500),
  "store.opening_hours": z.string().trim().max(500),
  "store.whatsapp_number": z.string().trim().max(20),
  "store.contact_email": z.string().trim().email().max(320).or(z.literal("")),
});

export const policySettingsFormSchema = z.object({
  "policy.about": z.string().trim().max(20_000),
  "policy.privacy": z.string().trim().max(20_000),
  "policy.terms": z.string().trim().max(20_000),
});
