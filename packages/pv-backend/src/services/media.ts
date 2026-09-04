import { randomUUID } from "node:crypto";
import { getPool, query } from "../db/client";
import { withTransaction } from "../db/transaction";
import { DERIVATIVES, MAX_IMAGE_BYTES, type DerivativeName } from "../storage/image-formats";
import { mediaKey } from "../storage/media-key";
import { deleteObject, getObjectBytes, presignUpload, putObject } from "../storage/r2";
import { recordAudit } from "./audit";
import { urlsForHash } from "./media-urls";

/**
 * Product media, uploaded in two steps.
 *
 * 1. `beginUpload` returns a short-lived pre-signed URL. The browser PUTs the
 *    file straight to R2, so the bytes never pass through the app server — which
 *    matters on Nigerian mobile data, where a 6MB photo relayed through a
 *    serverless function is slow and can time out.
 * 2. `finaliseUpload` fetches those bytes back server-side, checks the magic
 *    bytes, strips EXIF by re-encoding, builds the derivatives, and only then
 *    writes a product_media row.
 *
 * Step 2 is what makes step 1 safe. Until it runs, the staged object is
 * untrusted and is not reachable from any product.
 */

export class UploadNotFoundError extends Error {
  constructor() {
    super("That upload was not found or has already been handled.");
    this.name = "UploadNotFoundError";
  }
}

export class MediaNotFoundError extends Error {
  constructor() {
    super("That image was not found on this product.");
    this.name = "MediaNotFoundError";
  }
}

export type BeganUpload = {
  uploadId: string;
  url: string;
  stagingKey: string;
  expiresIn: number;
  maxBytes: number;
};

export class InvalidUploadSizeError extends Error {
  constructor() {
    super("That image is empty or larger than the upload limit.");
    this.name = "InvalidUploadSizeError";
  }
}

/**
 * `contentLength` is the file's real size, and it is signed into the URL — so it
 * is both an early refusal and a genuine cap. A browser that then sends anything
 * other than exactly that many bytes fails the signature check at R2, which is
 * why the size is checked here before a URL exists rather than trusted after.
 *
 * The last word still belongs to `processImage`, which is the only thing that
 * ever holds the bytes.
 */
export async function beginUpload(
  productId: string,
  contentType: string,
  contentLength: number,
  actor: { staffId: string },
): Promise<BeganUpload> {
  if (
    !Number.isSafeInteger(contentLength) ||
    contentLength <= 0 ||
    contentLength > MAX_IMAGE_BYTES
  ) {
    throw new InvalidUploadSizeError();
  }
  const stagingKey = `staging/${productId}/${randomUUID()}`;
  const { url, expiresIn } = await presignUpload("public", stagingKey, contentType, contentLength);

  const rows = await query<{ id: string }>(
    `INSERT INTO media_upload (product_id, staging_key, created_by)
          VALUES ($1, $2, $3)
       RETURNING id`,
    [productId, stagingKey, actor.staffId],
  );

  return {
    uploadId: rows[0]!.id,
    url,
    stagingKey,
    expiresIn,
    maxBytes: MAX_IMAGE_BYTES,
  };
}

export type FinalisedMedia = { mediaId: string; width: number; height: number };

/**
 * `replacesMediaId` swaps a new image into an existing one's place.
 *
 * Doing it as add-then-delete-then-reorder would be three round trips with three
 * chances to leave the product showing two versions of the same photo, or none.
 * Here the new row takes the old row's `sort_order` and the old row goes, in one
 * transaction — so the gallery either has the new image where the old one was,
 * or is untouched.
 *
 * The old renditions are deleted **after** the transaction commits: object
 * deletion is an external effect, and a CockroachDB transaction body may be run
 * more than once.
 */
