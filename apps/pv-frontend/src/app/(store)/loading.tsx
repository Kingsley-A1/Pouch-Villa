import { LoadingLine } from "@/components/loading-line";

export default function StoreLoading() {
  return (
    <div className="container-shell section-space" role="status" aria-live="polite">
      <LoadingLine label="Loading Pouch Villa" className="max-w-xs" />
      <div className="mt-6 h-4 w-32 rounded bg-(--pv-line)" />
      <div className="mt-4 h-12 max-w-xl rounded-xl bg-(--pv-line)" />
      <div className="mt-10 grid grid-cols-2 gap-4 md:grid-cols-4">
        {[1, 2, 3, 4].map((item) => (
          <div key={item} className="aspect-square rounded-3xl bg-(--pv-wash)" />
        ))}
      </div>
      <span className="sr-only">Loading Pouch Villa</span>
    </div>
  );
}
