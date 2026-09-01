"use client";

import { useActionState, useEffect, useState } from "react";
import type { AdminProduct } from "@pv/backend/services/products";
import type { AdminBrand } from "@pv/backend/services/brands";
import type { AdminCategory } from "@pv/backend/services/categories";
import type { AdminDevice } from "@pv/backend/services/devices";
import {
  Field,
  FormError,
  FormSuccess,
  Select,
  SubmitButton,
  TextArea,
  TextInput,
} from "@/components/admin/form-controls";
import { CARD_SHELL_CLASS, ProductCardFace } from "@/components/product-card";
import { useFormDraft } from "@/lib/use-form-draft";
import { INITIAL_ACTION_STATE, type ActionState } from "@/lib/action-state";
import { MAX_MEDIA, MIN_MEDIA, MediaPicker, type PickedFile } from "./media-picker";

type Action = (prev: ActionState, formData: FormData) => Promise<ActionState>;

type Draft = { name: string; description: string; brandId: string };

/**
 * One screen for a product's core details.
 *
 * Slug is gone: it is derived from the name in the service layer, because staff
 * should not have to know what a slug is and a hand-typed one is a standing
 * source of broken URLs. Summary is gone too — it and Description overlapped,
 * and the card never rendered summary — so there is one prose field, not a
 * decision about which to fill in.
 *
 * On create, images are chosen here and uploaded by the caller once the product
 * row exists; on edit they are managed by `MediaSection` against the saved
 * product, so this form does not show the picker.
 */
