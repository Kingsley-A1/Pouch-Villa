<title>ADR 0013 — Reading variant axes on CockroachDB</title>

# ADR 0013 — Why variant axes are aggregated as pairs, not as an object

**Date:** 2026-09-04 · **Status:** Accepted · **Forced by:** [`AGENTS.md`](../../AGENTS.md) §3

## What happened

Every product page, cart read and checkout for a product whose variant had no
colour or size returned a 500. In production, that was every product: variants
became optional at upload, so a product saved without one carries a variant with
no axis rows at all.

The page still answered `200`, which is why nothing caught it. The throw happened
inside a Suspense boundary, so the shell streamed, the browser rendered
`Loading`, and then replaced it with the route error boundary. To `curl` and to
the route checker it looked like a page that worked.

```
error: null value not allowed for object key   SQLSTATE 22004
  at listVariants (packages/pv-backend/src/services/catalogue.ts)
```

## The cause

The query was the obvious one, and it is correct PostgreSQL:

```sql
(SELECT jsonb_object_agg(vv.axis_code, vv.value)
   FROM variant_value vv WHERE vv.variant_id = v.id) AS axes
```

On PostgreSQL a variant with no rows aggregates an empty set and yields `NULL`.
CockroachDB decorrelates the subquery into a left join before evaluating it, so
that variant reaches the aggregate as a NULL-extended row — and `jsonb_object_agg`
refuses a NULL key. One such row fails the **whole statement**, not one output
row, so a single axis-less variant took down every product in the same query.

`variant_value.axis_code` is `STRING NOT NULL` and the table held no NULLs. The
NULL is manufactured by the rewrite.

## What was measured, not assumed

Every candidate was run against the live cluster. Three plausible fixes do not
work:

| Shape                                                 | Result |
| ----------------------------------------------------- | ------ |
| `WHERE vv.axis_code IS NOT NULL` inside the subquery  | fails  |
| `LEFT JOIN LATERAL (SELECT jsonb_object_agg(…))`      | fails  |
| `coalesce(<the subquery>, '{}')`                      | fails  |
| `LEFT JOIN … GROUP BY … FILTER (WHERE … IS NOT NULL)` | works  |
| `jsonb_agg(jsonb_build_array(axis_code, value))`      | works  |

The first three all decorrelate the same way. Filtering inside the subquery does
not help because the filter is folded into the join condition, and the
NULL-extended row is produced _after_ it.

## The decision

**Aggregate pairs, not an object, and build the record in TypeScript.**
`jsonb_agg` accepts NULL elements, so it survives the rewrite and returns `NULL`
for an empty set exactly as PostgreSQL would.

The SQL fragment and its decoder live together in
[`src/db/variant-axes.ts`](../../packages/pv-backend/src/db/variant-axes.ts), and
all three readers — the catalogue, the cart and order placement — use them. They
had three copies of the same subquery, which is why one bug was three bugs.

The `LEFT JOIN … GROUP BY … FILTER` form also works and was rejected: the cart
and order queries select a dozen columns across four joins, and every one of them
would have had to enter a `GROUP BY` for the sake of one field.

The alias is fixed rather than passed in. §5 forbids interpolating an identifier
into SQL, and all three callers already alias `product_variant` as `v`.

## Consequences

- **A regression test that needs a real cluster.**
  `tests/variant-axes.integration.test.ts` publishes a product whose variant has
  no axes and reads it back three ways. No mock reproduces this: the SQL is
  valid, the schema forbids the NULL, and the defect exists only in the
  optimiser. Confirmed by reverting the fix — all three tests fail with the
  production error, and pass with it.
- **The route checker now visits a product page.** It followed the first product
  link on the home page rather than a fixed path, because the slug depends on
  what is published. Every route it checked before this still answered 200 while
  the product page was broken.
- **`jsonb_object_agg` over a correlated subquery is now a thing to avoid**
  everywhere in this codebase, not only here. Any new query that reaches for it
  should use `VARIANT_AXES_SELECT`'s shape instead.

## The wider lesson

§3 says CockroachDB "speaks the Postgres wire protocol but is a distributed
database", and lists the traps that were known. This is one that was not: the
query is valid PostgreSQL, passes review, works against every row that has data,
and fails only on the empty case — which is the case that appears the moment a
field becomes optional.
