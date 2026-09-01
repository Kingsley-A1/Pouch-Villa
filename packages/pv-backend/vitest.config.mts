import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    // A single query against this CockroachDB Serverless cluster costs 2-3s even
    // warm, not the low milliseconds a local Postgres would. A test that chains
    // several operations — two mint+redeem cycles plus a couple of permission
    // writes is six-plus round trips — legitimately costs 15-25s, leaving too
    // little margin at 30s; it isn't a hang, just this cluster's real latency.
    testTimeout: 60_000,
    // A cold connection to the managed CockroachDB cluster has taken over a
    // minute; the default 10s hook timeout aborts setup before it lands.
    hookTimeout: 120_000,
    // The writing integration suites share one CockroachDB Serverless cluster and
    // its modest connection ceiling. Running the test files in parallel opened two
    // pools at once and starved each other's connection checkout, which surfaced
    // as unrelated tests timing out at 30s rather than a connection error.
    fileParallelism: false,
    /**
     * A small pool, because the suite does not need a large one and the cluster
     * cannot spare it.
     *
     * `fileParallelism: false` already means one test file runs at a time, so a
     * pool of ten connections buys no concurrency — it just holds ten of this
     * CockroachDB Serverless cluster's limited connection slots, which it then
     * competes for with anyone using the admin. That contention surfaced as
     * `connect ETIMEDOUT` on a shifting subset of tests: never the same ones
     * twice, always at `getPool().connect()` rather than in a query, and always
     * in whichever suite happened to open a pool while the budget was spent.
     */
    env: { DATABASE_POOL_MAX: "3" },
    // Pays a cold cluster's connection cost once, before any test's own 30s
    // budget starts — see the file for why this exists as a separate step.
    globalSetup: ["./tests/global-setup.ts"],
    coverage: { reporter: ["text", "html"], include: ["src/**/*.ts"] },
  },
});
