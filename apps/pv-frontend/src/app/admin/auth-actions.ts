"use server";

import { verifyPassword } from "@pv/backend/auth/password";
import { redirect } from "next/navigation";
import { z } from "zod";
import { clearSession, createSession } from "@/server/session";
import { getStaffByEmail, run } from "@pv/backend/db";

type LoginState = { error?: string } | undefined;
type Attempt = { count: number; resetAt: number };
const attempts = new Map<string, Attempt>();

export async function login(_: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = z
    .object({ email: z.email().trim().toLowerCase(), password: z.string().min(8).max(128) })
    .safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) return { error: "Enter a valid email and password." };
  const key = parsed.data.email;
  const now = Date.now();
  const state = attempts.get(key);
  if (state && state.resetAt > now && state.count >= 5)
    return { error: "Too many attempts. Wait 15 minutes and try again." };
  if (!state || state.resetAt <= now)
    attempts.set(key, { count: 0, resetAt: now + 15 * 60 * 1000 });
  const staff = getStaffByEmail(key);
  const valid =
    staff && staff.status === "active" && verifyPassword(parsed.data.password, staff.password_hash);
  if (!valid || !staff) {
    const current = attempts.get(key)!;
    attempts.set(key, { ...current, count: current.count + 1 });
    return { error: "Email or password is incorrect." };
  }
  attempts.delete(key);
  run("UPDATE staff SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?", staff.id);
  await createSession({ id: staff.id, name: staff.name, email: staff.email, role: staff.role });
  redirect("/admin");
}

export async function logout() {
  await clearSession();
  redirect("/admin/login");
}
