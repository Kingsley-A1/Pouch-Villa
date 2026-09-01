import type { SettingValue } from "@pv/backend/services/settings";

/** Shows a field's provenance so admin can tell "seeded from deployment" apart from "set by a person" rather than treating them as alike. */
export function OriginBadge({ value }: { value: SettingValue }) {
  if (!value.present) {
    return (
      <span className="rounded-full bg-[color-mix(in_srgb,var(--pv-warning)_12%,var(--pv-surface))] px-2 py-0.5 text-xs font-semibold text-(--pv-warning)">
        Awaiting confirmation
      </span>
    );
  }
  if (value.origin === "environment") {
    return (
      <span className="rounded-full bg-(--pv-wash) px-2 py-0.5 text-xs font-semibold text-(--pv-muted)">
        Seeded from environment
      </span>
    );
  }
  return (
    <span className="rounded-full bg-[color-mix(in_srgb,var(--pv-success)_12%,var(--pv-surface))] px-2 py-0.5 text-xs font-semibold text-(--pv-success)">
      Set in admin
    </span>
  );
}
