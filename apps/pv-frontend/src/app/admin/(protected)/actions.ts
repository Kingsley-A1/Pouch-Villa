"use server";

import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { MINIMUM_PASSWORD_LENGTH, hashPassword } from "@pv/backend/auth/password";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requirePermission } from "@/server/session";
import { getProductBySlug, one, run } from "@pv/backend/db";
import { AVAILABILITY_STATES, RESERVATION_STATES, ROLES } from "@pv/backend/domain/types";

function audit(
  staffId: number,
  action: string,
  entityType: string,
  entityId: string,
  details: string,
) {
  run(
    "INSERT INTO audit_logs (staff_id, action, entity_type, entity_id, details) VALUES (?, ?, ?, ?, ?)",
    staffId,
    action,
    entityType,
    entityId,
    details,
  );
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

const productSchema = z.object({
  name: z.string().trim().min(2).max(100),
  slug: z.string().trim().max(120).optional(),
  description: z.string().trim().min(20).max(1000),
  demoPrice: z.coerce.number().int().min(0).max(1000000),
  availability: z.enum(AVAILABILITY_STATES),
  style: z.string().trim().min(2).max(50),
  material: z.string().trim().min(2).max(80),
  protection: z.string().trim().min(2).max(50),
  magsafe: z.boolean(),
  isNew: z.boolean(),
  isBestseller: z.boolean(),
  image: z.string().trim().min(1),
  variants: z.string().trim().min(2),
});

async function resolveImage(formData: FormData, fallback: string) {
  const file = formData.get("imageUpload");
  if (!(file instanceof File) || file.size === 0) return String(formData.get("image") || fallback);
  if (!file.type.startsWith("image/") || file.size > 5 * 1024 * 1024)
    throw new Error("Upload must be an image under 5 MB.");
  // On Vercel, process.cwd() resolves inside the read-only deployed bundle, and even a
  // /tmp write would not help: /public assets are served from the static build, not the
  // live filesystem, so a runtime-written file is never reachable at its URL. Fail clearly
  // instead of writing a file that silently 404s.
  if (process.env.VERCEL)
    throw new Error(
      "Image upload is not available on this deployment. Choose an image from the media library instead.",
    );
  const safeExtension = [".png", ".jpg", ".jpeg", ".webp"].includes(
    extname(file.name).toLowerCase(),
  )
    ? extname(file.name).toLowerCase()
    : ".webp";
  const filename = `${randomUUID()}${safeExtension}`;
  const directory = join(process.cwd(), "public", "uploads");
  await mkdir(directory, { recursive: true });
  await writeFile(join(directory, filename), Buffer.from(await file.arrayBuffer()));
  return `/uploads/${filename}`;
}

function readProduct(formData: FormData, fallbackImage: string) {
  return productSchema.safeParse({
    name: formData.get("name"),
    slug: formData.get("slug"),
    description: formData.get("description"),
    demoPrice: formData.get("demoPrice"),
    availability: formData.get("availability"),
    style: formData.get("style"),
    material: formData.get("material"),
    protection: formData.get("protection"),
    magsafe: formData.get("magsafe") === "on",
    isNew: formData.get("isNew") === "on",
    isBestseller: formData.get("isBestseller") === "on",
    image: String(formData.get("image") || fallbackImage),
    variants: formData.get("variants"),
  });
}

function syncLinks(productId: number, deviceIds: number[], collectionIds: number[]) {
  run("DELETE FROM product_devices WHERE product_id = ?", productId);
  run("DELETE FROM product_collections WHERE product_id = ?", productId);
  deviceIds.forEach((id) =>
    run("INSERT INTO product_devices (product_id, device_id) VALUES (?, ?)", productId, id),
  );
  collectionIds.forEach((id) =>
    run("INSERT INTO product_collections (product_id, collection_id) VALUES (?, ?)", productId, id),
  );
}

export async function createProduct(formData: FormData) {
  const session = await requirePermission("products");
  const parsed = readProduct(formData, "/images/case-red-clear.png");
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message || "Invalid product data.");
  const data = parsed.data;
  const slug = slugify(data.slug || data.name);
  if (getProductBySlug(slug, true)) throw new Error("Product slug already exists.");
  const image = await resolveImage(formData, data.image);
  let variants: unknown;
  try {
    variants = JSON.parse(data.variants);
  } catch {
    throw new Error("Variants must be valid JSON.");
  }
  const result = run(
    `INSERT INTO products (slug,name,description,demo_price,status,availability,style,material,protection,magsafe,is_new,is_bestseller,image,variants_json)
    VALUES (?,?,?,?,'draft',?,?,?,?,?,?,?,?,?)`,
    slug,
    data.name,
    data.description,
    data.demoPrice,
    data.availability,
    data.style,
    data.material,
    data.protection,
    Number(data.magsafe),
    Number(data.isNew),
    Number(data.isBestseller),
    image,
    JSON.stringify(variants),
  );
  const id = Number(result.lastInsertRowid);
  syncLinks(
    id,
    formData.getAll("deviceIds").map(Number).filter(Number.isInteger),
    formData.getAll("collectionIds").map(Number).filter(Number.isInteger),
  );
  audit(session.id, "create", "product", String(id), `Created draft ${data.name}`);
  revalidatePath("/admin/products");
  redirect(`/admin/products/${id}/edit`);
}

