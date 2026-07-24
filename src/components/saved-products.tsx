"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Product } from "@/lib/types";
import { ProductGrid } from "@/components/product-grid";

export function SavedProducts({ products }: { products: Product[] }) {
  const [slugs, setSlugs] = useState<string[] | null>(null);
  useEffect(() => { const frame = requestAnimationFrame(() => { try { setSlugs(JSON.parse(localStorage.getItem("pouch-villa-saved") || "[]") as string[]); } catch { setSlugs([]); } }); return () => cancelAnimationFrame(frame); }, []);
  if (slugs === null) return <div className="grid grid-cols-2 gap-4 md:grid-cols-4">{[1,2,3,4].map((item) => <div key={item} className="aspect-square animate-pulse rounded-3xl bg-zinc-100" />)}</div>;
  const saved = products.filter((item) => slugs.includes(item.slug));
  return saved.length ? <ProductGrid products={saved} /> : <div className="rounded-3xl border border-dashed border-zinc-300 bg-[#fcfaf8] p-10 text-center"><h2 className="text-xl font-bold">Nothing saved yet</h2><p className="mt-2 text-zinc-500">Use the heart button on a product to keep it here on this device.</p><Link href="/shop" className="button-primary mt-5">Browse products</Link></div>;
}
