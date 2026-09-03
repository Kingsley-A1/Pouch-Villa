import { headers } from "next/headers";
import Link from "next/link";
import { CaretRight } from "@phosphor-icons/react/dist/ssr";

export type Crumb = { label: string; href?: string };

/**
 * Accessible breadcrumb trail. "Home" is prepended automatically, and the final
 * crumb always renders as the current page rather than a link. Emits
 * BreadcrumbList structured data alongside the visible trail.
 *
 * The structured data carries the request nonce. `application/ld+json` is data
 * rather than executable code, but it is still a `<script>` element and Chrome
 * applies `script-src` to it — without the nonce the block is dropped and the
 * rich result quietly disappears, which is exactly the kind of failure nobody
 * notices for months. Next attaches the nonce to its own scripts automatically;
 * one written by hand has to ask for it.
 */
export async function Breadcrumbs({ trail }: { trail: Crumb[] }) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  const items: Crumb[] = [{ label: "Home", href: "/" }, ...trail];
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.label,
      ...(item.href ? { item: item.href } : {}),
    })),
  };

  return (
    <nav aria-label="Breadcrumb" className="border-b border-(--pv-line) bg-(--pv-cream)">
      <div className="container-shell py-3.5">
        <ol className="breadcrumbs">
          {items.map((item, index) => {
            const isLast = index === items.length - 1;
            return (
              <li key={`${item.label}-${index}`} className="flex items-center gap-2">
                {index > 0 ? (
                  <CaretRight
                    className="breadcrumb-sep"
                    size={12}
                    weight="bold"
                    aria-hidden="true"
                  />
                ) : null}
                {isLast || !item.href ? (
                  <span aria-current={isLast ? "page" : undefined}>{item.label}</span>
                ) : (
                  <Link href={item.href}>{item.label}</Link>
                )}
              </li>
            );
          })}
        </ol>
      </div>
      <script
        type="application/ld+json"
        nonce={nonce}
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </nav>
  );
}
