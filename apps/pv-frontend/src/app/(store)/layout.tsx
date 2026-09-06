import { AnnouncementBar } from "@/components/announcement-bar";
import { ConnectionStatus } from "@/components/connection-status";
import { StoreFooter } from "@/components/store-footer";
import { StoreHeader } from "@/components/store-header";
import { StaffBar } from "@/components/staff-bar";
import { StoreSidebar } from "@/components/store-sidebar";
import { announcementDismissed, readAnnouncement } from "@/server/announcement";
import { getCustomerPrincipal } from "@/server/customer-session";
import { staffViewerName } from "@/server/staff-viewer";

/**
 * The storefront shell.
 *
 * `.storefront` is what makes the shop red. The class is here rather than on
 * `body` so the admin — same stylesheet, same tokens — stays on paper. See the
 * block of the same name in `globals.css` for the palette and its measurements.
 *
 * `min-h-dvh` matters now that the ground is coloured: without it a short page
 * paints red down to the last element and white below it.
 *
 * The brand strip that used to sit under the header is gone. It listed every
 * brand with stock, which on a shop carrying both phone makers and accessory
 * makers was a row of names with no shared meaning — and the brands now have a
 * place where they mean something, one step inside a category (§6 of the CEO
 * direction plan). Removing it also takes a database query off every single
 * storefront page.
 */
export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const [principal, staffName, announcement, announcementHidden] = await Promise.all([
    getCustomerPrincipal(),
    staffViewerName(),
    readAnnouncement(),
    announcementDismissed(),
  ]);
  const signedIn = principal !== null;

  return (
    <div className="storefront flex min-h-dvh flex-col">
      {/*
        Above everything, including the staff bar: an announcement is addressed
        to whoever is looking at the shop. It renders nothing until the CEO has
        written a message, and nothing at all once a visitor has closed it —
        both decided on the server, so the page never reflows around it.
      */}
      <AnnouncementBar announcement={announcement} dismissed={announcementHidden} />
      {/*
        Above everything, including the header, because it is a statement about
        the session rather than part of the shop. It renders nothing for a
        shopper — see `server/staff-viewer` for why it is a name and not a
        principal.
      */}
      <StaffBar name={staffName} />
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
      <div className="flex-1 lg:flex">
        <StoreSidebar signedIn={signedIn} />
        <main className="min-w-0 flex-1">{children}</main>
      </div>
      <StoreFooter />
    </div>
  );
}