export async function finaliseUpload(
  uploadId: string,
  actor: { staffId: string },
  options: { replacesMediaId?: string } = {},
): Promise<FinalisedMedia> {
  const staged = await query<{ id: string; product_id: string; staging_key: string }>(
    `SELECT id, product_id, staging_key FROM media_upload
      WHERE id = $1 AND status = 'pending'`,
    [uploadId],
  );
  const upload = staged[0];
  if (upload === undefined) throw new UploadNotFoundError();

  let processed;
  try {
    const bytes = await getObjectBytes("public", upload.staging_key);
    // Loaded here, not at module scope: sharp dlopens libvips on import, and
    // every other function in this file — listing media, building URLs, sweeping
    // stale uploads — must stay callable without that binary present.
    const { processImage } = await import("../storage/images");
    processed = await processImage(bytes);
  } catch (error) {
    // A rejected upload leaves nothing behind: the staged object goes, and the
    // row records why so the same bad file is not retried blindly.
    await deleteObject("public", upload.staging_key).catch(() => {});
    await query("UPDATE media_upload SET status = 'rejected', reject_reason = $2 WHERE id = $1", [
      uploadId,
      error instanceof Error ? error.message : "Unreadable image",
    ]);
    throw error;
  }

  const totalBytes = processed.renditions.reduce(
    (total, rendition) => total + rendition.bytes.length,
    0,
  );

  for (const rendition of processed.renditions) {
    await putObject(
      "public",
      mediaKey(upload.product_id, processed.hash, rendition.name),
      rendition.bytes,
      "image/webp",
    );
  }

  // The staged original has served its purpose; only the derivatives are served.
  await deleteObject("public", upload.staging_key).catch(() => {});

  const { mediaId, replacedHash } = await withTransaction(async (tx) => {
    /**
     * Where the new image lands.
     *
     * Replacing takes the old row's slot so the gallery does not visibly
     * reshuffle; otherwise the image goes on the end. The replaced row is read
     * inside the transaction so a concurrent reorder cannot leave the new image
     * in a position the old one no longer held.
     */
    let replaced: { sort_order: number; content_hash: string | null } | null = null;
    if (options.replacesMediaId !== undefined) {
      const existing = await tx.query(
        "SELECT sort_order, content_hash FROM product_media WHERE id = $1 AND product_id = $2",
        [options.replacesMediaId, upload.product_id],
      );
      replaced = (existing.rows[0] as { sort_order: number; content_hash: string | null }) ?? null;
      if (replaced === null) throw new MediaNotFoundError();
    }

    let sortOrder: number;
    if (replaced !== null) {
      sortOrder = replaced.sort_order;
    } else {
      const next = await tx.query(
        "SELECT coalesce(max(sort_order), -1) + 1 AS next FROM product_media WHERE product_id = $1",
        [upload.product_id],
      );
      sortOrder = (next.rows[0] as { next: number }).next;
    }

    if (options.replacesMediaId !== undefined) {
      await tx.query("DELETE FROM product_media WHERE id = $1", [options.replacesMediaId]);
    }

    const inserted = await tx.query(
      `INSERT INTO product_media
         (product_id, r2_key, kind, width, height, sort_order, content_hash, byte_size, uploaded_by)
       VALUES ($1, $2, 'image', $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [
        upload.product_id,
        mediaKey(upload.product_id, processed.hash, "card"),
        processed.width,
        processed.height,
        sortOrder,
        processed.hash,
        totalBytes,
        actor.staffId,
      ],
    );
    const id = (inserted.rows[0] as { id: string }).id;

    await tx.query(
      "UPDATE media_upload SET status = 'finalised', finalised_at = now() WHERE id = $1",
      [uploadId],
    );

    await recordAudit(tx, {
      actorType: "staff",
      actorId: actor.staffId,
      action: replaced === null ? "media.uploaded" : "media.replaced",
      entityType: "product_media",
      entityId: id,
      ...(replaced === null ? {} : { before: { mediaId: options.replacesMediaId } }),
      after: { productId: upload.product_id, width: processed.width, height: processed.height },
    });

    return { mediaId: id, replacedHash: replaced?.content_hash ?? null };
  });

  /**
   * Only now, and only when the replaced image's bytes are not the new image's.
   * Keys are content-hashed, so re-uploading an identical file produces the same
   * objects — deleting "the old ones" would delete the ones just written.
   */
  if (replacedHash !== null && replacedHash !== processed.hash) {
    await deleteRenditions(upload.product_id, replacedHash);
  }

  return { mediaId, width: processed.width, height: processed.height };
}

/** Every derivative for one content hash. Missing objects are not an error. */
async function deleteRenditions(productId: string, contentHash: string): Promise<void> {
  for (const derivative of DERIVATIVES) {
    await deleteObject("public", mediaKey(productId, contentHash, derivative.name)).catch(() => {});
  }
}

export async function deleteMedia(mediaId: string, actor: { staffId: string }) {
  const rows = await query<{ product_id: string; content_hash: string | null }>(
    "DELETE FROM product_media WHERE id = $1 RETURNING product_id, content_hash",
    [mediaId],
  );
  const removed = rows[0];
  if (removed === undefined) return false;

  // Deleting a product must not orphan its objects, so the renditions go too.
  if (removed.content_hash !== null) {
    await deleteRenditions(removed.product_id, removed.content_hash);
  }

  await recordAudit(getPool(), {
    actorType: "staff",
    actorId: actor.staffId,
    action: "media.deleted",
    entityType: "product_media",
    entityId: mediaId,
  });
  return true;
}

export async function reorderMedia(
  productId: string,
  orderedIds: string[],
  actor: { staffId: string },
) {
  return withTransaction(async (tx) => {
    for (const [index, id] of orderedIds.entries()) {
      await tx.query("UPDATE product_media SET sort_order = $3 WHERE id = $1 AND product_id = $2", [
        id,
        productId,
        index,
      ]);
    }
    await recordAudit(tx, {
      actorType: "staff",
      actorId: actor.staffId,
      action: "media.reordered",
      entityType: "product",
      entityId: productId,
      after: { order: orderedIds },
    });
  });
}

export type AdminMedia = {
  id: string;
  width: number | null;
  height: number | null;
  sortOrder: number;
  urls: Record<DerivativeName, string>;
};

export async function listProductMedia(productId: string): Promise<AdminMedia[]> {
  const rows = await query<{
    id: string;
    width: number | null;
    height: number | null;
    sort_order: number;
    content_hash: string | null;
    r2_key: string;
  }>(
    `SELECT id, width, height, sort_order, content_hash, r2_key
       FROM product_media
      WHERE product_id = $1 AND kind = 'image'
      ORDER BY sort_order`,
    [productId],
  );

  return rows.map((row) => ({
    id: row.id,
    width: row.width,
    height: row.height,
    sortOrder: row.sort_order,
    urls: urlsForHash(productId, row.content_hash, row.r2_key),
  }));
}

/**
 * Sweeps staged uploads that were never finalised — an abandoned tab, a failed
 * PUT, a browser closed mid-upload. Without this, R2 slowly fills with objects
 * nothing references.
 */
export async function sweepAbandonedUploads(olderThanHours = 24) {
  const rows = await query<{ id: string; staging_key: string }>(
    `SELECT id, staging_key FROM media_upload
      WHERE status = 'pending' AND created_at < now() - ($1 || ' hours')::INTERVAL
      LIMIT 500`,
    [String(olderThanHours)],
  );
  for (const row of rows) {
    await deleteObject("public", row.staging_key).catch(() => {});
    await query(
      "UPDATE media_upload SET status = 'rejected', reject_reason = 'abandoned' WHERE id = $1",
      [row.id],
    );
  }
  return rows.length;
}
