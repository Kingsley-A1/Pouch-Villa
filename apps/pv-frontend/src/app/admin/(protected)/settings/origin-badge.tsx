import type { SettingValue } from "@pv/backend/services/settings";

/** Shows a field's provenance so admin can tell "seeded from deployment" apart from "set by a person" rather than treating them as alike. */
export function OriginBadge({ value }: { value: SettingValue }) {
  if (!value.present) {
    return (
      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-800">
        Awaiting confirmation
      </span>
    );
  }
  if (value.origin === "environment") {
    return (
      <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-semibold text-(--pv-muted)">
        Seeded from environment
      </span>
    );
  }
  return (
    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-(--pv-success)">
      Set in admin
    </span>
  );
}
