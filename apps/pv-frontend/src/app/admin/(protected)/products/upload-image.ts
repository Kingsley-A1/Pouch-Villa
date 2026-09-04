import { describeUploadFailure } from "@/lib/upload-error";
import { beginUploadAction, finaliseUploadAction, replaceMediaAction } from "./media-actions";

/**
 * The three steps of putting one image on a product, in one place.
 *
 * Begin (get a short-lived pre-signed URL), PUT the bytes straight to R2, then
 * finalise server-side — where the bytes are fetched back, checked against their
 * magic bytes, stripped of EXIF and turned into derivatives. The create screen
 * and the edit screen both do exactly this, and when they each had their own
 * copy they also had their own idea of what a failure meant.
 *
 * Every outcome is a returned value, never a thrown error: the callers upload
 * several files in a row and need to carry on past a failure with the name of
 * the file that failed.
 */

/**
 * Must match `MAX_IMAGE_BYTES` in `@pv/backend/storage/image-formats`, which is
 * the real limit. Duplicated rather than imported so a Client Component does not
 * pull a module written against Node's Buffer into the browser bundle; a test
 * asserts the two agree, so they cannot drift silently.
 */
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

export const ACCEPTED_MEDIA = "image/jpeg,image/png,image/webp,image/avif";
export const ACCEPTED_MEDIA_TYPES = ACCEPTED_MEDIA.split(",");

export type UploadOutcome = { ok: true; message: string | null } | { ok: false; error: string };

function megabytes(bytes: number): string {
  return `${Math.round(bytes / 1024 / 1024)}MB`;
}

/**
 * Refuses a file the server was always going to refuse.
 *
 * `beginUpload` refuses the same sizes and signs the real length into the URL,
 * so this is not the enforcement — it is the difference between a checkable
 * mistake and four minutes of mobile data spent on a 30MB photo before anybody
 * says anything.
 */
export function rejectionReason(file: File): string | null {
  if (!ACCEPTED_MEDIA_TYPES.includes(file.type)) {
    return `${file.name} is not a JPEG, PNG, WebP or AVIF image.`;
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return `${file.name} is ${megabytes(file.size)} — the limit is ${megabytes(MAX_IMAGE_BYTES)}.`;
  }
  return null;
}

export async function uploadProductImage(
  productId: string,
  file: File,
  options: { replacesMediaId?: string } = {},
): Promise<UploadOutcome> {
  const refusal = rejectionReason(file);
  if (refusal !== null) return { ok: false, error: refusal };

  // The size is signed into the URL, so it has to be the file's real length.
  const began = await beginUploadAction(productId, file.type, file.size);
  if (!began.ok) return { ok: false, error: began.error };

  try {
    const put = await fetch(began.upload.url, {
      method: "PUT",
      body: file,
      headers: { "Content-Type": file.type },
    });
    if (!put.ok) {
      return {
        ok: false,
        error: `Storage refused ${file.name} (${put.status}). The upload link may have expired — try again.`,
      };
    }
  } catch (error) {
    // `fetch` throws rather than returning a response both for a dropped
    // connection and for a cross-origin request the browser blocked. The second
    // is invisible from here and is a bucket-configuration fault, which is why
    // `describeUploadFailure` names it rather than saying "check your connection".
    return { ok: false, error: `${file.name}: ${describeUploadFailure(error)}` };
  }

  const finalised =
    options.replacesMediaId === undefined
      ? await finaliseUploadAction(productId, began.upload.uploadId)
      : await replaceMediaAction(productId, options.replacesMediaId, began.upload.uploadId);

  if (finalised.error !== null) return { ok: false, error: `${file.name}: ${finalised.error}` };
  return { ok: true, message: finalised.message ?? null };
}
