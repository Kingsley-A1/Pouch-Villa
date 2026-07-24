import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle } from "@phosphor-icons/react/dist/ssr";
import { ProductGrid } from "@/components/product-grid";
import { getDevices, getProducts, run } from "@/lib/db";

export const dynamic = "force-dynamic";
export default async function DeviceResultsPage({ params }: { params: Promise<{ brand: string; model: string }> }) {
  const { brand, model } = await params;
  const device = getDevices(brand).find((item) => item.slug === model);
  if (!device) notFound();
  const products = getProducts({ brand, model });
  run("INSERT INTO analytics_events (event_type, entity, value) VALUES ('device_selected', 'device', ?)", device.name);
  return <section className="section-space"><div className="container-shell"><Link href="/find-my-case" className="mb-7 inline-flex items-center gap-2 text-sm font-bold text-zinc-600 hover:text-[#e30613]"><ArrowLeft size={17} /> Change my phone</Link><div className="mb-10 rounded-3xl bg-red-50 p-6 sm:p-8"><p className="flex items-center gap-2 font-bold text-emerald-800"><CheckCircle size={20} weight="fill" /> Device confirmed</p><h1 className="section-title mt-3">Cases for {device.brand_name} {device.name}</h1><p className="mt-3 max-w-2xl text-zinc-600">Only products linked through the structured compatibility table appear here.</p></div><ProductGrid products={products} emptyTitle={`No demonstration cases are linked to ${device.name} yet`} /></div></section>;
}
