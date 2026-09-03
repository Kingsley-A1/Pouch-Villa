"use client";

import { useRef, useState, useTransition } from "react";
import Image from "next/image";
import type { AdminMedia } from "@pv/backend/services/media";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { FormError, FormSuccess } from "@/components/admin/form-controls";
import { cn } from "@/lib/utils";
import { MAX_MEDIA } from "./media-picker";
import { ACCEPTED_MEDIA, uploadProductImage } from "./upload-image";
import { deleteMediaAction, reorderMediaAction, updateMediaAltAction } from "./media-actions";

/**
 * The product's images, after the product exists.
 *
 * Uploads go browser → R2 directly using a short-lived pre-signed URL, so a
 * large photo on mobile data never has to travel through the app server. Only
 * after the bytes are in R2 does the server fetch them back to validate, strip
 * EXIF and build the derivatives.
 *
 * Several files can be chosen at once — the backend has always allowed up to
 * `MAX_MEDIA` and this screen used to take only the first of a selection. They
 * are sent one after another rather than in parallel: five concurrent
 * multi-megabyte PUTs on a mobile connection contend with each other and are
 * likelier to time out than the same five sent in sequence.
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

  async function replaceFile(mediaId: string, file: File | undefined, alt: string | null) {
    if (file === undefined) return;
    setStatus({ error: null });
    setReplacing(mediaId);
    // The existing description is carried over: replacing a photo with a better
    // shot of the same thing should not silently discard the sentence someone
    // wrote about it.
    const outcome = await uploadProductImage(productId, file, { replacesMediaId: mediaId, alt });
    setReplacing(null);
    setStatus(outcome.ok ? { error: null, message: "Image replaced." } : { error: outcome.error });
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
        <h2 className="text-lg font-bold">
          Images{" "}
          <span className="text-sm font-normal text-(--pv-muted)">
            {media.length} of {MAX_MEDIA}
          </span>
        </h2>
        {/* The same cap the create screen applies, so the limit does not depend
            on which route the product was added through. */}
        <label
          className={cn(
            "inline-flex min-h-11 cursor-pointer items-center rounded-xl border border-(--pv-line) px-4 text-sm font-bold",
            (busy || room <= 0) && "pointer-events-none opacity-50",
          )}
        >
          {progress === null
            ? "Add images"
            : `Uploading ${progress.done + 1} of ${progress.total}…`}
          <input
            ref={fileInput}
            type="file"
            accept={ACCEPTED_MEDIA}
            multiple
            className="sr-only"
            disabled={busy || room <= 0}
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
        <p className="rounded-2xl border border-dashed border-(--pv-line) p-6 text-sm text-(--pv-muted)">
          No images yet. The first image is the one shoppers see on the product card.
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {media.map((item, index) => (
            <MediaCard
              key={item.id}
              productId={productId}
              item={item}
              index={index}
              total={media.length}
              busy={busy || pending}
              replacing={replacing === item.id}
              onMove={move}
              onReplace={replaceFile}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function MediaCard({
  productId,
  item,
  index,
  total,
  busy,
  replacing,
  onMove,
  onReplace,
}: {
  productId: string;
  item: AdminMedia;
  index: number;
  total: number;
  busy: boolean;
  replacing: boolean;
  onMove: (index: number, direction: -1 | 1) => void;
  onReplace: (mediaId: string, file: File | undefined, alt: string | null) => Promise<void>;
}) {
  const [alt, setAlt] = useState(item.alt ?? "");
  const [savingAlt, startAlt] = useTransition();
  const [altSaved, setAltSaved] = useState(false);

  return (
    <li className="grid gap-3 rounded-2xl border border-(--pv-line) bg-(--pv-surface) p-3">
      <div className="relative aspect-square overflow-hidden rounded-xl bg-(--pv-wash)">
        {/*
          `card`, not `thumb`: this tile renders up to 90vw on a phone, which at
          2x device pixels wants more than `thumb`'s 200px. `thumb` is sized for
          the storefront's small gallery rail, not this preview.
        */}
        <Image
          src={item.urls.card}
          alt={item.alt ?? ""}
          fill
          sizes="(max-width: 640px) 90vw, 300px"
          className="object-cover"
        />
        {index === 0 ? (
          <span className="absolute top-2 left-2 rounded-full bg-(--pv-red) px-2 py-0.5 text-xs font-bold text-(--pv-on-brand)">
            Primary
          </span>
        ) : null}
        {replacing ? (
          <span className="absolute inset-0 grid place-items-center bg-black/55 text-sm font-bold text-white">
            Replacing…
          </span>
        ) : null}
      </div>

      {/*
        Alt text is a sentence about the photograph, and nobody writes a good one
        while five files are uploading — so it is editable here rather than
        captured at upload. This screen used to store the *filename* as the alt
        text, which reads to a screen reader as "IMG 4021 dot jpeg".
      */}
      <label className="grid gap-1">
        <span className="text-xs font-bold text-(--pv-muted)">Description, for screen readers</span>
        <input
          value={alt}
          disabled={busy}
          maxLength={200}
          placeholder="e.g. Red leather pouch, front view"
          className="field min-h-11"
          onChange={(event) => {
            setAlt(event.target.value);
            setAltSaved(false);
          }}
          onBlur={() => {
            if (alt === (item.alt ?? "")) return;
            startAlt(async () => {
              await updateMediaAltAction(productId, item.id, alt);
              setAltSaved(true);
            });
          }}
        />
        <span className="text-xs text-(--pv-muted)">
          {savingAlt ? "Saving…" : altSaved ? "Saved." : "Leave blank if it shows nothing useful."}
        </span>
      </label>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1">
          <button
            type="button"
            disabled={index === 0 || busy}
            onClick={() => onMove(index, -1)}
            aria-label={`Move image ${index + 1} earlier`}
            className="grid h-11 w-11 place-items-center rounded-lg border border-(--pv-line) disabled:opacity-40"
          >
            ←
          </button>
          <button
            type="button"
            disabled={index === total - 1 || busy}
            onClick={() => onMove(index, 1)}
            aria-label={`Move image ${index + 1} later`}
            className="grid h-11 w-11 place-items-center rounded-lg border border-(--pv-line) disabled:opacity-40"
          >
            →
          </button>
        </div>

        <div className="flex items-center gap-3">
          {/*
            Replace keeps the image's place in the gallery, which is the whole
            reason it exists as its own control: swapping the primary photo for a
            better shot should not send it to the back of the queue.
          */}
          <label
            className={cn(
              "inline-flex min-h-11 cursor-pointer items-center text-sm font-bold text-(--pv-ink)",
              busy && "pointer-events-none opacity-40",
            )}
          >
            Replace
            <span className="sr-only"> image {index + 1}</span>
            <input
              type="file"
              accept={ACCEPTED_MEDIA}
              className="sr-only"
              disabled={busy}
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                void onReplace(item.id, file, item.alt);
              }}
            />
          </label>

          <ConfirmButton
            label="Remove"
            confirmLabel="Remove"
            onConfirm={async () => {
              await deleteMediaAction(productId, item.id);
            }}
          />
        </div>
      </div>
    </li>
  );
}
