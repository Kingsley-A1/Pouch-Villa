import type { Metadata } from "next";
import Link from "next/link";
import { CONTACT_STATUSES, listContactRequests } from "@pv/backend/services/contact";
import { formatPhoneLocal } from "@pv/backend/domain/phone";
import { requirePermission } from "@/server/session";
import { SavedViews } from "@/components/admin/saved-views";
import { EnquiryActions } from "./enquiry-actions";

export const metadata: Metadata = { title: "Contact requests" };
export const dynamic = "force-dynamic";

type Params = { searchParams: Promise<{ status?: string }> };

const LABELS: Record<string, string> = {
  new: "New",
  in_progress: "In progress",
  closed: "Closed",
};

export default async function ContactAdminPage({ searchParams }: Params) {
  await requirePermission("enquiry.manage");

  const { status } = await searchParams;
  const filter = CONTACT_STATUSES.find((candidate) => candidate === status) ?? "new";

  const enquiries = await listContactRequests({ status: filter });

  return (
    <div>
      <h1 className="text-2xl font-bold">Contact requests</h1>

      <div className="mt-4 flex flex-wrap gap-2">
        {CONTACT_STATUSES.map((candidate) => (
          <Link
            key={candidate}
            href={`/admin/contact?status=${candidate}`}
            aria-current={filter === candidate ? "page" : undefined}
            className={`inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-semibold ${
              filter === candidate
                ? "border-(--pv-red) bg-(--pv-red) text-(--pv-on-brand)"
                : "border-(--pv-line) bg-(--pv-surface)"
            }`}
          >
            {LABELS[candidate]}
          </Link>
        ))}
      </div>

      <SavedViews screen="contact" currentQuery={`status=${filter}`} />

      {enquiries.length === 0 ? (
        <p className="mt-8 rounded-2xl border border-dashed border-(--pv-line) bg-(--pv-surface) p-6 text-sm text-(--pv-muted)">
          {filter === "new" ? "No new enquiries." : `Nothing ${LABELS[filter]?.toLowerCase()}.`}
        </p>
      ) : (
        <ul className="mt-6 grid gap-4 lg:grid-cols-2">
          {enquiries.map((enquiry) => (
            <li
              key={enquiry.id}
              className="rounded-2xl border border-(--pv-line) bg-(--pv-surface) p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-bold">{enquiry.name}</p>
                  {/* Both are shown because either may be the only way to reply. */}
                  <p className="text-sm break-words text-(--pv-muted)">
                    {[
                      enquiry.email,
                      enquiry.phone === null ? null : formatPhoneLocal(enquiry.phone),
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <time
                  className="text-xs text-(--pv-muted)"
                  dateTime={enquiry.submittedAt.toISOString()}
                >
                  {formatLagos(enquiry.submittedAt)}
                </time>
              </div>

              {enquiry.orderReference ? (
                <p className="mt-2 font-mono text-sm font-bold">{enquiry.orderReference}</p>
              ) : null}
              {enquiry.subject ? <p className="mt-2 font-semibold">{enquiry.subject}</p> : null}
              <p className="mt-1 text-sm leading-6 whitespace-pre-line">{enquiry.message}</p>

              <EnquiryActions
                id={enquiry.id}
                status={enquiry.status}
                staffNote={enquiry.staffNote}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function formatLagos(value: Date): string {
  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Africa/Lagos",
  }).format(value);
}
