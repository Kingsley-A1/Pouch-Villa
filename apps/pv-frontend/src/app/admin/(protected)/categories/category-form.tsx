"use client";

import { useActionState, useState } from "react";
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
  fixedParentId,
  onDone,
}: {
  parents: AdminCategory[];
  editing?: AdminCategory;
  /**
   * Set when the form was opened by a section's own "Add type".
   *
   * The parent is then a fact about where the person pressed, not a question —
   * so it is carried as a hidden value rather than a dropdown they could set to
   * something that contradicts the button they used.
   */
  fixedParentId?: string;
  onDone?: () => void;
}) {
  const [state, formAction] = useActionState(saveCategoryAction, INITIAL_ACTION_STATE);

  /*
    Device fit belongs to a section, so the control only appears on a top-level
    category. A child inherits its root's answer — "Screen Protectors" is not
    separately a device-fitting section, it is part of one — and offering the
    checkbox on a child would invite an answer the storefront then ignores.
  */
  const [parentId, setParentId] = useState(fixedParentId ?? editing?.parentId ?? "");
  const isTopLevel = parentId === "";
  const parentIsFixed = fixedParentId !== undefined;
  const fixedParentName = parents.find((parent) => parent.id === fixedParentId)?.name ?? null;

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
      {parentIsFixed ? (
        <>
          <input type="hidden" name="parentId" value={fixedParentId} />
          <p className="help">
            Added under <span className="font-semibold text-(--pv-ink)">{fixedParentName}</span>.
          </p>
        </>
      ) : (
        <Field label="Parent category" name="parentId" hint="Leave unset for a top-level category">
          <Select
            name="parentId"
            value={parentId}
            onChange={(event) => setParentId(event.target.value)}
          >
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
      )}
      <Field label="Description" name="description">
        <TextArea name="description" defaultValue={editing?.description ?? ""} />
      </Field>
      <Field label="Sort order" name="sortOrder">
        <TextInput name="sortOrder" type="number" min={0} defaultValue={editing?.sortOrder ?? 0} />
      </Field>

      {/*
        The question that decides the whole shape of filing a product here.

        Ticked, staff pick a make, a device class and the models it fits — a case
        is defined by what it goes on. Unticked, they pick a type from this
        section's own list instead, because a power bank is a power bank whatever
        phone you own and asking which device it is for is the wrong question.

        A hidden input carries the "no" answer, because an unticked checkbox
        posts nothing at all and the action would otherwise read absence as
        "unspecified" and fall back to the default of ticked.
      */}
      {isTopLevel ? (
        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-(--pv-line) p-3">
          <input
            type="checkbox"
            name="fitsDevices"
            defaultChecked={editing?.fitsDevices ?? true}
            className="mt-0.5 h-5 w-5 accent-(--pv-red)"
          />
          <span className="text-sm">
            <span className="font-semibold">Products here fit a specific device</span>
            <span className="help block">
              Tick for pouches and cases: staff choose a make, a class and the models it fits, and
              shoppers browse by their phone. Leave it unticked for accessories, which are filed and
              browsed by type instead.
            </span>
          </span>
        </label>
      ) : parentIsFixed ? null : (
        <p className="help">
          This sits under another category, so it follows whatever that section is set to.
        </p>
      )}

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
        {editing ? "Save changes" : parentIsFixed ? "Add type" : "Add section"}
      </SubmitButton>
    </form>
  );
}
