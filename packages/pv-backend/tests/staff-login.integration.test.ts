import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { query, closePool } from "../src/db/client";
import { writableTestDatabaseConfigured } from "./helpers/database";
import { mintRoleCode, redeemRoleCode, setStaffStatus } from "../src/services/staff-access";
import {
  issueStaffSession,
  revokeStaffSession,
  verifyStaffSession,
} from "../src/auth/staff-session";
import {
  loginWithPassword,
  InvalidCredentialsError,
  TooManyAttemptsError,
  AccountSuspendedError,
} from "../src/services/staff-login";
import { sendEmail } from "../src/services/email";
import {
  sendVerificationCode,
  verifyEmailCode,
  CodeInvalidError,
  CodeAlreadySentError,
} from "../src/services/staff-email-verification";

const describeDb = writableTestDatabaseConfigured() ? describe : describe.skip;

vi.mock("../src/services/email", () => ({ sendEmail: vi.fn().mockResolvedValue(undefined) }));

const created: { staff: string[]; codes: string[] } = { staff: [], codes: [] };

function testEmail() {
  return `zz-login-${randomUUID()}@pv-integration.invalid`;
}

async function createEmployee(password = "correct-horse-battery") {
  const minted = await mintRoleCode({ role: "EMPLOYEE" }, { staffId: null });
  created.codes.push(minted.id);
  const email = testEmail();
  const { staffId } = await redeemRoleCode({
    code: minted.code,
    email,
    fullName: "Login Test",
    password,
  });
  created.staff.push(staffId);
  return { staffId, email, password };
}

async function cleanUp() {
  if (created.staff.length > 0) {
    await query("DELETE FROM staff_email_code WHERE staff_id = ANY($1)", [created.staff]);
    await query("DELETE FROM staff_session WHERE staff_id = ANY($1)", [created.staff]);
    await query("DELETE FROM staff_role_code_redemption WHERE staff_id = ANY($1)", [created.staff]);
    // actor_id is UUID and entity_id is STRING; CockroachDB infers one type per
    // placeholder, so the same $1 cannot serve both columns in a single query.
    await query("DELETE FROM audit_event WHERE actor_id = ANY($1::UUID[])", [created.staff]);
    await query("DELETE FROM audit_event WHERE entity_id = ANY($1::STRING[])", [created.staff]);
  }
  if (created.codes.length > 0) {
    await query("DELETE FROM staff_role_code_redemption WHERE role_code_id = ANY($1)", [
      created.codes,
    ]);
    await query("DELETE FROM staff_role_code WHERE id = ANY($1)", [created.codes]);
    created.codes.length = 0;
  }
  if (created.staff.length > 0) {
    await query("DELETE FROM staff WHERE id = ANY($1)", [created.staff]);
    created.staff.length = 0;
  }
}

describeDb("staff sessions", () => {
  afterEach(cleanUp);
  afterAll(closePool);

  it("issues a session and verifies it", async () => {
    const { staffId } = await createEmployee();
    const { token } = await issueStaffSession(staffId);

    const principal = await verifyStaffSession(token);
    expect(principal?.staffId).toBe(staffId);
    expect(principal?.role).toBe("EMPLOYEE");
  });

  it("rejects an unknown token", async () => {
    expect(await verifyStaffSession("not-a-real-token")).toBeNull();
  });

  it("rejects a revoked session immediately", async () => {
    const { staffId } = await createEmployee();
    const { token } = await issueStaffSession(staffId);
    expect(await verifyStaffSession(token)).not.toBeNull();

    await revokeStaffSession(token);
    expect(await verifyStaffSession(token)).toBeNull();
  });

  it("rejects a session past its absolute expiry", async () => {
    const { staffId } = await createEmployee();
    const { token } = await issueStaffSession(staffId);
    // An hour, not a second. `now()` is the database's clock and the check runs
    // against this process's clock; against a cloud cluster those differ by more
    // than a second, so a one-second margin made this fail on latency rather
    // than on the rule it is testing. The sibling idle test already uses an hour.
    await query("UPDATE staff_session SET absolute_expires_at = now() - interval '1 hour'");
    expect(await verifyStaffSession(token)).toBeNull();
  });

  it("rejects a session that has been idle too long", async () => {
    const { staffId } = await createEmployee();
    const { token } = await issueStaffSession(staffId);
    await query("UPDATE staff_session SET last_seen_at = now() - interval '1 hour'");
    expect(await verifyStaffSession(token)).toBeNull();
  });
});

describeDb("password login", () => {
  afterEach(cleanUp);
  afterAll(closePool);

  it("succeeds with the correct password and fails with the wrong one", async () => {
    const { email, password } = await createEmployee();

    const session = await loginWithPassword(email, password);
    expect(session.staffId).toBeTruthy();
    expect(session.role).toBe("EMPLOYEE");

    await expect(loginWithPassword(email, "wrong-password")).rejects.toBeInstanceOf(
      InvalidCredentialsError,
    );
  });

  it("gives the same rejection for an email that does not exist", async () => {
    await expect(loginWithPassword(testEmail(), "whatever-password")).rejects.toBeInstanceOf(
      InvalidCredentialsError,
    );
  });

  it("locks out after repeated failures on the same email", async () => {
    const { email } = await createEmployee();

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await expect(loginWithPassword(email, "wrong")).rejects.toThrow();
    }
    await expect(loginWithPassword(email, "wrong")).rejects.toBeInstanceOf(TooManyAttemptsError);
  });

  it("refuses a suspended account even with the right password", async () => {
    const { staffId, email, password } = await createEmployee();
    await setStaffStatus(staffId, "suspended", { staffId });

    await expect(loginWithPassword(email, password)).rejects.toBeInstanceOf(AccountSuspendedError);
  });
});

describeDb("staff email verification", () => {
  afterEach(cleanUp);
  afterAll(closePool);

  it("verifies the code Resend was asked to send", async () => {
    const { staffId, email } = await createEmployee();

    await sendVerificationCode(staffId, email);
    const call = vi.mocked(sendEmail).mock.calls.at(-1)?.[0];
    const codeBlock = call?.content.blocks.find((block) => block.type === "code");
    const code = codeBlock?.type === "code" ? codeBlock.value : undefined;
    expect(code).toBeTruthy();

    await verifyEmailCode(staffId, code!);
    const row = await query<{ email_verified_at: Date | null }>(
      "SELECT email_verified_at FROM staff WHERE id = $1",
      [staffId],
    );
    expect(row[0]?.email_verified_at).not.toBeNull();
  });

  it("rejects the wrong code without consuming a correct one already sent", async () => {
    const { staffId, email } = await createEmployee();
    await sendVerificationCode(staffId, email);
    await expect(verifyEmailCode(staffId, "000000")).rejects.toBeInstanceOf(CodeInvalidError);
  });

  it("refuses to send a second code inside the cooldown", async () => {
    const { staffId, email } = await createEmployee();
    await sendVerificationCode(staffId, email);
    await expect(sendVerificationCode(staffId, email)).rejects.toBeInstanceOf(CodeAlreadySentError);
  });
});
