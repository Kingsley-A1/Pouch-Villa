"use client";

import { useActionState, useState } from "react";
import type { AdminDeviceLine } from "@pv/backend/services/devices";
import type { AdminBrand } from "@pv/backend/services/brands";
import {
  Field,
  FormError,
  FormSuccess,
  Select,
  SubmitButton,
  TextInput,
} from "@/components/admin/form-controls";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { INITIAL_ACTION_STATE } from "@/lib/action-state";
import { saveDeviceLineAction, deleteDeviceLineAction } from "./actions";

/**
 * Device classes: the tier between a make and a model.
 *
 * Apple sells iPhones and iPads; Samsung sells Galaxy phones and Galaxy Tabs.
 * Without this, a brand's models are one flat list, which is fine at five and
 * unreadable at thirty.
 *
 * Entirely optional, per brand. A brand with no classes behaves exactly as it
 * did — its models flat, everywhere they are shown — so nobody has to sort the
 * whole catalogue before they can save a device.
 */
export function DeviceLineForm({
  brands,
  editing,
  onDone,
}: {
  brands: AdminBrand[];
  editing?: AdminDeviceLine;
  onDone?: () => void;
}) {
  const [state, formAction] = useActionState(saveDeviceLineAction, INITIAL_ACTION_STATE);

  return (
    <form
      action={async (formData) => {
        await formAction(formData);
        onDone?.();
      }}
      className="grid gap-3 rounded-2xl border border-(--pv-line) bg-(--pv-surface) p-4"
    >
      {editing ? <input type="hidden" name="id" value={editing.id} /> : null}
      {/*
        `id` is set apart from `name` on all three, and that is load-bearing.

        The device form on this same screen also has a Brand select and a Sort
        order box, and both forms can be open at once — so sharing the
        name-derived id would put duplicate ids on the page and let a label focus
        the other form's control. The names stay as the server action reads them;
        only the ids are prefixed.
      */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Brand" name="lineBrandId">
          <Select id="lineBrandId" name="brandId" required defaultValue={editing?.brandId ?? ""}>
            <option value="">— Choose —</option>
            {brands.map((brand) => (
              <option key={brand.id} value={brand.id}>
                {brand.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Class name" name="lineName">
          <TextInput
            id="lineName"
            name="name"
            required
            placeholder="iPhone, iPad, Galaxy Tab"
            defaultValue={editing?.name}
          />
        </Field>
        <Field label="Sort order" name="lineSortOrder">
          <TextInput
            id="lineSortOrder"
            name="sortOrder"
            type="number"
            min={0}
            defaultValue={editing?.sortOrder ?? 0}
          />
        </Field>
      </div>
      <FormError message={state.error} />
      <FormSuccess message={state.message} />
      <SubmitButton pendingLabel="Saving…" className="justify-self-start">
        {editing ? "Save changes" : "Add class"}
      </SubmitButton>
    </form>
  );
}

export function DeviceLineList({
  lines,
  brands,
}: {
  lines: AdminDeviceLine[];
  brands: AdminBrand[];
}) {
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <div className="grid gap-4">
      <div>
        <h2 className="text-lg font-bold">Device classes</h2>
        <p className="mt-1 text-sm text-(--pv-muted)">
          Optional. Group a brand&rsquo;s models — Apple into iPhone and iPad — so a long list
          reads. A brand with no classes shows its models flat, exactly as it does now.
        </p>
      </div>

      {lines.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-(--pv-line) p-6 text-sm text-(--pv-muted)">
          No classes yet, which is a fine place to be. Add one when a brand has enough models that a
          single list is hard to read.
        </p>
      ) : (
        <ul className="grid gap-3">
          {lines.map((line) =>
            editingId === line.id ? (
              <li key={line.id}>
                <DeviceLineForm brands={brands} editing={line} onDone={() => setEditingId(null)} />
              </li>
            ) : (
              <li
                key={line.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-(--pv-line) bg-(--pv-surface) p-4"
              >
                <div className="min-w-0">
                  <p className="font-bold break-words">
                    {line.brandName} {line.name}
                  </p>
                  {/* The count is what makes an empty class visible as one,
                      rather than a heading a customer meets with nothing under it. */}
                  <p className="text-xs text-(--pv-muted)">
                    /{line.slug} ·{" "}
                    {line.deviceCount === 0
                      ? "no models yet"
                      : `${line.deviceCount} ${line.deviceCount === 1 ? "model" : "models"}`}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setEditingId(line.id)}
                    className="min-h-11 text-sm font-bold text-(--pv-red)"
                  >
                    Edit
                  </button>
                  {/* Removing a class unfiles its models rather than deleting
                      them — see `deleteDeviceLine`. The label says so, because
                      "Remove" beside a count of 12 reads like losing 12 things. */}
                  <ConfirmButton
                    label="Remove"
                    confirmLabel="Remove, keep models"
                    onConfirm={async () => {
                      await deleteDeviceLineAction(line.id);
                    }}
                  />
                </div>
              </li>
            ),
          )}
        </ul>
      )}
    </div>
  );
}
