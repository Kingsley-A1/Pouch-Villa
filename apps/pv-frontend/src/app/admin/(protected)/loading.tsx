export default function AdminLoading() {
  return (
    <div role="status" aria-live="polite">
      <div className="h-4 w-28 animate-pulse rounded bg-zinc-200" />
      <div className="mt-3 h-11 w-72 animate-pulse rounded-xl bg-zinc-200" />
      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[1, 2, 3, 4].map((item) => (
          <div className="h-36 animate-pulse rounded-3xl bg-white" key={item} />
        ))}
      </div>
      <span className="sr-only">Loading admin data</span>
    </div>
  );
}
