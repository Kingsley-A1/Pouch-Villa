"use client";

import { useActionState } from "react";
import type { AdminVariant } from "@pv/backend/services/products";
import { koboToNaira } from "@pv/backend/domain/money";
import {
  Field,
  FormError,
  FormSuccess,
  SubmitButton,
  TextInput,
} from "@/components/admin/form-controls";
import { INITIAL_ACTION_STATE, type ActionState } from "@/lib/action-state";

export function VariantForm({
  action,
  editing,
  onDone,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  editing?: AdminVariant;
  onDone?: () => void;
}) {
  const [state, formAction] = useActionState(action, INITIAL_ACTION_STATE);

  return (
    <form
      action={async (formData) => {
        await formAction(formData);
        onDone?.();
      }}
      className="grid gap-3 rounded-xl border border-(--pv-line) bg-(--pv-wash) p-4"
    >
      {editing ? <input type="hidden" name="id" value={editing.id} /> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="SKU" name="sku" hint="Uppercase, numbers and hyphens">
          <TextInput name="sku" required defaultValue={editing?.sku} />
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
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Price (₦)" name="priceNaira">
          <TextInput
            name="priceNaira"
            type="number"
            min={0}
            step="1"
            required
            defaultValue={editing ? koboToNaira(editing.priceKobo) : undefined}
          />
        </Field>
        <Field label="Compare-at price (₦)" name="compareAtNaira" hint="Optional">
          <TextInput
            name="compareAtNaira"
            type="number"
            min={0}
            step="1"
            defaultValue={editing?.compareAtKobo ? koboToNaira(editing.compareAtKobo) : ""}
          />
        </Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Colour" name="axis.colour" hint="Optional">
          <TextInput name="axis.colour" defaultValue={editing?.axes.colour ?? ""} />
        </Field>
        <Field label="Size" name="axis.size" hint="Optional">
          <TextInput name="axis.size" defaultValue={editing?.axes.size ?? ""} />
        </Field>
        <Field label="Model" name="axis.model" hint="Optional">
          <TextInput name="axis.model" defaultValue={editing?.axes.model ?? ""} />
        </Field>
      </div>
      <FormError message={state.error} />
      <FormSuccess message={state.message} />
      <SubmitButton pendingLabel="Saving…" className="justify-self-start">
        {editing ? "Save variant" : "Add variant"}
      </SubmitButton>
    </form>
  );
}
