import type { Metadata } from "next";
import Image from "next/image";
import { pick, readSettings } from "@pv/backend/services/settings";
import { PolicyPage } from "@/components/policy-page";

export const metadata: Metadata = { title: "Pouch Villa" };

/**
 * Read from the settings store on every request, so the client can correct their
 * own wording in the admin without waiting for a deployment.
 */
export const dynamic = "force-dynamic";

export default async function Page() {
  const settings = await readSettings(["policy.about"]);
  const policy = pick(settings, "policy.about");

  return (
    <PolicyPage
      title="About"
      what="about page"
      content={policy.present ? policy.value : null}
      media={
        <figure>
          {/*
            Intrinsic width and height, not `fill`: this is a single photo at
            its own aspect ratio rather than a box being cropped to fit one, so
            next/image can reserve its box from these two numbers alone and the
            page never shifts once it loads (§2).
          */}
          <Image
            src="/images/storefront-exterior.jpg"
            alt="Pouch Villa's storefront, a red building with large display windows."
            width={1190}
            height={1322}
            sizes="(max-width: 768px) 100vw, 768px"
            priority
            className="w-full rounded-3xl"
          />
          <figcaption className="mt-3 text-center text-sm text-(--pv-muted)">
            Our storefront.
          </figcaption>
        </figure>
      }
    />
  );
}
