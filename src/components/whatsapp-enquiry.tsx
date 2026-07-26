"use client";

import { useRef, useState } from "react";
import { Check, Copy, WhatsappLogo, X } from "@phosphor-icons/react";

export function WhatsAppEnquiry({ message, label = "Prepare WhatsApp enquiry", number = "" }: { message: string; label?: string; number?: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [copied, setCopied] = useState(false);
  function open() {
    if (number) { window.open(`https://wa.me/${number.replace(/\D/g, "")}?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer"); return; }
    dialog.current?.showModal();
  }
  async function copy() { await navigator.clipboard.writeText(message); setCopied(true); window.setTimeout(() => setCopied(false), 1800); }
  return <>
    <button type="button" onClick={open} className="button-secondary w-full sm:w-auto"><WhatsappLogo size={21} weight="fill" /> {label}</button>
    <dialog ref={dialog} className="m-auto w-[min(92vw,560px)] rounded-3xl border border-[#e8e3df] bg-white p-0 shadow-2xl backdrop:bg-black/45">
      <div className="flex items-center justify-between border-b border-[#e8e3df] p-5"><div><p className="eyebrow">Message preview</p><h2 className="mt-1 text-xl font-bold">WhatsApp is not configured</h2></div><button onClick={() => dialog.current?.close()} className="grid h-10 w-10 place-items-center rounded-xl hover:bg-zinc-100" aria-label="Close message preview"><X size={20} /></button></div>
      <div className="p-5"><p className="text-sm leading-6 text-zinc-600">No official Pouch Hub WhatsApp number has been supplied. This prototype will not invent one or send a real message.</p><pre className="mt-4 max-h-64 overflow-auto whitespace-pre-wrap rounded-2xl bg-[#f6f3f1] p-4 font-sans text-sm leading-6">{message}</pre><div className="mt-5 flex flex-wrap gap-3"><button onClick={copy} className="button-primary">{copied ? <Check size={19} /> : <Copy size={19} />}{copied ? "Copied" : "Copy message"}</button><button onClick={() => dialog.current?.close()} className="button-ghost">Close</button></div></div>
    </dialog>
  </>;
}
