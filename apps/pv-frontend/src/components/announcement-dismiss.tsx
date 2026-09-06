"use client";

import { useState } from "react";
import { X } from "@phosphor-icons/react";
import { ANNOUNCEMENT_DISMISSED_COOKIE } from "@/lib/announcement";

/**
 * The close control, and the only client JavaScript the bar ships.
 *
 * It hides the bar immediately and writes the cookie itself rather than posting
 * a Server Action. A Server Action would be the house pattern — the theme
 * toggle is one — but closing a strip of furniture is not worth a round trip on
 * Nigerian mobile data, and this way the bar disappears on the tap rather than
 * on the response.
 *
 * The element removed is the whole bar, found by id, so the contact row goes
 * with the message. On the next request the server reads the cookie and the bar
 * is absent from the HTML rather than removed from it.
 */
export function AnnouncementDismiss({ targetId }: { targetId: string }) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <button
      type="button"
      // 44 px, as §2 requires of every interactive target.
      className="grid h-11 w-11 flex-none place-items-center text-(--pv-ink) hover:bg-black/15 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-(--pv-focus)"
      aria-label="Dismiss announcement"
      onClick={() => {
        // A year, and path-wide: a visitor who closed it does not want it back
        // on the next page. `Secure` only where there is HTTPS to be secure on,
        // so it still works against a local dev server.
        const secure = window.location.protocol === "https:" ? "; Secure" : "";
        document.cookie = `${ANNOUNCEMENT_DISMISSED_COOKIE}=1; Max-Age=${60 * 60 * 24 * 365}; Path=/; SameSite=Lax${secure}`;
        document.getElementById(targetId)?.remove();
        setDismissed(true);
      }}
    >
      <X aria-hidden="true" size={16} weight="bold" />
    </button>
  );
}
