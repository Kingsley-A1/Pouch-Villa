/**
 * A named, honest placeholder rather than an invented order, payment or review.
 * The scope commits to this page; the commerce schema it needs is a Phase 3 item.
 */
export function ComingSoon({ title, reason }: { title: string; reason: string }) {
  return (
    <div>
      <h1 className="text-2xl font-bold">{title}</h1>
      <p className="mt-4 max-w-prose rounded-2xl border border-dashed border-(--pv-line) bg-white p-6 text-sm text-(--pv-muted)">
        {reason}
      </p>
    </div>
  );
}
