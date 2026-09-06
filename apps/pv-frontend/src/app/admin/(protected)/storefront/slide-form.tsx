"use client";

import { useActionState } from "react";
import type { AdminHeroSlide } from "@pv/backend/services/hero-slides";
import {
  Field,
  FormError,
  FormSuccess,
  SubmitButton,
  TextInput,
} from "@/components/admin/form-controls";
import { INITIAL_ACTION_STATE } from "@/lib/action-state";
import { saveSlideAction } from "./slide-actions";

export function SlideForm({ editing, onDone }: { editing?: AdminHeroSlide; onDone?: () => void }) {
  const [state, formAction] = useActionState(saveSlideAction, INITIAL_ACTION_STATE);

  return (
    <form
      action={async (formData) => {
        await formAction(formData);
        onDone?.();
      }}
      className="grid gap-3 rounded-2xl border border-(--pv-line) bg-(--pv-surface) p-4"
    >
      {editing ? <input type="hidden" name="id" value={editing.id} /> : null}

      <Field
        label="Small line above the headline"
        name="kicker"
        hint="Optional — “New in”, “Clearance”. Leave blank for none."
      >
        <TextInput name="kicker" maxLength={40} defaultValue={editing?.kicker ?? ""} />
      </Field>

      <Field label="Headline" name="headline" hint="Short. It is set very large over a photograph.">
        <TextInput name="headline" required maxLength={80} defaultValue={editing?.headline ?? ""} />
      </Field>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          label="Where the button goes"
          name="href"
          // Stated here as well as enforced in the schema, so the rule is a
          // instruction rather than only a rejection after the fact.
          hint="A path inside the shop, starting with / — for example /shop or /browse/pouches"
        >
          <TextInput name="href" required defaultValue={editing?.href ?? "/shop"} />
        </Field>
        <Field label="Button label" name="ctaLabel" hint="Defaults to “Shop now”.">
          <TextInput name="ctaLabel" maxLength={30} defaultValue={editing?.ctaLabel ?? ""} />
        </Field>
      </div>

      <Field label="Sort order" name="sortOrder">
        <TextInput name="sortOrder" type="number" min={0} defaultValue={editing?.sortOrder ?? 0} />
      </Field>

      <FormError message={state.error} />
      <FormSuccess message={state.message} />
      <SubmitButton pendingLabel="Saving…">{editing ? "Save changes" : "Add slide"}</SubmitButton>

      {editing ? null : (
        <p className="text-xs text-(--pv-muted)">
          Save the slide first, then choose its photograph — the picture is stored against the
          slide, so it needs the slide to exist.
        </p>
      )}
    </form>
  );
}
