import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  SESSION_TTL_SECONDS,
  signSession,
  verifySession,
  type Session,
} from "@pv/backend/auth/session";
import { can, type Permission } from "@pv/backend/auth/permissions";

const COOKIE = "pv_admin_session";

export type { Session };

export async function createSession(session: Session) {
  const token = await signSession(session);
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
    priority: "high",
  });
}

export async function clearSession() {
  (await cookies()).delete(COOKIE);
}

export const getSession = cache(async (): Promise<Session | null> => {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  return verifySession(token);
});

export async function requireSession() {
  const session = await getSession();
  if (!session) redirect("/admin/login");
  return session;
}

export async function requirePermission(permission: Permission) {
  const session = await requireSession();
  if (!can(session.role, permission)) {
    throw new Error("You do not have permission to perform this action.");
  }
  return session;
}
