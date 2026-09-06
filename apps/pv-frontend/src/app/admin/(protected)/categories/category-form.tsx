"use client";

import { useActionState } from "react";
import type { AdminCategory } from "@pv/backend/services/categories";
import {
  Field,
  FormError,
  FormSuccess,
  Select,
  SubmitButton,
  TextArea,
  TextInput,
} from "@/components/admin/form-controls";
import { INITIAL_ACTION_STATE } from "@/lib/action-state";
import { saveCategoryAction } from "./actions";
import { CatalogueImageField } from "./catalogue-image-field";

export function CategoryForm({
  parents,
  editing,
  onDone,
}: {
  parents: AdminCategory[];
  editing?: AdminCategory;
  onDone?: () => void;
}) {
  const [state, formAction] = useActionState(saveCategoryAction, INITIAL_ACTION_STATE);

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
      <Field label="Parent category" name="parentId" hint="Leave unset for a top-level category">
        <Select name="parentId" defaultValue={editing?.parentId ?? ""}>
          <option value="">— Top level —</option>
          {parents
            .filter((parent) => parent.id !== editing?.id)
            .map((parent) => (
              <option key={parent.id} value={parent.id}>
                {parent.name}
              </option>
            ))}
        </Select>
      </Field>
      <Field label="Description" name="description">
        <TextArea name="description" defaultValue={editing?.description ?? ""} />
      </Field>
      <Field label="Sort order" name="sortOrder">
        <TextInput name="sortOrder" type="number" min={0} defaultValue={editing?.sortOrder ?? 0} />
      </Field>

      {/*
        Only once the category exists. The photograph is stored against the
        category id, so there is nothing to attach it to until the row is saved
        — and offering the control on a blank form would be a promise the screen
        cannot keep. The product create screen solves the same problem by holding
        files in the browser; here, saving first is one tap and no machinery.
      */}
      {editing ? (
        <CatalogueImageField
          owner="category"
          ownerId={editing.id}
          image={editing.image}
          label="Category photograph"
          hint="Shown on the home page tile and at the top of the category. A photograph of real stock reads better than a cut-out."
        />
      ) : null}

      <FormError message={state.error} />
      <FormSuccess message={state.message} />
      <SubmitButton pendingLabel="Saving…">
        {editing ? "Save changes" : "Add category"}
      </SubmitButton>
    </form>
  );
}
