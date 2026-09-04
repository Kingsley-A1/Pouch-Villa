import Link from "next/link";
import { BookmarkSimple, Users } from "@phosphor-icons/react/dist/ssr";
import { listSavedViews, type ViewScreen } from "@pv/backend/services/saved-views";
import { requireStaffPrincipal } from "@/server/session";
import { SaveViewForm } from "./save-view-form";

/**
 * The saved-view bar.
 *
 * A Server Component, so the views are in the HTML rather than fetched after
 * hydration; only the "save this one" form below it is interactive, and that is
 * a separate island.
 *
 * `currentQuery` is what the screen is showing right now, so saving captures the
 * filters actually in effect rather than asking someone to describe them.
 */
export async function SavedViews({
  screen,
  currentQuery,
}: {
  screen: ViewScreen;
  currentQuery: string;
}) {
  const principal = await requireStaffPrincipal();
  const views = await listSavedViews(screen, principal.staffId);

  const base = `/admin/${screen}`;

  return (
    <div className="mt-4 flex flex-wrap items-center gap-2">
      {views.map((view) => {
        const active = view.query === currentQuery;
        return (
          <Link
            key={view.id}
            href={view.query === "" ? base : `${base}?${view.query}`}
            aria-current={active ? "page" : undefined}
            className={`inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3.5 text-sm font-semibold ${
              active
                ? "border-(--pv-red) bg-(--pv-red) text-(--pv-on-brand)"
                : "border-(--pv-line) bg-(--pv-surface) hover:border-(--pv-muted)"
            }`}
          >
            <BookmarkSimple size={14} weight={active ? "fill" : "regular"} aria-hidden />
            {view.name}
            {/* A shared view is marked, so nobody wonders why they cannot
                remove one someone else set up for the whole shop. */}
            {view.isShared ? <Users size={13} aria-label="Shared with the team" /> : null}
          </Link>
        );
      })}

      <SaveViewForm
        screen={screen}
        currentQuery={currentQuery}
        existing={views
          .filter((view) => view.isOwn)
          .map((view) => ({ id: view.id, name: view.name }))}
        canShare={principal.role === "CEO" || principal.role === "MANAGER"}
      />
    </div>
  );
}
