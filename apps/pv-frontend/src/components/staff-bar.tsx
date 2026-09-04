import Link from "next/link";
import { ArrowUUpLeft, ShieldCheck } from "@phosphor-icons/react/dist/ssr";

/**
 * A thin band across the top of the shop, shown only to someone who is signed
 * into the admin.
 *
 * It answers the complaint that the storefront looks signed out to a staff
 * member who is very much signed in, and it does it the way every CMS does:
 * a bar that says who you are and offers the way back, sitting outside the
 * customer account UI rather than pretending to be part of it.
 *
 * The wording is exact on purpose. "Signed in to the admin" is true; "signed in"
 * on its own would imply a customer account this person does not have, and the
 * first time they tried to open an order history it would be a worse surprise
 * than the one this replaces.
 *
 * A Server Component with a plain link, so it ships no JavaScript and no shopper
 * ever pays for it — it renders nothing at all for them.
 */
export function StaffBar({ name }: { name: string | null }) {
  if (name === null) return null;

  return (
    <div className="bg-(--pv-ink) text-(--pv-page)">
      <div className="container-shell flex min-h-11 flex-wrap items-center justify-between gap-x-4 gap-y-1 py-1.5 text-xs">
        <span className="flex items-center gap-2">
          <ShieldCheck size={15} weight="fill" aria-hidden="true" />
          <span>
            Signed in to the admin as <strong className="font-bold">{name}</strong>
          </span>
        </span>
        <Link
          href="/admin"
          className="inline-flex min-h-11 items-center gap-1.5 font-bold underline underline-offset-4"
        >
          <ArrowUUpLeft size={14} weight="bold" aria-hidden="true" />
          Back to admin
        </Link>
      </div>
    </div>
  );
}
