"use client";

import { useActionState } from "react";
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
import { INITIAL_ACTION_STATE, type ActionState } from "@/lib/action-state";

type Action = (prev: ActionState, formData: FormData) => Promise<ActionState>;

export function ProductForm({
  action,
  brands,
  categories,
  devices,
  editing,
  submitLabel,
}: {
  action: Action;
  brands: AdminBrand[];
  categories: AdminCategory[];
  devices: AdminDevice[];
  editing?: AdminProduct;
  submitLabel: string;
}) {
  const [state, formAction] = useActionState(action, INITIAL_ACTION_STATE);
  const editingCategoryIds = new Set(editing?.categoryIds ?? []);
  const editingDeviceIds = new Set(editing?.deviceIds ?? []);

  return (
    <form
      action={formAction}
      className="grid gap-4 rounded-2xl border border-(--pv-line) bg-white p-5"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" name="name">
          <TextInput name="name" required defaultValue={editing?.name} />
        </Field>
        <Field label="Slug" name="slug" hint="lowercase-with-hyphens">
          <TextInput name="slug" required defaultValue={editing?.slug} />
        </Field>
      </div>
      <Field label="Summary" name="summary" hint="Shown on the product card">
        <TextInput name="summary" maxLength={500} defaultValue={editing?.summary ?? ""} />
      </Field>
      <Field label="Description" name="description">
        <TextArea name="description" defaultValue={editing?.description ?? ""} />
      </Field>
      <Field label="Brand" name="brandId">
        <Select name="brandId" defaultValue={editing?.brandId ?? ""}>
          <option value="">— None —</option>
          {brands.map((brand) => (
            <option key={brand.id} value={brand.id}>
              {brand.name}
            </option>
          ))}
        </Select>
      </Field>
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

      <FormError message={state.error} />
      <FormSuccess message={state.message} />
      <SubmitButton pendingLabel="Saving…" className="justify-self-start">
        {submitLabel}
      </SubmitButton>
    </form>
  );
}
