<title>ADR 0009 — What a product media manager owes</title>

# ADR 0009 — Choosing several images, and replacing one in place

**Date:** 2026-09-03 · **Status:** Accepted · **Scope items:** Product media · **Builds on:** [`AGENTS.md`](../../AGENTS.md) §8

## Context

Staff reported that image upload failed from the admin, and that the screen
would not take more than one image at a time.

The **failure** is fixed and is not this record's subject. It was two faults in
one code path, found and fixed in the "automate catalogue forms and harden
uploads" work: `presignUpload` signed the 10MiB _cap_ as `ContentLength` rather
than the file's real length, which made the presigned URL a promise the browser
could not keep and produced a signature mismatch on every upload; and the AWS
SDK was attaching checksum fields R2 rejects. Both the admin path and the
**customer payment-receipt** path were broken by the first. `beginUpload` now
takes the real length, refuses it above the cap, and signs it; the test asserts
that two different lengths produce two different signatures, so a regression back
to signing a constant fails.

What remained were three things the screens themselves owed and did not deliver.

## Decisions

### 1. The browser may choose several files, because the backend always could

The edit screen read `files[0]` from a single-file input while the backend and
the create screen had both allowed five since the feature was built. It now takes
a whole selection up to the same cap and sends them one after another.

Sequential, not parallel: five concurrent multi-megabyte PUTs on a mobile
connection contend with each other and are likelier to time out than the same
five in sequence. Files beyond the cap are named as not fitting rather than
silently dropped, and a file that fails is reported with its own reason —
"storage refused it" and "that file is 30MB" need different things done about
them.

### 2. Replace is one transaction, not delete-then-add

There was no way to swap an image. The only route was remove then add, which
sends the replacement to the back of the gallery, so correcting the primary photo
meant re-ordering afterwards.

`finaliseUpload` now takes an optional `replacesMediaId`. The new row takes the
old row's `sort_order` and the old row is deleted in the same transaction, so the
gallery either shows the new image where the old one was, or is untouched. Done
from the browser as two calls, a dropped connection can land the delete and lose
the add — and the delete is the half that lands first.

Two details that are easy to get wrong:

- The replaced renditions are deleted **after** the transaction commits. Object
  deletion is an external effect and a CockroachDB transaction body may run more
  than once.
- They are skipped when the content hash is unchanged. Keys are content-hashed,
  so re-uploading an identical file writes the same objects, and "delete the old
  ones" would delete the ones just written.

The create screen gets the same control against the files held in the browser,
where replacing is a straight substitution — but the discarded preview URL still
has to be revoked, or the photo stays in memory for the life of the tab.

### 3. Alt text is a sentence, not a filename

Both screens passed `file.name` as the image's alt text, so every product image
in the catalogue would have been announced by a screen reader as "IMG 4021 dot
jpeg" — worse than nothing, because a screen reader skips a genuinely empty alt
and reads this one out.

This was not in the reported fault. It is created by the exact line that had to
change, and §2 puts WCAG 2.2 AA at the floor rather than the ceiling, so it is
fixed here rather than logged. Alt text is now an editable field on each image,
saved on blur, stored as `null` when cleared — the difference between "no
description" and "deliberately decorative" is one a screen reader acts on. A
replacement carries the existing description over: swapping in a better shot of
the same thing should not discard the sentence someone wrote about it.

### 4. One upload helper, not one per screen

Both screens had their own copy of begin → PUT → finalise, and with it their own
idea of what a failure meant. `upload-image.ts` holds it once, returns every
outcome as a value rather than throwing (the callers upload several files in a
row and must carry on past a failure), and applies the browser-side type and
size checks in one place.

That browser-side check is a courtesy, never the enforcement — `beginUpload`
refuses the same sizes and the real authority is `processImage`, which is the
only thing that ever holds the bytes. Its value is that a 30MB photo is refused
before four minutes of mobile data is spent on it. A test asserts the client's
cap equals the server's, so the two cannot drift into telling staff different
things.

## Consequences

- `finaliseUpload` takes an options object; existing calls are unaffected.
- New service function `updateMediaAlt`, new actions `replaceMediaAction` and
  `updateMediaAltAction`.
- `MediaSection` is split into a list and a per-image card, because each image
  now owns editable state.

## What could not be verified here

This environment has no CockroachDB instance and no R2 bucket, so the integration
suites and a real end-to-end upload did not run. What was verified: the presigned
URL's signed headers and that its signature varies with the length; the
selection, limit, replace, remove and revoke behaviour in the browser; and that
the client's byte cap equals the server's. The first real upload against a
configured bucket is still the thing that proves the fix — and if one fails, the
bucket's CORS policy is the next thing to check, applied with
`scripts/configure-r2-cors.ts`.
