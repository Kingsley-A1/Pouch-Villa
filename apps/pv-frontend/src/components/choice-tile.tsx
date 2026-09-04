import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/lib/utils";

/**
 * One choice on the browse path — a brand, or a kind of pouch.
 *
 * Deliberately not a `CategoryCard`. These steps have no photograph to show: a
 * brand is a name, and putting one product's picture on it would claim the brand
 * looks like that. What earns its place instead is the count, which tells a
 * shopper which way is worth going before they spend a tap finding out.
 *
 * A Server Component with no JavaScript. The lift on hover is a transform, so it
 * costs no layout work, and it is dropped entirely under `prefers-reduced-motion`.
 */
export function ChoiceTile({
  href,
  title,
  detail,
}: {
  href: string;
  title: string;
  detail: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group flex min-h-24 flex-col justify-between gap-3 rounded-2xl p-4",
        "border border-(--pv-line) bg-(--pv-surface)",
        "transition-[transform,border-color,box-shadow] duration-200",
        "hover:-translate-y-0.5 hover:border-(--pv-ink)",
        "hover:shadow-[0_10px_28px_-16px_var(--pv-shadow)]",
        "motion-reduce:transition-none motion-reduce:hover:translate-y-0",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--pv-red)",
      )}
    >
      <span className="text-base leading-snug font-bold text-balance">{title}</span>
      <span className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-(--pv-muted)">{detail}</span>
        <ArrowRight
          aria-hidden="true"
          size={16}
          weight="bold"
          className={cn(
            "shrink-0 transition-transform duration-200",
            "group-hover:translate-x-0.5",
            "motion-reduce:transition-none motion-reduce:group-hover:translate-x-0",
          )}
        />
      </span>
    </Link>
  );
}
