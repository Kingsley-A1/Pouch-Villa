import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/**
 * Cloudflare R2 over the S3 API. Two buckets, deliberately separate:
 *
 *   public  — product media, served through a CDN with immutable keys.
 *   private — payment proofs. Financial documents containing bank details, so
 *             they are never public and every read is a short-lived signed URL.
 *
 * Nothing here falls back to the application filesystem. The prototype wrote to
 * `public/uploads`, which cannot work on a serverless host: a file written at
 * runtime is never served.
 */

export class StorageNotConfiguredError extends Error {
  constructor(missing: string) {
    super(`${missing} is not configured, so object storage is unavailable.`);
    this.name = "StorageNotConfiguredError";
  }
}

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new StorageNotConfiguredError(name);
  return value;
}

let client: S3Client | null = null;

export function getR2(): S3Client {
  client ??= new S3Client({
    region: "auto",
    endpoint: required("R2_ENDPOINT"),
    credentials: {
      accessKeyId: required("R2_ACCESS_KEY_ID"),
      secretAccessKey: required("R2_SECRET_ACCESS_KEY"),
    },
  });
  return client;
}

export type Bucket = "public" | "private";

export function bucketName(bucket: Bucket): string {
  return bucket === "public"
    ? required("R2_PUBLIC_BUCKET_NAME")
    : required("R2_PRIVATE_BUCKET_NAME");
}

export function isStorageConfigured(): boolean {
  return Boolean(
    process.env.R2_ENDPOINT?.trim() &&
    process.env.R2_ACCESS_KEY_ID?.trim() &&
    process.env.R2_SECRET_ACCESS_KEY?.trim() &&
    process.env.R2_PUBLIC_BUCKET_NAME?.trim(),
  );
}

const UPLOAD_URL_TTL_SECONDS = 5 * 60;
const READ_URL_TTL_SECONDS = 5 * 60;

/**
 * A short-lived URL the browser PUTs bytes to directly. The upload does not pass
 * through the application server — but the object is not trusted until
 * `finalise` has fetched it back and checked what it actually contains.
 *
 * **Nothing but `host` may be signed here, and that is the whole point.**
 *
 * This function used to pass the size cap as `ContentLength`, which SigV4 then
 * folded into the signature: the presigned URL came back with
 * `X-Amz-SignedHeaders=content-length;host`, committing the browser to sending
 * `Content-Length: 10485760` exactly. A browser sends the real length of the
 * file, so every upload of anything other than a precisely 10MiB image was
 * rejected with a signature mismatch — which is to say, every upload.
 *
 * A signed header is a promise about the request the browser will make, and the
 * browser is not taking instructions from us. So the size cap is enforced where
 * it can actually be checked, in three places that do not depend on a header:
 * the picker refuses an oversized file before asking for a URL, `beginUpload`
 * refuses to issue one for a declared size over the cap, and `processImage`
 * — the only authority, because it is the only one holding the bytes — rejects
 * the object after it is fetched back, and the staged object is deleted.
 */
export async function presignUpload(bucket: Bucket, key: string, contentType: string) {
  const url = await getSignedUrl(
    getR2(),
    new PutObjectCommand({
      Bucket: bucketName(bucket),
      Key: key,
      ContentType: contentType,
    }),
    { expiresIn: UPLOAD_URL_TTL_SECONDS },
  );
  return { url, key, expiresIn: UPLOAD_URL_TTL_SECONDS };
}

/** Payment proofs are read only through one of these, and every issue is audited. */
export async function presignRead(bucket: Bucket, key: string) {
  return getSignedUrl(getR2(), new GetObjectCommand({ Bucket: bucketName(bucket), Key: key }), {
    expiresIn: READ_URL_TTL_SECONDS,
  });
}

export async function getObjectBytes(bucket: Bucket, key: string): Promise<Buffer> {
  const result = await getR2().send(new GetObjectCommand({ Bucket: bucketName(bucket), Key: key }));
  const body = result.Body;
  if (body === undefined) throw new Error(`Object ${key} has no body.`);
  const chunks: Buffer[] = [];
  for await (const chunk of body as AsyncIterable<Uint8Array>) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

export async function putObject(
  bucket: Bucket,
  key: string,
  body: Buffer,
  contentType: string,
  cacheControl = "public, max-age=31536000, immutable",
) {
  await getR2().send(
    new PutObjectCommand({
      Bucket: bucketName(bucket),
      Key: key,
      Body: body,
      ContentType: contentType,
      CacheControl: cacheControl,
    }),
  );
}

export async function deleteObject(bucket: Bucket, key: string) {
  await getR2().send(new DeleteObjectCommand({ Bucket: bucketName(bucket), Key: key }));
}

/**
 * Public media is served from the CDN origin, never from a signed URL — a signed
 * URL would defeat caching and expire in a page someone left open.
 */
export function publicUrl(key: string): string {
  const base = required("R2_PUBLIC_BASE_URL").replace(/\/+$/, "");
  return `${base}/${key}`;
}
