import Link from "next/link";

type DeviceOption = { id: string; slug: string; name: string; brand_name: string };

/**
 * "Does it fit my phone" — the catalogue's differentiating facet now that Q1 has
 * settled on accessories rather than handsets. Rendered as links rather than a
 * <select> so each filtered view has its own URL a shopper can share or bookmark.
 */
export function DeviceFilter({
  devices,
  activeSlug,
  categorySlug,
}: {
  devices: DeviceOption[];
  activeSlug: string;
  categorySlug: string;
}) {
  if (devices.length === 0) return null;

  const hrefFor = (slug: string) => {
    const query = new URLSearchParams();
    if (categorySlug) query.set("category", categorySlug);
    if (slug) query.set("device", slug);
    const suffix = query.toString();
    return suffix ? `/shop?${suffix}` : "/shop";
  };

  return (
    <nav aria-label="Filter by device" className="-mx-4 mt-4 overflow-x-auto px-4">
      <ul className="flex w-max gap-2">
        <li>
          <Link
            href={hrefFor("")}
            aria-current={activeSlug === "" ? "true" : undefined}
            className={`inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-semibold ${
              activeSlug === ""
                ? "border-(--pv-red) bg-(--pv-red) text-white"
                : "border-(--pv-line) text-(--pv-ink)"
            }`}
          >
            Any device
          </Link>
        </li>
        {devices.map((device) => (
          <li key={device.id}>
            <Link
              href={hrefFor(device.slug)}
              aria-current={activeSlug === device.slug ? "true" : undefined}
              className={`inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-semibold whitespace-nowrap ${
                activeSlug === device.slug
                  ? "border-(--pv-red) bg-(--pv-red) text-white"
                  : "border-(--pv-line) text-(--pv-ink)"
              }`}
            >
              {device.brand_name} {device.name}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
