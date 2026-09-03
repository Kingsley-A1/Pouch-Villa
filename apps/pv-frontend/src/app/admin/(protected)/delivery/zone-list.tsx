"use client";

import { useState } from "react";
import type { DeliveryZone } from "@pv/backend/services/delivery";
import { formatKobo } from "@pv/backend/domain/money";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { ZoneForm } from "./zone-form";
import { setZoneActiveAction, deleteZoneAction } from "./actions";

export function ZoneList({ zones }: { zones: DeliveryZone[] }) {
  // Derived from the zones already on screen rather than passed in: it is the
  // same data, and a second prop would be one more thing to keep in step.
  const knownAreas = [
    ...new Set(zones.map((zone) => zone.lga).filter((lga): lga is string => lga !== null)),
  ].sort();
  const [editingId, setEditingId] = useState<string | "new" | null>(null);

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">Delivery zones</h2>
        <button
          type="button"
          onClick={() => setEditingId(editingId === "new" ? null : "new")}
          className="min-h-11 rounded-xl border border-(--pv-line) px-4 text-sm font-bold"
        >
          {editingId === "new" ? "Cancel" : "Add zone"}
        </button>
      </div>

      {editingId === "new" ? (
        <ZoneForm knownAreas={knownAreas} onDone={() => setEditingId(null)} />
      ) : null}

      {zones.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-(--pv-line) p-6 text-sm text-(--pv-muted)">
          No delivery zones yet. Until one exists, checkout resolves delivery to zero rather than
          guessing a fee.
        </p>
      ) : (
        <ul className="grid gap-3">
          {zones.map((zone) =>
            editingId === zone.id ? (
              <li key={zone.id}>
                <ZoneForm
                  editing={zone}
                  knownAreas={knownAreas}
                  onDone={() => setEditingId(null)}
                />
              </li>
            ) : (
              <li
                key={zone.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-(--pv-line) bg-(--pv-surface) p-4"
              >
                <div>
                  <p className="font-bold">
                    {zone.name}
                    {!zone.isActive ? (
                      <span className="ml-2 rounded-full bg-(--pv-wash) px-2 py-0.5 text-xs font-semibold text-(--pv-muted)">
                        Hidden
                      </span>
                    ) : null}
                  </p>
                  <p className="text-xs text-(--pv-muted)">
                    {zone.lga ? `${zone.lga} · ` : ""}
                    {formatKobo(zone.feeKobo)}
                    {zone.minDays !== null || zone.maxDays !== null
                      ? ` · ${zone.minDays ?? "?"}–${zone.maxDays ?? "?"} days`
                      : ""}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setEditingId(zone.id)}
                    className="min-h-11 text-sm font-bold text-(--pv-red)"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => setZoneActiveAction(zone.id, !zone.isActive)}
                    className="min-h-11 text-sm font-semibold text-(--pv-ink)"
                  >
                    {zone.isActive ? "Hide" : "Show"}
                  </button>
                  <ConfirmButton
                    label="Remove"
                    confirmLabel="Remove"
                    onConfirm={() => deleteZoneAction(zone.id, "Removed from admin").then(() => {})}
                  />
                </div>
              </li>
            ),
          )}
        </ul>
      )}
    </div>
  );
}
