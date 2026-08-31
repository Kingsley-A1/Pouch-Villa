import { randomUUID } from "node:crypto";
import { getPool, query } from "../db/client";
import { withTransaction } from "../db/transaction";
import {
  DERIVATIVES,
  MAX_IMAGE_BYTES,
  mediaKey,
  processImage,
  type DerivativeName,
} from "../storage/images";
import { deleteObject, getObjectBytes, presignUpload, publicUrl, putObject } from "../storage/r2";
import { recordAudit } from "./audit";

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

export type BeganUpload = {
  uploadId: string;
  url: string;
  stagingKey: string;
  expiresIn: number;
  maxBytes: number;
};

export async function beginUpload(
  productId: string,
  contentType: string,
  actor: { staffId: string },
): Promise<BeganUpload> {
  const stagingKey = `staging/${productId}/${randomUUID()}`;
  const { url, expiresIn } = await presignUpload(
    "public",
    stagingKey,
    contentType,
    MAX_IMAGE_BYTES,
  );

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

export async function finaliseUpload(
  uploadId: string,
  alt: string | null,
  actor: { staffId: string },
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

  const mediaId = await withTransaction(async (tx) => {
    const next = await tx.query(
      "SELECT coalesce(max(sort_order), -1) + 1 AS next FROM product_media WHERE product_id = $1",
      [upload.product_id],
    );
    const sortOrder = (next.rows[0] as { next: number }).next;

    const inserted = await tx.query(
      `INSERT INTO product_media
         (product_id, r2_key, kind, alt, width, height, sort_order, content_hash, byte_size, uploaded_by)
       VALUES ($1, $2, 'image', $3, $4, $5, $6, $7, $8, $9)
       RETURNING id`,
      [
        upload.product_id,
        mediaKey(upload.product_id, processed.hash, "card"),
        alt,
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
      action: "media.uploaded",
      entityType: "product_media",
      entityId: id,
      after: { productId: upload.product_id, width: processed.width, height: processed.height },
    });

    return id;
  });

  return { mediaId, width: processed.width, height: processed.height };
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
    for (const derivative of DERIVATIVES) {
      await deleteObject(
        "public",
        mediaKey(removed.product_id, removed.content_hash, derivative.name),
      ).catch(() => {});
    }
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
  alt: string | null;
  width: number | null;
  height: number | null;
  sortOrder: number;
  urls: Record<DerivativeName, string>;
};

export async function listProductMedia(productId: string): Promise<AdminMedia[]> {
  const rows = await query<{
    id: string;
    alt: string | null;
    width: number | null;
    height: number | null;
    sort_order: number;
    content_hash: string | null;
    r2_key: string;
  }>(
    `SELECT id, alt, width, height, sort_order, content_hash, r2_key
       FROM product_media
      WHERE product_id = $1 AND kind = 'image'
      ORDER BY sort_order`,
    [productId],
  );

  return rows.map((row) => ({
    id: row.id,
    alt: row.alt,
    width: row.width,
    height: row.height,
    sortOrder: row.sort_order,
    urls: urlsForHash(productId, row.content_hash, row.r2_key),
  }));
}

/**
 * Media predating the rendition pipeline has no content hash; those rows fall
 * back to whatever single key they were stored with rather than 404ing.
 */
export function urlsForHash(
  productId: string,
  contentHash: string | null,
  fallbackKey: string,
): Record<DerivativeName, string> {
  if (contentHash === null) {
    const url = publicUrl(fallbackKey);
    return { thumb: url, card: url, hero: url };
  }
  return {
    thumb: publicUrl(mediaKey(productId, contentHash, "thumb")),
    card: publicUrl(mediaKey(productId, contentHash, "card")),
    hero: publicUrl(mediaKey(productId, contentHash, "hero")),
  };
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
