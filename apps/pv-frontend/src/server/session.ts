import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  ABSOLUTE_TTL_MS,
  SESSION_COOKIE,
  issueStaffSession,
  verifyStaffSession,
  type StaffPrincipal,
} from "@pv/backend/auth/staff-session";
import { logout } from "@pv/backend/services/staff-login";
import { staffHasPermission } from "@pv/backend/services/roles";
import type { PermissionCode } from "@pv/backend/auth/permission-codes";

export type { StaffPrincipal };

/**
 * `__Host-` requires the Secure attribute, so it only applies once the app is
 * actually served over HTTPS — in local development the plain name is used
 * instead, matching the existing `secure: NODE_ENV === "production"` pattern.
 */
const IS_PRODUCTION = process.env.NODE_ENV === "production";
const COOKIE_NAME = IS_PRODUCTION ? `__Host-${SESSION_COOKIE}` : SESSION_COOKIE;

async function requestContext(): Promise<{ ip?: string; userAgent?: string }> {
  const list = await headers();
  const ip = list.get("x-forwarded-for")?.split(",")[0]?.trim();
  const userAgent = list.get("user-agent");
  return {
    ...(ip ? { ip } : {}),
    ...(userAgent ? { userAgent } : {}),
  };
}

export async function createStaffSession(staffId: string) {
  const context = await requestContext();
  const { token, expiresAt } = await issueStaffSession(staffId, context);
  (await cookies()).set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: IS_PRODUCTION,
    sameSite: "lax",
    path: "/",
    maxAge: Math.floor(ABSOLUTE_TTL_MS / 1000),
    expires: expiresAt,
    priority: "high",
  });
}

export async function clearStaffSession() {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (token) await logout(token);
  store.delete(COOKIE_NAME);
}

/** `cache()` scopes this to one request, so one session lookup serves a whole tree. */
export const getStaffPrincipal = cache(async (): Promise<StaffPrincipal | null> => {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyStaffSession(token);
});

export async function requireStaffPrincipal(): Promise<StaffPrincipal> {
  const principal = await getStaffPrincipal();
  if (principal === null) redirect("/admin/login");
  return principal;
}

/**
 * Authority is re-derived from the database on every call — nothing about a
 * grant is cached in the cookie or the session row, so a permission change
 * made in the admin takes effect for an already-signed-in user immediately.
 */
export async function requirePermission(permission: PermissionCode): Promise<StaffPrincipal> {
  const principal = await requireStaffPrincipal();
  if (!(await staffHasPermission(principal.staffId, permission))) {
    redirect("/admin?denied=1");
  }
  return principal;
}

export async function currentRequestContext() {
  return requestContext();
}
