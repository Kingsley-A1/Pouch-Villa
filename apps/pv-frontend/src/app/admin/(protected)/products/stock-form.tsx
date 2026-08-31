"use client";

import { useActionState } from "react";
import {
  Field,
  FormError,
  FormSuccess,
  Select,
  SubmitButton,
  TextInput,
} from "@/components/admin/form-controls";
import { INITIAL_ACTION_STATE, type ActionState } from "@/lib/action-state";

const REASONS = [
  ["received", "Stock received (+)"],
  ["returned", "Customer return (+)"],
  ["released", "Reservation released (+)"],
  ["sold", "Sold (–)"],
  ["damaged", "Damaged / written off (–)"],
  ["reserved", "Reserved for an order (–)"],
  ["adjustment", "Manual adjustment (either)"],
] as const;

export function StockForm({
  currentStock,
  action,
}: {
  currentStock: number;
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
}) {
  const [state, formAction] = useActionState(action, INITIAL_ACTION_STATE);

  return (
    <form
      action={formAction}
      className="grid gap-3 rounded-xl border border-(--pv-line) p-3 sm:grid-cols-4 sm:items-end"
    >
      <Field label="Reason" name="reason">
        <Select name="reason" defaultValue="received">
          {REASONS.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Quantity" name="delta" hint="Negative to remove stock">
        <TextInput name="delta" type="number" required defaultValue={1} />
      </Field>
      <Field label="Note" name="note" hint="Optional">
        <TextInput name="note" />
      </Field>
      <SubmitButton pendingLabel="Recording…">Record</SubmitButton>
      <div className="col-span-full text-xs text-(--pv-muted)">
        Current stock: <span className="font-bold tabular-nums">{currentStock}</span>
      </div>
      <div className="col-span-full">
        <FormError message={state.error} />
        <FormSuccess message={state.message} />
      </div>
    </form>
  );
}
