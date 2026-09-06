import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import type { CategoryCard as Category } from "@pv/backend/services/catalogue";
import { cn } from "@/lib/utils";

/**
 * A category, as a card with a picture of something actually in it.
 *
 * The categories were a list of bordered rows carrying a name and nothing else,
 * which asked a customer to guess what "Accessories" contains. A card with a
 * photograph answers that before they tap.
 *
 * Built in the same idiom as the account navigation's cards — the same radius,
 * border, surface and hover tint — so the shop and the signed-in area read as one
 * product rather than two designs.
 *
 * Where the category has nothing published, the picture is a tinted panel and the
 * card says the range is on its way. §0 rule 2: a stock photograph standing in
 * for stock that does not exist is a lie the client discovers in front of a
 * customer.
 */
export function CategoryCard({
  category,
  /**
   * Where the card leads. A top-level card starts the browse path — category,
   * then brand, then kind — while the flat list on `/categories` still goes
   * straight to the filtered shop, because someone already looking at every
   * category has made the choice the path exists to help them make.
   */
  href,
  /**
   * Off by default, and on only where categories are the point of the page.
   *
   * On the home page these cards sit between a hero and the products, and a
   * two-line description on each of twelve of them is two dozen lines of small
   * grey prose in the middle of the shop — the specific thing the client called
   * "a lot of text". On `/categories`, where choosing between them *is* the
   * task, the same sentence is the reason someone picks one.
   */
  showDescription = false,
}: {
  category: Category;
  href: string;
  showDescription?: boolean;
}) {
  const { image, productCount } = category;

  return (
    <Link
      href={href}
      className={cn(
        "group flex h-full flex-col overflow-hidden rounded-none border bg-(--pv-surface)",
        "border-(--pv-line) transition-[border-color,box-shadow,transform] duration-200",
        "hover:-translate-y-0.5 hover:border-[color-mix(in_srgb,var(--pv-red)_45%,var(--pv-line))]",
        "hover:shadow-[0_10px_30px_-16px_var(--pv-shadow)]",
        "motion-reduce:transition-none motion-reduce:hover:translate-y-0",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--pv-red)",
      )}
    >
      <div className="relative aspect-4/3 overflow-hidden bg-(--pv-wash)">
        {image === null ? (
          // Not an empty grey box: a tinted panel with the category's initial,
          // so a shop still being stocked looks deliberate rather than broken.
          <span
            aria-hidden="true"
            className="grid h-full place-items-center bg-(--pv-cream) text-5xl font-black text-[color-mix(in_srgb,var(--pv-red)_28%,transparent)]"
          >
            {category.name.slice(0, 1).toUpperCase()}
          </span>
        ) : (
          <Image
            src={image.cardUrl}
            // Decorative. The card's heading names the category, and describing
            // one product inside it would mislead more than it helps.
            alt=""
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className={cn(
              "object-cover transition-transform duration-500 ease-out group-hover:scale-[1.05]",
              "motion-reduce:transition-none motion-reduce:group-hover:scale-100",
            )}
          />
        )}
      </div>

      {/* The slim rule the product card carries too, so the picture reads as a
          picture rather than bleeding into the words underneath it. */}
      <div className="border-t border-(--pv-line)" />

      <div className="flex flex-1 flex-col gap-1 p-4">
        {/*
          A sub-category names its parent, so a flat grid still says where a
          thing sits. Nothing renders for a top-level category rather than an
          empty line that would leave the cards at different heights.
        */}
        {category.parentName === null ? null : (
          <span className="text-[11px] font-bold tracking-[.1em] text-(--pv-muted) uppercase">
            {category.parentName}
          </span>
        )}

        <span className="flex items-center justify-between gap-2 font-bold">
          {category.name}
          <ArrowRight
            aria-hidden="true"
            size={16}
            weight="bold"
            className={cn(
              "shrink-0 text-(--pv-muted) transition-[transform,color] duration-200",
              "group-hover:translate-x-0.5 group-hover:text-(--pv-red)",
              "motion-reduce:transition-none motion-reduce:group-hover:translate-x-0",
            )}
          />
        </span>

        {showDescription && category.description ? (
          <span className="line-clamp-2 text-xs leading-snug text-(--pv-muted)">
            {category.description}
          </span>
        ) : null}

        <span className="mt-auto pt-2 text-xs font-semibold text-(--pv-muted)">
          {productCount === 0
            ? "Range on its way"
            : `${productCount} ${productCount === 1 ? "product" : "products"}`}
        </span>
      </div>
    </Link>
  );
}
