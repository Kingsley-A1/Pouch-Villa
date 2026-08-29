"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Bell, BookmarkSimple, Check, DeviceMobile, MapPin } from "@phosphor-icons/react";
import { WhatsAppEnquiry } from "@/components/whatsapp-enquiry";
import type { Device, Product, ProductVariant } from "@pv/backend/domain/types";

export function ProductActions({
  product,
  devices,
  variants,
  whatsappNumber,
}: {
  product: Product;
  devices: Device[];
  variants: ProductVariant[];
  whatsappNumber: string;
}) {
  const [device, setDevice] = useState("");
  const [variant, setVariant] = useState(variants[0]?.name || "Default");
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      try {
        const viewed = JSON.parse(localStorage.getItem("pouch-villa-recent") || "[]") as string[];
        localStorage.setItem(
          "pouch-villa-recent",
          JSON.stringify(
            [product.slug, ...viewed.filter((item) => item !== product.slug)].slice(0, 8),
          ),
        );
        setSaved(
          (JSON.parse(localStorage.getItem("pouch-villa-saved") || "[]") as string[]).includes(
            product.slug,
          ),
        );
        const remembered = JSON.parse(localStorage.getItem("pouch-villa-phone") || "null") as {
          model?: string;
        } | null;
        if (remembered?.model && devices.some((item) => item.slug === remembered.model))
          setDevice(remembered.model);
      } catch {
        /* local storage is optional */
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [devices, product.slug]);
  const selectedDevice = useMemo(
    () => devices.find((item) => item.slug === device),
    [device, devices],
  );
  const message = `Hello Pouch Villa, I am interested in the ${product.name} demonstration listing (${variant}) for ${selectedDevice?.brand_name || "[confirm brand]"} ${selectedDevice?.name || "[confirm exact phone model]"}. Please confirm the real product details, availability and price.`;
  function toggleSaved() {
    const current = JSON.parse(localStorage.getItem("pouch-villa-saved") || "[]") as string[];
    const next = current.includes(product.slug)
      ? current.filter((item) => item !== product.slug)
      : [...current, product.slug];
    localStorage.setItem("pouch-villa-saved", JSON.stringify(next));
    setSaved(next.includes(product.slug));
  }
  return (
    <div className="grid gap-5">
      <label>
        <span className="label flex items-center gap-2">
          <DeviceMobile size={18} /> Confirm your exact phone model
        </span>
        <select
          className="field"
          value={device}
          onChange={(event) => setDevice(event.target.value)}
          required
        >
          <option value="">Select compatible model</option>
          {devices.map((item) => (
            <option key={item.id} value={item.slug}>
              {item.brand_name} {item.name}
            </option>
          ))}
        </select>
        <span className="help mt-2 block">
          Reservation and enquiry actions unlock only after compatibility is confirmed.
        </span>
      </label>
      <fieldset>
        <legend className="label">Choose demonstration variant</legend>
        <div className="flex flex-wrap gap-2">
          {variants.map((item) => (
            <button
              key={item.sku}
              type="button"
              onClick={() => setVariant(item.name)}
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-bold ${variant === item.name ? "border-[#e30613] bg-red-50 text-[#b9020c]" : "border-[#e8e3df]"}`}
            >
              <span
                className="h-4 w-4 rounded-full border border-black/10"
                style={{ backgroundColor: item.color }}
              />
              {item.name}
              {variant === item.name ? <Check size={15} /> : null}
            </button>
          ))}
        </div>
      </fieldset>
      <div className="grid gap-3 sm:grid-cols-2">
        <button type="button" onClick={toggleSaved} className="button-ghost">
          <BookmarkSimple size={20} weight={saved ? "fill" : "regular"} />
          {saved ? "Saved" : "Save product"}
        </button>
        <Link
          aria-disabled={!device}
          href={
            device
              ? `/reservation?product=${product.slug}&model=${device}&variant=${encodeURIComponent(variant)}`
              : "#confirm-phone"
          }
          className={`${device ? "button-primary" : "button-primary pointer-events-none opacity-50"}`}
        >
          <MapPin size={20} /> Reserve for pickup
        </Link>
      </div>
      <WhatsAppEnquiry
        message={message}
        number={device ? whatsappNumber : ""}
        label={device ? "Prepare WhatsApp enquiry" : "Confirm phone to enquire"}
      />
      {product.availability === "out_of_stock" ? (
        <Link className="button-ghost" href={`/request-case?product=${product.slug}`}>
          <Bell size={20} /> Register back-in-stock interest
        </Link>
      ) : null}
    </div>
  );
}
