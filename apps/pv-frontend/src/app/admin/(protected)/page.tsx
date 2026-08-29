import Link from "next/link";
import {
  ArrowRight,
  ChartBar,
  DeviceMobile,
  ListChecks,
  Package,
  WarningCircle,
} from "@phosphor-icons/react/dist/ssr";
import { AdminHeader } from "@/components/admin-header";
import { all, one } from "@pv/backend/db";
export const dynamic = "force-dynamic";
export default function AdminDashboardPage() {
  const metrics = {
    active:
      one<{ count: number }>("SELECT COUNT(*) AS count FROM products WHERE status='published'")
        ?.count || 0,
    stale:
      one<{ count: number }>(
        "SELECT COUNT(*) AS count FROM products WHERE julianday('now')-julianday(availability_updated_at)>14",
      )?.count || 0,
    reservations:
      one<{ count: number }>(
        "SELECT COUNT(*) AS count FROM reservations WHERE status NOT IN ('completed','cancelled')",
      )?.count || 0,
    enquiries:
      one<{ count: number }>("SELECT COUNT(*) AS count FROM enquiries WHERE status='new'")?.count ||
      0,
    requests:
      one<{ count: number }>(
        "SELECT COUNT(*) AS count FROM case_requests WHERE status IN ('new','reviewing')",
      )?.count || 0,
  };
  const topProducts = all<{ name: string; views: number }>(
    "SELECT name,views FROM products ORDER BY views DESC LIMIT 5",
  );
  const topDevices = all<{ value: string; count: number }>(
    "SELECT value,COUNT(*) AS count FROM analytics_events WHERE event_type='device_selected' GROUP BY value ORDER BY count DESC LIMIT 5",
  );
  const noResults = all<{ value: string; count: number }>(
    "SELECT value,COUNT(*) AS count FROM analytics_events WHERE event_type='search_no_results' GROUP BY value ORDER BY count DESC LIMIT 5",
  );
  const collections = all<{ value: string; count: number }>(
    "SELECT value,COUNT(*) AS count FROM analytics_events WHERE event_type='collection_view' GROUP BY value ORDER BY count DESC LIMIT 5",
  );
  const activity = all<{
    action: string;
    entity_type: string;
    details: string;
    created_at: string;
  }>(
    "SELECT action,entity_type,details,created_at FROM audit_logs ORDER BY created_at DESC LIMIT 6",
  );
  const cards = [
    { label: "Active products", value: metrics.active, Icon: Package },
    { label: "Needs update", value: metrics.stale, Icon: WarningCircle },
    { label: "Reservations", value: metrics.reservations, Icon: ListChecks },
    { label: "New enquiries", value: metrics.enquiries, Icon: ChartBar },
    { label: "Case requests", value: metrics.requests, Icon: DeviceMobile },
  ];
  return (
    <>
      <AdminHeader
        eyebrow="Operating overview"
        title="Pouch Villa dashboard"
        description="Demonstration operational data only. Every admin mutation is permission-checked and written to the local development database."
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {cards.map(({ label, value, Icon }) => (
          <div key={label} className="card-surface p-5">
            <Icon size={24} className="text-[#e30613]" />
            <p className="mt-6 text-3xl font-bold">{value}</p>
            <p className="mt-1 text-sm text-zinc-500">{label}</p>
          </div>
        ))}
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <DashboardList
          title="Most viewed products"
          items={topProducts.map((item) => [item.name, String(item.views)])}
        />
        <DashboardList
          title="Most requested phone models"
          items={topDevices.map((item) => [item.value, String(item.count)])}
        />
        <DashboardList
          title="Searches with no results"
          items={noResults.map((item) => [item.value, String(item.count)])}
        />
        <DashboardList
          title="Popular collections"
          items={collections.map((item) => [item.value, String(item.count)])}
        />
      </div>
      <div className="card-surface mt-6 p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">Recent staff activity</h2>
          <Link href="/admin/audit" className="text-sm font-bold text-[#e30613]">
            Audit history <ArrowRight className="inline" size={16} />
          </Link>
        </div>
        <div className="mt-4 divide-y divide-[#e8e3df]">
          {activity.length ? (
            activity.map((item, index) => (
              <div key={index} className="flex items-start justify-between gap-4 py-3 text-sm">
                <div>
                  <strong className="capitalize">{item.action.replaceAll("_", " ")}</strong>
                  <p className="mt-1 text-zinc-500">{item.details}</p>
                </div>
                <time className="shrink-0 text-xs text-zinc-400">{item.created_at}</time>
              </div>
            ))
          ) : (
            <p className="py-6 text-sm text-zinc-500">
              Activity appears after the first staff mutation.
            </p>
          )}
        </div>
      </div>
    </>
  );
}
function DashboardList({ title, items }: { title: string; items: Array<[string, string]> }) {
  return (
    <div className="card-surface p-5">
      <h2 className="text-lg font-bold">{title}</h2>
      <div className="mt-4 divide-y divide-[#e8e3df]">
        {items.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between gap-4 py-3 text-sm">
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}
