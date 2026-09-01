"use client";

import { useActionState } from "react";
import type { SettingValue } from "@pv/backend/services/settings";
import {
  Field,
  FormError,
  FormSuccess,
  SubmitButton,
  TextArea,
  TextInput,
} from "@/components/admin/form-controls";
import { INITIAL_ACTION_STATE } from "@/lib/action-state";
import { OriginBadge } from "./origin-badge";
import { saveStoreSettingsAction } from "./actions";

export function StoreSettingsForm({
  address,
  hours,
  whatsapp,
  contactEmail,
}: {
  address: SettingValue;
  hours: SettingValue;
  whatsapp: SettingValue;
  contactEmail: SettingValue;
}) {
  const [state, formAction] = useActionState(saveStoreSettingsAction, INITIAL_ACTION_STATE);

  return (
    <form
      action={formAction}
      className="grid gap-4 rounded-2xl border border-(--pv-line) bg-(--pv-surface) p-5"
    >
      <h2 className="text-lg font-bold">Store details</h2>
      <p className="text-sm text-(--pv-muted)">
        A blank field renders on the storefront as &ldquo;awaiting confirmation&rdquo; — never a
        guessed address or number.
      </p>

      <Field label="Address" name="store.address">
        <TextArea name="store.address" defaultValue={address.present ? address.value : ""} />
        <OriginBadge value={address} />
      </Field>
      <Field label="Opening hours" name="store.opening_hours">
        <TextArea name="store.opening_hours" defaultValue={hours.present ? hours.value : ""} />
        <OriginBadge value={hours} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="WhatsApp number"
          name="store.whatsapp_number"
          hint="Digits only, with country code"
        >
          <TextInput
            name="store.whatsapp_number"
            defaultValue={whatsapp.present ? whatsapp.value : ""}
          />
          <OriginBadge value={whatsapp} />
        </Field>
        <Field label="Contact email" name="store.contact_email">
          <TextInput
            name="store.contact_email"
            type="email"
            defaultValue={contactEmail.present ? contactEmail.value : ""}
          />
          <OriginBadge value={contactEmail} />
        </Field>
      </div>

      <FormError message={state.error} />
      <FormSuccess message={state.message} />
      <SubmitButton pendingLabel="Saving…" className="justify-self-start">
        Save store details
      </SubmitButton>
    </form>
  );
}
