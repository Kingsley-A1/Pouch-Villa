/**
 * Money is an integer count of kobo in a branded type, so a bare `number` — which
 * could be naira, kobo, or a float that lost a fraction — will not typecheck as a
 * price. Every conversion is explicit and happens here.
 */

declare const koboBrand: unique symbol;

export type Kobo = number & { readonly [koboBrand]: true };

export const KOBO_PER_NAIRA = 100;

export class InvalidMoneyError extends Error {
  constructor(value: unknown) {
    super(`${String(value)} is not a valid amount in kobo.`);
    this.name = "InvalidMoneyError";
  }
}

/** The only way into the type. Rejects floats rather than rounding silently. */
export function kobo(value: number): Kobo {
  if (!Number.isSafeInteger(value)) throw new InvalidMoneyError(value);
  return value as Kobo;
}

/** CockroachDB returns INT8 values as strings through `pg`; decode that boundary explicitly. */
export function koboFromDatabase(value: string): Kobo {
  if (!/^\d+$/.test(value)) throw new InvalidMoneyError(value);
  return kobo(Number(value));
}

/** Parse a staff-entered naira value exactly, without binary floating-point multiplication. */
export function parseNairaToKobo(value: string): Kobo {
  const normalized = value.replaceAll(",", "").trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) throw new InvalidMoneyError(value);
  const [nairaPart, fraction = ""] = normalized.split(".");
  const amount = Number(nairaPart) * KOBO_PER_NAIRA + Number(fraction.padEnd(2, "0"));
  return kobo(amount);
}

export function isKobo(value: unknown): value is Kobo {
  return typeof value === "number" && Number.isSafeInteger(value);
}

/** Rounding is explicit and stated: naira are rounded to the nearest kobo. */
export function nairaToKobo(naira: number): Kobo {
  if (!Number.isFinite(naira)) throw new InvalidMoneyError(naira);
  return kobo(Math.round(naira * KOBO_PER_NAIRA));
}

export function koboToNaira(amount: Kobo): number {
  return amount / KOBO_PER_NAIRA;
}

export function addKobo(...amounts: Kobo[]): Kobo {
  return kobo(amounts.reduce<number>((total, amount) => total + amount, 0));
}

export function multiplyKobo(amount: Kobo, quantity: number): Kobo {
  if (!Number.isSafeInteger(quantity) || quantity < 0) throw new InvalidMoneyError(quantity);
  return kobo(amount * quantity);
}

const NAIRA_FORMAT = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/** Whole naira: Pouch Villa does not price in kobo, and a trailing .00 is noise. */
export function formatKobo(amount: Kobo): string {
  return NAIRA_FORMAT.format(koboToNaira(amount));
}

/**
 * The same amount with no currency mark and two decimal places, for a document
 * that draws its own.
 *
 * Two differences from `formatKobo`, both deliberate. There is no ₦, because the
 * invoice renderer sets that symbol as artwork — no standard PDF font can encode
 * U+20A6 — and a stray one inside the number would be dropped mid-string. And
 * the kobo are shown even when they are zero: `formatKobo` drops `.00` as noise
 * on a price tag, but a receipt is a financial record, and a total that reads
 * `10,000` invites the question that `10,000.00` does not.
 */
const DOCUMENT_AMOUNT_FORMAT = new Intl.NumberFormat("en-NG", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatKoboForDocument(amount: Kobo): string {
  return DOCUMENT_AMOUNT_FORMAT.format(koboToNaira(amount));
}
