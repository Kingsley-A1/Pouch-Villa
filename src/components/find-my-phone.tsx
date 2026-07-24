"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, CheckCircle, DeviceMobile } from "@phosphor-icons/react";
import type { Brand, Device } from "@/lib/types";

export type RememberedPhone = { brand: string; brandName: string; model: string; modelName: string };

export function FindMyPhone({ brands, devices, compact = false }: { brands: Brand[]; devices: Device[]; compact?: boolean }) {
  const router = useRouter();
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [remember, setRemember] = useState(true);
  const models = useMemo(() => devices.filter((item) => item.brand_slug === brand), [brand, devices]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const saved = localStorage.getItem("pouch-villa-phone");
      if (!saved) return;
      try {
        const phone = JSON.parse(saved) as RememberedPhone;
        setBrand(phone.brand);
        setModel(phone.model);
      } catch { localStorage.removeItem("pouch-villa-phone"); }
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const brandItem = brands.find((item) => item.slug === brand);
    const modelItem = models.find((item) => item.slug === model);
    if (!brandItem || !modelItem) return;
    if (remember) localStorage.setItem("pouch-villa-phone", JSON.stringify({ brand, brandName: brandItem.name, model, modelName: modelItem.name } satisfies RememberedPhone));
    else localStorage.removeItem("pouch-villa-phone");
    router.push(`/shop/${brand}/${model}`);
  }

  return (
    <form onSubmit={submit} className={compact ? "grid gap-4" : "grid max-w-xl gap-4"}>
      <div className={compact ? "grid gap-4 md:grid-cols-2" : "grid gap-4"}>
        <label>
          <span className="mb-2 flex items-center gap-2 text-sm font-bold"><span className="grid h-8 w-8 place-items-center rounded-full bg-[#e30613] text-white">1</span> Brand</span>
          <select className="field" value={brand} onChange={(event) => { setBrand(event.target.value); setModel(""); }} required aria-label="Choose phone brand">
            <option value="">Select brand</option>
            {brands.map((item) => <option key={item.id} value={item.slug}>{item.name}</option>)}
          </select>
        </label>
        <label>
          <span className="mb-2 flex items-center gap-2 text-sm font-bold"><span className="grid h-8 w-8 place-items-center rounded-full bg-[#e30613] text-white">2</span> Model</span>
          <select className="field" value={model} onChange={(event) => setModel(event.target.value)} disabled={!brand} required aria-label="Choose phone model">
            <option value="">{brand ? "Select or search model" : "Choose a brand first"}</option>
            {models.map((item) => <option key={item.id} value={item.slug}>{item.name}</option>)}
          </select>
        </label>
      </div>
      <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-600"><input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} className="h-4 w-4 accent-[#e30613]" /> Remember my phone on this device</label>
      <button type="submit" className="button-primary w-full sm:w-auto" disabled={!brand || !model}><DeviceMobile size={21} weight="bold" /> Show compatible cases <ArrowRight size={19} weight="bold" /></button>
      {brand && model ? <p className="flex items-center gap-2 text-sm font-semibold text-emerald-700"><CheckCircle size={18} weight="fill" /> Device confirmed before browsing.</p> : null}
    </form>
  );
}
