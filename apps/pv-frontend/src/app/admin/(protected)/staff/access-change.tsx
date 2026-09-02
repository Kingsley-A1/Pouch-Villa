"use client";

import { useState, useTransition } from "react";
import type { AdminStaffMember } from "@pv/backend/services/staff-access";
import { setStaffStatusAction } from "./actions";

/**
 * Changing someone's access, and saying so in your own words.
 *
 * Q11's answer put the message here rather than in a fixed template: how Pouch
 * Villa parts with someone, or welcomes them back, is not wording an engineer
 * should have chosen months earlier. So the control expands into a composer at
 * the moment the decision is made, pre-filled with nothing.
 *
 * **Sending is never a condition of the change.** Both buttons are always live,
 * and the one that sends nothing is a real, labelled choice rather than a blank
 * field someone has to work out they can leave alone. Access that stays open
 * because an email could not be written would be the worse failure by far.
 *
 * Suspension is the destructive direction, so it keeps a two-step reveal: the
 * first tap opens the composer, and nothing has happened yet.
 */
export function AccessChange({ member }: { member: AdminStaffMember }) {
  const suspending = member.status === "active";
  const [composing, setComposing] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function apply(withMessage: string | null) {
    setError(null);
    start(async () => {
      const result = await setStaffStatusAction(
        member.id,
        suspending ? "suspended" : "active",
        withMessage,
      );
      if (result.error !== null) {
        setError(result.error);
        return;
      }
      setComposing(false);
      setMessage("");
    });
  }

  if (!composing) {
    return (
      <div className="grid justify-items-start gap-1">
        <button
          type="button"
          onClick={() => setComposing(true)}
          className={`min-h-11 text-sm font-bold ${
            suspending ? "text-(--pv-danger)" : "text-(--pv-success)"
          }`}
        >
          {suspending ? "Suspend" : "Reactivate"}
        </button>
        {error ? (
          <p role="alert" className="text-xs text-(--pv-danger)">
            {error}
          </p>
        ) : null}
      </div>
    );
  }

  const fieldId = `access-message-${member.id}`;

  return (
    <div className="grid gap-3 rounded-2xl border border-(--pv-line) bg-(--pv-wash) p-4 sm:w-96">
      <div>
        <label htmlFor={fieldId} className="text-sm font-bold">
          Message to {member.fullName}
        </label>
        <p className="mt-1 text-xs text-(--pv-muted)">
          Your words, sent to {member.email}. Optional.
        </p>
      </div>

      <textarea
        id={fieldId}
        rows={4}
        maxLength={2000}
        value={message}
        onChange={(event) => setMessage(event.target.value)}
        placeholder={
          suspending
            ? "Why their access is being suspended, and what happens next."
            : "That they can sign in again, and anything they should know."
        }
        className="field w-full"
      />

      {/*
        Said plainly at the point of decision. A suspension notice reaches a
        mailbox that may no longer belong to someone the business trusts, so the
        message deliberately carries no sign-in link and no code — and the person
        writing it should know that before they write "click here to get back in".
      */}
      <p className="text-xs text-(--pv-muted)">
        The email carries no sign-in link and no code, only your message.
      </p>

      {error ? (
        <p role="alert" className="text-sm text-(--pv-danger)">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => apply(message.trim() === "" ? null : message)}
          className="min-h-11 rounded-xl bg-(--pv-red) px-4 text-sm font-bold text-(--pv-on-brand) disabled:opacity-60"
        >
          {pending
            ? "Working…"
            : message.trim() === ""
              ? `${suspending ? "Suspend" : "Reactivate"} without a message`
              : `${suspending ? "Suspend" : "Reactivate"} and send`}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            setComposing(false);
            setMessage("");
            setError(null);
          }}
          className="min-h-11 rounded-xl border border-(--pv-line) px-4 text-sm font-bold disabled:opacity-60"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
