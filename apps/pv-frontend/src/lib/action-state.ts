/**
 * The shape every Server Action bound to `useActionState` returns.
 *
 * `values` exists because React resets a form once its action resolves, which is
 * right for a form that succeeded and wrong for one that did not: a mistyped
 * password used to wipe the email address with it, so every retry began by
 * typing an address the shop had just been told. An action that fails can hand
 * back what it was given, and the form redraws with it.
 *
 * **Only what is safe to send back.** This travels to the browser in the
 * response, so a password or a reset code never goes in it — those are the two
 * fields a visitor should retype, and the only two.
 */
export type ActionState = {
  error: string | null;
  message?: string;
  values?: Record<string, string>;
};

export const INITIAL_ACTION_STATE: ActionState = { error: null };

const GENERIC_ERROR_NAMES = new Set([
  "Error",
  "TypeError",
  "RangeError",
  "SyntaxError",
  "DatabaseError",
]);

/**
 * Maps a caught error to a message safe to show a user. Every domain error this
 * app throws gives itself a specific `.name`; a raw driver or network failure
 * keeps a generic one, so only the former's message is ever shown. Never the raw
 * error otherwise — a driver error or a stack trace must not reach the client,
 * per AGENTS.md §3.
 */
export function toActionError(error: unknown, fallback: string): ActionState {
  if (error instanceof Error && !GENERIC_ERROR_NAMES.has(error.name)) {
    return { error: error.message };
  }
  console.error(error);
  return { error: fallback };
}
