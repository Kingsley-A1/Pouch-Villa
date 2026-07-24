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
  if (process.env.NODE_ENV === "production" && (!configured || configured.length < 32)) {
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
