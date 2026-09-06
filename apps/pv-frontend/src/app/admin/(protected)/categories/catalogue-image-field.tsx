"use client";

import { useRef, useState, useTransition } from "react";
import Image from "next/image";
import { Trash, UploadSimple } from "@phosphor-icons/react";
import type { CatalogueImageRef } from "@pv/backend/services/catalogue-media-urls";
import type { CatalogueMediaOwner } from "@pv/backend/storage/media-key";
import { describeUploadFailure } from "@/lib/upload-error";
import {
  ACCEPTED_MEDIA,
  ACCEPTED_MEDIA_TYPES,
  MAX_IMAGE_BYTES,
  rejectionReason,
} from "../products/upload-image";
import {
  beginCatalogueUploadAction,
  deleteCatalogueImageAction,
  finaliseCatalogueUploadAction,
} from "./media-actions";

/**
 * One picture, for one category or one brand.
 *
 * Not `media-picker.tsx`. That component exists to hold *several* files in the
 * browser before a product id exists, so they can all be uploaded the moment it
 * does — a real problem on the product create screen and no problem at all
 * here, where the row is always saved before its picture is chosen. Sharing it
 * would mean carrying a gallery, a sort order and a deferred queue for a field
 * that has exactly one slot.
 *
 * What is shared is the part worth sharing: `rejectionReason` and the accepted
 * types, so a file this refuses is exactly the file the product form refuses.
 *
 * The bytes go straight from the browser to R2 through a pre-signed URL — they
 * never pass through the application server (AGENTS.md section 8).
 */
export function CatalogueImageField({
  owner,
  ownerId,
  image,
  label,
  hint,
}: {
  owner: CatalogueMediaOwner;
  ownerId: string;
  image: CatalogueImageRef | null;
  label: string;
  hint: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);

  async function upload(file: File) {
    setError(null);

    const refusal = rejectionReason(file);
    if (refusal !== null) {
      setError(refusal);
      return;
    }

    setUploading(true);
    try {
      // The size is signed into the URL, so it has to be the real length.
      const began = await beginCatalogueUploadAction(owner, ownerId, file.type, file.size);
      if (!began.ok) {
        setError(began.error);
        return;
      }

      try {
        const put = await fetch(began.upload.url, {
          method: "PUT",
          body: file,
          headers: { "Content-Type": file.type },
        });
        if (!put.ok) {
          setError(`Storage refused the file (${put.status}). The link may have expired.`);
          return;
        }
      } catch (failure) {
        // `fetch` throws both for a dropped connection and for a request the
        // browser blocked on CORS; the second is a bucket-configuration fault
        // and is invisible from here, which is what `describeUploadFailure` is for.
        setError(describeUploadFailure(failure));
        return;
      }

      const finalised = await finaliseCatalogueUploadAction(began.upload.uploadId);
      if (finalised.error !== null) setError(finalised.error);
    } finally {
      setUploading(false);
      if (inputRef.current !== null) inputRef.current.value = "";
    }
  }

  return (
    <div className="grid gap-2">
      <p className="text-sm font-bold">{label}</p>
      <p className="text-xs text-(--pv-muted)">{hint}</p>

      <div className="flex items-start gap-3">
        <div className="relative h-20 w-20 flex-none overflow-hidden border border-(--pv-line) bg-(--pv-wash)">
          {image === null ? (
            <span className="grid h-full place-items-center text-xs text-(--pv-muted)">None</span>
          ) : (
            <Image
              src={image.url}
              alt=""
              width={image.width}
              height={image.height}
              sizes="80px"
              className="h-full w-full object-cover"
            />
          )}
        </div>

        <div className="grid gap-2">
          <label className="button-secondary cursor-pointer">
            <UploadSimple aria-hidden="true" size={16} weight="bold" />
            {uploading ? "Uploading…" : image === null ? "Choose image" : "Replace"}
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPTED_MEDIA}
              className="sr-only"
              disabled={uploading || busy}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file !== undefined) void upload(file);
              }}
            />
          </label>

          {image === null ? null : (
            <button
              type="button"
              className="button-ghost"
              disabled={uploading || busy}
              onClick={() => {
                startTransition(async () => {
                  const removed = await deleteCatalogueImageAction(owner, ownerId);
                  setError(removed.error);
                });
              }}
            >
              <Trash aria-hidden="true" size={16} />
              Remove
            </button>
          )}
        </div>
      </div>

      {error === null ? null : (
        <p role="alert" className="text-sm text-(--pv-danger)">
          {error}
        </p>
      )}

      <p className="text-xs text-(--pv-muted)">
        {ACCEPTED_MEDIA_TYPES.map((type) => type.replace("image/", "").toUpperCase()).join(", ")} up
        to {Math.round(MAX_IMAGE_BYTES / 1024 / 1024)}MB.
      </p>
    </div>
  );
}
