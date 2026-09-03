"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { ACCEPTED_MEDIA, ACCEPTED_MEDIA_TYPES, rejectionReason } from "./upload-image";

export const MIN_MEDIA = 1;
export const MAX_MEDIA = 5;

export { ACCEPTED_MEDIA };

export type PickedFile = { id: string; file: File; previewUrl: string };

/**
 * Picks the product's images before the product exists.
 *
 * Uploading needs a product id — the R2 key is scoped by it — so on the create
 * screen there is nothing to upload *to* yet. Rather than making staff save a
 * product and then come back to add pictures, the files are held in the browser
 * and sent immediately after the product row is created. Nothing touches the
 * network until then, so choosing and re-choosing pictures costs nothing on
 * mobile data.
 *
 * Previews come from `URL.createObjectURL`, which reads the local file and
 * uploads nothing. Every URL created is revoked when it stops being shown —
 * without that, each re-pick leaks the full image into memory for the lifetime
 * of the tab, which on a phone with five 6MB photos is what actually kills it.
 */
export function MediaPicker({
  files,
  onChange,
  disabled,
}: {
  files: PickedFile[];
  onChange: (next: PickedFile[]) => void;
  disabled?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [problem, setProblem] = useState<string | null>(null);

  // Revoke on unmount only. Per-item revocation happens in `remove` and
  // `replace`, because revoking on every `files` change would kill URLs still
  // being rendered. The ref is written in an effect, not during render, so a
  // discarded render pass cannot leave it pointing at files that were never shown.
  const latest = useRef(files);
  useEffect(() => {
    latest.current = files;
  }, [files]);
  useEffect(() => {
    return () => {
      for (const picked of latest.current) URL.revokeObjectURL(picked.previewUrl);
    };
  }, []);

  function add(selected: FileList | null) {
    if (selected === null || selected.length === 0) return;
    setProblem(null);

    const room = MAX_MEDIA - files.length;
    if (room <= 0) {
      setProblem(`You can add up to ${MAX_MEDIA} images.`);
      return;
    }

    const incoming = Array.from(selected);
    // The same rules the upload path applies, applied here so a file that was
    // never going to be accepted is refused before anything is chosen at all.
    const refusals = incoming.map(rejectionReason).filter((reason) => reason !== null);
    const accepted = incoming.filter((file) => rejectionReason(file) === null);

    if (refusals.length > 0) setProblem(refusals.join(" "));
    if (accepted.length > room) {
      setProblem(`Only the first ${room} of those fit — the limit is ${MAX_MEDIA} images.`);
    }

    onChange([
      ...files,
      ...accepted.slice(0, room).map((file) => ({
        id: crypto.randomUUID(),
        file,
        previewUrl: URL.createObjectURL(file),
      })),
    ]);
    if (input.current) input.current.value = "";
  }

  function remove(id: string) {
    const target = files.find((picked) => picked.id === id);
    if (target) URL.revokeObjectURL(target.previewUrl);
    onChange(files.filter((picked) => picked.id !== id));
    setProblem(null);
  }

  /**
   * Swaps one chosen file for another, in place.
   *
   * Nothing has been uploaded yet, so this is a straight substitution — but the
   * old preview URL still has to be revoked, or the discarded photo stays in
   * memory for as long as the tab is open.
   */
  function replace(id: string, file: File | undefined) {
    if (file === undefined) return;
    const refusal = rejectionReason(file);
    if (refusal !== null) {
      setProblem(refusal);
      return;
    }
    setProblem(null);
    onChange(
      files.map((picked) => {
        if (picked.id !== id) return picked;
        URL.revokeObjectURL(picked.previewUrl);
        return { ...picked, file, previewUrl: URL.createObjectURL(file) };
      }),
    );
  }

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= files.length) return;
    const next = [...files];
    const moved = next[index]!;
    next[index] = next[target]!;
    next[target] = moved;
    onChange(next);
  }

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-bold text-(--pv-ink)">
          Images <span className="font-normal text-(--pv-muted)">— at least one, up to five</span>
        </span>
        <label
          className={cn(
            "inline-flex min-h-11 cursor-pointer items-center rounded-xl border border-(--pv-line) px-4 text-sm font-bold",
            (disabled || files.length >= MAX_MEDIA) && "pointer-events-none opacity-50",
          )}
        >
          Add images
          <input
            ref={input}
            type="file"
            accept={ACCEPTED_MEDIA_TYPES.join(",")}
            multiple
            className="sr-only"
            disabled={disabled || files.length >= MAX_MEDIA}
            onChange={(event) => add(event.target.files)}
          />
        </label>
      </div>

      {problem ? (
        <p role="alert" className="text-sm font-semibold text-(--pv-danger)">
          {problem}
        </p>
      ) : null}

      {files.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-(--pv-line) p-6 text-center text-sm text-(--pv-muted)">
          No images chosen yet. The first one is what shoppers see on the product card.
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
          {files.map((picked, index) => (
            <li
              key={picked.id}
              className="rounded-2xl border border-(--pv-line) bg-(--pv-surface) p-2"
            >
              <div className="relative aspect-square overflow-hidden rounded-xl bg-(--pv-wash)">
                {/*
                  A blob: URL of a file the user just chose — next/image would
                  try to run it through the optimiser, which cannot fetch it.
                */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={picked.previewUrl}
                  alt={`Selected image ${index + 1}: ${picked.file.name}`}
                  className="h-full w-full object-cover"
                />
                {index === 0 ? (
                  <span className="absolute top-1 left-1 rounded-full bg-(--pv-red) px-2 py-0.5 text-[11px] font-bold text-(--pv-on-brand)">
                    Primary
                  </span>
                ) : null}
              </div>

              <div className="mt-2 flex items-center justify-between gap-1">
                <div className="flex gap-1">
                  <button
                    type="button"
                    disabled={index === 0 || disabled}
                    onClick={() => move(index, -1)}
                    aria-label={`Move ${picked.file.name} earlier`}
                    className="grid h-11 w-11 place-items-center rounded-lg border border-(--pv-line) disabled:opacity-40"
                  >
                    ←
                  </button>
                  <button
                    type="button"
                    disabled={index === files.length - 1 || disabled}
                    onClick={() => move(index, 1)}
                    aria-label={`Move ${picked.file.name} later`}
                    className="grid h-11 w-11 place-items-center rounded-lg border border-(--pv-line) disabled:opacity-40"
                  >
                    →
                  </button>
                </div>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => remove(picked.id)}
                  aria-label={`Remove ${picked.file.name}`}
                  className="grid h-11 w-11 place-items-center rounded-lg border border-(--pv-line) text-(--pv-danger) disabled:opacity-40"
                >
                  ×
                </button>
              </div>

              {/* Swapping one photo for a better one should not mean removing it
                  and re-adding it at the back of the queue. */}
              <label
                className={cn(
                  "mt-1 inline-flex min-h-11 w-full cursor-pointer items-center justify-center text-sm font-bold",
                  disabled && "pointer-events-none opacity-40",
                )}
              >
                Replace
                <span className="sr-only"> {picked.file.name}</span>
                <input
                  type="file"
                  accept={ACCEPTED_MEDIA_TYPES.join(",")}
                  className="sr-only"
                  disabled={disabled}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    replace(picked.id, file);
                  }}
                />
              </label>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
