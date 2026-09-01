import { describe, expect, it, vi } from "vitest";
import type { QueryResult } from "pg";
import type { Queryable } from "../src/db/client";
import { ADMIN_SEARCH_ENTITIES } from "../src/services/admin-search";
import { syncAdminSearchDocument } from "../src/services/admin-search-index";

describe("syncAdminSearchDocument", () => {
  it("has a fixed projector for every supported entity", async () => {
    for (const entity of ADMIN_SEARCH_ENTITIES) {
      const query = vi.fn().mockImplementation(
        async (text: string) =>
          ({
            rows: text.includes("SELECT")
              ? [
                  {
                    title: "Safe title",
                    context: null,
                    search_text: "safe matching text",
                    required_permission: "dashboard.view",
                  },
                ]
              : [],
            command: "",
            rowCount: 0,
            oid: 0,
            fields: [],
          }) satisfies QueryResult,
      );
      const tx: Queryable = { query };

      await expect(syncAdminSearchDocument(tx, entity, "entity-id")).resolves.toBeUndefined();
    }
  });
});
