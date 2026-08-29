"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Heart } from "@phosphor-icons/react";
import type { Product } from "@pv/backend/domain/types";
import { availabilityTone, cn } from "@/lib/utils";
import { availabilityLabel, formatNaira } from "@pv/backend/domain/format";

export function ProductCard({ product }: { product: Product }) {
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      try {
        setSaved(
          (JSON.parse(localStorage.getItem("pouch-villa-saved") || "[]") as string[]).includes(
            product.slug,
          ),
        );
      } catch {
        setSaved(false);
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [product.slug]);
  function toggleSaved() {
    const current = JSON.parse(localStorage.getItem("pouch-villa-saved") || "[]") as string[];
    const next = current.includes(product.slug)
      ? current.filter((slug) => slug !== product.slug)
      : [...current, product.slug];
    localStorage.setItem("pouch-villa-saved", JSON.stringify(next));
    setSaved(next.includes(product.slug));
  }
  return (
    <article className="group min-w-0">
      <div className="relative overflow-hidden rounded-[1.35rem] bg-[#f6f3f1]">
        <Link
          href={`/products/${product.slug}`}
          className="block aspect-square overflow-hidden"
          aria-label={`View ${product.name}`}
        >
          <Image
            src={product.image}
            alt={`${product.name} demonstration phone case`}
            width={700}
            height={700}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.035]"
          />
        </Link>
        <button
          onClick={toggleSaved}
          className="absolute top-3 right-3 grid h-10 w-10 place-items-center rounded-full bg-white text-zinc-900 shadow-sm"
          aria-label={saved ? `Remove ${product.name} from saved products` : `Save ${product.name}`}
        >
          <Heart
            size={21}
            weight={saved ? "fill" : "regular"}
            className={saved ? "text-[#e30613]" : ""}
          />
        </button>
        {product.is_new ? (
          <span className="absolute top-3 left-3 rounded-full bg-[#e30613] px-2.5 py-1 text-[11px] font-bold tracking-wide text-white uppercase">
            New
          </span>
        ) : null}
      </div>
      <div className="pt-4">
        <div className="mb-2 flex items-start justify-between gap-3">
          <Link
            href={`/products/${product.slug}`}
            className="leading-tight font-bold hover:text-[#e30613]"
          >
            {product.name}
          </Link>
          <span className={cn("status-pill shrink-0", availabilityTone(product.availability))}>
            {availabilityLabel(product.availability)}
          </span>
        </div>
        <p className="text-sm text-zinc-500">
          {product.style} · {product.protection}
        </p>
        <p className="mt-2 font-extrabold text-[#e30613]">{formatNaira(product.demo_price)}</p>
      </div>
    </article>
  );
}
