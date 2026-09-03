"use client";

import { useActionState } from "react";
import type { AdminVariant } from "@pv/backend/services/products";
import { koboToNaira } from "@pv/backend/domain/money";
import { MoneyInput } from "@/components/admin/money-input";
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
      {editing ? (
        <div>
          <p className="text-sm font-bold">SKU</p>
          <p className="mt-1 font-mono text-sm text-(--pv-muted)">{editing.sku}</p>
        </div>
      ) : (
        <p className="text-sm text-(--pv-muted)">
          The SKU will be generated from the product name when this variant is saved.
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Price (₦)" name="priceNaira">
          <MoneyInput
            name="priceNaira"
            required
            placeholder="e.g. 25,000"
            defaultValue={editing ? koboToNaira(editing.priceKobo) : undefined}
          />
        </Field>
        <Field label="Compare-at price (₦)" name="compareAtNaira" hint="Optional">
          <MoneyInput
            name="compareAtNaira"
            placeholder="e.g. 30,000"
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
