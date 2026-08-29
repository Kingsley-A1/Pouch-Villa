import Link from "next/link";
import { Funnel, X } from "@phosphor-icons/react/dist/ssr";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { ProductGrid } from "@/components/product-grid";
import { getBrands, getDevices, getProducts } from "@pv/backend/db";
import { toSingle } from "@/lib/utils";

export const dynamic = "force-dynamic";
type Search = Promise<Record<string, string | string[] | undefined>>;

export default async function ShopPage({ searchParams }: { searchParams: Search }) {
  const raw = await searchParams;
  const filters = {
    q: toSingle(raw.q),
    brand: toSingle(raw.brand),
    model: toSingle(raw.model),
    style: toSingle(raw.style),
    colour: toSingle(raw.colour),
    material: toSingle(raw.material),
    protection: toSingle(raw.protection),
    availability: toSingle(raw.availability),
    magsafe: toSingle(raw.magsafe),
    min: toSingle(raw.min),
    max: toSingle(raw.max),
    newOnly: toSingle(raw.new),
    bestseller: toSingle(raw.bestseller),
  };
  const products = getProducts(filters);
  const brands = getBrands();
  const devices = getDevices();
  const activeCount = Object.values(filters).filter(Boolean).length;
  const filterForm = (
    <form action="/shop" className="grid gap-4">
      <label>
        <span className="label">Search</span>
        <input
          className="field"
          name="q"
          defaultValue={filters.q}
          placeholder="Case name or feature"
        />
      </label>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
        <label>
          <span className="label">Phone brand</span>
          <select className="field" name="brand" defaultValue={filters.brand}>
            <option value="">All brands</option>
            {brands.map((item) => (
              <option key={item.id} value={item.slug}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="label">Phone model</span>
          <select className="field" name="model" defaultValue={filters.model}>
            <option value="">All models</option>
            {devices.map((item) => (
              <option key={item.id} value={item.slug}>
                {item.brand_name} {item.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label>
          <span className="label">Style</span>
          <select className="field" name="style" defaultValue={filters.style}>
            <option value="">All</option>
            {["Minimalist", "Rugged", "Clear", "Soft colour", "Bold"].map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
        <label>
          <span className="label">Colour</span>
          <select className="field" name="colour" defaultValue={filters.colour}>
            <option value="">All</option>
            {["Blush", "Black", "Clear", "Sage", "Pouch Red", "Smoke"].map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
      </div>
      <label>
        <span className="label">Material</span>
        <select className="field" name="material" defaultValue={filters.material}>
          <option value="">All materials</option>
          {[
            "Soft-touch TPU",
            "Reinforced polycarbonate",
            "Clear TPU",
            "Textured vegan leather",
            "Hybrid polymer",
          ].map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label>
          <span className="label">Protection</span>
          <select className="field" name="protection" defaultValue={filters.protection}>
            <option value="">All</option>
            {["Everyday", "Enhanced", "Heavy duty"].map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
        <label>
          <span className="label">Availability</span>
          <select className="field" name="availability" defaultValue={filters.availability}>
            <option value="">All</option>
            <option value="available">Available</option>
            <option value="limited">Limited stock</option>
            <option value="out_of_stock">Out of stock</option>
            <option value="pre_order">Pre-order</option>
            <option value="on_request">On request</option>
          </select>
        </label>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label>
          <span className="label">Min demo price</span>
          <input
            className="field"
            type="number"
            name="min"
            defaultValue={filters.min}
            min="0"
            placeholder="0"
          />
        </label>
        <label>
          <span className="label">Max demo price</span>
          <input
            className="field"
            type="number"
            name="max"
            defaultValue={filters.max}
            min="0"
            placeholder="50000"
          />
        </label>
      </div>
      <div className="grid gap-2 text-sm">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            name="magsafe"
            value="true"
            defaultChecked={filters.magsafe === "true"}
            className="accent-[#e30613]"
          />{" "}
          MagSafe related
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            name="new"
            value="true"
            defaultChecked={filters.newOnly === "true"}
            className="accent-[#e30613]"
          />{" "}
          New arrivals
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            name="bestseller"
            value="true"
            defaultChecked={filters.bestseller === "true"}
            className="accent-[#e30613]"
          />{" "}
          Bestsellers
        </label>
      </div>
      <div className="flex gap-2">
        <button className="button-primary flex-1" type="submit">
          <Funnel size={18} /> Apply filters
        </button>
        {activeCount ? (
          <Link className="button-ghost" href="/shop" aria-label="Clear filters">
            <X size={18} />
          </Link>
        ) : null}
      </div>
    </form>
  );
  return (
    <>
      <Breadcrumbs trail={[{ label: "Shop" }]} />
      <section className="section-space">
        <div className="container-shell">
          <div className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="eyebrow">Compatibility-aware catalogue</p>
              <h1 className="section-title mt-3">Shop cases</h1>
              <p className="mt-3 text-zinc-500">
                {products.length} demonstration product{products.length === 1 ? "" : "s"}
              </p>
            </div>
            <details className="group lg:hidden">
              <summary className="button-ghost cursor-pointer list-none">
                <Funnel size={18} /> Filters {activeCount ? `(${activeCount})` : ""}
              </summary>
              <div className="mt-4 rounded-2xl border border-[#e8e3df] bg-white p-5">
                {filterForm}
              </div>
            </details>
          </div>
          <div className="grid gap-8 lg:grid-cols-[280px_1fr]">
            <aside className="hidden lg:block">
              <div className="sticky top-24 max-h-[calc(100dvh-7rem)] overflow-y-auto overscroll-contain rounded-2xl border border-[#e8e3df] p-5">
                {filterForm}
              </div>
            </aside>
            <ProductGrid products={products} />
          </div>
        </div>
      </section>
    </>
  );
}
