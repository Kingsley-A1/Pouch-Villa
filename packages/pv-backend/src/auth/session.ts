import { jwtVerify, SignJWT } from "jose";
import { ROLES, type StaffRole } from "../domain/types";

export type Session = { id: number; name: string; email: string; role: StaffRole };

export const SESSION_TTL_SECONDS = 60 * 60 * 8;

const MINIMUM_SECRET_LENGTH = 32;
const DEVELOPMENT_ONLY_SECRET = "development-only-secret-never-valid-in-production";

/**
 * A signing key must come from a real secret. Deriving one from a deployment ID,
 * commit SHA or hostname lets anyone who learns that value mint a valid staff
 * session, so an unconfigured production environment fails closed instead.
 */
export function sessionSecret() {
  const configured = process.env.AUTH_SECRET;
  if (configured && configured.length >= MINIMUM_SECRET_LENGTH) {
    return new TextEncoder().encode(configured);
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      `AUTH_SECRET must be configured with at least ${MINIMUM_SECRET_LENGTH} characters in production.`,
    );
  }
  return new TextEncoder().encode(DEVELOPMENT_ONLY_SECRET);
}

export async function signSession(session: Session) {
  return new SignJWT(session)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(sessionSecret());
}

export async function verifySession(token: string): Promise<Session | null> {
  try {
    const { payload } = await jwtVerify(token, sessionSecret());
    if (
      typeof payload.id !== "number" ||
      typeof payload.email !== "string" ||
      typeof payload.name !== "string" ||
      typeof payload.role !== "string" ||
      !ROLES.includes(payload.role as StaffRole)
    ) {
      return null;
    }
    return {
      id: payload.id,
      email: payload.email,
      name: payload.name,
      role: payload.role as StaffRole,
    };
  } catch {
    return null;
  }
}
