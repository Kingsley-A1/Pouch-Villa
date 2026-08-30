/**
 * Rule 2 made visible: where the client has not supplied a value, the page says so
 * rather than rendering a plausible placeholder or a blank gap. A blank looks like
 * a bug; an invented value becomes a lie the client discovers in front of a
 * customer.
 */
export function AwaitingConfirmation({ what }: { what: string }) {
  return (
    <p className="mt-2 rounded-xl border border-dashed border-(--pv-line) px-3 py-2 text-sm text-(--pv-muted)">
      The {what} has not been confirmed yet.
    </p>
  );
}
