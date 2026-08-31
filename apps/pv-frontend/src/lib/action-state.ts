/** The shape every Server Action bound to `useActionState` returns. */
export type ActionState = { error: string | null; message?: string };

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
