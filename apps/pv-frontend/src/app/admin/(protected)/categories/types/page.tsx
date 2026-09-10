import type { Metadata } from "next";
import { requirePermission } from "@/server/session";
import { listAllCategories } from "@pv/backend/services/categories";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { TypeList } from "./type-list";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Types" };

/**
 * Where a by-type section's types live — Power Banks, Screen Protectors, and
 * whatever else the shop stocks that is not chosen by the device it fits.
 *
 * This used to be part of Brands & Categories, nested under each section. It
 * moved out because that screen was doing two jobs at once: deciding the shape
 * of the shop (sections, and how each is browsed) and stocking one particular
 * shape of it (the types under a by-type section). A brand-new type is added
 * often, by whoever is uploading the next accessory; a section is created once
 * and rarely touched again. Splitting them is what keeps the frequent job from
 * being buried under the rare one, and what keeps Pouches — which has no use
 * for a type — from carrying an "Add type" button that does nothing useful.
 *
 * Read the same category rows Brands & Categories does, through the same
 * service and the same server actions, so a type added here is a category row
 * exactly as one added there would be — there is no second table, no second
 * schema, and nothing here can drift from what the storefront reads.
 */
export default async function TypesAdminPage() {
  await requirePermission("category.manage");
  const categories = await listAllCategories();

  return (
    <div className="grid gap-6">
      <Breadcrumbs
        trail={[{ label: "Brands & Categories", href: "/admin/categories" }, { label: "Types" }]}
      />
      <div>
        <h1 className="text-2xl font-bold">Types</h1>
        <p className="mt-1 max-w-2xl text-sm text-(--pv-muted)">
          The types offered under a section that is browsed by type — Power Banks and Screen
          Protectors under Accessories, for example. A section browsed by device, like Pouches, has
          no types: its models are managed under Admin &rarr; Devices instead.
        </p>
      </div>
      <TypeList categories={categories} />
    </div>
  );
}
