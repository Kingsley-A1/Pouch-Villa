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

export function BrandForm({ editing, onDone }: { editing?: AdminBrand; onDone?: () => void }) {
  const [state, formAction] = useActionState(saveBrandAction, INITIAL_ACTION_STATE);

  return (
    <form
      action={async (formData) => {
        await formAction(formData);
        onDone?.();
      }}
      className="grid gap-3 rounded-2xl border border-(--pv-line) bg-white p-4"
    >
      {editing ? <input type="hidden" name="id" value={editing.id} /> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Name" name="name">
          <TextInput name="name" required defaultValue={editing?.name} />
        </Field>
        <Field label="Slug" name="slug" hint="lowercase-with-hyphens">
          <TextInput name="slug" required defaultValue={editing?.slug} />
        </Field>
      </div>
      <Field label="Sort order" name="sortOrder">
        <TextInput name="sortOrder" type="number" min={0} defaultValue={editing?.sortOrder ?? 0} />
      </Field>
      <FormError message={state.error} />
      <FormSuccess message={state.message} />
      <SubmitButton pendingLabel="Saving…">{editing ? "Save changes" : "Add brand"}</SubmitButton>
    </form>
  );
}
