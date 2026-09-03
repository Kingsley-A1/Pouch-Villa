import { ConnectionStatus } from "@/components/connection-status";
import { StoreFooter } from "@/components/store-footer";
import { StoreHeader } from "@/components/store-header";
import { StoreSidebar } from "@/components/store-sidebar";
import { getCustomerPrincipal } from "@/server/customer-session";

/**
 * `getCustomerPrincipal` is request-cached, so the header and the sidebar
 * asking for it separately costs one lookup, not two.
 */
export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const signedIn = (await getCustomerPrincipal()) !== null;

  return (
    <>
      <ConnectionStatus />
      <StoreHeader />
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
