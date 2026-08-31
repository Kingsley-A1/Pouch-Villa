"use client";

import { useActionState } from "react";
import type { DeliveryZone } from "@pv/backend/services/delivery";
import { koboToNaira } from "@pv/backend/domain/money";
import {
  Field,
  FormError,
  FormSuccess,
  SubmitButton,
  TextInput,
} from "@/components/admin/form-controls";
import { INITIAL_ACTION_STATE } from "@/lib/action-state";
import { saveZoneAction } from "./actions";

export function ZoneForm({ editing, onDone }: { editing?: DeliveryZone; onDone?: () => void }) {
  const [state, formAction] = useActionState(saveZoneAction, INITIAL_ACTION_STATE);

  return (
    <form
      action={async (formData) => {
        await formAction(formData);
        onDone?.();
      }}
      className="grid gap-3 rounded-2xl border border-(--pv-line) bg-white p-4"
    >
      {editing ? <input type="hidden" name="id" value={editing.id} /> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Zone name" name="name">
          <TextInput name="name" required defaultValue={editing?.name} />
        </Field>
        <Field label="LGA" name="lga" hint="Optional">
          <TextInput name="lga" defaultValue={editing?.lga ?? ""} />
        </Field>
      </div>
      <Field label="Delivery fee (₦)" name="feeNaira">
        <TextInput
          name="feeNaira"
          type="number"
          min={0}
          step="1"
          required
          defaultValue={editing ? koboToNaira(editing.feeKobo) : 0}
        />
      </Field>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Min days" name="minDays" hint="Optional">
          <TextInput name="minDays" type="number" min={0} defaultValue={editing?.minDays ?? ""} />
        </Field>
        <Field label="Max days" name="maxDays" hint="Optional">
          <TextInput name="maxDays" type="number" min={0} defaultValue={editing?.maxDays ?? ""} />
        </Field>
        <Field label="Sort order" name="sortOrder">
          <TextInput
            name="sortOrder"
            type="number"
            min={0}
            defaultValue={editing?.sortOrder ?? 0}
          />
        </Field>
      </div>
      <FormError message={state.error} />
      <FormSuccess message={state.message} />
      <SubmitButton pendingLabel="Saving…">{editing ? "Save changes" : "Add zone"}</SubmitButton>
    </form>
  );
}
