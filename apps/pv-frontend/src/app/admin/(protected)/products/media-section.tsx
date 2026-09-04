"use client";

import { useRef, useState, useTransition } from "react";
import Image from "next/image";
import type { AdminMedia } from "@pv/backend/services/media";
import { FormError, FormSuccess } from "@/components/admin/form-controls";
import { cn } from "@/lib/utils";
import { MAX_MEDIA } from "./media-picker";
import { ACCEPTED_MEDIA, uploadProductImage } from "./upload-image";
import { deleteMediaAction, reorderMediaAction } from "./media-actions";

/**
 * The product's images, after the product exists.
 *
 * Deliberately the same shape as `MediaPicker` on the create screen: the same
 * heading, the same "Add images" control, and the same single scrolling row of
 * small thumbnails with the same four actions under each. They were two
 * different screens for one job — a wrapping grid of large tiles here, a
 * scrolling rail of small ones there — so a person who had learnt to add
 * pictures to a new product had to learn it again to change them.
 *
 * The difference that remains is real rather than cosmetic: there, nothing has
 * been uploaded and every action is local; here, every action is a round trip
 * to R2 and the database, so this one reports progress and can fail.
 *
 * Uploads go browser → R2 directly using a short-lived pre-signed URL, so a
 * large photo on mobile data never travels through the app server. Only once the
 * bytes are in R2 does the server fetch them back to validate, strip EXIF and
 * build the derivatives. Files are sent one after another rather than in
 * parallel: five concurrent multi-megabyte PUTs on a mobile connection contend
 * with each other and are likelier to time out than the same five in sequence.
 */
