"use client";

import { useActionState, useState } from "react";
import type { AdminDevice, AdminDeviceLine } from "@pv/backend/services/devices";
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
import { saveDeviceAction, deleteDeviceAction } from "./actions";

export function DeviceForm({
  brands,
  lines,
  editing,
  onDone,
}: {
  brands: AdminBrand[];
  lines: AdminDeviceLine[];
  editing?: AdminDevice;
  onDone?: () => void;
}) {
  const [state, formAction] = useActionState(saveDeviceAction, INITIAL_ACTION_STATE);
  /*
    The class list is filtered to the brand on screen, so an iPad can never be
    offered under Samsung. The service refuses that pairing too — this only
    keeps the form from proposing it.
  */
  const [brandId, setBrandId] = useState(editing?.brandId ?? "");
  const brandLines = lines.filter((line) => line.brandId === brandId);

  return (
    <form
      action={async (formData) => {
        await formAction(formData);
        onDone?.();
      }}
      className="grid gap-3 rounded-2xl border border-(--pv-line) bg-(--pv-surface) p-4"
    >
      {editing ? <input type="hidden" name="id" value={editing.id} /> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Brand" name="brandId">
          <Select
            name="brandId"
            required
            value={brandId}
            onChange={(event) => setBrandId(event.target.value)}
          >
            <option value="">— Choose —</option>
            {brands.map((brand) => (
              <option key={brand.id} value={brand.id}>
                {brand.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Model name" name="name">
          <TextInput
            name="name"
            required
            placeholder="iPhone 15 Pro"
            defaultValue={editing?.name}
          />
        </Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {/*
          Shown even when the brand has no classes, with a hint saying where they
          come from — so the field explains itself rather than looking broken.

          A `select` takes no placeholder, so this one guidance stays outside the
          control. Where classes do exist the options say everything a hint would,
          and "— None —" already says it is optional, so nothing is written.
        */}
        <Field
          label="Class"
          name="lineId"
          {...(brandLines.length > 0
            ? {}
            : { hint: "This brand has no classes yet. Add one with the button above." })}
        >
          <Select name="lineId" defaultValue={editing?.lineId ?? ""}>
            <option value="">— None —</option>
            {brandLines.map((line) => (
              <option key={line.id} value={line.id}>
                {line.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Released year" name="releasedYear">
          <TextInput
            name="releasedYear"
            type="number"
            min={1990}
            max={2100}
            placeholder="2024"
            defaultValue={editing?.releasedYear ?? ""}
          />
        </Field>
        <Field label="Sort order" name="sortOrder">
          <TextInput
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
        {editing ? "Save changes" : "Add device"}
      </SubmitButton>
    </form>
  );
}

/**
 * The models, and the inline editor for one of them.
 *
 * Adding is not here: both "add" buttons live in the toolbar at the top of the
 * screen, because this list is long. See `DevicesWorkspace`.
 */
export function DeviceList({
  devices,
  brands,
  lines,
}: {
  devices: AdminDevice[];
  brands: AdminBrand[];
  lines: AdminDeviceLine[];
}) {
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <div className="grid gap-4">
      <h2 className="text-lg font-bold">Devices</h2>

      {brands.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-(--pv-line) p-6 text-sm text-(--pv-muted)">
          Add a brand first — every device belongs to one.
        </p>
      ) : devices.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-(--pv-line) p-6 text-sm text-(--pv-muted)">
          No devices yet. These are the models an accessory can fit, not things you sell.
        </p>
      ) : (
        <ul className="grid gap-3">
          {devices.map((device) =>
            editingId === device.id ? (
              <li key={device.id}>
                <DeviceForm
                  brands={brands}
                  lines={lines}
                  editing={device}
                  onDone={() => setEditingId(null)}
                />
              </li>
            ) : (
              <li
                key={device.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-(--pv-line) bg-(--pv-surface) p-4"
              >
                <div>
                  <p className="font-bold">
                    {device.brandName} {device.name}
                  </p>
                  <p className="text-xs text-(--pv-muted)">
                    {device.lineName ? `${device.lineName} · ` : ""}/{device.slug}
                    {device.releasedYear ? ` · ${device.releasedYear}` : ""}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setEditingId(device.id)}
                    className="min-h-11 text-sm font-bold text-(--pv-red)"
                  >
                    Edit
                  </button>
                  <ConfirmButton
                    label="Remove"
                    confirmLabel="Remove"
                    onConfirm={async () => {
                      await deleteDeviceAction(device.id);
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
