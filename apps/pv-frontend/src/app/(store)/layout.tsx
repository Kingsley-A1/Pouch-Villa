import { listBrandsWithProducts } from "@pv/backend/services/catalogue";
import { BrandNav } from "@/components/brand-nav";
import { ConnectionStatus } from "@/components/connection-status";
import { StoreFooter } from "@/components/store-footer";
import { StoreHeader } from "@/components/store-header";
import { StoreSidebar } from "@/components/store-sidebar";
import { getCustomerPrincipal } from "@/server/customer-session";

/**
 * `getCustomerPrincipal` is request-cached, so the header and the sidebar
 * asking for it separately costs one lookup, not two. The brand strip is a
 * second query, fetched alongside rather than after it — latency on this
 * cluster is per statement, so two sequential awaits here would be paid on
 * every page of the shop.
 */
export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const [principal, brands] = await Promise.all([getCustomerPrincipal(), listBrandsWithProducts()]);
  const signedIn = principal !== null;

  return (
    <>
      <ConnectionStatus />
      <StoreHeader />
      {/*
        Directly under the header and above the sidebar split, so the strip runs
        the full width of the page rather than starting after a 240 px column.
      */}
      <BrandNav brands={brands} />
      {/*
        The sidebar is a sibling of `main`, not inside it, so a screen reader's
        landmark list reads navigation and main content as separate regions. It
        renders nothing below `lg`, where the drawer takes over.

        `min-w-0` on the main column matters: without it a flex child refuses to
        shrink below its content, and one wide table or code block would push the
        whole page into a horizontal scroll — which §2 forbids at any width.
      */}
      <div className="lg:flex">
        <StoreSidebar signedIn={signedIn} />
        <main className="min-w-0 flex-1">{children}</main>
      </div>
      <StoreFooter />
    </>
  );
}
