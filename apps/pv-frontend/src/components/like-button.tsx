"use client";

import { useState, useTransition } from "react";
import { Heart } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

/**
 * Like, unlike, and show how many others did.
 *
 * Optimistic on purpose. On Nigerian mobile data a round trip to a CockroachDB
 * cluster is measured in seconds, and a heart that does not fill until it
 * returns reads as broken — people tap again, which would toggle it back. The
 * state flips immediately, the request follows, and a failure puts it back
 * exactly where it was and says so.
 *
 * The count is hidden at zero rather than rendered as "0". A new shop showing a
 * row of zeroes tells a shopper only that nobody has bought anything, which is
 * both discouraging and not information they can use.
 */
export function LikeButton({
  productId,
  productName,
  initialLiked,
  initialCount,
  size = "card",
  onMedia = false,
}: {
  productId: string;
  productName: string;
  initialLiked: boolean;
  initialCount: number;
  /** `card` sits on a product tile; `detail` is the larger control on its page. */
  size?: "card" | "detail";
  /**
   * Whether the control is drawn straight onto a product photograph.
   *
   * It changes two things and nothing else. The glyph goes white, because the
   * muted grey it uses on a surface disappears into half the photographs a shop
   * uploads; and it takes the `on-media` shadow, which is what makes a light
   * glyph readable on a light image now that there is no plate behind it.
   *
   * Liked and unliked stay apart by the heart being filled or hollow rather than
   * by its colour, so the state survives both a white glyph and a shopper who
   * cannot distinguish the two colours.
   */
  onMedia?: boolean;
}) {
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialCount);
  const [failed, setFailed] = useState(false);
  const [pending, start] = useTransition();

  function toggle() {
    const previous = { liked, count };
    // Move first. The server is the authority and its answer is applied below,
    // but the shopper should never wait to see their own tap register.
    setLiked(!liked);
    setCount(Math.max(0, count + (liked ? -1 : 1)));
    setFailed(false);

    start(async () => {
      try {
        const response = await fetch(`/api/v1/products/${productId}/like`, { method: "POST" });
        const body: unknown = await response.json();
        const state = readLikeState(body);
        if (state === null) throw new Error("Unrecognised response");
        setLiked(state.liked);
        setCount(state.count);
      } catch {
        setLiked(previous.liked);
        setCount(previous.count);
        setFailed(true);
      }
    });
  }

  const detail = size === "detail";

  return (
    <span className={cn("inline-flex items-center", detail ? "gap-2" : "gap-1")}>
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        aria-pressed={liked}
        // The product name is in the accessible name because a grid of hearts is
        // otherwise a list of identically-labelled buttons to a screen reader.
        aria-label={liked ? `Unlike ${productName}` : `Like ${productName}`}
        // 44px either way, per §2. On a card that target is now invisible —
        // what was visible about it was the plate, not the control.
        className={cn(
          "grid h-11 w-11 place-items-center rounded-full transition-colors",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--pv-red)",
          detail ? "border border-(--pv-line)" : "",
          onMedia
            ? "on-media text-white"
            : liked
              ? "text-(--pv-red)"
              : "text-(--pv-muted) hover:text-(--pv-red)",
          pending ? "opacity-60" : "",
        )}
      >
        <Heart
          aria-hidden="true"
          size={detail ? 23 : 20}
          weight={liked ? "fill" : "regular"}
          className="motion-safe:transition-transform"
        />
      </button>

      {count > 0 ? (
        <span
          className={cn(
            "tabular-nums",
            detail ? "text-sm font-semibold" : "text-xs font-semibold",
            onMedia ? "on-media text-white" : detail ? "" : "text-(--pv-muted)",
          )}
        >
          {count}
          {/* The number alone is meaningless out of context to a screen reader. */}
          <span className="sr-only"> {count === 1 ? "person likes" : "people like"} this</span>
        </span>
      ) : null}

      {failed ? (
        <span role="status" className="text-xs text-(--pv-danger)">
          Not saved
        </span>
      ) : null}
    </span>
  );
}

/**
 * Narrows the API envelope without trusting it. The endpoint is ours, but a
 * proxy, an offline page or a redirect to a sign-in screen can all put something
 * else on the wire, and `body.data.count` on any of those would throw inside the
 * transition rather than fall through to the failure path.
 */
function readLikeState(body: unknown): { liked: boolean; count: number } | null {
  if (typeof body !== "object" || body === null) return null;
  const envelope = body as { ok?: unknown; data?: unknown };
  if (envelope.ok !== true || typeof envelope.data !== "object" || envelope.data === null) {
    return null;
  }
  const data = envelope.data as { liked?: unknown; count?: unknown };
  if (typeof data.liked !== "boolean" || typeof data.count !== "number") return null;
  return { liked: data.liked, count: data.count };
}
