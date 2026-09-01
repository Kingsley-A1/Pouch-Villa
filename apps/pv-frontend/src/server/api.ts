import { headers } from "next/headers";
import { randomUUID } from "node:crypto";
import type { z } from "zod";

/**
 * The shape of every `app/api/v1` response, per ADR 0003.
 *
 * Success and failure are a discriminated union so a consumer branches on one
 * field rather than inferring from the status code, and `code` is drawn from a
 * closed set so a client can react to a specific failure without string-matching
 * a human-readable message.
 *
 * The message is for a person. The code is for a program. They are never the
 * same field.
 */

export type ApiError = {
  code: ApiErrorCode;
  message: string;
  /** Field-level validation problems, keyed by path. */
  details?: Record<string, string[]>;
};

export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: ApiError };

export const API_ERROR_CODES = [
  "validation_failed",
  "unauthenticated",
  "forbidden",
  "not_found",
  "conflict",
  "rate_limited",
  "unavailable",
  "internal",
] as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

const STATUS_BY_CODE: Readonly<Record<ApiErrorCode, number>> = {
  validation_failed: 422,
  unauthenticated: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  rate_limited: 429,
  unavailable: 503,
  internal: 500,
};

export function ok<T>(data: T, init: ResponseInit = {}): Response {
  return Response.json({ ok: true, data } satisfies ApiResult<T>, {
    status: 200,
    ...init,
  });
}

export function created<T>(data: T, init: ResponseInit = {}): Response {
  return ok(data, { status: 201, ...init });
}

export function fail(
  code: ApiErrorCode,
  message: string,
  details?: Record<string, string[]>,
): Response {
  const error: ApiError = details === undefined ? { code, message } : { code, message, details };
  return Response.json({ ok: false, error } satisfies ApiResult<never>, {
    status: STATUS_BY_CODE[code],
  });
}

/**
 * Maps a caught error to a response a client may see.
 *
 * Every domain error in `@pv/backend` gives itself a specific `.name`; a raw
 * driver, network or programming failure keeps a generic one. Only the former's
 * message is ever returned — the same reasoning as `toActionError`, applied at
 * the HTTP boundary, because §3 forbids leaking a driver error to a client.
 *
 * An error whose name is not in this table but *is* specific still gets its
 * message, because it was written to be read; it just gets a generic code.
 */
const CODE_BY_ERROR_NAME: Readonly<Record<string, ApiErrorCode>> = {
  // Validation and input
  InvalidPhoneNumberError: "validation_failed",
  InvalidRatingError: "validation_failed",
  PasswordTooShortError: "validation_failed",
  BreachedPasswordError: "validation_failed",
  UnreachableEnquiryError: "validation_failed",
  DeliveryDetailsRequiredError: "validation_failed",
  CartLineLimitError: "validation_failed",
  UnsupportedProofError: "validation_failed",
  ProofTooLargeError: "validation_failed",
  InvalidMoneyError: "validation_failed",

  // Identity
  InvalidCustomerCredentialsError: "unauthenticated",
  InvalidResetCodeError: "unauthenticated",
  CustomerSuspendedError: "forbidden",

  // Absence
  OrderNotFoundError: "not_found",
  ProofNotFoundError: "not_found",
  ProofUploadNotFoundError: "not_found",
  ReviewNotFoundError: "not_found",
  EnquiryNotFoundError: "not_found",
  VariantUnavailableError: "not_found",
  ProductNotReviewableError: "not_found",

  // State
  EmailAlreadyRegisteredError: "conflict",
  IdempotencyConflictError: "conflict",
  IllegalTransitionError: "conflict",
  InsufficientStockError: "conflict",
  CartEmptyError: "conflict",
  OrderNotAwaitingPaymentError: "conflict",

  RateLimitedError: "rate_limited",

  // Configuration — the service is not set up, which is not the caller's fault
  // and must not read as a validation error they can fix.
  StorageNotConfiguredError: "unavailable",
  EmailNotConfiguredError: "unavailable",
  GoogleNotConfiguredError: "unavailable",
  DatabaseNotConfiguredError: "unavailable",
};

const GENERIC_ERROR_NAMES = new Set([
  "Error",
  "TypeError",
  "RangeError",
  "SyntaxError",
  "DatabaseError",
  "AggregateError",
]);

export function toApiError(error: unknown): Response {
  if (error instanceof Error && !GENERIC_ERROR_NAMES.has(error.name)) {
    const code = CODE_BY_ERROR_NAME[error.name] ?? "conflict";
    return fail(code, error.message);
  }
  // Logged server-side with no request body attached, so a payment proof key or
  // a password can never arrive here by accident.
  console.error("Unhandled API error", {
    name: error instanceof Error ? error.name : typeof error,
  });
  return fail("internal", "Something went wrong. Please try again.");
}

/**
 * Validates a JSON body against a schema, returning either the parsed value or
 * a 422 carrying field-level messages the form can render directly.
 */
export async function parseJson<Schema extends z.ZodType>(
  request: Request,
  schema: Schema,
): Promise<{ ok: true; data: z.output<Schema> } | { ok: false; response: Response }> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return { ok: false, response: fail("validation_failed", "Expected a JSON body.") };
  }

  const result = schema.safeParse(raw);
  if (!result.success) {
    const details: Record<string, string[]> = {};
    for (const issue of result.error.issues) {
      const path = issue.path.join(".") || "_";
      (details[path] ??= []).push(issue.message);
    }
    return {
      ok: false,
      response: fail("validation_failed", "Check the highlighted fields.", details),
    };
  }
  return { ok: true, data: result.data };
}

export type RequestContext = {
  ip?: string | undefined;
  userAgent?: string | undefined;
  requestId: string;
};

/**
 * The request identity every audit record carries. The request id comes from the
 * edge where one exists, so a log line and an audit row can be joined.
 */
export async function requestContext(): Promise<RequestContext> {
  const list = await headers();
  const ip = list.get("x-forwarded-for")?.split(",")[0]?.trim();
  const userAgent = list.get("user-agent");
  return {
    ...(ip ? { ip } : {}),
    ...(userAgent ? { userAgent } : {}),
    requestId: list.get("x-request-id") ?? randomUUID(),
  };
}

/**
 * Reads the `Idempotency-Key` header. §3 requires one on order placement and
 * payment-proof submission, and a missing one is the caller's error rather than
 * something to paper over with a generated value — a key the server invents
 * cannot deduplicate a retry, because the retry would invent a different one.
 */
export function idempotencyKey(request: Request): string | null {
  const key = request.headers.get("idempotency-key")?.trim();
  return key && key.length >= 8 && key.length <= 255 ? key : null;
}
