"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, DownloadSimple, UploadSimple, WarningCircle } from "@phosphor-icons/react";
import Link from "next/link";
import { describeUploadFailure } from "@/lib/upload-error";

/**
 * Client because the upload is a three-step exchange the browser drives: ask for
 * a pre-signed URL, PUT the bytes straight to R2, then tell the server to check
 * what actually landed.
 *
 * The bytes never pass through the application server. On Nigerian mobile data,
 * relaying a phone photo through a serverless function is slow and frequently
 * times out — and the object stays untrusted until the server has fetched it
 * back and checked its magic bytes, so going direct costs nothing in safety.
 */
export type ExistingProof = {
  id: string;
  status: string;
  uploadedAt: string;
  rejectReason: string | null;
};

const ACCEPTED = "image/jpeg,image/png,image/webp,application/pdf";
const MAX_BYTES = 8 * 1024 * 1024;

type Phase = "idle" | "requesting" | "uploading" | "checking" | "done" | "error";

/**
 * Long enough to read the confirmation and reach the receipt, short enough not
 * to feel stuck.
 *
 * Longer than it was. The confirmation now carries a download the customer might
 * actually want to use, and four seconds is not enough time to notice a button,
 * decide, and press it before the page moves out from under you.
 */
const LEAVE_AFTER_MS = 9000;

