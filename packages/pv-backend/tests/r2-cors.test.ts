import { describe, expect, it } from "vitest";
import { buildR2CorsRules } from "../src/storage/r2-cors";

describe("R2 browser upload CORS", () => {
  it("allows only upload traffic from normalized configured origins", () => {
    expect(
      buildR2CorsRules(["https://pouchvilla.com.ng/", "https://www.pouchvilla.com.ng"]),
    ).toEqual([
      {
        AllowedOrigins: ["https://pouchvilla.com.ng", "https://www.pouchvilla.com.ng"],
        AllowedMethods: ["PUT"],
        AllowedHeaders: ["Content-Type"],
        ExposeHeaders: ["ETag"],
        MaxAgeSeconds: 3600,
      },
    ]);
  });
});
