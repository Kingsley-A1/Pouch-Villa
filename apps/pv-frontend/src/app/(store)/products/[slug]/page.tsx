import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, CheckCircle, Info, MapPin, ShieldCheck } from "@phosphor-icons/react/dist/ssr";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { ProductActions } from "@/components/product-actions";
import { ProductGrid } from "@/components/product-grid";
import { getProductBySlug, getProducts, getSetting, run } from "@pv/backend/db";
import { availabilityTone, cn } from "@/lib/utils";
import { availabilityLabel, formatNaira, parseVariants } from "@pv/backend/domain/format";
export const dynamic = "force-dynamic";
export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = getProductBySlug(slug);
  if (!product) notFound();
  run("UPDATE products SET views = views + 1 WHERE id = ?", product.id);
  const devices = product.devices || [];
  const variants = parseVariants(product.variants_json);
  const first = devices[0];
  const related = first
    ? getProducts({ brand: first.brand_slug, model: first.slug })
        .filter((item) => item.id !== product.id)
        .slice(0, 4)
    : [];
  const whatsapp = getSetting("whatsapp_number");
  return (
    <>
      <Breadcrumbs
        trail={
          first
            ? [
                { label: "Shop", href: "/shop" },
                {
                  label: `${first.brand_name} ${first.name}`,
                  href: `/shop/${first.brand_slug}/${first.slug}`,
                },
                { label: product.name },
              ]
            : [{ label: "Shop", href: "/shop" }, { label: product.name }]
        }
      />
      <section className="section-space">
        <div className="container-shell grid gap-10 lg:grid-cols-[1.05fr_.95fr]">
          <div className="grid gap-4 sm:grid-cols-[1fr_88px] sm:[grid-template-areas:'main_thumbs']">
            <div className="relative aspect-square overflow-hidden rounded-[2rem] bg-[#f6f3f1] sm:[grid-area:main]">
              <Image
                src={product.image}
                alt={`${product.name} demonstration case`}
                fill
                sizes="(max-width: 1024px) 100vw, 52vw"
                className="object-cover"
                priority
              />
            </div>
            <div className="flex gap-3 sm:flex-col sm:[grid-area:thumbs]">
              {[product.image, "/images/pouch-villa-hero.png", product.image].map(
                (image, index) => (
                  <div
                    key={`${image}-${index}`}
                    className="relative aspect-square w-20 overflow-hidden rounded-xl border border-[#e8e3df] bg-[#f6f3f1]"
                  >
                    <Image
                      src={image}
                      alt="Demonstration gallery view"
                      fill
                      sizes="80px"
                      className="object-cover"
                    />
                  </div>
                ),
              )}
            </div>
          </div>
          <div>
            <p className="eyebrow">Original fictional demonstration product</p>
            <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
              <h1 className="section-title">{product.name}</h1>
              <span className={cn("status-pill", availabilityTone(product.availability))}>
                {availabilityLabel(product.availability)}
              </span>
            </div>
            <p className="mt-4 text-2xl font-extrabold text-[#e30613]">
              {formatNaira(product.demo_price)}
            </p>
            <p className="mt-5 leading-7 text-zinc-600">{product.description}</p>
            <div className="my-7 grid grid-cols-2 gap-px overflow-hidden rounded-2xl bg-[#e8e3df]">
              <div className="bg-[#fcfaf8] p-4">
                <p className="text-xs text-zinc-500">Material</p>
                <p className="mt-1 font-bold">{product.material}</p>
              </div>
              <div className="bg-[#fcfaf8] p-4">
                <p className="text-xs text-zinc-500">Protection</p>
                <p className="mt-1 font-bold">{product.protection}</p>
              </div>
              <div className="bg-[#fcfaf8] p-4">
                <p className="text-xs text-zinc-500">Style</p>
                <p className="mt-1 font-bold">{product.style}</p>
              </div>
              <div className="bg-[#fcfaf8] p-4">
                <p className="text-xs text-zinc-500">MagSafe related</p>
                <p className="mt-1 font-bold">{product.magsafe ? "Yes" : "No"}</p>
              </div>
            </div>
            <div id="confirm-phone">
              <ProductActions
                product={product}
                devices={devices}
                variants={variants}
                whatsappNumber={whatsapp}
              />
            </div>
          </div>
        </div>
      </section>
      <section className="border-y border-[#e8e3df] bg-[#fcfaf8]">
        <div className="container-shell grid gap-6 py-10 md:grid-cols-3">
          <div className="flex gap-3">
            <CheckCircle className="text-[#e30613]" size={24} />
            <div>
              <p className="font-bold">Compatibility</p>
              <p className="mt-1 text-sm leading-6 text-zinc-500">
                {devices.map((item) => `${item.brand_name} ${item.name}`).join(", ")}
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <MapPin className="text-[#e30613]" size={24} />
            <div>
              <p className="font-bold">Pickup information</p>
              <p className="mt-1 text-sm leading-6 text-zinc-500">
                Staff confirms availability and pickup details after reservation.
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <ShieldCheck className="text-[#e30613]" size={24} />
            <div>
              <p className="font-bold">Policy summary</p>
              <p className="mt-1 text-sm leading-6 text-zinc-500">
                No payment or final sale occurs through this prototype.
              </p>
            </div>
          </div>
        </div>
      </section>
      <section className="section-space">
        <div className="container-shell">
          <div className="mb-8 flex items-end justify-between">
            <div>
              <p className="eyebrow">Same confirmed device</p>
              <h2 className="section-title mt-3">Related compatible products</h2>
            </div>
            {first ? (
              <Link
                href={`/shop/${first.brand_slug}/${first.slug}`}
                className="button-ghost hidden sm:inline-flex"
              >
                View all <ArrowRight size={18} />
              </Link>
            ) : null}
          </div>
          {related.length ? (
            <ProductGrid products={related} />
          ) : (
            <div className="flex items-center gap-3 rounded-2xl bg-amber-50 p-5 text-amber-900">
              <Info size={22} /> No related demonstration products are linked yet.
            </div>
          )}
        </div>
      </section>
    </>
  );
}
