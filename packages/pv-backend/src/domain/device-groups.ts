/**
 * Splitting an ordered list of models into the device classes they belong to.
 *
 * Three surfaces need this now — the storefront finder, the product page's
 * "fits these devices", and the admin's compatibility picker — and each had
 * begun to answer the same question its own way. The rules that matter are easy
 * to get subtly wrong and are worth stating once:
 *
 *   * **The order comes from the caller, not from here.** Every query already
 *     sorts by the class sort order the CEO set, then by the model's own. This
 *     preserves first-appearance order rather than re-sorting, so what a shopper
 *     sees is what was arranged in the admin.
 *   * **Unfiled models are a group, not a mistake.** A class is optional per
 *     brand, so `null` is a legitimate bucket and keeps its place in the order.
 *   * **A list with no classes at all comes back as one unlabelled group.** A
 *     tier nobody filled in must never render as a heading in front of a
 *     customer, and every caller would otherwise need that guard itself.
 */

export type ClassifiedDevice = { lineName?: string | null };

export type DeviceClassGroup<T> = { lineName: string | null; devices: T[] };

export function groupByDeviceClass<T extends ClassifiedDevice>(
  devices: readonly T[],
): DeviceClassGroup<T>[] {
  const groups = new Map<string | null, T[]>();
  for (const device of devices) {
    const line = device.lineName ?? null;
    const existing = groups.get(line);
    if (existing === undefined) groups.set(line, [device]);
    else existing.push(device);
  }

  const entries = [...groups];
  const anyNamed = entries.some(([lineName]) => lineName !== null);
  if (!anyNamed) return [{ lineName: null, devices: [...devices] }];

  return entries.map(([lineName, grouped]) => ({ lineName, devices: grouped }));
}
