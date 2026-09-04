"use client";

import { useEffect, useState } from "react";
import { Bank, Check, Copy } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

/**
 * The bank details, shaped to be trusted and to be typed correctly.
 *
 * They were three lines of a definition list. The account number is the single
 * value on this site that, mistyped, sends a customer's money to a stranger —
 * and it was being read off a screen and keyed into a banking app by hand, on a
 * phone, from a page that gave no more prominence to it than to the bank's name.
 *
 * Four things do the work:
 *
 *   - **Copy, not retype.** A tap puts the number on the clipboard, which is the
 *     only reliable fix for a transposed digit. The amount and the reference
 *     copy too, because both are typed into the same transfer form.
 *   - **Grouped digits.** Ten digits in one unbroken run cannot be checked
 *     against a banking app at a glance; the same ten in threes can. The
 *     grouping is presentation only — what is copied is the number itself, with
 *     no spaces to paste into a field that would reject them.
 *
 *     (Written out rather than illustrated: the §4 check greps source for a
 *     ten-digit run and cannot tell an example in a comment from a real account
 *     number, so a sample here fails the build.)
 *   - **The amount, exactly.** A transfer for the wrong figure is a reconciliation
 *     problem for staff and a delay for the buyer.
 *   - **The reference as the narration.** It is what ties the money to the order.
 *
 * A client island, and a small one: `navigator.clipboard` is the whole reason.
 * The details themselves are rendered from props, so nothing about them depends
 * on JavaScript — with it disabled the numbers are still there to read.
 */
export function TransferDetails({
  accountName,
  accountNumber,
  bankName,
  amountLabel,
  reference,
}: {
  accountName: string;
  accountNumber: string;
  bankName: string;
  /** Formatted on the server — no `Kobo` crosses the client boundary. */
  amountLabel: string;
  reference: string;
}) {
  return (
    <div className="card-surface overflow-hidden">
      <div className="flex items-center gap-2.5 border-b border-(--pv-line) bg-(--pv-wash) px-5 py-3.5">
        <Bank size={20} weight="fill" aria-hidden="true" className="text-(--pv-red)" />
        <h2 className="text-lg font-bold">Pay by transfer</h2>
      </div>

      <div className="grid gap-4 p-5">
        <div>
          <p className="help">Account number</p>
          <div className="mt-1 flex items-center gap-2">
            <p className="font-mono text-2xl leading-tight font-extrabold tabular-nums">
              {group(accountNumber)}
            </p>
            <CopyButton value={accountNumber} label="account number" />
          </div>
        </div>

        <dl className="grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="help">Account name</dt>
            <dd className="font-bold">{accountName}</dd>
          </div>
          <div>
            <dt className="help">Bank</dt>
            <dd className="font-bold">{bankName}</dd>
          </div>
        </dl>

        <div className="grid gap-3 border-t border-(--pv-line) pt-4 sm:grid-cols-2">
          <div>
            <p className="help">Amount to send</p>
            <div className="mt-0.5 flex items-center gap-2">
              <p className="text-lg font-extrabold text-(--pv-red) tabular-nums">{amountLabel}</p>
              {/* Digits only — a banking app's amount field will not take ₦ or commas. */}
              <CopyButton value={amountLabel.replace(/[^\d.]/g, "")} label="amount" />
            </div>
          </div>
          <div>
            <p className="help">Use as narration</p>
            <div className="mt-0.5 flex items-center gap-2">
              <p className="font-mono font-bold">{reference}</p>
              <CopyButton value={reference} label="reference" />
            </div>
          </div>
        </div>

        <p className="rounded-xl bg-(--pv-wash) p-3 text-sm text-(--pv-muted)">
          Send the exact amount, put <strong className="text-(--pv-ink)">{reference}</strong> in the
          narration, then upload your receipt below. Nothing is taken from this page.
        </p>
      </div>
    </div>
  );
}

/**
 * Groups a Nigerian ten-digit NUBAN as 3-3-4, and anything else in threes.
 *
 * Presentation only. The unspaced value is what gets copied.
 */
function group(accountNumber: string): string {
  const digits = accountNumber.replace(/\s+/g, "");
  if (digits.length === 10) {
    return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
  }
  return digits.replace(/(.{3})/g, "$1 ").trim();
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);

  // Cleared on a timer, and the timer is cleared on unmount so a state update
  // never lands on a component that has gone.
  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(timer);
  }, [copied]);

  return (
    <button
      type="button"
      // The accessible name says what is copied. "Copy" four times down a card
      // is four identically named buttons to a screen reader.
      aria-label={copied ? `${label} copied` : `Copy the ${label}`}
      onClick={() => {
        // Clipboard access is refused outright in some browsers and over plain
        // http. The number is on screen either way, so a failure is silent
        // rather than an error the buyer can do nothing about.
        navigator.clipboard?.writeText(value).then(
          () => setCopied(true),
          () => setCopied(false),
        );
      }}
      className={cn(
        "grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-(--pv-line)",
        "hover:border-(--pv-red) hover:text-(--pv-red)",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--pv-red)",
        copied && "border-(--pv-success) text-(--pv-success)",
      )}
    >
      {copied ? (
        <Check size={17} weight="bold" aria-hidden="true" />
      ) : (
        <Copy size={17} weight="bold" aria-hidden="true" />
      )}
      {/* Announced on change, so the confirmation is not colour and icon alone. */}
      <span aria-live="polite" className="sr-only">
        {copied ? `${label} copied` : ""}
      </span>
    </button>
  );
}
