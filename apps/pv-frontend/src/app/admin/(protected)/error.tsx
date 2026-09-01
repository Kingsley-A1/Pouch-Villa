"use client";

import { ErrorState } from "@/components/error-state";

/**
 * The admin's own boundary. Without it, a failure in any admin route falls
 * through to the storefront's, which offers "go to the home page" — sending a
 * staff member out of the admin to fix an admin problem.
 */
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErrorState
      error={error}
      reset={reset}
      title="This admin screen could not load."
      homeHref="/admin"
      homeLabel="Back to the dashboard"
    />
  );
}
