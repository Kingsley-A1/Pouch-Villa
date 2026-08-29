"use client";
export default function StoreError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <section className="section-space">
      <div className="container-shell">
        <div className="mx-auto max-w-xl rounded-3xl border border-red-200 bg-red-50 p-8 text-center">
          <p className="eyebrow">Something went wrong</p>
          <h1 className="mt-3 text-3xl font-bold">This prototype route could not load.</h1>
          <p className="mt-3 text-zinc-600">
            No customer action was completed. You can safely retry.
          </p>
          <button className="button-primary mt-6" onClick={reset}>
            Try again
          </button>
        </div>
      </div>
    </section>
  );
}
