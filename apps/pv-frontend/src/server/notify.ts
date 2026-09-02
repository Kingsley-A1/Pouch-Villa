/**
 * Firing a transactional email without letting it become part of the request.
 *
 * Every send in this app is best-effort by design: an order is placed, a proof
 * is rejected and a password is changed whether or not Resend is reachable, and
 * a failed send must never roll one of those back. That rule was being written
 * out by hand at each call site, which is how the copies drift — and one of the
 * copies is where a recipient address ends up in a log.
 *
 * So it lives here once. The failure is recorded by error *name* only: §5's
 * closing rule forbids a recipient, a token or a proof URL reaching a log, and a
 * driver or fetch error frequently carries all three in its message.
 *
 * Deliberately not awaited by the caller. It is called after the transaction has
 * committed and after authority has been checked — never as a way of doing work
 * the caller should have waited for.
 */
export function dispatchEmail(what: string, send: Promise<void>): void {
  void send.catch((error: unknown) => {
    console.error(`${what} email failed`, {
      name: error instanceof Error ? error.name : typeof error,
    });
  });
}
