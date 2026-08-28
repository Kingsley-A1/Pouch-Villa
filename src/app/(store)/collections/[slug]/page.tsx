import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { ProductGrid } from "@/components/product-grid";
import { getCollections, getProducts } from "@/lib/db";
export const dynamic = "force-dynamic";
export default async function CollectionPage({ params }: { params: Promise<{ slug: string }> }) { const { slug } = await params; const collection = getCollections().find((item) => item.slug === slug); if (!collection) notFound(); const products = getProducts({ collection: slug }); return <><Breadcrumbs trail={[{ label: "Collections", href: "/collections" }, { label: collection.name }]} /><section className="section-space"><div className="container-shell"><p className="eyebrow">Pouch Villa collection</p><h1 className="section-title mt-3">{collection.name}</h1><p className="mt-4 max-w-2xl text-lg leading-8 text-zinc-600">{collection.description}</p><div className="mt-10"><ProductGrid products={products} /></div></div></section></>; }
