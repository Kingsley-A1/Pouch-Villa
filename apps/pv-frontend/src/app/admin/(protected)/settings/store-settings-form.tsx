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
  heroHeadline,
  heroSubtitle,
  invoiceTerms,
}: {
  address: SettingValue;
  hours: SettingValue;
  whatsapp: SettingValue;
  contactEmail: SettingValue;
  heroHeadline: SettingValue;
  heroSubtitle: SettingValue;
  invoiceTerms: SettingValue;
}) {
  const [state, formAction] = useActionState(saveStoreSettingsAction, INITIAL_ACTION_STATE);

  return (
    <form action={formAction} className="grid gap-4">
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

      {/*
        Marketing copy, not a business fact — so unlike the fields above, leaving
        these blank is safe: the home page falls back to its own wording rather
        than rendering "awaiting confirmation" where a headline should be.
      */}
      <fieldset className="grid gap-4 border-t border-(--pv-line) pt-4">
        <legend className="text-sm font-bold">Home page headline</legend>
        <Field
          label="Headline"
          name="store.hero_headline"
          hint="Leave blank to use the built-in wording."
        >
          <TextArea
            name="store.hero_headline"
            defaultValue={heroHeadline.present ? heroHeadline.value : ""}
          />
          <OriginBadge value={heroHeadline} />
        </Field>
        <Field label="Sub-heading" name="store.hero_subtitle">
          <TextArea
            name="store.hero_subtitle"
            defaultValue={heroSubtitle.present ? heroSubtitle.value : ""}
          />
          <OriginBadge value={heroSubtitle} />
        </Field>
      </fieldset>

      {/*
        Printed on every invoice and payment receipt, and blank until somebody
        writes it. §4 puts terms of trade in the admin rather than in source, and
        §0 rule 2 is why an empty value leaves the block off the document
        entirely instead of printing a term nobody agreed to.
      */}
      <fieldset className="grid gap-4 border-t border-(--pv-line) pt-4">
        <legend className="text-sm font-bold">Invoices and receipts</legend>
        <Field
          label="Terms & Conditions"
          name="store.invoice_terms"
          hint="Printed at the foot of every invoice and receipt. One per line, up to five lines. Leave blank to print none."
        >
          <TextArea
            name="store.invoice_terms"
            defaultValue={invoiceTerms.present ? invoiceTerms.value : ""}
          />
          <OriginBadge value={invoiceTerms} />
        </Field>
      </fieldset>

      <FormError message={state.error} />
      <FormSuccess message={state.message} />
      <SubmitButton pendingLabel="Saving…" className="justify-self-start">
        Save store details
      </SubmitButton>
    </form>
  );
}