export async function updateProduct(formData: FormData) {
  const session = await requirePermission("products");
  const id = Number(formData.get("id"));
  const existing = one<{ image: string }>("SELECT image FROM products WHERE id = ?", id);
  if (!existing) throw new Error("Product not found.");
  const parsed = readProduct(formData, existing.image);
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message || "Invalid product data.");
  const data = parsed.data;
  const slug = slugify(data.slug || data.name);
  const duplicate = one<{ id: number }>(
    "SELECT id FROM products WHERE slug = ? AND id != ?",
    slug,
    id,
  );
  if (duplicate) throw new Error("Product slug already exists.");
  const image = await resolveImage(formData, existing.image);
  let variants: unknown;
  try {
    variants = JSON.parse(data.variants);
  } catch {
    throw new Error("Variants must be valid JSON.");
  }
  run(
    `UPDATE products SET slug=?,name=?,description=?,demo_price=?,availability=?,style=?,material=?,protection=?,magsafe=?,is_new=?,is_bestseller=?,image=?,variants_json=?,updated_at=CURRENT_TIMESTAMP,availability_updated_at=CASE WHEN availability != ? THEN CURRENT_TIMESTAMP ELSE availability_updated_at END WHERE id=?`,
    slug,
    data.name,
    data.description,
    data.demoPrice,
    data.availability,
    data.style,
    data.material,
    data.protection,
    Number(data.magsafe),
    Number(data.isNew),
    Number(data.isBestseller),
    image,
    JSON.stringify(variants),
    data.availability,
    id,
  );
  syncLinks(
    id,
    formData.getAll("deviceIds").map(Number).filter(Number.isInteger),
    formData.getAll("collectionIds").map(Number).filter(Number.isInteger),
  );
  audit(session.id, "update", "product", String(id), `Updated ${data.name}`);
  revalidatePath("/shop");
  revalidatePath(`/products/${slug}`);
  revalidatePath("/admin/products");
  redirect(`/admin/products/${id}/edit?saved=1`);
}

export async function duplicateProduct(formData: FormData) {
  const session = await requirePermission("products");
  const id = Number(formData.get("id"));
  const product = one<Record<string, string | number>>("SELECT * FROM products WHERE id = ?", id);
  if (!product) return;
  const slug = `${product.slug}-copy-${Date.now().toString(36)}`;
  const result = run(
    `INSERT INTO products (slug,name,description,demo_price,status,availability,style,material,protection,magsafe,is_new,is_bestseller,image,variants_json) SELECT ?, name || ' Copy', description,demo_price,'draft',availability,style,material,protection,magsafe,0,0,image,variants_json FROM products WHERE id=?`,
    slug,
    id,
  );
  const newId = Number(result.lastInsertRowid);
  run(
    "INSERT INTO product_devices SELECT ?, device_id FROM product_devices WHERE product_id = ?",
    newId,
    id,
  );
  run(
    "INSERT INTO product_collections SELECT ?, collection_id FROM product_collections WHERE product_id = ?",
    newId,
    id,
  );
  audit(session.id, "duplicate", "product", String(newId), `Duplicated product ${id}`);
  revalidatePath("/admin/products");
}

