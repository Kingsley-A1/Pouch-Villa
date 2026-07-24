"use client";

import { useActionState } from "react";
import { WarningCircle } from "@phosphor-icons/react";
import { createCaseRequest } from "@/app/(store)/actions";

export function CaseRequestForm({ initialProduct = "" }: { initialProduct?: string }) {
  const [state, action, pending] = useActionState(createCaseRequest, undefined);
  return <form action={action} className="grid gap-5">
    {state?.error ? <div role="alert" className="flex gap-2 rounded-xl bg-red-50 p-4 text-sm text-red-800"><WarningCircle size={20} />{state.error}</div> : null}
    <div className="grid gap-4 sm:grid-cols-2"><label><span className="label">Demonstration name</span><input className="field" name="name" required placeholder="Use demo data only" /></label><label><span className="label">Demonstration contact</span><input className="field" name="contact" required placeholder="Do not enter real personal data" /></label></div>
    <div className="grid gap-4 sm:grid-cols-2"><label><span className="label">Phone brand</span><input className="field" name="brand" required placeholder="e.g. Tecno" /></label><label><span className="label">Exact model</span><input className="field" name="model" required placeholder="e.g. Camon 40 Pro" /></label></div>
    <label><span className="label">What kind of case do you need?</span><textarea className="field min-h-32 resize-y" name="preferences" required defaultValue={initialProduct ? `I am interested in a case similar to ${initialProduct}.` : ""} placeholder="Colour, protection, material or style" /></label>
    <label className="flex items-start gap-3 rounded-xl bg-amber-50 p-4 text-sm leading-6 text-amber-950"><input type="checkbox" name="demoConsent" value="yes" required className="mt-1 accent-[#e30613]" /> I understand this is a prototype and will use demonstration information only.</label>
    <button className="button-primary" disabled={pending}>{pending ? "Creating request…" : "Submit case request"}</button>
  </form>;
}
