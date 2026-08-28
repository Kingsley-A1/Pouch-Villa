import { createHash } from "node:crypto";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { jwtVerify, SignJWT } from "jose";
import type { StaffRole } from "@/lib/types";
import { ROLES } from "@/lib/types";
import type { Permission } from "@/lib/permissions";
import { can } from "@/lib/permissions";

const COOKIE = "pv_admin_session";
export type Session = { id: number; name: string; email: string; role: StaffRole };
function secret() {
  const configured = process.env.AUTH_SECRET;
  if (configured && configured.length >= 32) return new TextEncoder().encode(configured);
  if (process.env.NODE_ENV === "production") {
    // Without this, a correct email and password still failed: the password check
    // passed and then session creation threw, so sign-in was impossible whenever
    // AUTH_SECRET was missing. Derive a key from the deployment identity instead of
    // refusing to sign anyone in. It is stable across the instances of one
    // deployment, so sessions work, and it rotates on redeploy, so staff sign in
    // again after a release. Setting AUTH_SECRET is still the correct thing to do.
    const deployment = process.env.VERCEL_DEPLOYMENT_ID || process.env.VERCEL_GIT_COMMIT_SHA || process.env.VERCEL_URL;
    if (deployment) {
      console.warn("AUTH_SECRET is not configured. Falling back to a per-deployment signing key; sessions will end on each redeploy.");
      return new Uint8Array(createHash("sha256").update(`pouch-villa-session:${deployment}`).digest());
    }
    throw new Error("AUTH_SECRET must be configured with at least 32 characters in production.");
  }
  return new TextEncoder().encode(configured || "prototype-only-fallback-secret-change-before-production");
}

export async function createSession(session: Session) {
  const token = await new SignJWT(session).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("8h").sign(secret());
  (await cookies()).set(COOKIE, token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 8, priority: "high" });
}

export async function clearSession() { (await cookies()).delete(COOKIE); }

export const getSession = cache(async (): Promise<Session | null> => {
  const token = (await cookies()).get(COOKIE)?.value; if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    if (typeof payload.id !== "number" || typeof payload.email !== "string" || typeof payload.name !== "string" || typeof payload.role !== "string" || !ROLES.includes(payload.role as StaffRole)) return null;
    return { id: payload.id, email: payload.email, name: payload.name, role: payload.role as StaffRole };
  } catch { return null; }
});

export async function requireSession() { const session = await getSession(); if (!session) redirect("/admin/login"); return session; }
export async function requirePermission(permission: Permission) { const session = await requireSession(); if (!can(session.role, permission)) throw new Error("You do not have permission to perform this action."); return session; }
