"use client";

import { useActionState } from "react";
import type { AdminBrand } from "@pv/backend/services/brands";
import {
  Field,
  FormError,
  FormSuccess,
  SubmitButton,
  TextInput,
} from "@/components/admin/form-controls";
import { INITIAL_ACTION_STATE } from "@/lib/action-state";
import { saveBrandAction } from "./actions";
import { CatalogueImageField } from "./catalogue-image-field";

export function BrandForm({ editing, onDone }: { editing?: AdminBrand; onDone?: () => void }) {
  const [state, formAction] = useActionState(saveBrandAction, INITIAL_ACTION_STATE);

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
        <Field label="Name" name="name">
          <TextInput name="name" required defaultValue={editing?.name} />
        </Field>
      </div>
      <Field label="Sort order" name="sortOrder">
        <TextInput name="sortOrder" type="number" min={0} defaultValue={editing?.sortOrder ?? 0} />
      </Field>

      {/* Same reason as the category photograph: the logo hangs off the row. */}
      {editing ? (
        <CatalogueImageField
          owner="brand"
          ownerId={editing.id}
          image={editing.logo}
          label="Brand logo"
          hint="Carried on the brand card in the browse path. A logo on a plain background reads best."
        />
      ) : null}

      <FormError message={state.error} />
      <FormSuccess message={state.message} />
      <SubmitButton pendingLabel="Saving…">{editing ? "Save changes" : "Add brand"}</SubmitButton>
    </form>
  );
}
