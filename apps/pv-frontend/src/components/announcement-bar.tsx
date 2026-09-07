import Link from "next/link";
import {
  FacebookLogo,
  InstagramLogo,
  MapPin,
  WhatsappLogo,
  XLogo,
} from "@phosphor-icons/react/dist/ssr";
import type { Icon } from "@phosphor-icons/react";
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
  facebookUrl: string | null;
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

  const { whatsappNumber, instagramUrl, xUrl, facebookUrl, locations } = announcement;

  /**
   * The socials, as data rather than four near-identical blocks.
   *
   * Each one is an icon with its name as the accessible label and nothing
   * visible beside it. Written out, the X entry read `<XLogo />X` — a logo
   * followed by the letter it already is, which is the duplication the client
   * spotted. Naming them here means that cannot come back for the fifth one.
   */
  const socials: { label: string; href: string; Glyph: Icon; weight?: "fill" }[] = [
    ...(whatsappNumber === null
      ? []
      : [
          {
            label: "WhatsApp",
            // Built rather than stored, so the setting stays a phone number the
            // contact page can also render as one.
            href: `https://wa.me/${whatsappNumber.replace(/\D/g, "")}`,
            Glyph: WhatsappLogo,
            weight: "fill" as const,
          },
        ]),
    ...(instagramUrl === null
      ? []
      : [{ label: "Instagram", href: instagramUrl, Glyph: InstagramLogo }]),
    ...(facebookUrl === null
      ? []
      : [{ label: "Facebook", href: facebookUrl, Glyph: FacebookLogo, weight: "fill" as const }]),
    ...(xUrl === null ? [] : [{ label: "X", href: xUrl, Glyph: XLogo }]),
  ];

  const hasContactRow = locations.length > 0 || socials.length > 0;

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

      {/*
        Desktop only.

        On a phone this row was a second line of small print above the shop
        before anything about the shop itself — the client asked for it to live
        in the footer there, which it already does. `hidden md:block` rather
        than removing it, because on a wide screen it costs nothing and is the
        fastest route to WhatsApp.
      */}
      {hasContactRow ? (
        <div className="hidden border-b border-(--pv-line) bg-(--pv-page) md:block">
          <div className="container-shell flex flex-wrap items-center gap-x-5 gap-y-1 py-1.5 text-xs text-(--pv-muted)">
            {locations.length > 0 ? (
              <span className="inline-flex items-center gap-1.5">
                <MapPin aria-hidden="true" size={14} weight="fill" />
                {locations.join(" · ")}
              </span>
            ) : null}

            <span className="ml-auto flex flex-wrap items-center gap-x-3 gap-y-1">
              {socials.map(({ label, href, Glyph, weight }) => (
                <a
                  key={label}
                  href={href}
                  // The name is the label, not a glyph a screen reader cannot
                  // read. 44px square, as §2 asks of any target.
                  aria-label={label}
                  title={label}
                  className="grid h-11 w-11 place-items-center hover:text-(--pv-ink)"
                  rel="noreferrer"
                  target="_blank"
                >
                  <Glyph aria-hidden="true" size={17} weight={weight ?? "regular"} />
                </a>
              ))}
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
