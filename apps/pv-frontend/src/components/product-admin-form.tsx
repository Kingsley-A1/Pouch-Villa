import Image from "next/image";
import { createProduct, updateProduct } from "@/app/admin/(protected)/actions";
import type { Collection, Device, Product } from "@pv/backend/domain/types";

const stockStates = [
  ["available", "Available"],
  ["limited", "Limited stock"],
  ["out_of_stock", "Out of stock"],
  ["pre_order", "Pre-order"],
  ["on_request", "On request"],
  ["hidden", "Hidden"],
] as const;
const media = [
  "/images/case-blush.png",
  "/images/case-rugged.png",
  "/images/case-red-clear.png",
  "/images/case-sage.png",
  "/images/case-smoke.png",
];
const defaultVariants = JSON.stringify(
  [
    { name: "Pouch Red", color: "#e30613", sku: "PH-NEW-A", availability: "available" },
    { name: "Black", color: "#171717", sku: "PH-NEW-B", availability: "available" },
  ],
  null,
  2,
);

export function ProductAdminForm({
  product,
  devices,
  collections,
}: {
  product?: Product;
  devices: Device[];
  collections: Collection[];
}) {
  const assignedDevices = new Set(product?.devices?.map((item) => item.id));
  const assignedCollections = new Set(product?.collections?.map((item) => item.id));
  const action = product ? updateProduct : createProduct;
  return (
    <form action={action} className="grid gap-6" encType="multipart/form-data">
      {product ? <input type="hidden" name="id" value={product.id} /> : null}
      <section className="card-surface grid gap-5 p-5 sm:p-7">
        <h2 className="text-lg font-bold">Core product information</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <label>
            <span className="label">Product name</span>
            <input className="field" name="name" defaultValue={product?.name} required />
          </label>
          <label>
            <span className="label">Slug</span>
            <input
              className="field"
              name="slug"
              defaultValue={product?.slug}
              placeholder="Generated from name"
            />
          </label>
        </div>
        <label>
          <span className="label">Description</span>
          <textarea
            className="field min-h-32"
            name="description"
            defaultValue={
              product?.description ||
              "Original fictional demonstration case. Compatibility, price and availability require Pouch Villa confirmation."
            }
            required
          />
        </label>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label>
            <span className="label">Demo price (₦)</span>
            <input
              className="field"
              type="number"
              name="demoPrice"
              min="0"
              defaultValue={product?.demo_price || 15000}
              required
            />
          </label>
          <label>
            <span className="label">Availability</span>
            <select
              className="field"
              name="availability"
              defaultValue={product?.availability || "available"}
            >
              {stockStates.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="label">Style</span>
            <select className="field" name="style" defaultValue={product?.style || "Minimalist"}>
              {["Minimalist", "Rugged", "Clear", "Soft colour", "Bold"].map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
          <label>
            <span className="label">Protection</span>
            <select
              className="field"
              name="protection"
              defaultValue={product?.protection || "Everyday"}
            >
              {["Everyday", "Enhanced", "Heavy duty"].map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
        </div>
        <label>
          <span className="label">Material</span>
          <input
            className="field"
            name="material"
            defaultValue={product?.material || "Soft-touch TPU"}
            required
          />
        </label>
        <div className="flex flex-wrap gap-5 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              name="magsafe"
              defaultChecked={Boolean(product?.magsafe)}
              className="accent-[#e30613]"
            />{" "}
            MagSafe related
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              name="isNew"
              defaultChecked={Boolean(product?.is_new)}
              className="accent-[#e30613]"
            />{" "}
            New arrival
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              name="isBestseller"
              defaultChecked={Boolean(product?.is_bestseller)}
              className="accent-[#e30613]"
            />{" "}
            Bestseller
          </label>
        </div>
      </section>
      <section className="card-surface grid gap-5 p-5 sm:p-7">
        <h2 className="text-lg font-bold">Image and variants</h2>
        {product ? (
          <Image
            src={product.image}
            alt="Current demonstration product"
            width={160}
            height={160}
            className="h-36 w-36 rounded-2xl object-cover"
          />
        ) : null}
        <label>
          <span className="label">Media library image</span>
          <select className="field" name="image" defaultValue={product?.image || media[0]}>
            {media.map((path) => (
              <option key={path} value={path}>
                {path.split("/").at(-1)}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="label">Or upload an image</span>
          <input
            className="field py-3"
            type="file"
            name="imageUpload"
            accept="image/png,image/jpeg,image/webp"
          />
          <span className="help mt-2 block">
            PNG, JPG or WebP, up to 5 MB. Local upload persistence is a prototype feature.
          </span>
        </label>
        <label>
          <span className="label">Variants JSON</span>
          <textarea
            className="field min-h-48 font-mono text-xs"
            name="variants"
            defaultValue={
              product?.variants_json
                ? JSON.stringify(JSON.parse(product.variants_json), null, 2)
                : defaultVariants
            }
            required
          />
        </label>
      </section>
      <section className="card-surface grid gap-5 p-5 sm:p-7">
        <h2 className="text-lg font-bold">Structured compatibility</h2>
        <p className="help">
          Select every exact phone model this product is genuinely compatible with. This
          relationship drives public results.
        </p>
        <div className="grid max-h-80 gap-2 overflow-y-auto rounded-xl border border-[#e8e3df] p-3 sm:grid-cols-2 lg:grid-cols-3">
          {devices.map((device) => (
            <label
              key={device.id}
              className="flex items-center gap-2 rounded-lg p-2 text-sm hover:bg-[#f6f3f1]"
            >
              <input
                type="checkbox"
                name="deviceIds"
                value={device.id}
                defaultChecked={assignedDevices.has(device.id)}
                className="accent-[#e30613]"
              />
              {device.brand_name} {device.name}
            </label>
          ))}
        </div>
      </section>
      <section className="card-surface grid gap-5 p-5 sm:p-7">
        <h2 className="text-lg font-bold">Collections</h2>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {collections.map((collection) => (
            <label
              key={collection.id}
              className="flex items-center gap-2 rounded-xl border border-[#e8e3df] p-3 text-sm"
            >
              <input
                type="checkbox"
                name="collectionIds"
                value={collection.id}
                defaultChecked={assignedCollections.has(collection.id)}
                className="accent-[#e30613]"
              />
              {collection.name}
            </label>
          ))}
        </div>
      </section>
      <div className="flex flex-wrap gap-3">
        <button className="button-primary">
          {product ? "Save product changes" : "Create draft product"}
        </button>
        {product ? (
          <a
            href={`/products/${product.slug}`}
            target="_blank"
            rel="noreferrer"
            className="button-ghost"
          >
            Preview public page
          </a>
        ) : null}
      </div>
    </form>
  );
}
