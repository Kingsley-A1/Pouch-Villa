import { randomUUID } from "node:crypto";
import { query } from "../db/client";
import { withTransaction } from "../db/transaction";
import { DERIVATIVES, MAX_IMAGE_BYTES } from "../storage/image-formats";
import { catalogueMediaKey, type CatalogueMediaOwner } from "../storage/media-key";
import { deleteObject, getObjectBytes, presignUpload, putObject } from "../storage/r2";
import { recordAudit } from "./audit";
import { catalogueImageUrl } from "./catalogue-media-urls";
import { InvalidUploadSizeError, UploadNotFoundError } from "./media";

/**
 * The photograph on a category, the logo on a brand, and the picture on a hero
 * slide.
 *
 * Deliberately a second, narrower path rather than an option threaded through
 * `services/media.ts`. That file is about a product *gallery* — sort order,
 * replacing an image in place without the grid reshuffling, a variant
 * reference. A category has exactly one photograph and a brand exactly one
 * logo, so all of that machinery would be dead weight and every one of its
 * functions would grow a branch that never fires for a product.
 *
 * What is genuinely shared is shared: the same staging table, the same
 * pre-signed upload, and above all the same `processImage` — magic-byte check,
 * EXIF stripped by re-encoding, derivatives built once. A brand logo is
 * uploaded by a staff member from a phone exactly as a product photo is, and it
 * deserves the same treatment rather than a weaker second pipeline.
 */

export type BeganCatalogueUpload = {
  uploadId: string;
  url: string;
  stagingKey: string;
  expiresIn: number;
  maxBytes: number;
};

export type CatalogueImage = {
  /** The card rendition, which is the only size either surface renders at. */
  url: string;
  width: number;
  height: number;
  alt: string | null;
};

/**
 * Which of the three owners a staged upload belongs to.
 *
 * The owner never becomes an interpolated column or table name — AGENTS.md
 * section 5 forbids that even behind an enum guard — so every function below
 * branches into distinct prepared statements instead. It is more lines than one
 * templated query and it is the lookup the rule asks for.
 */
async function stagedOwnerId(uploadId: string): Promise<{
  owner: CatalogueMediaOwner;
  ownerId: string;
  stagingKey: string;
} | null> {
  const rows = await query<{
    category_id: string | null;
    brand_id: string | null;
    hero_slide_id: string | null;
    staging_key: string;
  }>(
    `SELECT category_id, brand_id, hero_slide_id, staging_key FROM media_upload
      WHERE id = $1 AND status = 'pending'`,
    [uploadId],
  );
  const row = rows[0];
  if (row === undefined) return null;
  if (row.category_id !== null) {
    return { owner: "category", ownerId: row.category_id, stagingKey: row.staging_key };
  }
  if (row.brand_id !== null) {
    return { owner: "brand", ownerId: row.brand_id, stagingKey: row.staging_key };
  }
  if (row.hero_slide_id !== null) {
    return { owner: "hero", ownerId: row.hero_slide_id, stagingKey: row.staging_key };
  }
  // A product upload finalised through the wrong service. Not an error worth a
  // distinct type: to this caller the upload simply is not one of ours.
  return null;
}

export async function beginCatalogueUpload(
  owner: CatalogueMediaOwner,
  ownerId: string,
  contentType: string,
  contentLength: number,
  actor: { staffId: string },
): Promise<BeganCatalogueUpload> {
  if (
    !Number.isSafeInteger(contentLength) ||
    contentLength <= 0 ||
    contentLength > MAX_IMAGE_BYTES
  ) {
    throw new InvalidUploadSizeError();
  }

  const stagingKey = `staging/${owner}/${ownerId}/${randomUUID()}`;
  const { url, expiresIn } = await presignUpload("public", stagingKey, contentType, contentLength);

  const rows =
    owner === "category"
      ? await query<{ id: string }>(
          `INSERT INTO media_upload (category_id, staging_key, created_by)
                VALUES ($1, $2, $3) RETURNING id`,
          [ownerId, stagingKey, actor.staffId],
        )
      : owner === "brand"
        ? await query<{ id: string }>(
            `INSERT INTO media_upload (brand_id, staging_key, created_by)
                  VALUES ($1, $2, $3) RETURNING id`,
            [ownerId, stagingKey, actor.staffId],
          )
        : await query<{ id: string }>(
            `INSERT INTO media_upload (hero_slide_id, staging_key, created_by)
                  VALUES ($1, $2, $3) RETURNING id`,
            [ownerId, stagingKey, actor.staffId],
          );

  const inserted = rows[0];
  if (inserted === undefined) throw new UploadNotFoundError();

  return { uploadId: inserted.id, url, stagingKey, expiresIn, maxBytes: MAX_IMAGE_BYTES };
}

/**
 * Turns a staged upload into the owner's one image, replacing whatever was
 * there.
 *
 * The previous row is read and deleted inside the same transaction as the
 * insert, so a category is never briefly without a photograph and never briefly
 * has two. The old objects go afterwards, and only once the transaction has
 * committed: object deletion is an external effect and a CockroachDB
 * transaction body may be run more than once (AGENTS.md section 3).
 */
