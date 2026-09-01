import { z } from "zod";
import { MINIMUM_PASSWORD_LENGTH } from "../auth/password";
import { STAFF_ROLES } from "../auth/role-codes";
import { normalisePhone } from "./phone";

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

export const deviceSchema = z.object({
  brandId: z.string().uuid(),
  name: z.string().trim().min(1).max(120),
  slug,
  releasedYear: z.coerce.number().int().min(1990).max(2100).nullable(),
  sortOrder: z.coerce.number().int().min(0).max(9999).default(0),
});

/**
 * No `slug` and no `summary`.
 *
 * The slug is derived from the name in the service layer — staff should not have
 * to know what one is, and a hand-typed slug is a standing source of broken URLs.
 * Summary was collapsed into `description`: two overlapping prose fields made
 * every product entry a decision about which to fill in, and the card never
 * rendered summary anyway.
 */
export const productSchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(5000).nullable(),
  brandId: z.string().uuid().nullable(),
  categoryIds: z.array(z.string().uuid()).default([]),
  deviceIds: z.array(z.string().uuid()).default([]),
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
  "policy.returns": z.string().trim().max(20_000),
  "policy.privacy": z.string().trim().max(20_000),
  "policy.terms": z.string().trim().max(20_000),
});

// ---------------------------------------------------------------------------
// Commerce boundaries — Phase 3.
//
// One schema per boundary, shared between the `app/api/v1` route handler and the
// Server Action that adapts a form onto the same service (ADR 0003).
// ---------------------------------------------------------------------------

/**
 * Accepts every shape a Nigerian mobile number is actually typed in and stores
 * the canonical one. The transform is part of the schema rather than the service
 * because ADR 0002 makes this number security-bearing for order tracking, and a
 * number that reaches storage un-normalised is a customer locked out of their
 * own order.
 */
export const phoneSchema = z
  .string()
  .trim()
  .min(1, "Required")
  .transform((value, ctx) => {
    const normalised = normalisePhone(value);
    if (normalised === null) {
      ctx.addIssue({ code: "custom", message: "Enter a Nigerian mobile number" });
      return z.NEVER;
    }
    return normalised;
  });

export const customerSignUpSchema = z.object({
  email: z.string().trim().email().max(320),
  password: passwordSchema,
  fullName: z.string().trim().min(1).max(200).nullable().default(null),
  phone: phoneSchema.nullable().default(null),
});

export const customerLoginSchema = z.object({
  email: z.string().trim().email().max(320),
  password: z.string().min(1, "Required"),
});

export const passwordResetRequestSchema = z.object({
  email: z.string().trim().email().max(320),
});

export const passwordResetCompleteSchema = z.object({
  email: z.string().trim().email().max(320),
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Enter the 6-digit code"),
  password: passwordSchema,
});

export const cartItemSchema = z.object({
  variantId: z.string().uuid(),
  quantity: z.coerce.number().int().min(1).max(99).default(1),
});

export const cartQuantitySchema = z.object({
  variantId: z.string().uuid(),
  quantity: z.coerce.number().int().min(0).max(99),
});

export const FULFILMENTS = ["delivery", "pickup"] as const;

/**
 * Checkout. The delivery branch is validated as a whole rather than field by
 * field: a delivery order without an address is the failure that produces an
 * order nobody can deliver, and it must be impossible at the boundary.
 */
export const checkoutSchema = z
  .object({
    contactName: z.string().trim().min(1, "Required").max(200),
    contactEmail: z.string().trim().email().max(320),
    contactPhone: phoneSchema,
    fulfilment: z.enum(FULFILMENTS),
    deliveryZoneId: z.string().uuid().nullable().default(null),
    deliveryLga: z.string().trim().max(120).nullable().default(null),
    deliveryAddress: z.string().trim().max(500).nullable().default(null),
    deliveryLandmark: z.string().trim().max(200).nullable().default(null),
    customerNote: z.string().trim().max(1000).nullable().default(null),
    // ADR 0002: ticked by default, and a real choice.
    createAccount: z.coerce.boolean().default(true),
  })
  .refine((value) => value.fulfilment !== "delivery" || Boolean(value.deliveryAddress?.trim()), {
    message: "Enter the delivery address",
    path: ["deliveryAddress"],
  })
  .refine((value) => value.fulfilment !== "delivery" || value.deliveryZoneId !== null, {
    message: "Choose a delivery area",
    path: ["deliveryZoneId"],
  });

export const orderTrackingSchema = z.object({
  reference: z.string().trim().min(1, "Enter your order reference").max(40),
  phone: phoneSchema,
});

export const proofUploadStartSchema = z.object({
  orderId: z.string().uuid(),
  contentType: z.enum(["image/jpeg", "image/png", "image/webp", "application/pdf"]),
});

export const proofUploadFinaliseSchema = z.object({
  uploadId: z.string().uuid(),
});

export const proofDecisionSchema = z.object({
  proofId: z.string().uuid(),
  note: z.string().trim().max(500).nullable().default(null),
});

export const proofRejectionSchema = z.object({
  proofId: z.string().uuid(),
  reason: z.string().trim().min(1, "Say why, so the customer can fix it").max(500),
});

/**
 * Reviews. No account field and no sign-in requirement — per Q9 and ADR 0005,
 * anyone may review and everything is held for approval.
 */
export const reviewSubmissionSchema = z.object({
  productId: z.string().uuid(),
  authorName: z.string().trim().min(1, "Required").max(120),
  authorEmail: z.string().trim().email().max(320).nullable().default(null),
  rating: z.coerce.number().int().min(1, "Choose a rating").max(5),
  title: z.string().trim().max(160).nullable().default(null),
  body: z.string().trim().min(1, "Tell us what you thought").max(4000),
});

export const reviewModerationSchema = z.object({
  reviewId: z.string().uuid(),
  reason: z.string().trim().max(500).nullable().default(null),
});

export const contactRequestSchema = z
  .object({
    name: z.string().trim().min(1, "Required").max(200),
    email: z.string().trim().email().max(320).or(z.literal("")).nullable().default(null),
    phone: z.string().trim().max(40).or(z.literal("")).nullable().default(null),
    subject: z.string().trim().max(200).nullable().default(null),
    message: z.string().trim().min(1, "Tell us how we can help").max(4000),
    orderReference: z.string().trim().max(40).nullable().default(null),
  })
  .refine((value) => Boolean(value.email?.trim()) || Boolean(value.phone?.trim()), {
    message: "Leave an email address or a phone number so we can reply",
    path: ["email"],
  });

export const orderStatusChangeSchema = z.object({
  orderId: z.string().uuid(),
  status: z.enum([
    "awaiting_payment",
    "proof_submitted",
    "payment_confirmed",
    "preparing",
    "ready_for_pickup",
    "dispatched",
    "completed",
    "cancelled",
  ]),
  reason: z.string().trim().max(500).nullable().default(null),
});

export const contactStatusSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["new", "in_progress", "closed"]),
  note: z.string().trim().max(1000).nullable().default(null),
});
