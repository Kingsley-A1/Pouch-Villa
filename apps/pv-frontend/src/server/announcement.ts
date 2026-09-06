import { cookies } from "next/headers";
import { pick, readSettings, type SettingValue } from "@pv/backend/services/settings";
import { ANNOUNCEMENT_DISMISSED_COOKIE } from "@/lib/announcement";
import type { Announcement } from "@/components/announcement-bar";

/**
 * Whether the visitor has closed the announcement bar.
 *
 * A cookie, read **on the server**, for the same reason `server/theme.ts` uses
 * one: the answer has to be known before the first paint. The alternative —
 * render the bar, then remove it from `localStorage` after hydration — pushes
 * every element on the page down by the height of the bar and then snaps it
 * back up, which is the textbook way to fail the CLS budget in §2.
 *
 * Not `HttpOnly`, because the close button writes it in the browser: dismissing
 * a strip of furniture should not cost a network round trip on mobile data.
 * Nothing here is a secret — the value is the string "1" or the cookie is absent.
 */
export async function announcementDismissed(): Promise<boolean> {
  return (await cookies()).get(ANNOUNCEMENT_DISMISSED_COOKIE)?.value === "1";
}

/** A typed absence stays an absence: an unset setting is `null`, never `""`. */
function valueOf(setting: SettingValue): string | null {
  if (!setting.present) return null;
  const trimmed = setting.value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

export async function readAnnouncement(): Promise<Announcement> {
  const settings = await readSettings([
    "store.announcement",
    "store.whatsapp_number",
    "store.instagram_url",
    "store.x_url",
    "store.facebook_url",
    "store.locations",
  ]);

  const locations = valueOf(pick(settings, "store.locations"));

  return {
    message: valueOf(pick(settings, "store.announcement")),
    whatsappNumber: valueOf(pick(settings, "store.whatsapp_number")),
    instagramUrl: valueOf(pick(settings, "store.instagram_url")),
    xUrl: valueOf(pick(settings, "store.x_url")),
    facebookUrl: valueOf(pick(settings, "store.facebook_url")),
    // One per line in the admin, so a shop with one branch and a shop with four
    // both read correctly without a second settings key.
    locations:
      locations === null
        ? []
        : locations
            .split("\n")
            .map((line) => line.trim())
            .filter((line) => line.length > 0),
  };
}
