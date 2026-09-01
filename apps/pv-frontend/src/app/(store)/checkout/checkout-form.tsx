"use client";

import { useActionState, useState } from "react";
import { House, Storefront } from "@phosphor-icons/react";
import { ProgressiveDisclosure } from "@/components/progressive-disclosure";
import { INITIAL_ACTION_STATE } from "@/lib/action-state";
import { placeOrderAction } from "./actions";

/**
 * Client because the delivery fields appear only once "Deliver to me" is chosen
 * and the running total has to follow that choice without a round trip.
 *
 * Prices arrive already formatted — no `Kobo` crosses the client boundary as a
 * bare number.
 */
export type CheckoutZone = {
  id: string;
  name: string;
  feeKobo: number;
  feeLabel: string;
  timeframe: string | null;
};

export function CheckoutForm({
  zones,
  idempotencyKey,
  subtotalKobo,
  formatMoney,
  signedInEmail,
  signedInName,
  signedInPhone,
}: {
  zones: CheckoutZone[];
  idempotencyKey: string;
  subtotalKobo: number;
  /** A precomputed table of every total this form can produce, built server-side. */
  formatMoney: Record<string, string>;
  signedInEmail: string | null;
  signedInName: string | null;
  signedInPhone: string | null;
}) {
  const [state, submit, pending] = useActionState(placeOrderAction, INITIAL_ACTION_STATE);
  const [fulfilment, setFulfilment] = useState<"delivery" | "pickup">("delivery");
  const [zoneId, setZoneId] = useState(zones[0]?.id ?? "");

  const zone = zones.find((candidate) => candidate.id === zoneId);
  const feeKobo = fulfilment === "delivery" ? (zone?.feeKobo ?? 0) : 0;
  const totalKobo = subtotalKobo + feeKobo;

  return (
    <form action={submit} className="grid gap-8 lg:grid-cols-[1fr_22rem] lg:items-start">
      {/*
        Generated once when the page rendered and resubmitted unchanged on every
        retry. This is what makes a double tap on a dropping connection produce
        one order rather than two.
      */}
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />

      <div className="grid gap-6">
        <fieldset className="card-surface p-5">
          <legend className="px-1 text-lg font-bold">Your details</legend>

          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="contactName">
                Full name
              </label>
              <input
                id="contactName"
                name="contactName"
                className="field"
                required
                maxLength={200}
                autoComplete="name"
                defaultValue={signedInName ?? ""}
              />
            </div>

            <div>
              <label className="label" htmlFor="contactPhone">
                Phone number
              </label>
              <input
                id="contactPhone"
                name="contactPhone"
                className="field"
                required
                inputMode="tel"
                autoComplete="tel"
                defaultValue={signedInPhone ?? ""}
                aria-describedby="phone-help"
              />
              <p className="help mt-1" id="phone-help">
                We use this to reach you about delivery, and to open your order on the tracking
                page.
              </p>
            </div>

            <div className="sm:col-span-2">
              <label className="label" htmlFor="contactEmail">
                Email address
              </label>
              <input
                id="contactEmail"
                name="contactEmail"
                type="email"
                className="field"
                required
                maxLength={320}
                autoComplete="email"
                defaultValue={signedInEmail ?? ""}
              />
            </div>
          </div>
        </fieldset>

        <fieldset className="card-surface p-5">
          <legend className="px-1 text-lg font-bold">How would you like it?</legend>

          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {(
              [
                ["delivery", "Deliver to me", House],
                ["pickup", "I will collect it", Storefront],
              ] as const
            ).map(([value, label, Icon]) => (
              <label
                key={value}
                className={`flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 transition-colors ${
                  fulfilment === value
                    ? "border-(--pv-red) bg-(--pv-cream)"
                    : "border-(--pv-line) hover:border-zinc-400"
                }`}
              >
                <input
                  type="radio"
                  name="fulfilment"
                  value={value}
                  checked={fulfilment === value}
                  onChange={() => setFulfilment(value)}
                  className="h-4 w-4 accent-(--pv-red)"
                />
                <Icon size={20} aria-hidden="true" />
                <span className="text-sm font-semibold">{label}</span>
              </label>
            ))}
          </div>

          {/* The client's Q2 ask, in its first real use: the delivery fields
              only exist once delivery is actually chosen. */}
          <ProgressiveDisclosure open={fulfilment === "delivery"} className="mt-4">
            <div className="grid gap-4">
              <div>
                <label className="label" htmlFor="deliveryZoneId">
                  Delivery area
                </label>
                {zones.length === 0 ? (
                  <p className="rounded-xl bg-(--pv-wash) p-3 text-sm" role="status">
                    No delivery areas have been set up yet. Choose collection, or contact us to
                    arrange delivery.
                  </p>
                ) : (
                  <select
                    id="deliveryZoneId"
                    name="deliveryZoneId"
                    className="field"
                    value={zoneId}
                    onChange={(event) => setZoneId(event.target.value)}
                    required={fulfilment === "delivery"}
                  >
                    {zones.map((candidate) => (
                      <option key={candidate.id} value={candidate.id}>
                        {candidate.name} — {candidate.feeLabel}
                        {candidate.timeframe ? ` · ${candidate.timeframe}` : ""}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="label" htmlFor="deliveryLga">
                    LGA
                  </label>
                  <input id="deliveryLga" name="deliveryLga" className="field" maxLength={120} />
                </div>
                <div>
                  <label className="label" htmlFor="deliveryLandmark">
                    Nearest landmark
                  </label>
                  <input
                    id="deliveryLandmark"
                    name="deliveryLandmark"
                    className="field"
                    maxLength={200}
                  />
                </div>
              </div>

              <div>
                <label className="label" htmlFor="deliveryAddress">
                  Delivery address
                </label>
                <textarea
                  id="deliveryAddress"
                  name="deliveryAddress"
                  className="field"
                  rows={3}
                  maxLength={500}
                  required={fulfilment === "delivery"}
                />
              </div>
            </div>
          </ProgressiveDisclosure>
        </fieldset>

        <fieldset className="card-surface p-5">
          <legend className="px-1 text-lg font-bold">Anything else?</legend>
          <label className="label mt-3" htmlFor="customerNote">
            Note for us (optional)
          </label>
          <textarea
            id="customerNote"
            name="customerNote"
            className="field"
            rows={2}
            maxLength={1000}
          />

          {/*
            Ticked by default and a real choice, per ADR 0002. Unticking places
            the order without an account; the ticked state is recorded as
            consent with a timestamp, which is the NDPR distinction between a
            default and a silent creation.
          */}
          {signedInEmail === null ? (
            <label className="mt-4 flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                name="createAccount"
                defaultChecked
                className="mt-1 h-4 w-4 accent-(--pv-red)"
              />
              <span className="text-sm">
                <span className="font-semibold">Create my Pouch Villa account</span>
                <span className="help block">
                  So you can track this order and reorder without typing it all again.
                </span>
              </span>
            </label>
          ) : null}
        </fieldset>
      </div>

      <aside className="card-surface p-5 lg:sticky lg:top-24">
        <h2 className="text-lg font-bold">Order total</h2>
        <dl className="mt-4 grid gap-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-(--pv-muted)">Subtotal</dt>
            <dd className="font-semibold tabular-nums">{formatMoney[String(subtotalKobo)]}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-(--pv-muted)">
              {fulfilment === "pickup" ? "Collection" : "Delivery"}
            </dt>
            <dd className="font-semibold tabular-nums">
              {fulfilment === "pickup" ? "Free" : (formatMoney[String(feeKobo)] ?? "—")}
            </dd>
          </div>
          <div className="mt-2 flex justify-between border-t border-(--pv-line) pt-3 text-base">
            <dt className="font-bold">Total</dt>
            <dd className="font-extrabold tabular-nums">{formatMoney[String(totalKobo)] ?? "—"}</dd>
          </div>
        </dl>

        <button type="submit" className="button-primary mt-5 w-full" disabled={pending}>
          {pending ? "Placing your order…" : "Place order"}
        </button>

        <p className="help mt-3">
          You will see the transfer details on the next screen. Nothing is charged here.
        </p>

        {state.error ? (
          <p className="mt-3 text-sm text-(--pv-danger)" role="alert">
            {state.error}
          </p>
        ) : null}
      </aside>
    </form>
  );
}
