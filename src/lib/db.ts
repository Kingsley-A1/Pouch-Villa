import { randomBytes } from "node:crypto";
import { mkdirSync } from "node:fs";
import { hashSync } from "bcryptjs";
import { basename, dirname, isAbsolute, join } from "node:path";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { SCHEMA_SQL } from "@/lib/schema";
import { seedDatabase } from "@/lib/seed-data";
import type { Brand, Collection, Device, Product, Reservation, Staff } from "@/lib/types";

type GlobalWithDatabase = typeof globalThis & { __pouchVillaDb?: DatabaseSync };

const IN_MEMORY = ":memory:";

/** Vercel and Lambda mount the deployed bundle read-only; only /tmp accepts writes. */
function isServerless() {
  return Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.LAMBDA_TASK_ROOT);
}

function resolveDatabasePath() {
  const configured = process.env.DATABASE_URL?.replace(/^file:/, "").trim();
  if (configured === IN_MEMORY) return IN_MEMORY;
  // A relative DATABASE_URL would resolve inside the read-only bundle on serverless
  // and fail with ENOENT on every request, so force those onto /tmp. This is not
  // durable storage — /tmp is wiped on cold starts and redeploys. See
  // docs/production-promotion.md for the required move to managed Postgres.
  if (isServerless()) {
    if (configured && isAbsolute(configured)) return configured;
    return join("/tmp", configured ? basename(configured) : "pouch-villa-prototype.db");
  }
  if (configured) return isAbsolute(configured) ? configured : join(process.cwd(), "data", basename(configured));
  return join(process.cwd(), "data", "pouch-villa-prototype.db");
}

function openDatabase() {
  const databasePath = resolveDatabasePath();
  try {
    if (databasePath !== IN_MEMORY) mkdirSync(dirname(databasePath), { recursive: true });
    return new DatabaseSync(databasePath, { enableForeignKeyConstraints: true });
  } catch (error) {
    // An unwritable filesystem must never take the whole storefront down. An
    // in-memory database keeps the prototype fully browsable for the lifetime of
    // this instance; writes simply do not outlive it.
    console.error(`Database path ${databasePath} is not writable; falling back to in-memory.`, error);
    return new DatabaseSync(IN_MEMORY, { enableForeignKeyConstraints: true });
  }
}

/**
 * Never seed a publicly known default credential into a production deployment, but
 * never take the storefront down over it either. Without configured values we seed
 * an unguessable random password, which leaves admin sign-in closed until real
 * credentials are supplied.
 *
 * A configured password is always used as given. Silently substituting a random
 * password for one deemed too short made sign-in fail with "email or password is
 * incorrect" while the configured value looked perfectly valid. The minimum here
 * matches the one the sign-in form itself enforces.
 */
const MINIMUM_PASSWORD_LENGTH = 8;

function resolveAdminCredentials() {
  const email = process.env.DEMO_ADMIN_EMAIL?.trim();
  const password = process.env.DEMO_ADMIN_PASSWORD;
  if (email && password && password.length >= MINIMUM_PASSWORD_LENGTH) {
    if (password.length < 12) console.warn("DEMO_ADMIN_PASSWORD is shorter than 12 characters. It will be used, but choose a longer one.");
    return { email, password, configured: true };
  }
  if (process.env.NODE_ENV === "production") {
    if (email && password) console.warn(`DEMO_ADMIN_PASSWORD is shorter than ${MINIMUM_PASSWORD_LENGTH} characters, so it cannot be used. Admin sign-in is disabled.`);
    else console.warn("DEMO_ADMIN_EMAIL/DEMO_ADMIN_PASSWORD are not configured; admin sign-in is disabled for this deployment.");
    return { email: email || "admin@pouchvilla.invalid", password: randomBytes(24).toString("base64url"), configured: false };
  }
  return { email: email || "admin@pouchvilla.demo", password: password || "PouchVillaDemo!2026", configured: true };
}

/**
 * Seeding only creates the owner account the first time a database is built, so a
 * database that already exists keeps whatever credentials it was seeded with. On a
 * warm serverless instance that meant updated environment values never took effect.
 * Re-apply the configured credentials on every boot instead.
 */
function applyAdminCredentials(db: DatabaseSync, email: string, password: string) {
  const address = email.toLowerCase();
  const hash = hashSync(password, 12);
  const existing = db.prepare("SELECT id FROM staff WHERE email = ?").get(address) as { id: number } | undefined;
  if (existing) db.prepare("UPDATE staff SET password_hash = ?, role = 'owner', status = 'active' WHERE id = ?").run(hash, existing.id);
  else db.prepare("INSERT INTO staff (name, email, password_hash, role, status) VALUES (?, ?, ?, 'owner', 'active')").run("Prototype Owner", address, hash);
}

export function getDatabase() {
  const globalDatabase = globalThis as GlobalWithDatabase;
  if (!globalDatabase.__pouchVillaDb) {
    const db = openDatabase();
    db.exec(SCHEMA_SQL);
    const { email, password, configured } = resolveAdminCredentials();
    seedDatabase(db, email, password);
    if (configured) applyAdminCredentials(db, email, password);
    globalDatabase.__pouchVillaDb = db;
  }
  return globalDatabase.__pouchVillaDb;
}

// node:sqlite returns rows with a null prototype, which React Server Components
// refuse to serialize when passed to Client Components. Spread each row into a
// plain object so every query result is safe to hand across the boundary.
export function all<T>(sql: string, ...params: SQLInputValue[]) {
  return getDatabase().prepare(sql).all(...params).map((row) => ({ ...row })) as T[];
}

