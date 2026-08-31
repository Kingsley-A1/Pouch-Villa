"use client";

import { useActionState } from "react";
import { STAFF_ROLES } from "@pv/backend/auth/role-codes";
import {
  Field,
  FormError,
  Select,
  SubmitButton,
  TextInput,
} from "@/components/admin/form-controls";
import { mintCodeAction, type MintCodeState } from "./actions";

const INITIAL: MintCodeState = { error: null };

export function MintCodeForm() {
  const [state, formAction] = useActionState(mintCodeAction, INITIAL);

  return (
    <div className="grid gap-4 rounded-2xl border border-(--pv-line) bg-white p-5">
      <h2 className="text-lg font-bold">Issue a role code</h2>
      <p className="text-sm text-(--pv-muted)">
        Three levels and no more. The code is shown once — write it down or share it now.
      </p>
      <form action={formAction} className="grid gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Access level" name="role">
            <Select name="role" required defaultValue="EMPLOYEE">
              {STAFF_ROLES.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Label" name="label" hint="Who this is for, e.g. a name">
            <TextInput name="label" />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Number of uses" name="maxUses">
            <TextInput name="maxUses" type="number" min={1} max={1000} defaultValue={1} />
          </Field>
          <Field label="Expires in (minutes)" name="ttlMinutes">
            <TextInput name="ttlMinutes" type="number" min={1} defaultValue={60 * 24 * 7} />
          </Field>
        </div>
        <FormError message={state.error} />
        <SubmitButton pendingLabel="Creating…" className="justify-self-start">
          Create code
        </SubmitButton>
      </form>
      {state.code ? (
        <div className="rounded-xl border border-(--pv-success) bg-emerald-50 p-4">
          <p className="text-sm font-semibold text-(--pv-success)">
            Code created — this is shown once:
          </p>
          <p className="mt-1 font-mono text-2xl font-bold tracking-wider">{state.code}</p>
        </div>
      ) : null}
    </div>
  );
}
