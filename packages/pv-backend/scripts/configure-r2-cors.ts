import { resolve } from "node:path";
import { GetBucketCorsCommand, PutBucketCorsCommand } from "@aws-sdk/client-s3";
import { loadEnvFiles } from "../src/env";
import { buildR2CorsRules } from "../src/storage/r2-cors";
import { bucketName, getR2, type Bucket } from "../src/storage/r2";

async function main() {
  loadEnvFiles(resolve(process.cwd(), "../.."));
  loadEnvFiles(process.cwd());

  const configured = process.env.R2_ALLOWED_ORIGINS?.split(",").map((value) => value.trim());
  const origins = configured?.filter(Boolean) ?? [];
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
