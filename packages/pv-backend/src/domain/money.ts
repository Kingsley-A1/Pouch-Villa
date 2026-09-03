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
