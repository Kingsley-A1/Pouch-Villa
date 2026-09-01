"use client";

import { useActionState } from "react";
import type { SettingValue } from "@pv/backend/services/settings";
import {
  Field,
  FormError,
  FormSuccess,
  SubmitButton,
  TextInput,
} from "@/components/admin/form-controls";
import { INITIAL_ACTION_STATE } from "@/lib/action-state";
import { OriginBadge } from "./origin-badge";
import { saveBankSettingsAction } from "./actions";

export function BankSettingsForm({
  accountName,
  accountNumber,
  bankName,
}: {
  accountName: SettingValue;
  accountNumber: SettingValue;
  bankName: SettingValue;
}) {
  const [state, formAction] = useActionState(saveBankSettingsAction, INITIAL_ACTION_STATE);

  return (
    <form
      action={formAction}
      className="grid gap-4 rounded-2xl border border-(--pv-line) bg-(--pv-surface) p-5"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">Bank account for transfers</h2>
      </div>
      <p className="text-sm text-(--pv-muted)">
        Shown at checkout for &ldquo;Pay by Transfer&rdquo;. An admin edit here permanently takes
        over from whatever was seeded in the environment.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Account name" name="bank.account_name">
          <TextInput
            name="bank.account_name"
            defaultValue={accountName.present ? accountName.value : ""}
          />
          <OriginBadge value={accountName} />
        </Field>
        <Field label="Bank name" name="bank.bank_name">
          <TextInput name="bank.bank_name" defaultValue={bankName.present ? bankName.value : ""} />
          <OriginBadge value={bankName} />
        </Field>
      </div>
      <Field label="Account number" name="bank.account_number">
        <TextInput
          name="bank.account_number"
          inputMode="numeric"
          defaultValue={accountNumber.present ? accountNumber.value : ""}
        />
        <OriginBadge value={accountNumber} />
      </Field>

      <FormError message={state.error} />
      <FormSuccess message={state.message} />
      <SubmitButton pendingLabel="Saving…" className="justify-self-start">
        Save bank details
      </SubmitButton>
    </form>
  );
}
