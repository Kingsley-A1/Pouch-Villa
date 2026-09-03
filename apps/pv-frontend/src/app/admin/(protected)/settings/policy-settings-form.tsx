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
  returns,
  privacy,
  terms,
}: {
  about: SettingValue;
  returns: SettingValue;
  privacy: SettingValue;
  terms: SettingValue;
}) {
  const [state, formAction] = useActionState(savePolicySettingsAction, INITIAL_ACTION_STATE);

  return (
    <form action={formAction} className="grid gap-4">
      <p className="text-sm text-(--pv-muted)">
        Legally operative wording needs a named owner on your side, so nothing here is drafted for
        you. Left blank, a page shows an explicit awaiting-confirmation notice rather than inventing
        a policy. A blank line starts a new paragraph; a line starting <code>## </code> is a heading
        and <code>- </code> a bullet.
      </p>

      <Field label="About" name="policy.about">
        <TextArea
          name="policy.about"
          className="min-h-40"
          defaultValue={about.present ? about.value : ""}
        />
        <OriginBadge value={about} />
      </Field>
      <Field label="Return &amp; Warranty Policy" name="policy.returns">
        <TextArea
          name="policy.returns"
          className="min-h-40"
          defaultValue={returns.present ? returns.value : ""}
        />
        <OriginBadge value={returns} />
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
