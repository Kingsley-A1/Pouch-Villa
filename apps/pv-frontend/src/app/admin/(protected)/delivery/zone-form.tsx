"use client";

import { useActionState } from "react";
import type { DeliveryZone } from "@pv/backend/services/delivery";
import { koboToNaira } from "@pv/backend/domain/money";
import { MoneyInput } from "@/components/admin/money-input";
import {
  Field,
  FormError,
  FormSuccess,
  SubmitButton,
  Select,
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
      className="grid gap-3 rounded-2xl border border-(--pv-line) bg-(--pv-surface) p-4"
    >
      {editing ? <input type="hidden" name="id" value={editing.id} /> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Zone name" name="name">
          <TextInput name="name" required defaultValue={editing?.name} />
        </Field>
        <Field label="Local government area" name="lga">
          <Select name="lga" required defaultValue={editing?.lga ?? ""}>
            <option value="" disabled>
              Choose a location
            </option>
            <option value="Calabar Municipal">Calabar Municipal</option>
            <option value="Calabar South">Calabar South</option>
            <option value="Outside Calabar">Outside Calabar</option>
          </Select>
        </Field>
      </div>
      <Field label="Delivery fee (₦)" name="feeNaira">
        <MoneyInput
          name="feeNaira"
          required
          placeholder="e.g. 2,500"
          defaultValue={editing ? koboToNaira(editing.feeKobo) : ""}
        />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Min days" name="minDays" hint="Optional">
          <TextInput
            name="minDays"
            type="number"
            min={0}
            placeholder="e.g. 1"
            defaultValue={editing?.minDays ?? ""}
          />
        </Field>
        <Field label="Max days" name="maxDays" hint="Optional">
          <TextInput
            name="maxDays"
            type="number"
            min={0}
            placeholder="e.g. 3"
            defaultValue={editing?.maxDays ?? ""}
          />
        </Field>
      </div>
      <FormError message={state.error} />
      <FormSuccess message={state.message} />
      <SubmitButton pendingLabel="Saving…">{editing ? "Save changes" : "Add zone"}</SubmitButton>
    </form>
  );
}
