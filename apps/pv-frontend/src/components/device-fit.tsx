import Link from "next/link";
import { CheckCircle } from "@phosphor-icons/react/dist/ssr";
import type { StorefrontDevice } from "@pv/backend/services/catalogue";
import { groupByDeviceClass } from "@pv/backend/domain/device-groups";

/**
 * What this product fits, and a way through to everything else that fits the
 * same device.
 *
 * Grouped by device class — iPhone, iPad, Galaxy Tab — in the order the CEO set
 * on the classes screen. The query does the ordering; this only splits the run,
 * so what a customer reads is the arrangement chosen in the admin rather than
 * a second opinion formed here.
 *
 * A make nobody has sorted into classes renders exactly as it always did: one
 * flat row of pills, with no heading. A class tier that has not been filled in
 * must never appear to a customer as an empty label.
 *
 * Renders nothing when the list is empty rather than claiming the product fits
 * everything. An empty compatibility list means one of two things — a universal
 * pouch, or staff who have not filled it in yet — and neither is something the
 * page may guess at on the customer's behalf (AGENTS.md §0 rule 2).
 */
export function DeviceFit({ devices }: { devices: readonly StorefrontDevice[] }) {
  if (devices.length === 0) return null;

  const groups = groupByDeviceClass(devices);

  return (
    <section className="mt-8">
      <h2 className="flex items-center gap-2 text-lg font-bold">
        <CheckCircle size={20} weight="fill" aria-hidden="true" className="text-(--pv-success)" />
        Fits these devices
      </h2>

      <div className="mt-3 grid gap-4">
        {groups.map(({ lineName, devices: models }) => (
          <div key={lineName ?? "unfiled"}>
            {lineName === null ? null : (
              <h3 className="mb-2 text-xs font-bold tracking-[.1em] text-(--pv-muted) uppercase">
                {lineName}
              </h3>
            )}
            <ul className="flex flex-wrap gap-2">
              {models.map((device) => (
                <li key={device.id}>
                  <Link
                    href={`/shop?device=${device.slug}`}
                    className="inline-flex min-h-11 items-center rounded-full border border-(--pv-line) px-4 text-sm font-semibold hover:border-[color-mix(in_srgb,var(--pv-red)_45%,var(--pv-line))]"
                  >
                    <span className="text-(--pv-muted)">{device.brandName}</span>
                    <span className="ml-1">{device.name}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
