/**
 * Checked accessors for cases where an index is provably in range but the compiler
 * cannot prove it. They exist so `noUncheckedIndexedAccess` can stay on without
 * reintroducing the non-null assertion it was turned on to catch: a genuinely
 * out-of-range read fails loudly here rather than surfacing as `undefined` three
 * layers away.
 */

export function at<T>(values: readonly T[], index: number): T {
  const value = values[index];
  if (value === undefined) {
    throw new RangeError(`Index ${index} is out of range for a list of ${values.length}.`);
  }
  return value;
}

export function must<T>(value: T | null | undefined, description: string): T {
  if (value === null || value === undefined) {
    throw new Error(`Expected ${description} to be present.`);
  }
  return value;
}
