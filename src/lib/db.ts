import { mkdirSync } from "node:fs";
import { basename, dirname, isAbsolute, join } from "node:path";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { SCHEMA_SQL } from "@/lib/schema";
import { seedDatabase } from "@/lib/seed-data";
import type { Brand, Collection, Device, Product, Reservation, Staff } from "@/lib/types";

type GlobalWithDatabase = typeof globalThis & { __pouchVillaDb?: DatabaseSync };

function resolveDatabasePath() {
  const configured = process.env.DATABASE_URL?.replace(/^file:/, "") || "data/pouch-villa-prototype.db";
  return isAbsolute(configured) ? configured : join(process.cwd(), "data", basename(configured));
}

export function getDatabase() {
  const globalDatabase = globalThis as GlobalWithDatabase;
  if (!globalDatabase.__pouchVillaDb) {
    const databasePath = resolveDatabasePath();
    mkdirSync(dirname(databasePath), { recursive: true });
    const db = new DatabaseSync(databasePath, { enableForeignKeyConstraints: true });
    db.exec(SCHEMA_SQL);
    const adminEmail = process.env.DEMO_ADMIN_EMAIL;
    const adminPassword = process.env.DEMO_ADMIN_PASSWORD;
    if (process.env.NODE_ENV === "production" && (!adminEmail || !adminPassword || adminPassword.length < 12)) {
      throw new Error("DEMO_ADMIN_EMAIL and a DEMO_ADMIN_PASSWORD of at least 12 characters are required when seeding production.");
    }
    seedDatabase(
      db,
      adminEmail || "admin@pouchvilla.demo",
      adminPassword || "PouchVillaDemo!2026",
    );
    globalDatabase.__pouchVillaDb = db;
  }
  return globalDatabase.__pouchVillaDb;
}

export function all<T>(sql: string, ...params: SQLInputValue[]) {
  return getDatabase().prepare(sql).all(...params) as T[];
}

export function one<T>(sql: string, ...params: SQLInputValue[]) {
  return getDatabase().prepare(sql).get(...params) as T | undefined;
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
  return `PV-${prefix}-${date}-${random}`;
}
