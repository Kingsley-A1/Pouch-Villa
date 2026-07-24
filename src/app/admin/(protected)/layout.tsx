import { AdminNav } from "@/components/admin-nav";
import { requireSession } from "@/lib/auth";
export const dynamic = "force-dynamic";
export default async function AdminLayout({ children }: { children: React.ReactNode }) { const session = await requireSession(); return <div className="min-h-screen bg-[#f6f3f1]"><AdminNav session={session} /><main className="min-w-0 lg:pl-[270px]"><div className="mx-auto max-w-[1500px] p-4 sm:p-6 lg:p-8">{children}</div></main></div>; }
