"use client";

import { useActionState } from "react";
import { WarningCircle } from "@phosphor-icons/react";
import { createReservation } from "@/app/(store)/actions";
import type { Device, ProductVariant } from "@/lib/types";

export function ReservationForm({ productSlug, devices, initialModel, variants, initialVariant }: { productSlug: string; devices: Device[]; initialModel: string; variants: ProductVariant[]; initialVariant: string }) {
  const [state, action, pending] = useActionState(createReservation, undefined);
  return <form action={action} className="grid gap-5"><input type="hidden" name="product" value={productSlug} />
    {state?.error ? <div role="alert" className="flex gap-2 rounded-xl bg-red-50 p-4 text-sm text-red-800"><WarningCircle size={20} className="shrink-0" />{state.error}</div> : null}
    <div className="grid gap-4 sm:grid-cols-2"><label><span className="label">Exact phone model</span><select className="field" name="model" defaultValue={initialModel} required><option value="">Select model</option>{devices.map((device) => <option key={device.id} value={device.slug}>{device.brand_name} {device.name}</option>)}</select></label><label><span className="label">Variant</span><select className="field" name="variant" defaultValue={initialVariant} required>{variants.map((variant) => <option key={variant.sku}>{variant.name}</option>)}</select></label></div>
    <div className="grid gap-4 sm:grid-cols-2"><label><span className="label">Demonstration name</span><input className="field" name="name" required minLength={2} maxLength={80} placeholder="Use demo data only" /></label><label><span className="label">Demonstration contact</span><input className="field" name="contact" required minLength={5} maxLength={100} placeholder="Do not enter real personal data" /></label></div>
    <label><span className="label">Preferred pickup date</span><input className="field" type="date" name="pickupDate" required /></label>
    <label><span className="label">Notes</span><textarea className="field min-h-28 resize-y" name="notes" maxLength={500} placeholder="Optional compatibility or pickup note" /></label>
    <label className="flex items-start gap-3 rounded-xl bg-amber-50 p-4 text-sm leading-6 text-amber-950"><input type="checkbox" name="demoConsent" value="yes" required className="mt-1 accent-[#e30613]" /> I understand this is a prototype and will not submit real personal information.</label>
    <button className="button-primary" disabled={pending}>{pending ? "Creating reference…" : "Create pickup reservation"}</button>
  </form>;
}
