import Link from "next/link";
export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center bg-(--pv-wash) p-6 text-center">
      <div>
        <p className="eyebrow">404</p>
        <h1 className="mt-3 text-4xl font-bold">We couldn’t find that page.</h1>
        <p className="mt-3 text-(--pv-muted)">The product or route may have changed.</p>
        <Link className="button-primary mt-6" href="/">
          Return home
        </Link>
      </div>
    </main>
  );
}
