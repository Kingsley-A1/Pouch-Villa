"use client";

import { useActionState } from "react";
import type { SettingValue } from "@pv/backend/services/settings";
import {
  Field,
  FormError,
  FormSuccess,
  SubmitButton,
  TextArea,
} from "@/components/admin/form-controls";
import { INITIAL_ACTION_STATE } from "@/lib/action-state";
import { OriginBadge } from "./origin-badge";
import { savePolicySettingsAction } from "./actions";

export function PolicySettingsForm({
  about,
  privacy,
  terms,
}: {
  about: SettingValue;
  privacy: SettingValue;
  terms: SettingValue;
}) {
  const [state, formAction] = useActionState(savePolicySettingsAction, INITIAL_ACTION_STATE);

  return (
    <form
      action={formAction}
      className="grid gap-4 rounded-2xl border border-(--pv-line) bg-white p-5"
    >
      <h2 className="text-lg font-bold">About, Privacy &amp; Terms</h2>
      <p className="text-sm text-(--pv-muted)">
        These pages are not drafted for you — legally operative wording needs a named owner on your
        side. Left blank, each page shows an explicit awaiting-confirmation notice.
      </p>

      <Field label="About" name="policy.about">
        <TextArea
          name="policy.about"
          className="min-h-40"
          defaultValue={about.present ? about.value : ""}
        />
        <OriginBadge value={about} />
      </Field>
      <Field label="Privacy Policy" name="policy.privacy">
        <TextArea
          name="policy.privacy"
          className="min-h-40"
          defaultValue={privacy.present ? privacy.value : ""}
        />
        <OriginBadge value={privacy} />
      </Field>
      <Field label="Terms & Conditions" name="policy.terms">
        <TextArea
          name="policy.terms"
          className="min-h-40"
          defaultValue={terms.present ? terms.value : ""}
        />
        <OriginBadge value={terms} />
      </Field>

      <FormError message={state.error} />
      <FormSuccess message={state.message} />
      <SubmitButton pendingLabel="Saving…" className="justify-self-start">
        Save pages
      </SubmitButton>
    </form>
  );
}
