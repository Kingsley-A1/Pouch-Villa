import type { Metadata } from "next";
import { MINIMUM_PASSWORD_LENGTH } from "@pv/backend/auth/password";
import { ResetFlow } from "./reset-flow";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Reset your password" };

export default function ForgotPasswordPage() {
  return (
    <section className="section-space">
      <div className="container-shell max-w-md">
        <h1 className="section-title">Reset your password</h1>
        <p className="mt-3 text-(--pv-muted)">
          Enter the email address on your account and we will send you a code.
        </p>
        <div className="mt-8">
          <ResetFlow
            passwordHint={`At least ${MINIMUM_PASSWORD_LENGTH} characters. Avoid one you use elsewhere.`}
          />
        </div>
      </div>
    </section>
  );
}
