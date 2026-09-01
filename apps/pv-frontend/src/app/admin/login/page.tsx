import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Staff sign in" };

export default function LoginPage() {
  const googleClientId = process.env.GOOGLE_CLIENT_ID ?? null;

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 py-10">
      <h1 className="text-2xl font-bold">Staff sign in</h1>
      <p className="mt-2 text-sm text-(--pv-muted)">Pouch Villa team members only.</p>
      <div className="mx-auto mt-8">
        <LoginForm googleClientId={googleClientId} />
      </div>
      <p className="mt-8 text-sm text-(--pv-muted)">
        Have a role code?{" "}
        <Link href="/admin/claim" className="font-bold text-(--pv-red)">
          Claim your account
        </Link>
      </p>
    </div>
  );
}
