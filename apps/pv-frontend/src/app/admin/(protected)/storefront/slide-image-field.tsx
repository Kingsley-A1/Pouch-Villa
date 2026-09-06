"use client";

import { useRef, useState, useTransition } from "react";
import Image from "next/image";
import { Trash, UploadSimple } from "@phosphor-icons/react";
import type { AdminHeroSlide } from "@pv/backend/services/hero-slides";
import { describeUploadFailure } from "@/lib/upload-error";
import { ACCEPTED_MEDIA, MAX_IMAGE_BYTES, rejectionReason } from "../products/upload-image";
import {
  beginSlideUploadAction,
  deleteSlideImageAction,
  finaliseSlideUploadAction,
} from "./slide-actions";

/**
 * The photograph on one slide.
 *
 * The same shape as the category and brand picker, and for the same reasons: one
 * slot, bytes straight from the browser to R2 through a pre-signed URL, and the
 * refusal rules shared with the product form so a file this rejects is exactly
 * the file that one rejects.
 *
 * The preview is wide rather than square. A hero is a 16:9 band and a square
 * thumbnail of one hides how the crop will actually land, which is the single
 * thing the person uploading it needs to see.
 */
export function SlideImageField({ slide }: { slide: AdminHeroSlide }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [busy, startTransition] = useTransition();

  async function upload(file: File) {
    setError(null);
    const refusal = rejectionReason(file);
    if (refusal !== null) {
      setError(refusal);
      return;
    }

    setUploading(true);
    try {
      const began = await beginSlideUploadAction(slide.id, file.type, file.size);
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
        setError(describeUploadFailure(failure));
        return;
      }
      const finalised = await finaliseSlideUploadAction(began.upload.uploadId);
      if (finalised.error !== null) setError(finalised.error);
    } finally {
      setUploading(false);
      if (inputRef.current !== null) inputRef.current.value = "";
    }
  }

  return (
    <div className="grid gap-2">
      <div className="relative aspect-video w-full max-w-sm overflow-hidden border border-(--pv-line) bg-(--pv-wash)">
        {slide.image === null ? (
          <span className="grid h-full place-items-center text-xs text-(--pv-muted)">
            No photograph — this slide will not appear on the home page.
          </span>
        ) : (
          <Image
            src={slide.image.url}
            alt=""
            fill
            sizes="384px"
            className="object-cover"
            unoptimized={false}
          />
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <label className="button-secondary cursor-pointer">
          <UploadSimple aria-hidden="true" size={16} weight="bold" />
          {uploading ? "Uploading…" : slide.image === null ? "Choose photograph" : "Replace"}
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
        {slide.image === null ? null : (
          <button
            type="button"
            className="button-ghost"
            disabled={uploading || busy}
            onClick={() => {
              startTransition(async () => {
                const removed = await deleteSlideImageAction(slide.id);
                setError(removed.error);
              });
            }}
          >
            <Trash aria-hidden="true" size={16} />
            Remove
          </button>
        )}
      </div>

      {error === null ? null : (
        <p role="alert" className="text-sm text-(--pv-danger)">
          {error}
        </p>
      )}
      <p className="text-xs text-(--pv-muted)">
        Landscape, at least 1600px wide. Up to {Math.round(MAX_IMAGE_BYTES / 1024 / 1024)}MB.
      </p>
    </div>
  );
}