export function MediaSection({
  productId,
  productName,
  media,
  storageConfigured,
}: {
  productId: string;
  /** Names the pictures for assistive technology — see `MediaTile`. */
  productName: string;
  media: AdminMedia[];
  storageConfigured: boolean;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<{ error: string | null; message?: string }>({ error: null });
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [replacing, setReplacing] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const busy = progress !== null || replacing !== null;
  const room = MAX_MEDIA - media.length;

  async function addFiles(selected: FileList | null) {
    if (selected === null || selected.length === 0) return;

    const chosen = Array.from(selected);
    const accepted = chosen.slice(0, Math.max(room, 0));
    const overflow = chosen.length - accepted.length;

    setStatus({ error: null });
    setProgress({ done: 0, total: accepted.length });

    const failures: string[] = [];
    for (const [index, file] of accepted.entries()) {
      const outcome = await uploadProductImage(productId, file);
      if (!outcome.ok) failures.push(outcome.error);
      setProgress({ done: index + 1, total: accepted.length });
    }

    setProgress(null);
    if (fileInput.current) fileInput.current.value = "";

    const added = accepted.length - failures.length;
    const overflowNote =
      overflow > 0 ? ` ${overflow} more did not fit — ${MAX_MEDIA} is the limit.` : "";

    if (failures.length > 0) {
      setStatus({ error: `${failures.join(" ")}${overflowNote}` });
      return;
    }
    setStatus({
      error: null,
      message: `${added} ${added === 1 ? "image" : "images"} added.${overflowNote}`,
    });
  }

  async function replaceFile(mediaId: string, file: File | undefined) {
    if (file === undefined) return;
    setStatus({ error: null });
    setReplacing(mediaId);
    const outcome = await uploadProductImage(productId, file, { replacesMediaId: mediaId });
    setReplacing(null);
    setStatus(outcome.ok ? { error: null, message: "Image replaced." } : { error: outcome.error });
  }

  async function remove(mediaId: string) {
    setStatus({ error: null });
    setReplacing(mediaId);
    await deleteMediaAction(productId, mediaId);
    setReplacing(null);
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

  const disabled = busy || pending;

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-bold text-(--pv-ink)">
          Images{" "}
          <span className="font-normal text-(--pv-muted)">
            — {media.length} of {MAX_MEDIA}
          </span>
        </span>
        <label
          className={cn(
            "inline-flex min-h-11 cursor-pointer items-center rounded-xl border border-(--pv-line) px-4 text-sm font-bold",
            (disabled || room <= 0) && "pointer-events-none opacity-50",
          )}
        >
          {progress === null
            ? "Add images"
            : `Uploading ${Math.min(progress.done + 1, progress.total)} of ${progress.total}…`}
          <input
            ref={fileInput}
            type="file"
            accept={ACCEPTED_MEDIA}
            multiple
            className="sr-only"
            disabled={disabled || room <= 0}
            onChange={(event) => void addFiles(event.target.files)}
          />
        </label>
      </div>

      {room <= 0 ? (
        <p className="text-sm text-(--pv-muted)">
          Remove or replace one before adding another — {MAX_MEDIA} is the limit.
        </p>
      ) : null}

      <div aria-live="polite" className="grid gap-2">
        <FormError message={status.error} />
        <FormSuccess message={status.message} />
      </div>

      {media.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-(--pv-line) p-6 text-center text-sm text-(--pv-muted)">
          No images yet. The first one is what shoppers see on the product card.
        </p>
      ) : (
        /*
          A single scrolling row of small thumbnails, not a wrapping grid — the
          same reasoning as the create screen. A grid grew a new row every few
          images and pushed the variants and the publish button further down the
          page with each one added.
        */
        <ul className="-mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-2">
          {media.map((item, index) => (
            <MediaTile
              key={item.id}
              item={item}
              index={index}
              total={media.length}
              productName={productName}
              disabled={disabled}
              replacing={replacing === item.id}
              onMove={move}
              onReplace={replaceFile}
              onRemove={remove}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function MediaTile({
  item,
  index,
  total,
  productName,
  disabled,
  replacing,
  onMove,
  onReplace,
  onRemove,
}: {
  item: AdminMedia;
  index: number;
  total: number;
  productName: string;
  disabled: boolean;
  replacing: boolean;
  onMove: (index: number, direction: -1 | 1) => void;
  onReplace: (mediaId: string, file: File | undefined) => Promise<void>;
  onRemove: (mediaId: string) => Promise<void>;
}) {
  const position = `image ${index + 1} of ${total}`;

  return (
    <li className="w-36 shrink-0 snap-start rounded-2xl border border-(--pv-line) bg-(--pv-surface) p-2">
      <div className="relative aspect-square overflow-hidden rounded-xl bg-(--pv-wash)">
        {/*
          `card`, not `thumb`, even though the tile is only 144 px wide. `thumb`
          is 200 px, and a 144 px box on a phone at 2x wants 288 px — the source
          would be upscaled and look soft, which is the fault ADR 0012 was
          written about. `sizes` tells the optimiser the real box, so it serves
          roughly 300 px rather than the whole 960 px file.

          The picture is decorative here — every control beside it already names
          which image it acts on — so it takes an empty alt rather than repeating
          the product name five times down the rail.
        */}
        <Image src={item.urls.card} alt="" fill sizes="144px" className="object-cover" />
        {index === 0 ? (
          <span className="absolute top-1 left-1 rounded-full bg-(--pv-red) px-2 py-0.5 text-[11px] font-bold text-(--pv-on-brand)">
            Primary
          </span>
        ) : null}
        {replacing ? (
          <span className="absolute inset-0 grid place-items-center bg-black/55 text-xs font-bold text-white">
            Working…
          </span>
        ) : null}
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-1">
        <div className="flex gap-1">
          <button
            type="button"
            disabled={index === 0 || disabled}
            onClick={() => onMove(index, -1)}
            aria-label={`Move ${productName} ${position} earlier`}
            className="grid h-11 w-11 place-items-center rounded-lg border border-(--pv-line) disabled:opacity-40"
          >
            ←
          </button>
          <button
            type="button"
            disabled={index === total - 1 || disabled}
            onClick={() => onMove(index, 1)}
            aria-label={`Move ${productName} ${position} later`}
            className="grid h-11 w-11 place-items-center rounded-lg border border-(--pv-line) disabled:opacity-40"
          >
            →
          </button>
        </div>
        {/*
          No confirmation step. It used to have one, which cost two taps on a
          phone for an act that is one upload away from being undone — and the
          picture is still in R2 until the reconciliation job runs.
        */}
        <button
          type="button"
          disabled={disabled}
          onClick={() => void onRemove(item.id)}
          aria-label={`Remove ${productName} ${position}`}
          className="grid h-11 w-11 place-items-center rounded-lg border border-(--pv-line) text-(--pv-danger) disabled:opacity-40"
        >
          ×
        </button>
      </div>

      {/* Replace keeps the image's place in the gallery, which is the whole
          reason it exists as its own control: swapping the primary photo for a
          better shot should not send it to the back of the queue. */}
      <label
        className={cn(
          "mt-1 inline-flex min-h-11 w-full cursor-pointer items-center justify-center text-sm font-bold",
          disabled && "pointer-events-none opacity-40",
        )}
      >
        Replace
        <span className="sr-only"> {`${productName} ${position}`}</span>
        <input
          type="file"
          accept={ACCEPTED_MEDIA}
          className="sr-only"
          disabled={disabled}
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            void onReplace(item.id, file);
          }}
        />
      </label>
    </li>
  );
}
