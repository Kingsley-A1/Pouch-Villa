import Link from "next/link";
import { CheckCircle } from "@phosphor-icons/react/dist/ssr";
import type { StorefrontDevice } from "@pv/backend/services/catalogue";

/**
 * What this product fits, and a way through to everything else that fits the
 * same phone.
 *
 * Renders nothing when the list is empty rather than claiming the product fits
 * everything. An empty compatibility list means one of two things — a universal
 * pouch, or staff who have not filled it in yet — and neither is something the
 * page may guess at on the customer's behalf (AGENTS.md §0 rule 2).
 */
export function DeviceFit({ devices }: { devices: readonly StorefrontDevice[] }) {
  if (devices.length === 0) return null;

  return (
    <section className="mt-8">
      <h2 className="flex items-center gap-2 text-lg font-bold">
        <CheckCircle size={20} weight="fill" aria-hidden="true" className="text-(--pv-success)" />
        Fits these phones
      </h2>
      <ul className="mt-3 flex flex-wrap gap-2">
        {devices.map((device) => (
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
    </section>
  );
}
