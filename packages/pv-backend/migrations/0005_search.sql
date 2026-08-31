-- Real search: a full-text index for relevance, plus trigrams for misspellings.
--
-- The prototype filtered with `LIKE '%q%'`, which cannot use an index, cannot
-- rank, and matched substrings of SKUs and descriptions — so searching "blue"
-- returned anything whose SKU happened to contain those letters.
--
-- Two CockroachDB limits shape this. `setweight()` is unimplemented and tsvector
-- `||` is unsupported, so the usual weighted-concatenation trick is unavailable:
-- the column is one vector built from the concatenated *text*. Field weighting is
-- recovered at query time instead, where the ranking expression adds a trigram
-- similarity score on the name — which also does the fuzzy-matching job.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

ALTER TABLE product ADD COLUMN IF NOT EXISTS search_vector TSVECTOR
  AS (
    to_tsvector(
      'english',
      coalesce(name, '') || ' ' || coalesce(summary, '') || ' ' || coalesce(description, '')
    )
  ) STORED;

CREATE INVERTED INDEX IF NOT EXISTS product_search_idx ON product (search_vector);

-- Trigram index on the name alone: fuzzy matching is for "otterbocks" finding
-- "OtterBox", and running it across descriptions would surface noise.
CREATE INDEX IF NOT EXISTS product_name_trgm_idx ON product USING GIN (name gin_trgm_ops);
