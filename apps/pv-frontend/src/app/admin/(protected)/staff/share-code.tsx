"use client";

import { useEffect, useState } from "react";
import { Check, Copy, ShareNetwork } from "@phosphor-icons/react";
import { absoluteSiteUrl } from "@pv/backend/domain/site-origin";

/**
 * What to do with a code the moment it exists.
 *
 * The panel showed the code and said "write it down or share it now", and left
 * the person to do both by hand — reading eight characters off a screen and
 * retyping them into WhatsApp, which is exactly where a transcription mistake
 * comes from. The whole invitation is one tap now.
 *
 * **The link deliberately carries no code.** Putting it in the query string
 * would be more convenient and would also write a live credential into the
 * browser's history, the server's access log and any proxy in between — the
 * three places a secret should never be at rest. The code travels in the
 * message body, where it is exposed to the recipient and nobody else.
 */
export function ShareCode({ code }: { code: string }) {
  const claimUrl = absoluteSiteUrl("/admin/claim");
  const invite = `You have been given staff access to Pouch Villa.\n\nOpen ${claimUrl} and enter this code:\n${code}`;

  // Named so the confirmation can say which button was pressed, rather than
  // three buttons sharing one "Copied" that appears in the wrong place.
  const [copied, setCopied] = useState<"code" | "link" | "invite" | null>(null);

  useEffect(() => {
    if (copied === null) return;
    const timer = window.setTimeout(() => setCopied(null), 2000);
    return () => window.clearTimeout(timer);
  }, [copied]);

  async function copy(what: "code" | "link" | "invite", text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
    } catch {
      // A browser that refuses the clipboard — an insecure origin, or a
      // permission denied — must not look like it worked. The code is on screen
      // and can still be read off it.
    }
  }

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      <Action
        onClick={() => copy("code", code)}
        done={copied === "code"}
        label="Copy code"
        doneLabel="Code copied"
      />
      <Action
        onClick={() => copy("link", claimUrl)}
        done={copied === "link"}
        label="Copy link"
        doneLabel="Link copied"
      />
      <Action
        onClick={() => copy("invite", invite)}
        done={copied === "invite"}
        label="Copy invite"
        doneLabel="Invite copied"
      />
      {/*
        Always rendered, and the capability is read on the tap rather than on
        mount. `navigator.share` does not exist on the server, so deciding during
        render is a hydration mismatch and deciding in an effect is a second
        render for something a click already knows. A desktop browser without the
        share sheet copies the invite instead, which is the same outcome by hand.
      */}
      <button
        type="button"
        onClick={() => {
          if (typeof navigator.share !== "function") {
            void copy("invite", invite);
            return;
          }
          // The phone's own sheet, so it lands in WhatsApp in one tap — which is
          // how this shop actually passes things to people.
          void navigator.share({ title: "Pouch Villa staff access", text: invite }).catch(() => {
            // Dismissing the sheet rejects. That is not a failure.
          });
        }}
        className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-(--pv-line) bg-(--pv-surface) px-3.5 text-sm font-bold"
      >
        <ShareNetwork size={16} weight="bold" aria-hidden="true" />
        Share
      </button>
    </div>
  );
}

function Action({
  onClick,
  done,
  label,
  doneLabel,
}: {
  onClick: () => void;
  done: boolean;
  label: string;
  doneLabel: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-(--pv-line) bg-(--pv-surface) px-3.5 text-sm font-bold"
    >
      {done ? (
        <Check size={16} weight="bold" aria-hidden="true" className="text-(--pv-success)" />
      ) : (
        <Copy size={16} weight="bold" aria-hidden="true" />
      )}
      {/* The change is announced, not only drawn, so it is not a colour-only
          confirmation — which §2 forbids and a screen reader would miss. */}
      <span role="status">{done ? doneLabel : label}</span>
    </button>
  );
}
