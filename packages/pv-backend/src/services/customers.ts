import { query, queryOne } from "../db/client";

/**
 * Read-only for now: the customer table is real and populated at checkout (the
 * "Create my Pouch Villa account" flow), which has not been built yet, so this
 * list is honestly empty until Phase 3 ships. No admin action here invents a
 * customer or a purchase history that does not exist.
 */

export type AdminCustomer = {
  id: string;
  email: string;
  fullName: string | null;
  phone: string | null;
  accountSource: string;
  status: string;
  createdAt: Date;
};

type CustomerRow = {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  account_source: string;
  status: string;
  created_at: Date;
};

function toCustomer(row: CustomerRow): AdminCustomer {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    phone: row.phone,
    accountSource: row.account_source,
    status: row.status,
    createdAt: row.created_at,
  };
}

export async function listCustomers(limit = 100): Promise<AdminCustomer[]> {
  const rows = await query<CustomerRow>(
    `SELECT id, email, full_name, phone, account_source, status, created_at
       FROM customer
      WHERE deleted_at IS NULL
      ORDER BY created_at DESC
      LIMIT $1`,
    [limit],
  );
  return rows.map(toCustomer);
}

export async function countCustomers(): Promise<number> {
  const row = await queryOne<{ total: string }>(
    "SELECT count(*)::STRING AS total FROM customer WHERE deleted_at IS NULL",
  );
  return Number(row?.total ?? 0);
}
