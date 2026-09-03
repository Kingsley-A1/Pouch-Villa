<title>ADR 0009 — Why no image could be uploaded, and what a media manager owes</title>

# ADR 0009 — The upload nobody could complete

**Date:** 2026-09-03 · **Status:** Accepted · **Scope items:** Product media, payment proof upload · **Builds on:** [`AGENTS.md`](../../AGENTS.md) §8

## Context

Staff reported that image upload failed from the admin. It did — for every
image, every time, and the same defect broke the customer-facing payment-receipt
upload, which is on the critical path of getting paid.

Two more things were wrong with the same screens. The edit screen read
`files[0]` from a single-file input, so choosing four images uploaded one, while
the backend and the create screen had both allowed five since the feature was
built. And there was no way to swap an image: the only route was remove-then-add,
which sends the replacement to the back of the gallery — so correcting the
primary photo meant re-ordering afterwards.

## Decisions

### 1. Sign nothing but `host` in a pre-signed upload URL

`presignUpload` passed the size cap as `ContentLength`. SigV4 folds a present
header into the signature, so the URL came back with:

```
X-Amz-SignedHeaders=content-length;host
```

That is a promise that whoever uses the URL will send `Content-Length: 10485760`
exactly. A browser sends the real length of the file it is uploading. Every PUT
of anything other than a precisely 10MiB image was therefore rejected as a
signature mismatch — which is to say, every upload the product has ever
attempted, on both the admin and the customer paths.

The rule this leaves behind: **a signed header is a promise about a request the
browser makes on its own terms, so a pre-signed URL may sign nothing but the
host.** The regression test asserts the query string directly, and was confirmed
to fail against the old code before the fix landed.

### 2. Enforce the size where it can actually be measured

Dropping `ContentLength` removes a cap that never worked, so the limit is stated
three times, in increasing order of authority:

| Where                      | What it is                                                      |
| -------------------------- | --------------------------------------------------------------- |
| The picker, in the browser | A courtesy. Refuses before four minutes of mobile data is spent |
| `beginUpload`              | A free early refusal on the declared size. Not trusted          |
| `processImage`             | The authority. It is the only one holding the bytes             |

A client that lies about the size is still a client; the object is fetched back,
measured, and the staged copy deleted on rejection. That was always true and is
unchanged — what is new is that a 30MB photo is refused before it is uploaded
rather than after.

### 3. The browser can choose several files, because the backend always could

The edit screen now takes a whole selection, up to the same five-image cap, and
sends them one after another. Sequential, not parallel: five concurrent
multi-megabyte PUTs on a mobile connection contend with each other and are
likelier to time out than the same five in sequence. Files beyond the cap are
named as not fitting rather than silently dropped.

### 4. Replace is one transaction, not delete-then-add

`finaliseUpload` takes an optional `replacesMediaId`. The new row takes the old
row's `sort_order` and the old row is deleted in the same transaction, so the
gallery either shows the new image where the old one was or is untouched. Done
from the browser as two calls, a dropped connection can land the delete and lose
the add — and the delete is the half that lands first.

The replaced image's renditions are deleted **after** the transaction commits,
because object deletion is an external effect and a CockroachDB transaction body
may run more than once. They are also skipped when the content hash is unchanged:
keys are content-hashed, so re-uploading an identical file writes the same
objects, and "delete the old ones" would delete the ones just written.

### 5. A network failure and a blocked request are told apart

`fetch` throws rather than returning a response both for a dropped connection and
for a cross-origin request the browser refused. The second is invisible from
JavaScript and is a bucket-configuration fault, not the operator's — and "check
your connection" sends someone to look in entirely the wrong place when every
upload fails identically. The message now names the possibility, and
[`.env.example`](../../.env.example) carries the CORS policy both buckets need.

### 6. Alt text is a sentence, not a filename

Both screens passed `file.name` as the image's alt text, so every product image
in the catalogue would have been announced by a screen reader as "IMG 4021 dot
jpeg" — worse than nothing, because a screen reader skips a genuinely empty alt
and reads this one out.

This was not in the reported fault, but it is created by the exact line that had
to change, and §2 puts WCAG 2.2 AA at the floor rather than the ceiling. Alt text
is now an editable field on each image, saved on blur, stored as `null` when
cleared — the difference between "no description" and "deliberately decorative"
is one a screen reader acts on. A replacement carries the existing description
over: swapping in a better shot of the same thing should not discard the sentence
someone wrote about it.

## Consequences

- `presignUpload` no longer takes `maxBytes`. Both callers were updated.
- `finaliseUpload` takes an options object; existing calls are unaffected.
- `beginUpload` takes an optional declared size.
- New service function `updateMediaAlt`, new actions `replaceMediaAction` and
  `updateMediaAltAction`, and a shared browser helper `upload-image.ts` that both
  product screens now use instead of each keeping its own copy of the three-step
  dance.
- **The CORS policy is a deployment prerequisite that was never written down.**
  If uploads still fail after this change, that is the next thing to check, and
  it is now in `.env.example`.

## What could not be verified here

This environment has no CockroachDB instance and no R2 bucket, so the integration
suites and a real end-to-end upload did not run. What was verified: the presigned
URL's signed-header set, directly and by reintroducing the bug to watch the test
fail; the browser-side selection, limit, replace and revoke behaviour; and that
the client's byte cap equals the server's. The first real upload against a
configured bucket is still the thing that proves the fix.
