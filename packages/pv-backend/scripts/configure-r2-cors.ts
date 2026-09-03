import { resolve } from "node:path";
import { GetBucketCorsCommand, PutBucketCorsCommand } from "@aws-sdk/client-s3";
import { loadEnvFiles } from "../src/env";
import { buildR2CorsRules } from "../src/storage/r2-cors";
import { bucketName, getR2, type Bucket } from "../src/storage/r2";

async function main() {
  const workspaceRoot = resolve(process.cwd(), "../..");
  const loaded = [
    ...loadEnvFiles(workspaceRoot).map((name) => `${workspaceRoot}/${name}`),
    ...loadEnvFiles(process.cwd()).map((name) => `${process.cwd()}/${name}`),
  ];

  const configured = process.env.R2_ALLOWED_ORIGINS?.split(",").map((value) => value.trim());
  const origins = configured?.filter(Boolean) ?? [];

  /**
   * Said here rather than left to `buildR2CorsRules`, which knows the rule but
   * not where the value was meant to come from. "At least one origin is
   * required" is true and unactionable; the thing an operator needs is the
   * variable name and the files that were actually read for it.
   */
  if (origins.length === 0) {
    throw new Error(
      [
        "R2_ALLOWED_ORIGINS is not set, so there is no origin to allow.",
        "",
        "Set it in the .env at the workspace root, as a comma-separated list of",
        "every address the site is served from — each one a full origin with its",
        "scheme, and no trailing slash:",
        "",
        "  R2_ALLOWED_ORIGINS=https://your-site,http://localhost:3000",
        "",
        loaded.length === 0
          ? `No env file was found at ${workspaceRoot} or ${process.cwd()}.`
          : `Env files read: ${loaded.join(", ")}`,
      ].join("\n"),
    );
  }

  const rules = buildR2CorsRules(origins);

  for (const bucket of ["public", "private"] satisfies Bucket[]) {
    const Bucket = bucketName(bucket);
    await getR2().send(
      new PutBucketCorsCommand({ Bucket, CORSConfiguration: { CORSRules: rules } }),
    );
    const applied = await getR2().send(new GetBucketCorsCommand({ Bucket }));
    console.log(`${bucket}: ${applied.CORSRules?.length ?? 0} CORS rule(s) applied`);
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(
    message === "Access Denied"
      ? "R2 denied the bucket-policy change. Use an R2 Admin Read & Write token for this command."
      : message,
  );
  process.exitCode = 1;
});