export function ProofUpload({
  orderId,
  reference,
  signedIn,
  existingProofs,
}: {
  orderId: string;
  reference: string;
  /** Decides where a finished upload goes: the account, or the shop. */
  signedIn: boolean;
  existingProofs: ExistingProof[];
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [message, setMessage] = useState<string | null>(null);

  const pending = phase === "requesting" || phase === "uploading" || phase === "checking";
  const destination = signedIn ? "/account" : "/";

  /**
   * A finished upload leaves this page.
   *
   * It used to stay, with a line of green text under a button that still said
   * "Upload another" — so the one question the buyer had, *did that work*, was
   * answered in the same weight as the hint above it, and the obvious next
   * action was to send the receipt again. Now the form is replaced by the
   * confirmation and the page moves on by itself.
   *
   * The delay is what makes it a confirmation rather than a flash. The button
   * below is there throughout for anyone who does not want to wait, and the
   * timer is cleared on unmount so a push never lands after they have gone.
   */
  useEffect(() => {
    if (phase !== "done") return;
    const timer = window.setTimeout(() => router.push(destination), LEAVE_AFTER_MS);
    return () => window.clearTimeout(timer);
  }, [phase, destination, router]);

  async function upload(file: File) {
    if (file.size > MAX_BYTES) {
      setPhase("error");
      setMessage("That file is larger than 8MB. Try a photo rather than a scan.");
      return;
    }

    try {
      setPhase("requesting");
      setMessage(null);

      const begin = await fetch(`/api/v1/orders/${orderId}/proof`, {
        method: "POST",
        headers: {
          "x-upload-content-type": file.type,
          "x-upload-content-length": String(file.size),
        },
      });
      const beginBody = await begin.json();
      if (!begin.ok || !beginBody.ok) {
        throw new Error(beginBody.error?.message ?? "We could not start that upload.");
      }

      setPhase("uploading");
      const put = await fetch(beginBody.data.url, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!put.ok) throw new Error("The upload did not complete. Check your connection.");

      setPhase("checking");
      const finalise = await fetch(`/api/v1/orders/${orderId}/proof`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uploadId: beginBody.data.uploadId }),
      });
      const finaliseBody = await finalise.json();
      if (!finalise.ok || !finaliseBody.ok) {
        throw new Error(finaliseBody.error?.message ?? "That file could not be read.");
      }

      setPhase("done");
      setMessage(null);
    } catch (error) {
      setPhase("error");
      setMessage(describeUploadFailure(error));
    }
  }

  /**
   * The confirmation, in its own colour.
   *
   * Green rather than the shop's red, and the only green surface in the
   * storefront. This is the one screen a customer reaches immediately after
   * parting with money on trust, and the question in their head is binary — did
   * that work. A card in the same palette as everything else answers it in the
   * same voice as everything else. The panel tokens are stated on every ground
   * (see `globals.css`), so it is green on paper, in dark mode, and against the
   * red shop alike.
   *
   * `role="status"` announces the whole panel once to a screen reader, which is
   * why the tick is `aria-hidden` and the heading carries the meaning.
   */
  if (phase === "done") {
    return (
      <div
        role="status"
        className="grid gap-3 border border-(--pv-success-panel-line) bg-(--pv-success-panel) p-5 text-center text-(--pv-success-panel-ink)"
      >
        <CheckCircle
          size={44}
          weight="fill"
          aria-hidden="true"
          className="justify-self-center text-(--pv-success-panel-ink)"
        />
        <h2 className="text-lg font-bold">Thank you — we have your payment</h2>
        <p className="text-sm">
          Your receipt for {reference} is with us and being reviewed. You will get an email as soon
          as it is confirmed, and there is nothing else you need to do.
        </p>

        {/*
          A plain link, not a fetch: the response is a file, and letting the
          browser handle a download is the one thing it does better than any
          code we could write around it. It also means the button works with
          JavaScript broken, and on the phones where a blob download does not.
        */}
        <a
          href={`/api/v1/orders/${orderId}/receipt?kind=receipt`}
          className="button-on-success mt-1 justify-self-center"
        >
          <DownloadSimple size={18} weight="bold" aria-hidden="true" />
          Download your receipt
        </a>

        <Link href={destination} className="text-sm font-bold underline">
          {signedIn ? "Go to your account" : "Back to the shop"}
        </Link>
        <p className="text-xs opacity-80">Taking you there in a moment.</p>
      </div>
    );
  }

  return (
    <div className="card-surface p-5">
      <h2 className="text-lg font-bold">Upload your receipt</h2>
      <p className="help mt-1">
        A screenshot or PDF of the transfer for {reference}. Optional, but it gets your order
        confirmed faster.
      </p>

      {existingProofs.length > 0 ? (
        <ul className="mt-4 grid gap-2">
          {existingProofs.map((proof) => (
            <li key={proof.id} className="flex items-start gap-2 text-sm">
              {proof.status === "rejected" ? (
                <WarningCircle
                  size={18}
                  className="mt-0.5 flex-none text-(--pv-warning)"
                  aria-hidden="true"
                />
              ) : (
                <CheckCircle
                  size={18}
                  className="mt-0.5 flex-none text-(--pv-success)"
                  aria-hidden="true"
                />
              )}
              <span>
                {/* Status is written out, never carried by colour alone. */}
                <span className="font-semibold">
                  {proof.status === "pending"
                    ? "Sent, waiting to be checked"
                    : proof.status === "accepted"
                      ? "Accepted"
                      : "Not accepted"}
                </span>
                <span className="help block">{proof.uploadedAt}</span>
                {proof.rejectReason ? (
                  <span className="help block">{proof.rejectReason}</span>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED}
        className="sr-only"
        id="proof-file"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void upload(file);
          event.target.value = "";
        }}
      />
      <label htmlFor="proof-file" className="button-ghost mt-4 w-full cursor-pointer">
        <UploadSimple size={18} weight="bold" />
        {pending
          ? phase === "requesting"
            ? "Preparing…"
            : phase === "uploading"
              ? "Uploading…"
              : "Checking…"
          : existingProofs.length > 0
            ? "Upload another"
            : "Choose a file"}
      </label>

      <p aria-live="polite" className="mt-2 text-sm">
        {message ? (
          <span className={phase === "error" ? "text-(--pv-danger)" : "text-(--pv-success)"}>
            {message}
          </span>
        ) : null}
      </p>
    </div>
  );
}
