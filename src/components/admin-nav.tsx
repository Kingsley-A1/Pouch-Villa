import Link from "next/link";
import { Archive, ChartBar, ClockCounterClockwise, DeviceMobile, FolderOpen, Gear, House, ImageSquare, ListChecks, MagnifyingGlass, Package, Question, Storefront, Users, UserSwitch } from "@phosphor-icons/react/dist/ssr";
import { BrandMark } from "@/components/brand-mark";
import { logout } from "@/app/admin/auth-actions";
import { can } from "@/lib/permissions";
import type { Session } from "@/lib/auth";

const nav = [
  ["Dashboard", "/admin", "dashboard", House], ["Products", "/admin/products", "products", Package], ["Compatibility", "/admin/compatibility", "compatibility", DeviceMobile],
  ["Inventory", "/admin/inventory", "inventory", Archive], ["Reservations", "/admin/reservations", "reservations", ListChecks], ["Collections", "/admin/collections", "collections", FolderOpen],
  ["Enquiries", "/admin/enquiries", "enquiries", Question], ["Case requests", "/admin/case-requests", "case_requests", MagnifyingGlass], ["Customers", "/admin/customers", "customers", Users],
  ["Media", "/admin/media", "media", ImageSquare], ["Homepage & content", "/admin/content", "content", Storefront], ["Business settings", "/admin/settings", "settings", Gear],
  ["Staff & roles", "/admin/staff", "staff", UserSwitch], ["Analytics", "/admin/analytics", "analytics", ChartBar], ["Audit history", "/admin/audit", "audit", ClockCounterClockwise],
] as const;

export function AdminNav({ session }: { session: Session }) {
  return <aside className="border-b border-white/10 bg-[#171717] text-white lg:fixed lg:inset-y-0 lg:left-0 lg:w-[270px] lg:overflow-y-auto lg:border-b-0 lg:border-r">
    <div className="p-5"><Link href="/admin"><BrandMark inverse compact /></Link><p className="mt-4 text-xs text-zinc-500">Protected prototype admin</p></div>
    <nav className="flex gap-1 overflow-x-auto px-3 pb-3 lg:grid lg:overflow-visible lg:pb-5" aria-label="Admin navigation">{nav.filter((item) => can(session.role, item[2])).map(([label, href,, Icon]) => <Link key={href} href={href} className="flex shrink-0 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-zinc-300 hover:bg-white/10 hover:text-white"><Icon size={19} />{label}</Link>)}</nav>
    <div className="hidden border-t border-white/10 p-5 lg:block"><p className="text-sm font-bold">{session.name}</p><p className="mt-1 text-xs capitalize text-zinc-500">{session.role} role</p><form action={logout}><button className="mt-4 text-xs font-bold text-red-300 hover:text-white">Sign out</button></form></div>
  </aside>;
}
