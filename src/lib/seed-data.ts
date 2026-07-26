import { hashSync } from "bcryptjs";
import type { DatabaseSync } from "node:sqlite";

const brands = [
  ["Apple", "apple"],
  ["Samsung", "samsung"],
  ["Google", "google"],
  ["Xiaomi", "xiaomi"],
  ["Tecno", "tecno"],
  ["Infinix", "infinix"],
] as const;

const devices: Record<string, Array<[string, string, number]>> = {
  apple: [
    ["iPhone 17 Pro Max", "iphone-17-pro-max", 2025], ["iPhone 16 Pro Max", "iphone-16-pro-max", 2024],
    ["iPhone 15 Pro Max", "iphone-15-pro-max", 2023], ["iPhone 15 Pro", "iphone-15-pro", 2023],
    ["iPhone 14 Pro Max", "iphone-14-pro-max", 2022], ["iPhone 14", "iphone-14", 2022],
    ["iPhone 13 Pro Max", "iphone-13-pro-max", 2021], ["iPhone 13", "iphone-13", 2021],
  ],
  samsung: [
    ["Galaxy S25 Ultra", "galaxy-s25-ultra", 2025], ["Galaxy S24 Ultra", "galaxy-s24-ultra", 2024],
    ["Galaxy S24", "galaxy-s24", 2024], ["Galaxy A56", "galaxy-a56", 2025], ["Galaxy A36", "galaxy-a36", 2025],
  ],
  google: [["Pixel 9 Pro", "pixel-9-pro", 2024], ["Pixel 9", "pixel-9", 2024], ["Pixel 8 Pro", "pixel-8-pro", 2023]],
  xiaomi: [["Redmi Note 14 Pro", "redmi-note-14-pro", 2025], ["Redmi Note 13 Pro", "redmi-note-13-pro", 2024], ["Redmi 14C", "redmi-14c", 2024]],
  tecno: [["Camon 40 Pro", "camon-40-pro", 2025], ["Camon 30", "camon-30", 2024], ["Spark 30 Pro", "spark-30-pro", 2024], ["Pop 9", "pop-9", 2024]],
  infinix: [["Note 50 Pro", "note-50-pro", 2025], ["Hot 50 Pro+", "hot-50-pro-plus", 2024], ["Smart 9", "smart-9", 2024]],
};

const collections = [
  ["New Arrivals", "new-arrivals", "Fresh demonstration styles recently added to the prototype."],
  ["Minimalist", "minimalist", "Clean forms, quiet colours and everyday comfort."],
  ["Clear Cases", "clear-cases", "Show the phone while adding practical protection."],
  ["Rugged Protection", "rugged-protection", "Reinforced demonstration options for demanding days."],
  ["MagSafe", "magsafe", "Magnetic-compatible demonstration case designs."],
  ["Soft Colours", "soft-colours", "Calm pastel tones for a lighter look."],
  ["Bold Styles", "bold-styles", "Confident colour and stronger visual expression."],
  ["Gift Picks", "gift-picks", "Easy-to-consider demonstration picks for gifting."],
  ["Premium Picks", "premium-picks", "Refined materials and elevated finishes."],
] as const;

const productNames = [
  "Blush Arc", "Carbon Guard", "Redline Clear", "Sage Quiet", "Smoke Frame",
  "Velvet Ember", "Stone Halo", "Rose Current", "Obsidian Grid", "Cloud Edge",
  "Scarlet Loop", "Mineral Soft", "Night Transit", "Pearl Trace", "Clay Form",
  "Graphite Shield", "Petal Line", "Frost Circuit", "Ruby Outline", "Olive Calm",
  "Shadow Ridge", "Coral Fold", "Clear Current", "Ink Armour", "Sandstone Touch",
  "Crimson Air", "Mist Guard", "Berry Studio", "Charcoal Form", "Pale Sage Loop",
  "Amber Drift", "Slate Motion", "Lilac Field", "Copper Trace", "Ivory Pulse",
  "Storm Vector", "Peach Static", "Basalt Edge", "Linen Glow", "Cobalt Frame",
  "Terra Bloom", "Onyx Weave", "Quartz Halo", "Umber Path", "Aqua Signal",
  "Bronze Quiet", "Plum Contour", "Chalk Circuit",
];

const images = ["/images/case-blush.png", "/images/case-rugged.png", "/images/case-red-clear.png", "/images/case-sage.png", "/images/case-smoke.png"];
const styles = ["Minimalist", "Rugged", "Clear", "Soft colour", "Bold"];
const materials = ["Soft-touch TPU", "Reinforced polycarbonate", "Clear TPU", "Textured vegan leather", "Hybrid polymer"];
const protections = ["Everyday", "Heavy duty", "Everyday", "Enhanced", "Everyday"];
const availability = ["available", "limited", "available", "pre_order", "on_request", "out_of_stock"];
const colours = [["Blush", "#e9a7ad"], ["Charcoal", "#262626"], ["Pouch Red", "#e30613"], ["Sage", "#8d9c80"], ["Smoke", "#6b6e73"]];

