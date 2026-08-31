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
    // Pays a cold cluster's connection cost once, before any test's own 30s
    // budget starts — see the file for why this exists as a separate step.
    globalSetup: ["./tests/global-setup.ts"],
    coverage: { reporter: ["text", "html"], include: ["src/**/*.ts"] },
  },
});
