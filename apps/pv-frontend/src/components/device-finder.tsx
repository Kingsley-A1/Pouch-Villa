"use client";

import { useId, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { DeviceMobile } from "@phosphor-icons/react";
import type { DeviceLike } from "@pv/backend/domain/device-match";

export type FinderDevice = DeviceLike & { id: string };

/**
 * "Which phone have you got?" — pick the brand, pick the model, get what fits.
 *
 * This replaces a typeahead. The typeahead worked, and it was still the wrong
 * shape: it looked exactly like the search box in the header, so it read as
 * "search the shop" rather than "tell us your phone", and it asked the shopper
 * to supply the answer before it would help. Nobody types a model name they are
 * not already sure the shop stocks.
 *
 * Two selects state the question instead. The brand list says which makes are
 * covered at a glance, and choosing one narrows the models to that brand's, so
 * the second list is short enough to read. It is also the pattern every
 * accessory counter uses out loud — "what phone? which model?" — which is the
 * point: the control should match the conversation.
 *
 * Native `<select>` rather than a custom listbox. On Android it opens the OS
 * picker: full-screen rows, real touch targets, and the system's own
 * accessibility settings. That is the wrong trade when a list runs to hundreds
 * and typing is the only way through, which is why the typeahead existed — but
 * grouped by brand the list is short, so the trade goes the other way.
 *
 * The whole thing is a real GET form pointed at the shop, so every result has a
 * URL a shopper can share, bookmark or reach with the back button — and it still
 * works with no JavaScript at all. That is why the model list holds every device
 * grouped by brand rather than starting empty: the brand select is an accelerant,
 * never the gate. A disabled control that only a script can enable is a dead
 * control on a phone that dropped the bundle.
 */
export function DeviceFinder({
  devices,
  activeSlug = "",
  categorySlug = "",
}: {
  devices: readonly FinderDevice[];
  activeSlug?: string;
  categorySlug?: string;
}) {
  const router = useRouter();
  const fieldId = useId();

  const active = devices.find((device) => device.slug === activeSlug) ?? null;

  const [choice, setChoice] = useState(() => ({
    brand: active?.brandName ?? "",
    slug: active?.slug ?? "",
  }));
  /**
   * Navigating between two devices re-renders this component rather than
   * remounting it, so state seeded from the prop would keep showing the model
   * the shopper filtered by *last*. Resetting during render — React's documented
   * way to adjust state to a changed prop — is what keeps the selects agreeing
   * with the URL.
   */
  const [renderedFor, setRenderedFor] = useState(activeSlug);
  if (renderedFor !== activeSlug) {
    setRenderedFor(activeSlug);
    setChoice({ brand: active?.brandName ?? "", slug: active?.slug ?? "" });
  }

  /**
   * Devices grouped by brand, in the order the catalogue returns them — the sort
   * order staff set in the admin, not alphabetical. A shop that sells mostly
   * Samsung should be able to put Samsung first.
   */
  const byBrand = useMemo(() => {
    const groups = new Map<string, FinderDevice[]>();
    for (const device of devices) {
      const existing = groups.get(device.brandName);
      if (existing === undefined) groups.set(device.brandName, [device]);
      else existing.push(device);
    }
    return [...groups];
  }, [devices]);

  if (devices.length === 0) return null;

  const shownGroups =
    choice.brand === "" ? byBrand : byBrand.filter(([brandName]) => brandName === choice.brand);

  const shopHref = (slug: string) => {
    const query = new URLSearchParams();
    if (categorySlug) query.set("category", categorySlug);
    if (slug) query.set("device", slug);
    const suffix = query.toString();
    return suffix ? `/shop?${suffix}` : "/shop";
  };

  return (
    <form
      action="/shop"
      method="get"
      // Client-side navigation where there is JavaScript; the plain GET above is
      // what happens where there is not. Both land on the same URL.
      onSubmit={(event) => {
        event.preventDefault();
        router.push(shopHref(choice.slug));
      }}
      className="grid gap-3 rounded-2xl border border-(--pv-line) bg-(--pv-surface) p-4"
    >
      <p className="flex items-center gap-2 text-sm font-bold">
        <DeviceMobile size={20} weight="fill" aria-hidden="true" className="text-(--pv-red)" />
        Find what fits your phone
      </p>

      {/* The category a shopper was already browsing is carried through, so the
          finder narrows what they were looking at rather than resetting it. */}
      {categorySlug ? <input type="hidden" name="category" value={categorySlug} /> : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor={`${fieldId}-brand`} className="label">
            Brand
          </label>
          {/*
            Deliberately unnamed, so it is never submitted. `/shop` does have a
            `brand` filter, but it filters by the maker of the *pouch*, not the
            maker of the phone — submitting this would quietly answer a different
            question and hand back an empty shop.
          */}
          <select
            id={`${fieldId}-brand`}
            value={choice.brand}
            onChange={(event) => setChoice({ brand: event.target.value, slug: "" })}
            className="field min-h-11 w-full"
          >
            <option value="">All brands</option>
            {byBrand.map(([brandName]) => (
              <option key={brandName} value={brandName}>
                {brandName}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor={`${fieldId}-model`} className="label">
            Model
          </label>
          <select
            id={`${fieldId}-model`}
            name="device"
            required
            value={choice.slug}
            onChange={(event) => setChoice((current) => ({ ...current, slug: event.target.value }))}
            className="field min-h-11 w-full"
          >
            <option value="">Choose your model</option>
            {shownGroups.map(([brandName, models]) => (
              <optgroup key={brandName} label={brandName}>
                {models.map((device) => (
                  <option key={device.id} value={device.slug}>
                    {device.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" className="button-primary">
          Show what fits
        </button>
        {active !== null ? (
          <a href={shopHref("")} className="text-sm font-bold text-(--pv-red)">
            Show everything
          </a>
        ) : null}
      </div>

      {active !== null ? (
        <p className="help" role="status">
          Showing what fits your {active.brandName} {active.name}.
        </p>
      ) : null}
    </form>
  );
}
