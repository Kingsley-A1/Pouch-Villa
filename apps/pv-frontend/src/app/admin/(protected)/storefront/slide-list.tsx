"use client";

import { useState, useTransition } from "react";
import { ArrowDown, ArrowUp } from "@phosphor-icons/react";
import type { AdminHeroSlide } from "@pv/backend/services/hero-slides";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { SlideForm } from "./slide-form";
import { SlideImageField } from "./slide-image-field";
import { deleteSlideAction, moveSlideAction, setSlideActiveAction } from "./slide-actions";

/**
 * The hero deck, managed the same way the sections below it are.
 *
 * It sits above the section list on the same page rather than getting a nav
 * entry of its own: both are "what the home page shows", the permission is the
 * same, and a second screen for four fields would be a second place to look.
 */
export function SlideList({ slides }: { slides: AdminHeroSlide[] }) {
  const [editingId, setEditingId] = useState<string | "new" | null>(null);

  const renderable = slides.filter((slide) => slide.isActive && slide.image !== null).length;

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">Hero slides</h2>
          <p className="mt-1 max-w-2xl text-sm text-(--pv-muted)">
            The photographs at the very top of the home page. A slide appears only once it is
            switched on and has a picture; where none qualifies, the home page opens with your
            headline from Settings instead.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setEditingId(editingId === "new" ? null : "new")}
          className="min-h-11 rounded-xl border border-(--pv-line) px-4 text-sm font-bold"
        >
          {editingId === "new" ? "Cancel" : "Add slide"}
        </button>
      </div>

      {editingId === "new" ? <SlideForm onDone={() => setEditingId(null)} /> : null}

      {slides.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-(--pv-line) p-6 text-sm text-(--pv-muted)">
          No slides yet. The home page opens with the headline set in Settings.
        </p>
      ) : (
        <>
          {renderable === 0 ? (
            // Said once, at the top, because every individual row already says
            // why it is not showing — repeating it per row would be noise.
            <p className="rounded-2xl border border-(--pv-warning)/40 bg-(--pv-wash) p-4 text-sm text-(--pv-warning)">
              None of these slides will appear yet: each one needs to be switched on and to have a
              photograph.
            </p>
          ) : null}
          <ul className="grid gap-3">
            {slides.map((slide, index) => (
              <li key={slide.id}>
                <SlideRow
                  slide={slide}
                  isFirst={index === 0}
                  isLast={index === slides.length - 1}
                  editing={editingId === slide.id}
                  onToggleEdit={() => setEditingId(editingId === slide.id ? null : slide.id)}
                  onDone={() => setEditingId(null)}
                />
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function SlideRow({
  slide,
  isFirst,
  isLast,
  editing,
  onToggleEdit,
  onDone,
}: {
  slide: AdminHeroSlide;
  isFirst: boolean;
  isLast: boolean;
  editing: boolean;
  onToggleEdit: () => void;
  onDone: () => void;
}) {
  const [pending, start] = useTransition();

  return (
    <div className="rounded-2xl border border-(--pv-line) bg-(--pv-surface) p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 font-bold">
            {slide.headline}
            {!slide.isActive ? (
              <span className="rounded-full bg-(--pv-wash) px-2 py-0.5 text-xs font-bold text-(--pv-muted)">
                Hidden
              </span>
            ) : null}
          </p>
          {slide.kicker === null ? null : (
            <p className="mt-0.5 text-sm text-(--pv-muted)">{slide.kicker}</p>
          )}
          <p
            className={`mt-1 text-xs ${slide.image === null ? "text-(--pv-warning)" : "text-(--pv-muted)"}`}
          >
            {slide.image === null ? "No photograph — will not appear" : "Ready"} ·{" "}
            {slide.ctaLabel ?? "Shop now"} → {slide.href}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <MoveButton
            label="Move up"
            disabled={isFirst || pending}
            onClick={() => start(() => moveSlideAction(slide.id, "up"))}
          >
            <ArrowUp aria-hidden="true" size={17} />
          </MoveButton>
          <MoveButton
            label="Move down"
            disabled={isLast || pending}
            onClick={() => start(() => moveSlideAction(slide.id, "down"))}
          >
            <ArrowDown aria-hidden="true" size={17} />
          </MoveButton>
        </div>
      </div>

      <div className="mt-3">
        <SlideImageField slide={slide} />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-4">
        <button type="button" onClick={onToggleEdit} className="text-sm font-bold">
          {editing ? "Close" : "Edit"}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => start(() => setSlideActiveAction(slide.id, !slide.isActive))}
          className="text-sm font-bold"
        >
          {slide.isActive ? "Hide from home page" : "Show on home page"}
        </button>
        <ConfirmButton
          label="Remove"
          onConfirm={async () => {
            await deleteSlideAction(slide.id, "Removed from the admin storefront screen");
          }}
        />
      </div>

      {editing ? (
        <div className="mt-3">
          <SlideForm editing={slide} onDone={onDone} />
        </div>
      ) : null}
    </div>
  );
}

function MoveButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="grid h-11 w-11 place-items-center rounded-xl border border-(--pv-line) disabled:opacity-40"
    >
      {children}
    </button>
  );
}
