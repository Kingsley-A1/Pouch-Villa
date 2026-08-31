import { createHash, randomInt } from "node:crypto";
import { query, queryOne } from "../db/client";
import { withTransaction } from "../db/transaction";
import { sendEmail } from "./email";
import { recordAudit } from "./audit";

/**
 * Staff email verification is a 6-digit code entered in the app, never a link.
 * Magic links are phishable, break inside in-app browsers, and leak through
 * forwarded mail; a code the user types into a page they already have open does
 * not have those failure modes.
 */

const CODE_TTL_MINUTES = 15;
const MAX_ATTEMPTS = 5;

export class CodeAlreadySentError extends Error {
  constructor(readonly retryAfterSeconds: number) {
    super("A verification code was already sent recently.");
    this.name = "CodeAlreadySentError";
  }
}

export class CodeInvalidError extends Error {
  constructor() {
    super("That code is incorrect or has expired.");
    this.name = "CodeInvalidError";
  }
}

function generateCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

function hashCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

const RESEND_COOLDOWN_SECONDS = 60;

export async function sendVerificationCode(staffId: string, email: string): Promise<void> {
  const recent = await queryOne<{ created_at: Date }>(
    `SELECT created_at FROM staff_email_code
      WHERE staff_id = $1 AND consumed_at IS NULL
      ORDER BY created_at DESC LIMIT 1`,
    [staffId],
  );
  if (recent !== null) {
    const elapsed = (Date.now() - recent.created_at.getTime()) / 1000;
    if (elapsed < RESEND_COOLDOWN_SECONDS) {
      throw new CodeAlreadySentError(Math.ceil(RESEND_COOLDOWN_SECONDS - elapsed));
    }
  }

  const code = generateCode();
  const expiresAt = new Date(Date.now() + CODE_TTL_MINUTES * 60_000);
  await query(
    "INSERT INTO staff_email_code (staff_id, code_hash, expires_at) VALUES ($1, $2, $3)",
    [staffId, hashCode(code), expiresAt],
  );

  await sendEmail({
    to: email,
    subject: `${code} is your Pouch Villa verification code`,
    text: `Your Pouch Villa verification code is ${code}. It expires in ${CODE_TTL_MINUTES} minutes. If you did not request this, ignore this email.`,
    html: `<p>Your Pouch Villa verification code is:</p><p style="font-size:28px;font-weight:700;letter-spacing:.08em">${code}</p><p>It expires in ${CODE_TTL_MINUTES} minutes. If you did not request this, ignore this email.</p>`,
  });
}

export async function verifyEmailCode(
  staffId: string,
  code: string,
  actor: { requestId?: string } = {},
): Promise<void> {
  return withTransaction(async (tx) => {
    const found = await tx.query(
      `SELECT id, code_hash, expires_at, attempts
         FROM staff_email_code
        WHERE staff_id = $1 AND consumed_at IS NULL
        ORDER BY created_at DESC LIMIT 1`,
      [staffId],
    );
    const row = found.rows[0] as
      { id: string; code_hash: string; expires_at: Date; attempts: number } | undefined;

    if (
      row === undefined ||
      row.attempts >= MAX_ATTEMPTS ||
      row.expires_at.getTime() <= Date.now()
    ) {
      throw new CodeInvalidError();
    }

    await tx.query("UPDATE staff_email_code SET attempts = attempts + 1 WHERE id = $1", [row.id]);

    if (row.code_hash !== hashCode(code)) throw new CodeInvalidError();

    await tx.query("UPDATE staff_email_code SET consumed_at = now() WHERE id = $1", [row.id]);
    await tx.query("UPDATE staff SET email_verified_at = now() WHERE id = $1", [staffId]);

    await recordAudit(tx, {
      actorType: "staff",
      actorId: staffId,
      action: "staff.email_verified",
      entityType: "staff",
      entityId: staffId,
      requestId: actor.requestId,
    });
  });
}
