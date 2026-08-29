import { redirect } from "next/navigation";
import { BrandMark } from "@/components/brand-mark";
import { LoginForm } from "@/components/login-form";
import { getSession } from "@/server/session";
export const dynamic = "force-dynamic";
export default async function AdminLoginPage() {
  if (await getSession()) redirect("/admin");
  return (
    <main className="grid min-h-screen place-items-center bg-[#f6f3f1] p-5">
      <div className="w-full max-w-md rounded-[1.6rem] border border-[#e8e3df] bg-white p-7 shadow-xl sm:p-9">
        <BrandMark />
        <p className="eyebrow mt-8">Protected staff application</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight">Sign in to manage the prototype.</h1>
        <p className="mt-3 text-sm leading-6 text-zinc-500">
          Credentials are generated locally by <code>npm run setup</code>. Permissions are checked
          on the server for every mutation.
        </p>
        <div className="mt-7">
          <LoginForm />
        </div>
      </div>
    </main>
  );
}
