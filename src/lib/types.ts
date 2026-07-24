export const AVAILABILITY_STATES = ["available", "limited", "out_of_stock", "pre_order", "on_request", "hidden"] as const;
export const RESERVATION_STATES = ["new", "contacted", "confirmed", "ready", "completed", "cancelled"] as const;
export const ROLES = ["owner", "manager", "catalogue", "support", "viewer"] as const;

export type Availability = (typeof AVAILABILITY_STATES)[number];
export type ReservationStatus = (typeof RESERVATION_STATES)[number];
export type StaffRole = (typeof ROLES)[number];

export type Brand = { id: number; name: string; slug: string; sort_order: number };
export type Device = { id: number; brand_id: number; brand_name?: string; brand_slug?: string; name: string; slug: string; released_year: number | null };
export type Collection = { id: number; name: string; slug: string; description: string; sort_order: number };

export type ProductVariant = { name: string; color: string; sku: string; availability: Availability };

export type Product = {
  id: number;
  slug: string;
  name: string;
  description: string;
  demo_price: number;
  status: "draft" | "published" | "unpublished" | "archived";
  availability: Availability;
  style: string;
  material: string;
  protection: string;
  magsafe: number;
  is_new: number;
  is_bestseller: number;
  image: string;
  variants_json: string;
  views: number;
  created_at: string;
  updated_at: string;
  availability_updated_at: string;
  devices?: Device[];
  collections?: Collection[];
};

export type Staff = { id: number; name: string; email: string; password_hash: string; role: StaffRole; status: string; last_login_at: string | null };

export type Reservation = {
  id: number;
  reference: string;
  customer_name: string;
  contact: string;
  phone_model: string;
  product_id: number | null;
  product_name?: string | null;
  variant: string;
  pickup_date: string;
  notes: string;
  status: ReservationStatus;
  created_at: string;
  updated_at: string;
};