export async function finaliseCatalogueUpload(
  uploadId: string,
  actor: { staffId: string },
): Promise<CatalogueImage> {
  const staged = await stagedOwnerId(uploadId);
  if (staged === null) throw new UploadNotFoundError();
  const { owner, ownerId, stagingKey } = staged;

  let processed;
  try {
    const bytes = await getObjectBytes("public", stagingKey);
    // Imported here, not at module scope, for the same reason media.ts does it:
    // sharp dlopens libvips, and nothing that only reads an image URL should
    // pay for that.
    const { processImage } = await import("../storage/images");
    processed = await processImage(bytes);
  } catch (error) {
    await deleteObject("public", stagingKey).catch(() => {});
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
      catalogueMediaKey(owner, ownerId, processed.hash, rendition.name),
      rendition.bytes,
      "image/webp",
    );
  }

  await deleteObject("public", stagingKey).catch(() => {});

  const replacedHash = await withTransaction(async (tx) => {
    const existing =
      owner === "category"
        ? await tx.query("SELECT content_hash FROM catalogue_media WHERE category_id = $1", [
            ownerId,
          ])
        : owner === "brand"
          ? await tx.query("SELECT content_hash FROM catalogue_media WHERE brand_id = $1", [
              ownerId,
            ])
          : // A hero slide keeps its picture on its own row rather than in
            // catalogue_media — see the note on `CatalogueMediaOwner`.
            await tx.query("SELECT image_hash AS content_hash FROM hero_slide WHERE id = $1", [
              ownerId,
            ]);
    const previous =
      (existing.rows[0] as { content_hash: string | null } | undefined)?.content_hash ?? null;

    if (previous !== null && owner !== "hero") {
      // The hero row is updated in place below, so it has nothing to delete
      // first; the other two own a `catalogue_media` row that has to go.
      if (owner === "category") {
        await tx.query("DELETE FROM catalogue_media WHERE category_id = $1", [ownerId]);
      } else {
        await tx.query("DELETE FROM catalogue_media WHERE brand_id = $1", [ownerId]);
      }
    }

    const key = catalogueMediaKey(owner, ownerId, processed.hash, "card");
    if (owner === "category") {
      await tx.query(
        `INSERT INTO catalogue_media
           (category_id, r2_key, content_hash, width, height, byte_size, uploaded_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          ownerId,
          key,
          processed.hash,
          processed.width,
          processed.height,
          totalBytes,
          actor.staffId,
        ],
      );
    } else if (owner === "brand") {
      await tx.query(
        `INSERT INTO catalogue_media
           (brand_id, r2_key, content_hash, width, height, byte_size, uploaded_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          ownerId,
          key,
          processed.hash,
          processed.width,
          processed.height,
          totalBytes,
          actor.staffId,
        ],
      );
    }

    if (owner === "hero") {
      // The hero renders at the largest derivative, so that is the key stored.
      await tx.query(
        `UPDATE hero_slide
            SET image_r2_key = $2, image_hash = $3, image_width = $4, image_height = $5,
                updated_at = now(), updated_by = $6
          WHERE id = $1`,
        [
          ownerId,
          catalogueMediaKey(owner, ownerId, processed.hash, "hero"),
          processed.hash,
          processed.width,
          processed.height,
          actor.staffId,
        ],
      );
    }

    await tx.query(
      "UPDATE media_upload SET status = 'finalised', finalised_at = now() WHERE id = $1",
      [uploadId],
    );

    await recordAudit(tx, {
      actorType: "staff",
      actorId: actor.staffId,
      action: previous === null ? "catalogue_media.uploaded" : "catalogue_media.replaced",
      entityType: owner,
      entityId: ownerId,
      after: { width: processed.width, height: processed.height },
    });

    return previous;
  });

  // Keys are content-hashed, so re-uploading an identical file produces the same
  // objects. Deleting "the old ones" would then delete the ones just written.
  if (replacedHash !== null && replacedHash !== processed.hash) {
    await deleteRenditions(owner, ownerId, replacedHash);
  }

  return {
    url: catalogueImageUrl(owner, ownerId, processed.hash),
    width: processed.width,
    height: processed.height,
    alt: null,
  };
}

export async function deleteCatalogueImage(
  owner: CatalogueMediaOwner,
  ownerId: string,
  actor: { staffId: string },
): Promise<boolean> {
  const rows =
    owner === "category"
      ? await query<{ content_hash: string }>(
          "DELETE FROM catalogue_media WHERE category_id = $1 RETURNING content_hash",
          [ownerId],
        )
      : owner === "brand"
        ? await query<{ content_hash: string }>(
            "DELETE FROM catalogue_media WHERE brand_id = $1 RETURNING content_hash",
            [ownerId],
          )
        : // The slide itself survives; only its picture is cleared, so the CEO
          // can put a different one on the same slide without rewriting it.
          await query<{ content_hash: string }>(
            `UPDATE hero_slide
                SET image_r2_key = NULL, image_hash = NULL,
                    image_width = NULL, image_height = NULL, updated_at = now()
              WHERE id = $1 AND image_hash IS NOT NULL
              RETURNING image_hash AS content_hash`,
            [ownerId],
          );

  const removed = rows[0];
  if (removed === undefined) return false;

  // Section 8: deleting the owner must not orphan its objects.
  await deleteRenditions(owner, ownerId, removed.content_hash);
  await withTransaction(async (tx) => {
    await recordAudit(tx, {
      actorType: "staff",
      actorId: actor.staffId,
      action: "catalogue_media.deleted",
      entityType: owner,
      entityId: ownerId,
      before: { contentHash: removed.content_hash },
    });
  });
  return true;
}

async function deleteRenditions(
  owner: CatalogueMediaOwner,
  ownerId: string,
  contentHash: string,
): Promise<void> {
  for (const derivative of DERIVATIVES) {
    await deleteObject(
      "public",
      catalogueMediaKey(owner, ownerId, contentHash, derivative.name),
    ).catch(() => {});
  }
}

/**
 * The CDN URL for an owner's card rendition.
 *
 * Re-exported from `catalogue-media-urls.ts` rather than defined here, because
 * every storefront read needs it and this module imports the R2 write path.
 */
export { catalogueImageUrl };
