/**
 * Reading a variant's axes — colour, size, storage — without tripping over a
 * CockroachDB difference that took a live product page down.
 *
 * ## The trap
 *
 * The obvious query is a correlated aggregate:
 *
 * ```sql
 * (SELECT jsonb_object_agg(vv.axis_code, vv.value)
 *    FROM variant_value vv WHERE vv.variant_id = v.id) AS axes
 * ```
 *
 * On PostgreSQL a variant with no axis rows aggregates an empty set and yields
 * `NULL`. CockroachDB decorrelates the subquery into a left join first, so that
 * variant reaches the aggregate as a NULL-extended row, and `jsonb_object_agg`
 * refuses a NULL key:
 *
 * ```
 * error: null value not allowed for object key   (SQLSTATE 22004)
 * ```
 *
 * One such row poisons the whole statement, not one output row. Since variants
 * became optional, a product saved without one has an axis-less variant — so
 * every product page, every cart read and every checkout for it returned a 500.
 *
 * Measured against the cluster rather than reasoned about. `WHERE axis_code IS
 * NOT NULL` inside the subquery does not help, and neither does `LEFT JOIN
 * LATERAL`: both are decorrelated the same way. Only two shapes survive — an
 * explicit `LEFT JOIN … GROUP BY` with an aggregate `FILTER`, which every
 * caller here would have to restructure around, and this one.
 *
 * ## The shape that works
 *
 * `jsonb_agg` accepts NULL elements, so aggregating *pairs* stays correlated,
 * stays a one-line change at each call site, and yields `NULL` for a variant
 * with no axes exactly as PostgreSQL would. The object is then assembled here.
 *
 * The alias is fixed rather than passed in: §5 forbids interpolating an
 * identifier into SQL, and all three callers already alias `product_variant`
 * as `v`.
 */

/** Aggregates `variant_value` for the row aliased `v`. Yields NULL when empty. */
export const VARIANT_AXES_SELECT = `(SELECT jsonb_agg(jsonb_build_array(vv.axis_code, vv.value))
               FROM variant_value vv WHERE vv.variant_id = v.id)`;

/** What {@link VARIANT_AXES_SELECT} returns: `[axisCode, value]` pairs, or NULL. */
export type VariantAxisPairs = [string, string][] | null;

/** Turns the pairs back into the record the domain uses. */
export function axesFromPairs(pairs: VariantAxisPairs): Record<string, string> {
  const axes: Record<string, string> = {};
  if (pairs === null) return axes;
  for (const [code, value] of pairs) axes[code] = value;
  return axes;
}
