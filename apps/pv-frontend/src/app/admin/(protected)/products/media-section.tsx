"use client";

import { useRef, useState, useTransition } from "react";
import Image from "next/image";
import type { AdminMedia } from "@pv/backend/services/media";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { FormError, FormSuccess } from "@/components/admin/form-controls";
import {
  beginUploadAction,
  deleteMediaAction,
  finaliseUploadAction,
  reorderMediaAction,
} from "./media-actions";

/**
 * Uploads go browser → R2 directly using a short-lived pre-signed URL, so a
 * large photo on mobile data never has to travel through the app server. Only
 * after the bytes are in R2 does the server fetch them back to validate and
 * build the derivatives.
 */
export function MediaSection({
  productId,
  media,
  storageConfigured,
}: {
  productId: string;
  media: AdminMedia[];
  storageConfigured: boolean;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<{ error: string | null; message?: string }>({ error: null });
  const [busy, setBusy] = useState(false);
  const [pending, start] = useTransition();

  async function upload(file: File) {
    setBusy(true);
    setStatus({ error: null });
    try {
      const began = await beginUploadAction(productId, file.type);
      if (!began.ok) {
        setStatus({ error: began.error });
        return;
      }

      const put = await fetch(began.upload.url, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });
      if (!put.ok) {
        setStatus({ error: "The image could not be uploaded. Check your connection." });
        return;
      }

      const finalised = await finaliseUploadAction(productId, began.upload.uploadId, file.name);
      setStatus(finalised);
    } catch {
      setStatus({ error: "The image could not be uploaded." });
    } finally {
      setBusy(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  function move(index: number, direction: -1 | 1) {
    const next = [...media];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    const moved = next[index]!;
    next[index] = next[target]!;
    next[target] = moved;
    start(async () => {
      await reorderMediaAction(
        productId,
        next.map((item) => item.id),
      );
    });
  }

  if (!storageConfigured) {
    return (
      <div className="grid gap-3">
        <h2 className="text-lg font-bold">Images</h2>
        <p className="rounded-2xl border border-dashed border-(--pv-line) p-6 text-sm text-(--pv-muted)">
          Object storage is not configured for this environment, so images cannot be uploaded here.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold">Images</h2>
        <label className="inline-flex min-h-11 cursor-pointer items-center rounded-xl border border-(--pv-line) px-4 text-sm font-bold">
          {busy ? "Uploading…" : "Add image"}
          <input
            ref={fileInput}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif"
            className="sr-only"
            disabled={busy}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void upload(file);
            }}
          />
        </label>
      </div>

      <FormError message={status.error} />
      <FormSuccess message={status.message} />

      {media.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-(--pv-line) p-6 text-sm text-(--pv-muted)">
          No images yet. The first image is the one shoppers see on the product card.
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {media.map((item, index) => (
            <li key={item.id} className="rounded-2xl border border-(--pv-line) bg-white p-2">
              <div className="relative aspect-square overflow-hidden rounded-xl bg-(--pv-wash)">
                <Image
                  src={item.urls.thumb}
                  alt={item.alt ?? ""}
                  fill
                  sizes="(max-width: 640px) 45vw, 200px"
                  className="object-cover"
                />
                {index === 0 ? (
                  <span className="absolute top-1 left-1 rounded-full bg-(--pv-red) px-2 py-0.5 text-xs font-bold text-white">
                    Primary
                  </span>
                ) : null}
              </div>
              <div className="mt-2 flex items-center justify-between gap-1">
                <div className="flex gap-1">
                  <button
                    type="button"
                    disabled={index === 0 || pending}
                    onClick={() => move(index, -1)}
                    aria-label="Move image earlier"
                    className="grid h-11 w-11 place-items-center rounded-lg border border-(--pv-line) disabled:opacity-40"
                  >
                    ←
                  </button>
                  <button
                    type="button"
                    disabled={index === media.length - 1 || pending}
                    onClick={() => move(index, 1)}
                    aria-label="Move image later"
                    className="grid h-11 w-11 place-items-center rounded-lg border border-(--pv-line) disabled:opacity-40"
                  >
                    →
                  </button>
                </div>
                <ConfirmButton
                  label="Remove"
                  confirmLabel="Remove"
                  onConfirm={async () => {
                    await deleteMediaAction(productId, item.id);
                  }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
