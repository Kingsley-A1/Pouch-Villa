import { LoadingLine } from "@/components/loading-line";

/**
 * The product page while its data is on the way.
 *
 * Shaped like the page it stands in for — breadcrumb, square gallery, thumbnail
 * row, title, price, the add-to-cart block — rather than the store's generic
 * grid, so the real page lands in the same boxes instead of reflowing around a
 * layout that was never going to be there. On this cluster a product page costs
 * several seconds of queries, which is exactly the gap this fills.
 */
export default function ProductLoading() {
  return (
    <div role="status" aria-live="polite">
      <span className="sr-only">Loading product</span>
      <div className="border-b border-(--pv-line)">
        <div className="container-shell flex h-12 items-center gap-3">
          <div className="h-4 w-12 rounded bg-(--pv-line)" />
          <div className="h-4 w-10 rounded bg-(--pv-line)" />
          <div className="h-4 w-32 rounded bg-(--pv-line)" />
        </div>
      </div>

      <section className="section-space" aria-hidden="true">
        <div className="container-shell grid gap-10 lg:grid-cols-2">
          <div className="grid gap-3">
            <div className="pv-shimmer pv-loop relative grid aspect-square place-items-center overflow-hidden rounded-3xl">
              <LoadingLine label="Loading product" className="max-w-40" />
            </div>
            <div className="flex gap-2">
              {[1, 2, 3, 4].map((slot) => (
                <div key={slot} className="pv-shimmer pv-loop h-16 w-16 shrink-0 rounded-xl" />
              ))}
            </div>
          </div>

          <div className="grid content-start gap-4">
            <div className="h-9 w-4/5 rounded-xl bg-(--pv-line)" />
            <div className="flex items-center justify-between">
              <div className="h-8 w-28 rounded-lg bg-(--pv-line)" />
              <div className="h-11 w-11 rounded-full bg-(--pv-line)" />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {[1, 2, 3].map((chip) => (
                <div key={chip} className="h-11 w-24 rounded-full bg-(--pv-wash)" />
              ))}
            </div>
            <div className="mt-2 h-12 w-full rounded-full bg-(--pv-line)" />
            <div className="mt-6 grid gap-2">
              <div className="h-4 w-full rounded bg-(--pv-wash)" />
              <div className="h-4 w-11/12 rounded bg-(--pv-wash)" />
              <div className="h-4 w-2/3 rounded bg-(--pv-wash)" />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
