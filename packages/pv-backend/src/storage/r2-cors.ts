import type { CORSRule } from "@aws-sdk/client-s3";

export function buildR2CorsRules(origins: readonly string[]): CORSRule[] {
  const allowedOrigins = [...new Set(origins.map((origin) => new URL(origin).origin))];
  if (allowedOrigins.length === 0) throw new Error("At least one R2 browser origin is required.");
  return [
    {
      AllowedOrigins: allowedOrigins,
      AllowedMethods: ["PUT"],
      AllowedHeaders: ["Content-Type"],
      ExposeHeaders: ["ETag"],
      MaxAgeSeconds: 3600,
    },
  ];
}
