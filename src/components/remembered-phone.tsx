"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, DeviceMobile, X } from "@phosphor-icons/react";
import type { RememberedPhone } from "@/components/find-my-phone";

export function RememberedPhoneBanner() {
  const [phone, setPhone] = useState<RememberedPhone | null>(null);
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      try { const raw = localStorage.getItem("pouch-villa-phone"); if (raw) setPhone(JSON.parse(raw) as RememberedPhone); } catch { /* ignore malformed local data */ }
    });
    return () => cancelAnimationFrame(frame);
  }, []);
  if (!phone) return null;
  return (
    <div className="border-y border-[#e8e3df] bg-[#fcfaf8]">
      <div className="container-shell flex flex-col gap-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-full bg-red-50 text-[#e30613]"><DeviceMobile size={21} weight="bold" /></span><div><p className="text-xs font-bold uppercase tracking-[.1em] text-zinc-500">Your remembered phone</p><p className="font-bold">{phone.brandName} {phone.modelName}</p></div></div>
        <div className="flex items-center gap-2"><Link className="button-primary min-h-10 px-3 py-2 text-sm" href={`/shop/${phone.brand}/${phone.model}`}>New for my phone <ArrowRight size={17} /></Link><button className="grid h-10 w-10 place-items-center rounded-xl hover:bg-zinc-100" onClick={() => { localStorage.removeItem("pouch-villa-phone"); setPhone(null); }} aria-label="Forget remembered phone"><X size={18} /></button></div>
      </div>
    </div>
  );
}
