import type { Metadata } from "next";
import { requirePermission } from "@/server/session";
import { listAllHomeSections } from "@pv/backend/services/home-sections";
import { listAllHeroSlides } from "@pv/backend/services/hero-slides";
import { listAllCategories } from "@pv/backend/services/categories";
import { listAllBrands } from "@pv/backend/services/brands";
import { SectionList } from "./section-list";
import { SlideList } from "./slide-list";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Storefront" };

export default async function StorefrontAdminPage() {
  await requirePermission("product.manage");
  const [sections, categories, brands, slides] = await Promise.all([
    listAllHomeSections(),
    listAllCategories(),
    listAllBrands(),
    listAllHeroSlides(),
  ]);

  return (
    <div className="grid gap-8">
      <div>
        <h1 className="text-2xl font-bold">Storefront</h1>
        <p className="mt-1 max-w-2xl text-sm text-(--pv-muted)">
          What shoppers see on the home page, in the order they see it. A section that would show
          nothing is left out rather than rendered as an empty heading, so the home page never looks
          broken while you are setting it up.
        </p>
      </div>
      {/* Above the sections, because it is above them on the page it describes. */}
      <SlideList slides={slides} />
      <SectionList sections={sections} categories={categories} brands={brands} />
    </div>
  );
}
