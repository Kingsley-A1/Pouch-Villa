"use client";

import { useActionState, useState } from "react";
import type { AdminDevice } from "@pv/backend/services/devices";
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

function DeviceForm({
  brands,
  editing,
  onDone,
}: {
  brands: AdminBrand[];
  editing?: AdminDevice;
  onDone?: () => void;
}) {
  const [state, formAction] = useActionState(saveDeviceAction, INITIAL_ACTION_STATE);

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
          <Select name="brandId" required defaultValue={editing?.brandId ?? ""}>
            <option value="">— Choose —</option>
            {brands.map((brand) => (
              <option key={brand.id} value={brand.id}>
                {brand.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Model name" name="name">
          <TextInput name="name" required defaultValue={editing?.name} />
        </Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Slug" name="slug" hint="lowercase-with-hyphens">
          <TextInput name="slug" required defaultValue={editing?.slug} />
        </Field>
        <Field label="Released year" name="releasedYear" hint="Optional">
          <TextInput
            name="releasedYear"
            type="number"
            min={1990}
            max={2100}
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

export function DeviceList({ devices, brands }: { devices: AdminDevice[]; brands: AdminBrand[] }) {
  const [editingId, setEditingId] = useState<string | "new" | null>(null);

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">Devices</h2>
        <button
          type="button"
          onClick={() => setEditingId(editingId === "new" ? null : "new")}
          className="min-h-11 rounded-xl border border-(--pv-line) px-4 text-sm font-bold"
        >
          {editingId === "new" ? "Cancel" : "Add device"}
        </button>
      </div>

      {editingId === "new" ? (
        <DeviceForm brands={brands} onDone={() => setEditingId(null)} />
      ) : null}

      {brands.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-(--pv-line) p-6 text-sm text-(--pv-muted)">
          Add a brand first — every device belongs to one.
        </p>
      ) : devices.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-(--pv-line) p-6 text-sm text-(--pv-muted)">
          No devices yet. These are the phone models an accessory can fit, not things you sell.
        </p>
      ) : (
        <ul className="grid gap-3">
          {devices.map((device) =>
            editingId === device.id ? (
              <li key={device.id}>
                <DeviceForm brands={brands} editing={device} onDone={() => setEditingId(null)} />
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
                    /{device.slug}
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
