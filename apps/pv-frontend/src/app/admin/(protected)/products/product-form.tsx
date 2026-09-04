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
import { MoneyInput } from "@/components/admin/money-input";
import { formatKobo, parseNairaToKobo } from "@pv/backend/domain/money";

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
  collections,
  memberOfCollectionIds,
  editing,
  submitLabel,
  pickedFiles,
  onPickedFilesChange,
}: {
  action: Action;
  brands: AdminBrand[];
  categories: AdminCategory[];
  devices: AdminDevice[];
  /** Hand-picked home-page sections this product can be placed into. */
  collections: { id: string; title: string }[];
  memberOfCollectionIds?: string[];
  editing?: AdminProduct;
  /** The edit screen's button label. On create the label follows the publish choice. */
  submitLabel?: string;
  /** Present only on create, where images are collected before the product exists. */
  pickedFiles?: PickedFile[];
  onPickedFilesChange?: (next: PickedFile[]) => void;
}) {
  const creating = editing === undefined;
  const collectsMedia = creating && pickedFiles !== undefined && onPickedFilesChange !== undefined;

  const editingCategoryIds = new Set(editing?.categoryIds ?? []);
  const editingDeviceIds = new Set(editing?.deviceIds ?? []);
  const editingCollectionIds = new Set(memberOfCollectionIds ?? []);

  const [values, setValues] = useState<Draft>({
    name: editing?.name ?? "",
    description: editing?.description ?? "",
    brandId: editing?.brandId ?? "",
  });
  /**
   * What pressing the button actually does.
   *
   * This used to have no answer on this screen: creating a product always left
   * it a draft, and nothing on the way through said so until a confirmation
   * screen after the fact. Staff filled in a product, saw it save, and found
   * nothing in the shop — the single loudest complaint about the admin.
   *
   * Publishing is the default because it is what "add a product" means to a
   * shopkeeper. Saving a draft is still one tap away for the half-finished one.
   */
  const [publishNow, setPublishNow] = useState(true);
  /**
   * Mirrored out of `MoneyInput` for the preview only. The field still owns the
   * value and still submits it; without this the preview said "Price on request"
   * over a product whose price had just been typed two fields above it.
   */
  const [priceNaira, setPriceNaira] = useState("");
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

        {/*
          Price and opening stock, on the screen that creates the product.

          These were two further steps afterwards — add a variant, then adjust
          its stock — and both were easy to miss, which is why products read
          "Out of stock" and would not publish. Someone selling one version of a
          thing should not have to learn what a variant is to say what it costs.

          Only on create. On the edit screen the variants section owns both,
          because by then there may be several and a single price field would
          have to pick one to represent.
        */}
        {creating ? (
          <div className="grid gap-4 rounded-2xl border border-(--pv-line) p-4 sm:grid-cols-2">
            <Field
              label="Price (₦)"
              name="priceNaira"
              hint={
                publishNow
                  ? "Required to go live — a shop cannot sell something with no price."
                  : "Leave blank to set it later. A price is needed before it can go live."
              }
            >
              {/*
                Required only when publishing, so the browser blocks the one
                submission that would otherwise fail on the server. Choosing to
                save a draft lifts it again — an unpriced draft is a legitimate
                thing to save.
              */}
              <MoneyInput
                name="priceNaira"
                placeholder="e.g. 25,000"
                required={publishNow}
                onValueChange={setPriceNaira}
              />
            </Field>
            <Field label="Opening stock" name="openingStock" hint="How many you have right now.">
              <TextInput name="openingStock" type="number" min={0} placeholder="e.g. 10" />
            </Field>
          </div>
        ) : null}

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

      {/*
        Where it lands on the public site.

        Categories above decide what the product *is*, and rule-driven home
        sections follow from them automatically. This is the other half: the
        hand-picked collections, which are a merchandising choice and have to be
        made per product. Shown only when the CEO has created a collection to
        put things in, so an unused feature does not add a field to every upload.
      */}
      {collections.length > 0 ? (
        <fieldset>
          <legend className="text-sm font-bold text-(--pv-ink)">Where it appears</legend>
          <p className="mt-1 text-xs text-(--pv-muted)">
            Hand-picked home page sections. Category sections fill themselves from the categories
            above.
          </p>
          <div className="mt-2 grid gap-1.5">
            {collections.map((collection) => (
              <label
                key={collection.id}
                className="flex min-h-11 items-center gap-3 rounded-xl px-1 hover:bg-(--pv-wash)"
              >
                <input
                  type="checkbox"
                  name="collectionIds"
                  value={collection.id}
                  defaultChecked={editingCollectionIds.has(collection.id)}
                  className="h-5 w-5 accent-(--pv-red)"
                />
                <span className="text-sm">{collection.title}</span>
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}

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
          priceLabel={priceLabelFor(priceNaira)}
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

      {creating ? <PublishChoice value={publishNow} onChange={setPublishNow} /> : null}

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

        <SubmitButton
          pendingLabel={creating && publishNow ? "Publishing…" : "Saving…"}
          disabled={mediaMissing}
        >
          {creating ? (publishNow ? "Publish product" : "Save as draft") : (submitLabel ?? "Save")}
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
 * What happens when the button is pressed, decided before it is pressed.
 *
 * Two radios rather than a checkbox: a checkbox states one outcome and leaves
 * the other implied, and the implied one here — "it will not be in the shop" —
 * is exactly the thing that went unsaid and cost the client sales. Both
 * outcomes are written out, and the button below repeats the chosen one.
 *
 * The value is read from the submitted `FormData` by the create screen, so the
 * choice survives without a second piece of state crossing the boundary.
 */
function PublishChoice({ value, onChange }: { value: boolean; onChange: (next: boolean) => void }) {
  const options = [
    {
      publish: true,
      label: "Publish it now",
      detail: "Customers can see and buy it as soon as the pictures finish uploading.",
    },
    {
      publish: false,
      label: "Save as a draft",
      detail: "Only staff can see it. Publish it later from the product itself.",
    },
  ];

  return (
    <fieldset className="grid gap-2 rounded-2xl border border-(--pv-line) p-4">
      <legend className="px-1 text-sm font-bold text-(--pv-ink)">When you press the button</legend>
      {options.map((option) => (
        <label
          key={option.label}
          className="flex min-h-11 items-start gap-3 rounded-xl px-1 py-1.5 hover:bg-(--pv-wash)"
        >
          <input
            type="radio"
            name="publish"
            value={option.publish ? "now" : "later"}
            checked={value === option.publish}
            onChange={() => onChange(option.publish)}
            className="mt-1 h-5 w-5 shrink-0 accent-(--pv-red)"
          />
          <span className="text-sm">
            <span className="block font-bold">{option.label}</span>
            <span className="block text-(--pv-muted)">{option.detail}</span>
          </span>
        </label>
      ))}
    </fieldset>
  );
}

/**
 * What the price on the preview card should read.
 *
 * "Price on request" is what a shopper genuinely sees for a product with no
 * priced variant, so it is the honest empty state rather than a placeholder —
 * but it was shown unconditionally, including over a price that had just been
 * typed. A half-typed or malformed figure falls back to it too: `parseNairaToKobo`
 * is strict by design, and guessing at what somebody meant by "25." on a preview
 * is how a preview stops being worth trusting.
 */
function priceLabelFor(naira: string): string {
  if (naira.trim() === "") return "Price on request";
  try {
    return formatKobo(parseNairaToKobo(naira));
  } catch {
    return "Price on request";
  }
}

/**
 * The pre-publish preview. Uses `ProductCardFace` — the same component the
 * storefront grid renders — so what is shown here is the card, not a mock-up of
 * one.
 */
function PreviewPanel({
  name,
  brandName,
  description,
  priceLabel,
  previewUrl,
  onEdit,
}: {
  name: string;
  brandName: string | null;
  description: string;
  priceLabel: string;
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
              priceLabel={priceLabel}
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
        Colours, sizes and extra pictures are added on the product itself, once it exists.
      </p>
    </section>
  );
}
