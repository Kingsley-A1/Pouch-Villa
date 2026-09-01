<title>ADR 0004 — Argon2id, and a breach check that fails open</title>

# ADR 0004 — Argon2id password hashing, with rehash-on-login

**Date:** 2026-08-31 · **Status:** Accepted · **Implements:** `AGENTS.md` §5

## Context

`AGENTS.md` §5 requires _"Argon2id, minimum 12 characters, checked against a
breach list"_. Two of the three were true at the close of Phase 2. The minimum is
correctly enforced in one place, but
[`auth/password.ts`](../../packages/pv-backend/src/auth/password.ts) hashed with
**bcrypt** at 12 rounds, and a search of the repository for
`breach|pwned|haveibeen|argon2` returned nothing.

Three problems, in increasing order of importance:

1. bcrypt is not what the standard says, and the standard is what a reviewer
   checks against.
2. `hashSync` blocks the event loop for the whole cost of the hash, on every
   sign-in and every account creation.
3. bcrypt silently truncates the input at 72 bytes. With a 12-character minimum
   and a passphrase-friendly UI, that is reachable rather than theoretical, and
   it fails silently — two different long passwords can both open the account.

Phase 3 adds customer accounts, which is a second and much larger password
surface. The population of staff accounts today is approximately one.

## Decision

**Argon2id**, via **`hash-wasm`**, with OWASP's current parameters — 19 MiB
memory, 2 iterations, parallelism 1 — asynchronous, so hashing does not block the
request loop.

`hash-wasm` rather than the faster `@node-rs/argon2` because `@node-rs/argon2`
ships a native `.node` binding, and a native binding is a portability liability
we hit immediately: on the development machine this was written on, loading it
fails with _"An Application Control policy has blocked this file"_. That is a
Windows policy, not a bug, and no amount of reinstalling fixes it. A serverless
target with a different libc or a locked-down CI runner is the same problem
wearing different clothes.

`hash-wasm` is WebAssembly, so it has no binding to block and runs identically on
every target. It costs about 190 ms per hash here against roughly 60 ms native —
which is 190 ms on a path that is hit at sign-in and never in a loop, and is
comfortably inside the budget. Its output is the standard PHC-encoded
`$argon2id$v=19$m=19456,t=2,p=1$…` string, so it interoperates with every other
Argon2 implementation and switching to a native one later is a drop-in with no
rehash.

**Existing bcrypt hashes are migrated transparently on next successful login.**
`verifyPassword` detects the algorithm from the stored hash's prefix (`$2` for
bcrypt, `$argon2id$` for Argon2id) and verifies with whichever produced it. On a
successful bcrypt verification the caller is told the hash is stale and rehashes
it in the same transaction as the login. No password reset is forced on anyone,
and no user notices.

`bcryptjs` stays in the manifest for exactly as long as a bcrypt hash may still
exist in the database. It is not used for any new hash.

**The breach check is a k-anonymity range query** against the Have I Been Pwned
range API: the first five hex characters of the password's SHA-1 are sent, the
password is not, and the full hash is compared locally against the returned
suffixes. It runs on account creation and password change, never on login.

**It fails open.** If HIBP is unreachable, slow, or returns anything unexpected,
the password is accepted and the failure is logged without the password, the
hash, or the account. A Nigerian mobile-data customer must not be blocked from
creating an account because a third-party API in another country is having an
afternoon. Refusing a known-breached password is a real improvement over not
checking; making checkout depend on a foreign service's uptime is not.

The timeout is 2 seconds. A staff password change uses the same path.

## Consequences

- Argon2id at 19 MiB is materially more expensive per hash than bcrypt at 12
  rounds. That is the point, and it is bounded — sign-in is not a hot path.
- 19 MiB is allocated per concurrent hash. At the pool sizes here that is
  negligible, but it is a real number and it is worth knowing before anyone puts
  password hashing behind an unbounded queue.
- The WASM module adds roughly 130 ms per hash over a native implementation.
  Measured, not assumed: 191 ms for one hash at these parameters on the
  development machine.
- The breach check adds up to 2 seconds to account creation in the worst case,
  and nothing in the normal case. It is not on the sign-in path.
- A breached-password rejection is a real error message shown to the user, and it
  never says which list or how many times — only that the password has appeared
  in a public breach and another should be chosen.