export function one<T>(sql: string, ...params: SQLInputValue[]) {
  const row = getDatabase().prepare(sql).get(...params);
  return (row === undefined ? undefined : { ...row }) as T | undefined;
}

export function run(sql: string, ...params: SQLInputValue[]) {
  return getDatabase().prepare(sql).run(...params);
}

export function getBrands() {
  return all<Brand>("SELECT * FROM brands ORDER BY sort_order, name");
}

export function getDevices(brandSlug?: string) {
  const clause = brandSlug ? "WHERE b.slug = ?" : "";
  const params = brandSlug ? [brandSlug] : [];
  return all<Device>(`SELECT d.*, b.name AS brand_name, b.slug AS brand_slug FROM devices d JOIN brands b ON b.id = d.brand_id ${clause} ORDER BY b.sort_order, d.released_year DESC, d.name`, ...params);
}

export function getCollections() {
  return all<Collection>("SELECT * FROM collections ORDER BY sort_order, name");
}

export type ProductFilters = {
  q?: string;
  brand?: string;
  model?: string;
  style?: string;
  colour?: string;
  material?: string;
  protection?: string;
  availability?: string;
  magsafe?: string;
  min?: string;
  max?: string;
  collection?: string;
  newOnly?: string;
  bestseller?: string;
  includeAdmin?: boolean;
};

export function getProducts(filters: ProductFilters = {}) {
  const clauses = [filters.includeAdmin ? "1=1" : "p.status = 'published' AND p.availability != 'hidden'"];
  const params: SQLInputValue[] = [];
  const add = (condition: string, value: SQLInputValue) => { clauses.push(condition); params.push(value); };
  if (filters.q) { add("(p.name LIKE ? OR p.description LIKE ?)", `%${filters.q}%`); params.push(`%${filters.q}%`); }
  if (filters.brand) add("b.slug = ?", filters.brand);
  if (filters.model) add("d.slug = ?", filters.model);
  if (filters.style) add("p.style = ?", filters.style);
  if (filters.material) add("p.material = ?", filters.material);
  if (filters.protection) add("p.protection = ?", filters.protection);
  if (filters.availability) add("p.availability = ?", filters.availability);
  if (filters.magsafe === "true") clauses.push("p.magsafe = 1");
  if (filters.min && Number.isFinite(Number(filters.min))) add("p.demo_price >= ?", Number(filters.min));
  if (filters.max && Number.isFinite(Number(filters.max))) add("p.demo_price <= ?", Number(filters.max));
  if (filters.collection) add("c.slug = ?", filters.collection);
  if (filters.newOnly === "true") clauses.push("p.is_new = 1");
  if (filters.bestseller === "true") clauses.push("p.is_bestseller = 1");
  if (filters.colour) add("p.variants_json LIKE ?", `%${filters.colour}%`);
  return all<Product>(`
    SELECT DISTINCT p.* FROM products p
    LEFT JOIN product_devices pd ON pd.product_id = p.id
    LEFT JOIN devices d ON d.id = pd.device_id
    LEFT JOIN brands b ON b.id = d.brand_id
    LEFT JOIN product_collections pc ON pc.product_id = p.id
    LEFT JOIN collections c ON c.id = pc.collection_id
    WHERE ${clauses.join(" AND ")}
    ORDER BY p.is_new DESC, p.is_bestseller DESC, p.created_at DESC, p.name`, ...params);
}

export function getProductBySlug(slug: string, includeAdmin = false) {
  const product = one<Product>(`SELECT * FROM products WHERE slug = ? ${includeAdmin ? "" : "AND status = 'published' AND availability != 'hidden'"}`, slug);
  if (!product) return undefined;
  product.devices = all<Device>("SELECT d.*, b.name AS brand_name, b.slug AS brand_slug FROM devices d JOIN brands b ON b.id = d.brand_id JOIN product_devices pd ON pd.device_id = d.id WHERE pd.product_id = ? ORDER BY b.sort_order, d.name", product.id);
  product.collections = all<Collection>("SELECT c.* FROM collections c JOIN product_collections pc ON pc.collection_id = c.id WHERE pc.product_id = ? ORDER BY c.sort_order", product.id);
  return product;
}

export function getProductById(id: number) {
  const product = one<Product>("SELECT * FROM products WHERE id = ?", id);
  if (!product) return undefined;
  product.devices = all<Device>("SELECT d.*, b.name AS brand_name, b.slug AS brand_slug FROM devices d JOIN brands b ON b.id = d.brand_id JOIN product_devices pd ON pd.device_id = d.id WHERE pd.product_id = ? ORDER BY b.sort_order, d.name", product.id);
  product.collections = all<Collection>("SELECT c.* FROM collections c JOIN product_collections pc ON pc.collection_id = c.id WHERE pc.product_id = ? ORDER BY c.sort_order", product.id);
  return product;
}

export function getStaffByEmail(email: string) {
  return one<Staff>("SELECT * FROM staff WHERE email = ?", email.toLowerCase());
}

export function getReservations() {
  return all<Reservation>("SELECT r.*, p.name AS product_name FROM reservations r LEFT JOIN products p ON p.id = r.product_id ORDER BY r.created_at DESC");
}

export function getSetting(key: string) {
  return one<{ value: string }>("SELECT value FROM settings WHERE key = ?", key)?.value || "";
}

export function makeReference(prefix: "R" | "E" | "C") {
  const now = new Date();
  const date = `${String(now.getUTCFullYear()).slice(-2)}${String(now.getUTCMonth() + 1).padStart(2, "0")}${String(now.getUTCDate()).padStart(2, "0")}`;
  const random = Math.floor(1000 + Math.random() * 9000);
  return `PH-${prefix}-${date}-${random}`;
}
