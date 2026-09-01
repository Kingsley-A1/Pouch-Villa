"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Star, X } from "@phosphor-icons/react";
import { ProgressiveDisclosure } from "@/components/progressive-disclosure";

/**
 * Leaving a review without leaving the page.
 *
 * This is the client's Q2 ask, almost verbatim: _"If a review can be completed
 * in the home page with the via a clean modal, that have its input field in a
 * progressive screen, lets not force users to go the review page before the can
 * air thier view."_ So there is no `/review` route — the rating is the whole
 * first step, and the rest appears only once a star is chosen.
 *
 * No sign-in wall, per Q9 and ADR 0005. Everything submitted is held for
 * approval, so nothing a stranger types reaches the storefront unread.
 */
export function ReviewModal({
  productId,
  productName,
}: {
  productId: string;
  productName: string;
}) {
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    // Focus moves into the dialog on open and Escape closes it — a modal that
    // traps a keyboard user is an accessibility failure, not a detail.
    closeRef.current?.focus();

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
      if (event.key !== "Tab") return;

      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (focusable === undefined || focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (first === undefined || last === undefined) return;

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  async function submit(formData: FormData) {
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/v1/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId,
          rating,
          authorName: formData.get("authorName"),
          authorEmail: formData.get("authorEmail") || null,
          title: formData.get("title") || null,
          body: formData.get("body"),
        }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error?.message ?? "That review could not be sent.");
      }
      setDone(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "That review could not be sent.");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <button type="button" className="button-ghost" onClick={() => setOpen(true)}>
        <Star size={18} weight="bold" /> Write a review
      </button>

      {open && typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed inset-0 z-50 grid place-items-end bg-black/45 p-0 sm:place-items-center sm:p-4"
              onMouseDown={(event) => {
                if (event.target === event.currentTarget) setOpen(false);
              }}
            >
              <div
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby="review-modal-title"
                className="max-h-[90dvh] w-full overflow-y-auto rounded-t-3xl bg-(--pv-surface) p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:max-w-lg sm:rounded-3xl"
              >
                <div className="flex items-start justify-between gap-4">
                  <h2 id="review-modal-title" className="text-lg font-bold">
                    {done ? "Thank you" : `Review ${productName}`}
                  </h2>
                  <button
                    ref={closeRef}
                    type="button"
                    onClick={() => setOpen(false)}
                    className="grid h-11 w-11 flex-none place-items-center rounded-xl hover:bg-(--pv-wash)"
                    aria-label="Close"
                  >
                    <X size={20} />
                  </button>
                </div>

                {done ? (
                  <p className="mt-3 text-sm">
                    Your review has been sent. It will appear on this page once it has been checked.
                  </p>
                ) : (
                  <form action={submit} className="mt-4">
                    <fieldset>
                      <legend className="label">How was it?</legend>
                      <div className="mt-1 flex gap-1">
                        {[1, 2, 3, 4, 5].map((value) => (
                          <button
                            key={value}
                            type="button"
                            onClick={() => setRating(value)}
                            className="grid h-11 w-11 place-items-center rounded-xl hover:bg-(--pv-wash)"
                            aria-label={`${value} ${value === 1 ? "star" : "stars"}`}
                            aria-pressed={rating === value}
                          >
                            <Star
                              size={26}
                              weight={value <= rating ? "fill" : "regular"}
                              className={value <= rating ? "text-(--pv-red)" : "text-(--pv-muted)"}
                            />
                          </button>
                        ))}
                      </div>
                      {/* The rating is also stated in words, because colour and a
                          filled icon alone do not carry meaning (WCAG 2.2 AA). */}
                      <p className="help mt-1" aria-live="polite">
                        {rating === 0
                          ? "Choose a rating to continue"
                          : `${rating} out of 5 selected`}
                      </p>
                    </fieldset>

                    {/* The rest of the form only exists once a rating is chosen —
                        the "progressive screen" the client asked for. */}
                    <ProgressiveDisclosure open={rating > 0} className="mt-4">
                      <div className="grid gap-4">
                        <div>
                          <label className="label" htmlFor="review-name">
                            Your name
                          </label>
                          <input
                            id="review-name"
                            name="authorName"
                            className="field"
                            required={rating > 0}
                            maxLength={120}
                          />
                        </div>

                        <div>
                          <label className="label" htmlFor="review-body">
                            What should other people know?
                          </label>
                          <textarea
                            id="review-body"
                            name="body"
                            className="field"
                            rows={4}
                            required={rating > 0}
                            maxLength={4000}
                          />
                        </div>

                        <div>
                          <label className="label" htmlFor="review-email">
                            Email (optional)
                          </label>
                          <input
                            id="review-email"
                            name="authorEmail"
                            type="email"
                            className="field"
                            maxLength={320}
                            aria-describedby="review-email-help"
                          />
                          <p className="help mt-1" id="review-email-help">
                            Only so we can tell if you bought this. Never shown.
                          </p>
                        </div>

                        <button type="submit" className="button-primary" disabled={pending}>
                          {pending ? "Sending…" : "Send review"}
                        </button>

                        <p className="help">Reviews are checked before they appear.</p>
                      </div>
                    </ProgressiveDisclosure>

                    {error ? (
                      <p className="mt-3 text-sm text-(--pv-danger)" role="alert">
                        {error}
                      </p>
                    ) : null}
                  </form>
                )}
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