export async function setProductStatus(formData: FormData) {
  const session = await requirePermission("products");
  const id = Number(formData.get("id"));
  const status = z
    .enum(["draft", "published", "unpublished", "archived"])
    .parse(formData.get("status"));
  run("UPDATE products SET status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?", status, id);
  audit(session.id, "status_change", "product", String(id), `Status set to ${status}`);
  revalidatePath("/shop");
  revalidatePath("/admin/products");
}
export async function setAvailability(formData: FormData) {
  const session = await requirePermission("inventory");
  const id = Number(formData.get("id"));
  const availability = z.enum(AVAILABILITY_STATES).parse(formData.get("availability"));
  run(
    "UPDATE products SET availability=?,availability_updated_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=?",
    availability,
    id,
  );
  audit(
    session.id,
    "availability_change",
    "product",
    String(id),
    `Availability set to ${availability}`,
  );
  revalidatePath("/shop");
  revalidatePath("/admin/inventory");
}
export async function bulkAvailability(formData: FormData) {
  const session = await requirePermission("inventory");
  const ids = formData.getAll("productIds").map(Number).filter(Number.isInteger);
  const availability = z.enum(AVAILABILITY_STATES).parse(formData.get("availability"));
  ids.forEach((id) =>
    run(
      "UPDATE products SET availability=?,availability_updated_at=CURRENT_TIMESTAMP WHERE id=?",
      availability,
      id,
    ),
  );
  audit(
    session.id,
    "bulk_availability",
    "product",
    ids.join(","),
    `${ids.length} products set to ${availability}`,
  );
  revalidatePath("/shop");
  revalidatePath("/admin/inventory");
}
export async function updateReservationStatus(formData: FormData) {
  const session = await requirePermission("reservations");
  const id = Number(formData.get("id"));
  const status = z.enum(RESERVATION_STATES).parse(formData.get("status"));
  run("UPDATE reservations SET status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?", status, id);
  audit(session.id, "status_change", "reservation", String(id), `Reservation set to ${status}`);
  revalidatePath("/admin/reservations");
}
export async function addCompatibility(formData: FormData) {
  const session = await requirePermission("compatibility");
  const productId = Number(formData.get("productId"));
  const deviceId = Number(formData.get("deviceId"));
  run(
    "INSERT OR IGNORE INTO product_devices (product_id,device_id) VALUES (?,?)",
    productId,
    deviceId,
  );
  audit(session.id, "compatibility_add", "product", String(productId), `Device ${deviceId} linked`);
  revalidatePath("/admin/compatibility");
  revalidatePath("/shop");
}
export async function removeCompatibility(formData: FormData) {
  const session = await requirePermission("compatibility");
  const productId = Number(formData.get("productId"));
  const deviceId = Number(formData.get("deviceId"));
  run("DELETE FROM product_devices WHERE product_id=? AND device_id=?", productId, deviceId);
  audit(
    session.id,
    "compatibility_remove",
    "product",
    String(productId),
    `Device ${deviceId} unlinked`,
  );
  revalidatePath("/admin/compatibility");
  revalidatePath("/shop");
}
export async function updateSettings(formData: FormData) {
  const session = await requirePermission("settings");
  for (const key of [
    "store_address",
    "opening_hours",
    "whatsapp_number",
    "homepage_announcement",
  ]) {
    const value = String(formData.get(key) || "").trim();
    run(
      "INSERT INTO settings (key,value,updated_at) VALUES (?,?,CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=CURRENT_TIMESTAMP",
      key,
      value,
    );
  }
  audit(session.id, "update", "settings", "business", "Updated business settings");
  revalidatePath("/");
  revalidatePath("/visit-us");
  revalidatePath("/admin/settings");
}
export async function updateRequestStatus(formData: FormData) {
  const section = z.enum(["enquiries", "case_requests"]).parse(formData.get("section"));
  const permission = section === "enquiries" ? "enquiries" : "case_requests";
  const session = await requirePermission(permission);
  const id = Number(formData.get("id"));
  const status = String(formData.get("status"));
  const allowed =
    section === "enquiries"
      ? ["new", "responded", "closed"]
      : ["new", "reviewing", "sourced", "closed"];
  if (!allowed.includes(status)) throw new Error("Invalid status");
  run(`UPDATE ${section} SET status=? WHERE id=?`, status, id);
  audit(session.id, "status_change", section, String(id), `Status set to ${status}`);
  revalidatePath(section === "enquiries" ? "/admin/enquiries" : "/admin/case-requests");
}
export async function createStaff(formData: FormData) {
  const session = await requirePermission("staff");
  const parsed = z
    .object({
      name: z.string().min(2).max(80),
      email: z.email().toLowerCase(),
      password: z.string().min(MINIMUM_PASSWORD_LENGTH).max(128),
      role: z.enum(ROLES),
    })
    .safeParse({
      name: formData.get("name"),
      email: formData.get("email"),
      password: formData.get("password"),
      role: formData.get("role"),
    });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message || "Invalid staff account");
  const passwordHash = hashPassword(parsed.data.password);
  run(
    "INSERT INTO staff (name,email,password_hash,role,status) VALUES (?,?,?,?,'active')",
    parsed.data.name,
    parsed.data.email,
    passwordHash,
    parsed.data.role,
  );
  audit(session.id, "create", "staff", parsed.data.email, `Created ${parsed.data.role} account`);
  revalidatePath("/admin/staff");
}
