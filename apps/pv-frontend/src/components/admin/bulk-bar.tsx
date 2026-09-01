import type { ReactNode } from "react";
import { SelectAll } from "./select-all";

/**
 * The bulk-action bar, as a Server Component.
 *
 * There is deliberately no client state here. The list sits inside a real
 * `<form>`, each row carries a plain checkbox the form collects natively, and
 * the bar is revealed by a CSS `:has()` rule the moment anything is ticked.
 *
 * The alternative — a client component holding a `Set` of selected ids and
 * taking the rows as a render-prop — cannot work: a function cannot cross the
 * Server Component boundary. Doing it in the platform is both correct and
 * smaller, and it keeps working when the JavaScript has not arrived.
 *
 * `name` is the field each row's checkbox uses, so the action reads them with
 * `formData.getAll(name)`.
 */
export function BulkBar({
  name,
  children,
  actions,
}: {
  name: string;
  /** The list itself, rendered on the server. */
  children: ReactNode;
  /** Submit buttons, each carrying its own decision as a name/value pair. */
  actions: ReactNode;
}) {
  return (
    <>
      <SelectAll name={name} />

      <div className="bulk-list">{children}</div>

      <div className="bulk-bar fixed inset-x-0 bottom-0 z-40 border-t border-(--pv-line) bg-(--pv-surface) p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-4px_20px_var(--pv-shadow)]">
        <div className="container-shell flex flex-wrap items-center justify-between gap-3">
          <span className="text-sm font-bold">Selected</span>
          <span className="flex flex-wrap gap-2">{actions}</span>
        </div>
      </div>
    </>
  );
}
