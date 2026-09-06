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
  announcement,
  instagramUrl,
  xUrl,
  locations,
  heroHeadline,
  heroSubtitle,
}: {
  address: SettingValue;
  hours: SettingValue;
  whatsapp: SettingValue;
  contactEmail: SettingValue;
  announcement: SettingValue;
  instagramUrl: SettingValue;
  xUrl: SettingValue;
  locations: SettingValue;
  heroHeadline: SettingValue;
  heroSubtitle: SettingValue;
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
        The bar above the header. Blank is not a broken state here: the whole
        bar is absent until there is a message, which is §0 rule 2 applied to a
        piece of furniture rather than to a fact.
      */}
      <fieldset className="grid gap-4 border-t border-(--pv-line) pt-4">
        <legend className="text-sm font-bold">Announcement bar</legend>
        <Field
          label="Running message"
          name="store.announcement"
          hint="One sentence. It scrolls across the top of the shop. Blank hides the whole bar."
        >
          <TextArea
            name="store.announcement"
            defaultValue={announcement.present ? announcement.value : ""}
          />
          <OriginBadge value={announcement} />
        </Field>
        <Field
          label="Store locations"
          name="store.locations"
          hint="One per line. Listed in the contact row under the message."
        >
          <TextArea
            name="store.locations"
            defaultValue={locations.present ? locations.value : ""}
          />
          <OriginBadge value={locations} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Instagram link" name="store.instagram_url" hint="Full https:// address">
            <TextInput
              name="store.instagram_url"
              type="url"
              defaultValue={instagramUrl.present ? instagramUrl.value : ""}
            />
            <OriginBadge value={instagramUrl} />
          </Field>
          <Field label="X link" name="store.x_url" hint="Full https:// address">
            <TextInput
              name="store.x_url"
              type="url"
              defaultValue={xUrl.present ? xUrl.value : ""}
            />
            <OriginBadge value={xUrl} />
          </Field>
        </div>
      </fieldset>

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

      <FormError message={state.error} />
      <FormSuccess message={state.message} />
      <SubmitButton pendingLabel="Saving…" className="justify-self-start">
        Save store details
      </SubmitButton>
    </form>
  );
}
