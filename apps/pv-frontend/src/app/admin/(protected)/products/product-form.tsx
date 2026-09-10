"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import type { AdminProduct } from "@pv/backend/services/products";
import type { AdminBrand } from "@pv/backend/services/brands";
import type { AdminCategory } from "@pv/backend/services/categories";
import type { AdminDevice, AdminDeviceLine } from "@pv/backend/services/devices";
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
import { groupByDeviceClass } from "@pv/backend/domain/device-groups";

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
  deviceLines,
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
  /** The device classes staff have set up, for narrowing the model list. */
  deviceLines: AdminDeviceLine[];
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

  const editingCollectionIds = new Set(memberOfCollectionIds ?? []);
  // Memoised because `hiddenTicks` depends on it: a fresh Set every render
  // would recompute that on every keystroke in the name field.
  const editingDeviceIds = useMemo(() => new Set(editing?.deviceIds ?? []), [editing?.deviceIds]);

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
  /**
   * Which class of the chosen make the model list is narrowed to.
   *
   * A filter, not a field. It is never submitted and the product carries no
   * class of its own — the product is filed under a make, and the class only
   * decides how much of that make's model list is on screen while somebody
   * ticks boxes.
   */
  const [deviceClassId, setDeviceClassId] = useState("");
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
    // A class belongs to one make, so changing the make has to drop the filter.
    // Otherwise an iPad filter survives a switch to Samsung and empties the list.
    if (field === "brandId") setDeviceClassId("");
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

  /*
    The section this product belongs to, and the question that reshapes the form.

    A pouch is defined by what it fits, so its section asks for a make, a class
    and the models it goes on. An accessory is defined by what it *is* — a power
    bank is a power bank whatever phone you own — so its section asks for a type
    instead and never mentions a device.

    Which is which is read from the category, never from its name: AGENTS.md
    section 4 forbids a category list in source, and a rule keyed on
    "Accessories" would break the day the client renames it.
  */
  const sections = useMemo(
    () => categories.filter((category) => category.parentId === null),
    [categories],
  );

  const [sectionId, setSectionId] = useState(() => {
    const filed = new Set(editing?.categoryIds ?? []);
    return categories.find((c) => c.parentId === null && filed.has(c.id))?.id ?? "";
  });
  const [typeId, setTypeId] = useState(() => {
    const filed = new Set(editing?.categoryIds ?? []);
    return categories.find((c) => c.parentId !== null && filed.has(c.id))?.id ?? "";
  });

  function chooseSection(next: string) {
    setSectionId(next);
    // A type belongs to one section, so it cannot survive a move to another.
    setTypeId("");
  }

  const section = sections.find((candidate) => candidate.id === sectionId) ?? null;
  // No section chosen yet keeps the device fields, which is the shape this form
  // had before sections existed — the safe default for a half-filled form.
  const fitsDevices = section === null ? true : section.fitsDevices;

  const typesForSection = useMemo(
    () => categories.filter((category) => category.parentId === sectionId),
    [categories, sectionId],
  );

  const brandName = brands.find((brand) => brand.id === values.brandId)?.name ?? null;

  /** The chosen make's device classes, for the filter below the brand field. */
  const classesForBrand = useMemo(
    () => deviceLines.filter((line) => line.brandId === values.brandId),
    [deviceLines, values.brandId],
  );

  /**
   * The models a shopper could be buying this for.
   *
   * **Narrowed to the make on the product, not merely sorted by it.** Offering
   * every make at once means offering every model the shop knows, which turned
   * this section into a scroll rather than a choice — and the boxes that matter
   * are always the ones for the make being filed.
   *
   * With no make chosen there is nothing to narrow by, so everything is offered.
   * That is the deliberate escape: a universal pouch, or one from an accessory
   * maker that fits other people's phones, is filed under no make and can still
   * be ticked against anything.
   *
   * `listAllDevices` already returns brand, then class, then model order, so
   * this splits the run and never re-sorts — re-sorting here would override the
   * arrangement made on the classes screen.
   */
  const shownDevices = useMemo(() => {
    const forBrand =
      values.brandId === ""
        ? devices
        : devices.filter((device) => device.brandId === values.brandId);
    if (deviceClassId === "") return forBrand;
    return forBrand.filter((device) => device.lineId === deviceClassId);
  }, [devices, values.brandId, deviceClassId]);

  const shownByClass = useMemo(() => groupByDeviceClass(shownDevices), [shownDevices]);

  /**
   * Saved compatibility for models the filter is currently hiding.
   *
   * An unchecked box posts nothing, so without carrying these forward as hidden
   * inputs, editing a product and then narrowing the list would silently delete
   * every tick outside the filter. Only bites on edit — a new product has
   * nothing saved yet.
   */
  const hiddenTicks = useMemo(() => {
    const visible = new Set(shownDevices.map((device) => device.id));
    return [...editingDeviceIds].filter((deviceId) => !visible.has(deviceId));
  }, [shownDevices, editingDeviceIds]);

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

        {/*
          Make, class and device fit belong to a section whose products are
          chosen by what they go on. An accessory section hides all three rather
          than showing them greyed out: a power bank has no make in the sense
          this field means, and three fields nobody can answer is how a form
          teaches staff to guess.
        */}
        {fitsDevices ? (
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
        ) : null}

        {/*
          The make's device classes, appearing the moment a make that has any is
          chosen.

          Unnamed, because it is not submitted: the product has no class of its
          own, and this narrows the model list further down. A make with no
          classes gets no control at all rather than an empty select — the same
          rule the storefront follows, so a tier nobody filled in never shows up
          as a thing to choose.
        */}
        {/*
          Said, rather than left as an absence.

          Hiding the make and the model list is right for an accessory, but on
          edit it also means saving clears whatever was recorded — an unchecked
          box and an unrendered select both post nothing. That is the correct
          outcome for a product that has been moved into a section where device
          fit has no meaning, and it must not be the kind of thing a person finds
          out afterwards.
        */}
        {!fitsDevices ? (
          <p className="help sm:col-span-2">
            No make or device list: this section is browsed by type. Anything previously recorded
            against a device is cleared when you save.
          </p>
        ) : null}

        {fitsDevices && classesForBrand.length > 0 ? (
          <Field
            label="Device class"
            name="deviceClassFilter"
            hint="Narrows the models below. Not saved on the product."
          >
            {/*
              A raw select, not the shared `Select`, which derives its id from
              its `name`. This control has no name on purpose — the same rule the
              storefront finder follows for its brand select — so it needs to
              carry its own id for the label to reach it.
            */}
            <select
              id="deviceClassFilter"
              value={deviceClassId}
              onChange={(event) => setDeviceClassId(event.target.value)}
              className="field min-h-11 w-full"
            >
              <option value="">All classes</option>
              {classesForBrand.map((line) => (
                <option key={line.id} value={line.id}>
                  {line.name}
                </option>
              ))}
            </select>
          </Field>
        ) : null}
      </div>

      {/*
        Where it goes, as two questions rather than a list of tickboxes.

        The old control was every category at once, top level and children mixed,
        and it left the filing of a product to whoever happened to be ticking. A
        section and a type is the shop's own shape and it is what decides which
        fields above are even asked for.

        Both post `categoryIds`, so the product still lands in the same
        many-to-many rows and nothing downstream changes.
      */}
      {/*
        Nothing at all where the shop has no top-level category yet.

        Not rendered, rather than hidden. A required select with one empty option
        is a box that cannot be answered and blocks the form outright — a shop
        setting itself up would be unable to add its first product — and one left
        in the markup would post an empty string as a category id. The same rule
        the device class and the collections follow: a tier nobody has filled in
        never becomes a field.
      */}
      {sections.length > 0 ? (
        <fieldset className="grid gap-3 sm:grid-cols-2">
          <legend className="sr-only">Where it goes</legend>

          <Field label="Section" name="categoryIds">
            <Select
              name="categoryIds"
              required
              value={sectionId}
              onChange={(event) => chooseSection(event.target.value)}
            >
              <option value="">— Choose —</option>
              {sections.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.name}
                </option>
              ))}
            </Select>
          </Field>

          {/*
          Only for a section browsed by type, and only where it has types to
          offer. Device fit and a type are the two shapes this form asks for
          and they do not mix on one product — Pouches manages models under
          Admin → Devices, never types, so the field does not appear there even
          if a stray child category exists from before this rule. A by-type
          section with no types yet is filed by section alone, the same rule
          the device class follows: a tier nobody has filled in never becomes
          an empty box.
        */}
          {!fitsDevices && typesForSection.length > 0 ? (
            <Field label="Type" name="typeCategoryId">
              <select
                id="typeCategoryId"
                name="categoryIds"
                value={typeId}
                required
                onChange={(event) => setTypeId(event.target.value)}
                className="field min-h-11 w-full"
              >
                <option value="">— None —</option>
                {typesForSection.map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>
                    {candidate.name}
                  </option>
                ))}
              </select>
            </Field>
          ) : null}
        </fieldset>
      ) : null}

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

      {fitsDevices && devices.length > 0 ? (
        <fieldset>
          <legend className="text-sm font-bold text-(--pv-ink)">Fits these devices</legend>
          <p className="mt-1 text-xs text-(--pv-muted)">
            Powers &ldquo;show me what fits my device&rdquo;. Leave blank if it fits anything.
          </p>
          {/*
            A tick on a model the filter has since hidden is still submitted, as
            a hidden input. Without this, narrowing to iPad after ticking an
            iPhone would silently un-tick it: an unchecked box posts nothing, so
            the compatibility would be lost with nothing on screen to say so.
          */}
          {hiddenTicks.map((deviceId) => (
            <input key={deviceId} type="hidden" name="deviceIds" value={deviceId} />
          ))}

          {/*
            Narrowed to the make chosen above, then to the class if one is
            picked. Offering every make at once meant offering every model the
            shop knows, which made this a scroll rather than a choice.

            Where the make has nothing recorded the section says so and names
            the screen that fixes it, rather than showing an empty box that
            reads as a fault in the form.
          */}
          {shownDevices.length === 0 ? (
            <p className="mt-2 rounded-xl border border-dashed border-(--pv-line) p-4 text-xs text-(--pv-muted)">
              {brandName === null
                ? "No devices recorded yet. Add them under Devices."
                : `No ${brandName} models are recorded yet. Add them under Devices, or leave this blank if the product fits anything.`}
            </p>
          ) : (
            <div className="mt-2 grid max-h-72 gap-1 overflow-y-auto">
              {shownByClass.map(({ lineName, devices: models }) => (
                <div key={lineName ?? "unfiled"} className="grid gap-1">
                  {/* Only where the make has classes, and only while more than
                      one is on screen — a heading above the single class
                      somebody just filtered to says nothing. */}
                  {lineName === null || shownByClass.length < 2 ? null : (
                    <p className="sticky top-0 bg-(--pv-surface) pt-2 text-xs font-bold tracking-[.08em] text-(--pv-muted) uppercase">
                      {lineName}
                    </p>
                  )}
                  {models.map((device) => (
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
                      {/* The make is already on the field above, so repeating it
                          on thirty rows is noise. With no make chosen the list
                          spans them all and needs it. */}
                      <span className="text-sm">
                        {values.brandId === "" ? `${device.brandName} ${device.name}` : device.name}
                      </span>
                    </label>
                  ))}
                </div>
              ))}
            </div>
          )}
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