export function ProductForm({
  action,
  brands,
  categories,
  devices,
  editing,
  submitLabel,
  pickedFiles,
  onPickedFilesChange,
}: {
  action: Action;
  brands: AdminBrand[];
  categories: AdminCategory[];
  devices: AdminDevice[];
  editing?: AdminProduct;
  submitLabel: string;
  /** Present only on create, where images are collected before the product exists. */
  pickedFiles?: PickedFile[];
  onPickedFilesChange?: (next: PickedFile[]) => void;
}) {
  const creating = editing === undefined;
  const collectsMedia = creating && pickedFiles !== undefined && onPickedFilesChange !== undefined;

  const editingCategoryIds = new Set(editing?.categoryIds ?? []);
  const editingDeviceIds = new Set(editing?.deviceIds ?? []);

  const [values, setValues] = useState<Draft>({
    name: editing?.name ?? "",
    description: editing?.description ?? "",
    brandId: editing?.brandId ?? "",
  });
  const [showPreview, setShowPreview] = useState(false);
  // Until someone types, an unfinished draft is offered rather than applied.
  const [touched, setTouched] = useState(false);
  const [dismissedDraft, setDismissedDraft] = useState(false);

  // Only a new product gets a draft. An edit form is already backed by a saved
  // row, so restoring stale local text over it would quietly undo saved work.
  const draftKey = "pv-draft-product-new";
  const { stored, save, clear } = useFormDraft<Draft>(draftKey, { enabled: creating });

  /**
   * Wraps the action so the local draft is dropped the moment the product is
   * genuinely saved — inside the submit path rather than an effect watching for
   * success, which would fire a render late and could re-save on the way past.
   */
  const [state, formAction] = useActionState(
    async (prev: ActionState, formData: FormData): Promise<ActionState> => {
      const result = await action(prev, formData);
      if (result.error === null) clear();
      return result;
    },
    INITIAL_ACTION_STATE,
  );

  useEffect(() => {
    if (!creating || !touched) return;
    save(values);
  }, [creating, touched, values, save]);

  const mediaCount = pickedFiles?.length ?? 0;
  const mediaMissing = collectsMedia && mediaCount < MIN_MEDIA;

  function update<K extends keyof Draft>(field: K, value: Draft[K]) {
    setTouched(true);
    setValues((current) => ({ ...current, [field]: value }));
  }

  /**
   * Restoring is a choice, not something that happens to you. Silently
   * overwriting a form someone has already started is the behaviour that makes
   * autosave feel unsafe, so the draft is offered and they decide.
   */
  const offerDraft = creating && !touched && !dismissedDraft && stored !== null;

  function restoreDraft() {
    if (stored === null) return;
    setValues((current) => ({
      name: stored.name ?? current.name,
      description: stored.description ?? current.description,
      brandId: stored.brandId ?? current.brandId,
    }));
    setTouched(true);
  }

  function discardDraft() {
    clear();
    setDismissedDraft(true);
  }

  const brandName = brands.find((brand) => brand.id === values.brandId)?.name ?? null;

  return (
    <form action={formAction} className="panel-bracket grid gap-5 p-5">
      {offerDraft ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[color-mix(in_srgb,var(--pv-warning)_35%,var(--pv-line))] bg-[color-mix(in_srgb,var(--pv-warning)_12%,var(--pv-surface))] px-4 py-3 text-sm text-(--pv-warning)">
          <span>You have an unfinished product on this device. Images are not kept.</span>
          <span className="flex gap-2">
            <button type="button" className="button-ghost" onClick={restoreDraft}>
              Restore it
            </button>
            <button type="button" className="button-ghost" onClick={discardDraft}>
              Discard
            </button>
          </span>
        </div>
      ) : null}

      <div className="grid gap-4">
        <Field label="Product name" name="name" hint="The web address is created from this.">
          <TextInput
            name="name"
            required
            maxLength={200}
            value={values.name}
            onChange={(event) => update("name", event.target.value)}
          />
        </Field>

        {collectsMedia ? <MediaPicker files={pickedFiles} onChange={onPickedFilesChange} /> : null}

        <Field
          label="Description"
          name="description"
          hint="Shown on the product page, and used for the search index and the Google result."
        >
          <TextArea
            name="description"
            maxLength={5000}
            value={values.description}
            onChange={(event) => update("description", event.target.value)}
          />
        </Field>

        <Field label="Brand" name="brandId">
          <Select
            name="brandId"
            value={values.brandId}
            onChange={(event) => update("brandId", event.target.value)}
          >
            <option value="">— None —</option>
            {brands.map((brand) => (
              <option key={brand.id} value={brand.id}>
                {brand.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <fieldset>
        <legend className="text-sm font-bold text-(--pv-ink)">Categories</legend>
        <div className="mt-2 grid gap-1.5">
          {categories.map((category) => (
            <label
              key={category.id}
              className="flex min-h-11 items-center gap-3 rounded-xl px-1 hover:bg-(--pv-wash)"
            >
              <input
                type="checkbox"
                name="categoryIds"
                value={category.id}
                defaultChecked={editingCategoryIds.has(category.id)}
                className="h-5 w-5 accent-(--pv-red)"
              />
              <span className="text-sm">
                {category.parentId ? "— " : ""}
                {category.name}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {devices.length > 0 ? (
        <fieldset>
          <legend className="text-sm font-bold text-(--pv-ink)">Fits these devices</legend>
          <p className="mt-1 text-xs text-(--pv-muted)">
            Powers &ldquo;show me what fits my phone&rdquo;. Leave blank if it fits anything.
          </p>
          <div className="mt-2 grid max-h-64 gap-1.5 overflow-y-auto">
            {devices.map((device) => (
              <label
                key={device.id}
                className="flex min-h-11 items-center gap-3 rounded-xl px-1 hover:bg-(--pv-wash)"
              >
                <input
                  type="checkbox"
                  name="deviceIds"
                  value={device.id}
                  defaultChecked={editingDeviceIds.has(device.id)}
                  className="h-5 w-5 accent-(--pv-red)"
                />
                <span className="text-sm">
                  {device.brandName} {device.name}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}

      {showPreview ? (
        <PreviewPanel
          name={values.name}
          brandName={brandName}
          description={values.description}
          previewUrl={pickedFiles?.[0]?.previewUrl ?? null}
          onEdit={() => setShowPreview(false)}
        />
      ) : null}

      <FormError message={state.error} />
      <FormSuccess message={state.message} />

      {mediaMissing ? (
        <p className="text-sm text-(--pv-muted)">
          Add at least one image — up to {MAX_MEDIA} — before creating this product.
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        {collectsMedia && !showPreview ? (
          <button
            type="button"
            className="button-secondary"
            disabled={values.name.trim() === "" || mediaMissing}
            onClick={() => setShowPreview(true)}
          >
            Preview
          </button>
        ) : null}

        <SubmitButton pendingLabel="Saving…" disabled={mediaMissing}>
          {submitLabel}
        </SubmitButton>

        {creating && touched && stored !== null ? (
          <span className="text-xs text-(--pv-muted)" role="status">
            Draft saved on this device
          </span>
        ) : null}
      </div>
    </form>
  );
}

/**
 * The pre-publish preview. Uses `ProductCardFace` — the same component the
 * storefront grid renders — so what is shown here is the card, not a mock-up of
 * one. Price says "Price on request" because variants and their prices are added
 * after the product exists, which is exactly what a shopper would see meanwhile.
 */
function PreviewPanel({
  name,
  brandName,
  description,
  previewUrl,
  onEdit,
}: {
  name: string;
  brandName: string | null;
  description: string;
  previewUrl: string | null;
  onEdit: () => void;
}) {
  return (
    <section
      aria-label="Preview"
      className="grid gap-4 rounded-2xl border border-(--pv-line) bg-(--pv-wash) p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-bold">How this will look to a shopper</h2>
        <button type="button" className="button-ghost" onClick={onEdit}>
          Keep editing
        </button>
      </div>

      <div className="flex flex-wrap gap-6">
        <div className="w-44">
          <div className={CARD_SHELL_CLASS}>
            <ProductCardFace
              name={name || "Untitled product"}
              priceLabel="Price on request"
              outOfStock={false}
              imageSlot={
                previewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={previewUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="grid h-full place-items-center text-xs text-(--pv-muted)">
                    No image yet
                  </div>
                )
              }
            />
          </div>
        </div>

        <dl className="min-w-48 flex-1 text-sm">
          <dt className="font-bold">Brand</dt>
          <dd className="mb-2 text-(--pv-muted)">{brandName ?? "None"}</dd>
          <dt className="font-bold">Description</dt>
          <dd className="text-(--pv-muted)">
            {description.trim() === "" ? "None yet" : description}
          </dd>
        </dl>
      </div>

      <p className="text-xs text-(--pv-muted)">
        Creating it saves a <strong>draft</strong> — nothing is public yet. Add prices and stock on
        the next screen, then publish when you are ready.
      </p>
    </section>
  );
}
