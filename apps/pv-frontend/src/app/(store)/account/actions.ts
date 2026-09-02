"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  customerLoginSchema,
  customerSignUpSchema,
  passwordResetCompleteSchema,
  passwordResetRequestSchema,
} from "@pv/backend/domain/schemas";
import { passwordSchema } from "@pv/backend/domain/schemas";
import * as account from "@pv/backend/services/customer-account";
import { loginCustomerWithGoogle } from "@pv/backend/services/customer-account";
import { sendPasswordResetEmail } from "@pv/backend/services/order-email";
import { requestContext } from "@/server/api";
import {
  clearCustomerSession,
  establishCustomerSession,
  getCustomerPrincipal,
} from "@/server/customer-session";
import { toActionError, type ActionState } from "@/lib/action-state";

/**
 * Server Actions for the customer account, each a thin adapter over the same
 * service function the `api/v1` route handler calls (AGENTS.md §3). No business
 * rule lives here — if one did, a future mobile client would have to have it
 * rewritten.
 */

/**
 * Where to go after signing in.
 *
 * Only a path on this site is accepted. A `next` parameter that a visitor can
 * set is an open-redirect if it is trusted, and "sign in, then get sent to a
 * convincing copy of this site" is the exact attack that makes one worth having.
 */
function safeRedirect(value: FormDataEntryValue | null): string {
  if (typeof value !== "string") return "/account";
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\"))
    return "/account";
  return value;
}

/**
 * Where a brand-new member goes: the welcome screen, carrying the destination
 * they were originally heading for.
 *
 * Registering is the one moment worth confirming out loud. Someone who signs up
 * mid-checkout and is dropped straight back onto a form has no way to tell
 * whether the account was created, and the next thing they do is sign up again.
 * The destination is put through `safeRedirect` here rather than trusted on the
 * welcome page, so an open-redirect cannot be smuggled in through `next`.
 */
function welcomeRedirect(next: string): string {
  const destination = safeRedirect(next);
  return destination === "/account"
    ? "/account/welcome"
    : `/account/welcome?next=${encodeURIComponent(destination)}`;
}

export async function registerAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = customerSignUpSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    fullName: formData.get("fullName") || null,
    phone: formData.get("phone") || null,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form." };

  const context = await requestContext();
  try {
    const { customerId } = await account.signUp(parsed.data, {
      ip: context.ip,
      requestId: context.requestId,
    });
    await establishCustomerSession(customerId);
  } catch (error) {
    return toActionError(error, "That account could not be created.");
  }
  redirect(welcomeRedirect(safeRedirect(formData.get("next"))));
}

export async function signInAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = customerLoginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form." };

  const context = await requestContext();
  try {
    const { customerId } = await account.loginCustomerWithPassword(
      parsed.data.email,
      parsed.data.password,
      { ip: context.ip, requestId: context.requestId },
    );
    await establishCustomerSession(customerId);
  } catch (error) {
    // The service already answers a wrong password and an unknown address with
    // one message, so this form cannot be used to discover who has an account.
    // The fallback only covers a driver or network failure.
    return toActionError(error, "That email and password could not be checked. Try again.");
  }
  redirect(safeRedirect(formData.get("next")));
}

/** Google, for a customer. It may create the account — see the route handler. */
export async function googleSignInAction(credential: string, next: string): Promise<void> {
  const context = await requestContext();
  const { customerId, created } = await loginCustomerWithGoogle(credential, {
    ip: context.ip,
    requestId: context.requestId,
  });
  await establishCustomerSession(customerId);
  // Signing in with Google is one tap, so nothing on screen otherwise
  // distinguishes "you now have an account" from "you were already a member".
  // A returning customer is sent straight on; only a new one is welcomed.
  redirect(created ? welcomeRedirect(safeRedirect(next)) : safeRedirect(next));
}

export async function signOutAction(): Promise<void> {
  await clearCustomerSession();
  redirect("/");
}

/**
 * Step one of recovery. Always reports success, whether or not the address is
 * registered — the same reasoning as the sign-in message above.
 */
export async function requestResetAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = passwordResetRequestSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) return { error: "Enter the email address on your account." };

  const context = await requestContext();
  try {
    const issued = await account.requestPasswordReset(parsed.data.email, {
      ip: context.ip,
      requestId: context.requestId,
    });
    // Sending is an external effect and best-effort; the uniform answer below
    // does not depend on it.
    if (issued !== null) {
      void sendPasswordResetEmail(parsed.data.email, issued.code).catch((error: unknown) => {
        console.error("Password reset email failed", {
          name: error instanceof Error ? error.name : typeof error,
        });
      });
    }
  } catch (error) {
    return toActionError(error, "That request could not be sent.");
  }
  return { error: null, message: "If that address has an account, a code is on its way." };
}

export async function completeResetAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = passwordResetCompleteSchema.safeParse({
    email: formData.get("email"),
    code: formData.get("code"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form." };

  const context = await requestContext();
  try {
    await account.completePasswordReset(parsed.data.email, parsed.data.code, parsed.data.password, {
      ip: context.ip,
      requestId: context.requestId,
    });
  } catch (error) {
    return toActionError(error, "That code could not be used. Ask for a new one.");
  }
  // Not signed in automatically. Whoever redeems the code has proved control of
  // the mailbox, not that they are at a device the owner wants left signed in.
  redirect("/account/sign-in?reset=1");
}

const profileFormSchema = z.object({
  fullName: z.string().trim().min(1).max(200).nullable(),
  phone: z.string().trim().max(32).nullable(),
});

export async function updateProfileAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const principal = await getCustomerPrincipal();
  if (principal === null) return { error: "Sign in to change your details." };

  const parsed = profileFormSchema.safeParse({
    fullName: formData.get("fullName") || null,
    phone: formData.get("phone") || null,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form." };

  const context = await requestContext();
  try {
    await account.updateCustomerProfile(principal.customerId, parsed.data, {
      ip: context.ip,
      requestId: context.requestId,
    });
  } catch (error) {
    return toActionError(error, "Your details could not be saved.");
  }
  revalidatePath("/account/details");
  return { error: null, message: "Your details are saved." };
}

const passwordChangeSchema = z.object({
  currentPassword: z.string().nullable(),
  password: passwordSchema,
});

export async function changePasswordAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const principal = await getCustomerPrincipal();
  if (principal === null) return { error: "Sign in to change your password." };

  const parsed = passwordChangeSchema.safeParse({
    currentPassword: formData.get("currentPassword") || null,
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form." };

  const context = await requestContext();
  try {
    await account.changeCustomerPassword(
      principal.customerId,
      parsed.data.currentPassword,
      parsed.data.password,
      { ip: context.ip, requestId: context.requestId },
    );
  } catch (error) {
    return toActionError(error, "Your password could not be changed.");
  }

  // Changing a password ends every session, including this one. Sending them
  // back to sign in is the honest outcome rather than a page that silently
  // stops working on the next click.
  await clearCustomerSession();
  redirect("/account/sign-in?changed=1");
}
