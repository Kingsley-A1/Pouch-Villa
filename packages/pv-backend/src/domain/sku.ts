import { randomInt } from "node:crypto";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function skuFromProductName(productName: string, code: string): string {
  const stem = productName
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 59)
    .replace(/-+$/g, "")
    .toUpperCase();
  const suffix = code.toUpperCase();
  if (!/^[A-Z0-9]{4}$/.test(suffix)) throw new Error("An SKU code must have four characters.");
  return `${stem || "PRODUCT"}-${suffix}`;
}

export function generateSku(productName: string): string {
  let code = "";
  for (let index = 0; index < 4; index += 1) {
    code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  }
  return skuFromProductName(productName, code);
}
