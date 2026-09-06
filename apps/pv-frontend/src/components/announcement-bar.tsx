import Link from "next/link";
import { InstagramLogo, MapPin, WhatsappLogo, XLogo } from "@phosphor-icons/react/dist/ssr";
import { AnnouncementDismiss } from "./announcement-dismiss";

const BAR_ID = "pv-announcement";

/**
 * What the bar needs in order to render, with every field already resolved from
 * the settings store by the caller.
 *
 * Presentational, as §7 requires of everything in `components/`: the layout
 * reads the settings and the dismissal cookie, this decides what a visitor sees.
 * That split is also what makes the "renders nothing" cases testable without a
 * database.
 */
export type Announcement = {
  /** The running message. Empty or absent means no bar at all. */
  message: string | null;
  /** Digits only — the `wa.me` link is built here, so the setting stays a number. */
  whatsappNumber: string | null;
  instagramUrl: string | null;
  xUrl: string | null;
  /** One branch per entry, already split and trimmed. */
  locations: readonly string[];
};

/**
 * The running message above the header, and the contact row beneath it.
 *
 * **Nothing here is written in this file.** The message, the locations, the
 * WhatsApp number and both social links are settings rows the CEO edits
 * (AGENTS.md §4) — a shop that opens a second branch or changes its Instagram
 * handle should not need a deployment, and the CI fact check would fail the
 * build on a number typed in here, which is the gate working.
 *
 * The whole bar is absent until there is a message. §0 rule 2: an empty strip
 * where an announcement should be is furniture with nothing in it, and a
 * plausible placeholder would be worse.
 */
export function AnnouncementBar({
  announcement,
  dismissed,
}: {
  announcement: Announcement;
  dismissed: boolean;
}) {
  const message = announcement.message?.trim() ?? "";
  if (dismissed || message.length === 0) return null;

  const { whatsappNumber, instagramUrl, xUrl, locations } = announcement;
  const hasContactRow =
    locations.length > 0 || whatsappNumber !== null || instagramUrl !== null || xUrl !== null;

  return (
    <div id={BAR_ID} className="text-sm">
      <div className="flex items-stretch bg-(--pv-surface-raised)">
        <div className="pv-marquee min-w-0 flex-1">
          {/*
            Two identical copies, translated by exactly half the track's width,
            so the second is in position the instant the first leaves. The copy
            is `aria-hidden` — a screen reader should hear the announcement once,
            not twice, and it is not reading the animation anyway.
          */}
          <div className="pv-marquee-track pv-loop">
            <MarqueeRun text={message} />
            <MarqueeRun text={message} duplicate />
          </div>
        </div>
        <AnnouncementDismiss targetId={BAR_ID} />
      </div>

      {hasContactRow ? (
        <div className="border-b border-(--pv-line) bg-(--pv-page)">
          <div className="container-shell flex flex-wrap items-center gap-x-5 gap-y-1 py-1.5 text-xs text-(--pv-muted)">
            {locations.length > 0 ? (
              <span className="inline-flex items-center gap-1.5">
                <MapPin aria-hidden="true" size={14} weight="fill" />
                {locations.join(" · ")}
              </span>
            ) : null}

            <span className="ml-auto flex flex-wrap items-center gap-x-4 gap-y-1">
              {whatsappNumber === null ? null : (
                <a
                  // Built rather than stored, so the setting stays a phone number
                  // that the contact page can also render as one.
                  href={`https://wa.me/${whatsappNumber.replace(/\D/g, "")}`}
                  className="inline-flex min-h-11 items-center gap-1.5 hover:text-(--pv-ink)"
                  rel="noreferrer"
                  target="_blank"
                >
                  <WhatsappLogo aria-hidden="true" size={15} weight="fill" />
                  WhatsApp
                </a>
              )}
              {instagramUrl === null ? null : (
                <a
                  href={instagramUrl}
                  className="inline-flex min-h-11 items-center gap-1.5 hover:text-(--pv-ink)"
                  rel="noreferrer"
                  target="_blank"
                >
                  <InstagramLogo aria-hidden="true" size={15} />
                  Instagram
                </a>
              )}
              {xUrl === null ? null : (
                <a
                  href={xUrl}
                  className="inline-flex min-h-11 items-center gap-1.5 hover:text-(--pv-ink)"
                  rel="noreferrer"
                  target="_blank"
                >
                  <XLogo aria-hidden="true" size={15} />X
                </a>
              )}
              <Link
                href="/contact"
                className="inline-flex min-h-11 items-center hover:text-(--pv-ink)"
              >
                Contact us
              </Link>
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function MarqueeRun({ text, duplicate = false }: { text: string; duplicate?: boolean }) {
  return (
    <p className="pv-marquee-run" aria-hidden={duplicate ? "true" : undefined}>
      {text}
      <span aria-hidden="true" className="pv-marquee-dot" />
    </p>
  );
}
