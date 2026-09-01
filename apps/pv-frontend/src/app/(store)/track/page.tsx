import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { TrackForm } from "./track-form";

export const metadata: Metadata = {
  title: "Track your order",
  description: "Check the status of a Pouch Villa order.",
};

type Params = { searchParams: Promise<{ reference?: string }> };

export default async function TrackPage({ searchParams }: Params) {
  const { reference } = await searchParams;

  return (
    <>
      <Breadcrumbs trail={[{ label: "Track order" }]} />
      <section className="section-space">
        <div className="container-shell">
          <h1 className="section-title">Track your order</h1>
          <p className="mt-3 max-w-prose text-(--pv-muted)">
            Enter your reference and the phone number you gave when you ordered. We ask for both
            because a reference on its own travels in a bank transfer, and it should not be enough
            to open someone&rsquo;s address.
          </p>

          <TrackForm defaultReference={reference ?? ""} />
        </div>
      </section>
    </>
  );
}
