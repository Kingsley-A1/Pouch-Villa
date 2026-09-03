"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, UploadSimple, WarningCircle } from "@phosphor-icons/react";
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

export function ProofUpload({
  orderId,
  reference,
  existingProofs,
}: {
  orderId: string;
  reference: string;
  existingProofs: ExistingProof[];
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [message, setMessage] = useState<string | null>(null);

  const pending = phase === "requesting" || phase === "uploading" || phase === "checking";

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
      setMessage("Received. We will confirm your payment shortly.");
      router.refresh();
    } catch (error) {
      setPhase("error");
      setMessage(describeUploadFailure(error));
    }
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
