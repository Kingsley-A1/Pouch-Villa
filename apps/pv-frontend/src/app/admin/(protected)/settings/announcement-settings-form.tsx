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
import { saveAnnouncementSettingsAction } from "./actions";

/**
 * The running message above the shop's header, and the contact row beneath it.
 *
 * Its own form and its own section, rather than a fieldset inside "Store
 * details", because the client looked for it there and concluded the feature did
 * not exist. For something whose entire purpose is to be edited by a non-engineer
 * on a Sunday, being hard to find is the same as being missing.
 */
export function AnnouncementSettingsForm({
  announcement,
  locations,
  instagramUrl,
  xUrl,
}: {
  announcement: SettingValue;
  locations: SettingValue;
  instagramUrl: SettingValue;
  xUrl: SettingValue;
}) {
  const [state, formAction] = useActionState(saveAnnouncementSettingsAction, INITIAL_ACTION_STATE);

  return (
    <form action={formAction} className="grid gap-4">
      <p className="text-sm text-(--pv-muted)">
        The strip that runs across the very top of the shop. Leave the message blank and the whole
        bar disappears — including the contact row — so nothing empty is ever shown. Shoppers can
        close it, and it stays closed for them.
      </p>

      <Field
        label="Running message"
        name="store.announcement"
        hint="One sentence. It scrolls across the top of every page."
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
        <TextArea name="store.locations" defaultValue={locations.present ? locations.value : ""} />
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
          <TextInput name="store.x_url" type="url" defaultValue={xUrl.present ? xUrl.value : ""} />
          <OriginBadge value={xUrl} />
        </Field>
      </div>

      <FormError message={state.error} />
      <FormSuccess message={state.message} />
      <SubmitButton pendingLabel="Saving…" className="justify-self-start">
        Save announcement
      </SubmitButton>
    </form>
  );
}