export function seedDatabase(db: DatabaseSync, adminEmail: string, adminPassword: string) {
  const brandCount = db.prepare("SELECT COUNT(*) AS count FROM brands").get() as { count: number };
  if (brandCount.count > 0) return;

  db.exec("BEGIN IMMEDIATE");
  try {
    const insertBrand = db.prepare("INSERT INTO brands (name, slug, sort_order) VALUES (?, ?, ?)");
    const insertDevice = db.prepare("INSERT INTO devices (brand_id, name, slug, released_year) VALUES (?, ?, ?, ?)");
    brands.forEach(([name, slug], index) => {
      const result = insertBrand.run(name, slug, index);
      const brandId = Number(result.lastInsertRowid);
      devices[slug].forEach(([deviceName, deviceSlug, year]) => insertDevice.run(brandId, deviceName, deviceSlug, year));
    });

    const insertCollection = db.prepare("INSERT INTO collections (name, slug, description, sort_order) VALUES (?, ?, ?, ?)");
    collections.forEach(([name, slug, description], index) => insertCollection.run(name, slug, description, index));

    const insertProduct = db.prepare(`INSERT INTO products
      (slug, name, description, demo_price, status, availability, style, material, protection, magsafe, is_new, is_bestseller, image, variants_json, views, created_at, updated_at, availability_updated_at)
      VALUES (?, ?, ?, ?, 'published', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', ?), datetime('now', ?), datetime('now', ?))`);
    const linkDevice = db.prepare("INSERT INTO product_devices (product_id, device_id) VALUES (?, ?)");
    const linkCollection = db.prepare("INSERT INTO product_collections (product_id, collection_id) VALUES (?, ?)");
    const allBrandRows = db.prepare("SELECT id, slug FROM brands ORDER BY sort_order").all() as Array<{ id: number; slug: string }>;

    productNames.forEach((name, index) => {
      const visual = index % images.length;
      const colour = colours[visual];
      const productSlug = name.toLowerCase().replace(/\s+/g, "-");
      const variants = [
        { name: colour[0], color: colour[1], sku: `PH-${String(index + 1).padStart(3, "0")}-A`, availability: availability[index % availability.length] },
        { name: "Black", color: "#171717", sku: `PH-${String(index + 1).padStart(3, "0")}-B`, availability: "available" },
        { name: "Clear", color: "#e8e6e2", sku: `PH-${String(index + 1).padStart(3, "0")}-C`, availability: index % 4 === 0 ? "limited" : "available" },
      ];
      const offset = `-${(index % 18) + 1} days`;
      const result = insertProduct.run(
        productSlug,
        name,
        `${name} is an original fictional demonstration case created for this prototype. Compatibility, price and availability require Pouch Hub confirmation.`,
        12500 + (index % 8) * 1750,
        availability[index % availability.length],
        styles[visual],
        materials[visual],
        protections[visual],
        index % 3 === 0 ? 1 : 0,
        index < 10 ? 1 : 0,
        index % 4 === 0 ? 1 : 0,
        images[visual],
        JSON.stringify(variants),
        42 + ((index * 37) % 260),
        offset, offset, index % 7 === 0 ? "-24 days" : offset,
      );
      const productId = Number(result.lastInsertRowid);
      const selectedBrand = allBrandRows[index % allBrandRows.length];
      // Rotate the compatibility window across each brand's device list rather
      // than always linking the first four, so coverage spreads over every model.
      const brandDevices = db.prepare("SELECT id FROM devices WHERE brand_id = ? ORDER BY id").all(selectedBrand.id) as Array<{ id: number }>;
      const start = brandDevices.length ? (index * 2) % brandDevices.length : 0;
      const compatible = new Set<number>();
      for (let step = 0; step < Math.min(4, brandDevices.length); step += 1) {
        compatible.add(brandDevices[(start + step) % brandDevices.length].id);
      }
      compatible.forEach((deviceId) => linkDevice.run(productId, deviceId));
      const collectionIds = new Set<number>([visual + 2, index < 10 ? 1 : 2, index % 4 === 0 ? 9 : 8]);
      if (index % 3 === 0) collectionIds.add(5);
      collectionIds.forEach((collectionId) => linkCollection.run(productId, collectionId));
    });

    // Storefront invariant: every device must have at least one compatible case,
    // so no model page can ever come back empty. Enforced explicitly rather than
    // relying on the rotation arithmetic above to cover every model.
    const orphanDevices = db.prepare(
      "SELECT d.id AS id, d.brand_id AS brand_id FROM devices d LEFT JOIN product_devices pd ON pd.device_id = d.id WHERE pd.device_id IS NULL",
    ).all() as Array<{ id: number; brand_id: number }>;
    const leastLinkedForBrand = db.prepare(
      `SELECT p.id AS id FROM products p
       JOIN product_devices pd ON pd.product_id = p.id
       JOIN devices d ON d.id = pd.device_id
       WHERE d.brand_id = ? GROUP BY p.id ORDER BY COUNT(pd.device_id) ASC, p.id ASC LIMIT 1`,
    );
    const anyProduct = db.prepare("SELECT id FROM products ORDER BY id LIMIT 1");
    orphanDevices.forEach((device) => {
      const match = (leastLinkedForBrand.get(device.brand_id) ?? anyProduct.get()) as { id: number } | undefined;
      if (match) linkDevice.run(match.id, device.id);
    });

    const firstProducts = db.prepare("SELECT id, name FROM products ORDER BY id LIMIT 5").all() as Array<{ id: number; name: string }>;
    const reservationInsert = db.prepare(`INSERT INTO reservations
      (reference, customer_name, contact, phone_model, product_id, variant, pickup_date, notes, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, date('now', ?), ?, ?, datetime('now', ?), datetime('now', ?))`);
    [
      ["PH-R-260701", "Demo Customer A", "Demonstration contact", "iPhone 14 Pro Max", "Blush", "+1 day", "Confirm exact model at pickup", "new", "-1 hour"],
      ["PH-R-260702", "Demo Customer B", "Demonstration contact", "Galaxy S24 Ultra", "Black", "+2 days", "Requested rugged protection", "contacted", "-5 hours"],
      ["PH-R-260703", "Demo Customer C", "Demonstration contact", "Camon 40 Pro", "Clear", "+1 day", "Pickup timing awaiting confirmation", "confirmed", "-1 day"],
      ["PH-R-260704", "Demo Customer D", "Demonstration contact", "iPhone 15 Pro Max", "Pouch Red", "+3 days", "Gift request", "ready", "-2 days"],
    ].forEach((row, index) => reservationInsert.run(row[0], row[1], row[2], row[3], firstProducts[index].id, row[4], row[5], row[6], row[7], row[8], row[8]));

    const enquiryInsert = db.prepare("INSERT INTO enquiries (reference, customer_name, contact, product_id, message, status, created_at) VALUES (?, ?, ?, ?, ?, ?, datetime('now', ?))");
    enquiryInsert.run("PH-E-260701", "Demo Enquirer A", "Demonstration contact", firstProducts[1].id, "Is this available for Pixel 9 Pro?", "new", "-3 hours");
    enquiryInsert.run("PH-E-260702", "Demo Enquirer B", "Demonstration contact", firstProducts[2].id, "Please prepare a WhatsApp product summary.", "responded", "-1 day");

    const requestInsert = db.prepare("INSERT INTO case_requests (reference, customer_name, contact, brand, model, preferences, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now', ?))");
    requestInsert.run("PH-C-260701", "Demo Request A", "Demonstration contact", "Tecno", "Phantom V Fold", "Clear case, enhanced protection", "new", "-4 hours");
    requestInsert.run("PH-C-260702", "Demo Request B", "Demonstration contact", "Xiaomi", "Poco X7 Pro", "Soft colour, slim profile", "reviewing", "-2 days");

    const eventInsert = db.prepare("INSERT INTO analytics_events (event_type, entity, value, created_at) VALUES (?, ?, ?, datetime('now', ?))");
    ["iPhone 14 Pro Max", "Galaxy S24 Ultra", "iPhone 15 Pro Max", "Camon 40 Pro", "Redmi Note 14 Pro"].forEach((model, index) => {
      for (let count = 0; count < 7 - index; count += 1) eventInsert.run("device_selected", "device", model, `-${count + index} hours`);
    });
    ["iphone 12 mini", "itel a70", "poco c75"].forEach((term, index) => eventInsert.run("search_no_results", "search", term, `-${index + 1} days`));
    ["new-arrivals", "rugged-protection", "soft-colours", "magsafe"].forEach((slug, index) => {
      for (let count = 0; count < 5 - index; count += 1) eventInsert.run("collection_view", "collection", slug, `-${count + 1} hours`);
    });

    const settingsInsert = db.prepare("INSERT INTO settings (key, value) VALUES (?, ?)");
    settingsInsert.run("store_address", "");
    settingsInsert.run("opening_hours", "");
    settingsInsert.run("whatsapp_number", "");
    settingsInsert.run("homepage_announcement", "New demonstration arrivals are now in the prototype.");

    db.prepare("INSERT INTO staff (name, email, password_hash, role, status) VALUES (?, ?, ?, 'owner', 'active')")
      .run("Prototype Owner", adminEmail.toLowerCase(), hashSync(adminPassword, 12));
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
