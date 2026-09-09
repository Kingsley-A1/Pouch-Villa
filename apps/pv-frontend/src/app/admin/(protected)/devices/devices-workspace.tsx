"use client";

import { useState } from "react";
import { Plus, X } from "@phosphor-icons/react";
import type { AdminDevice, AdminDeviceLine } from "@pv/backend/services/devices";
import type { AdminBrand } from "@pv/backend/services/brands";
import { cn } from "@/lib/utils";
import { DeviceForm, DeviceList } from "./device-list";
import { DeviceLineForm, DeviceLineList } from "./device-line-list";

type Adding = "device" | "class" | null;

/**
 * Both ways of adding something, in one row at the top of the screen.
 *
 * "Add class" used to sit in the Device classes heading, which is below the
 * whole device list — so a shop with fifty models had to scroll past all of them
 * to reach it, and the client reasonably read that as the control being missing.
 *
 * Moving only the button would have been worse: pressing something at the top
 * and having a form appear a screen and a half below is a control that does
 * nothing as far as the person pressing it can tell. So the form opens here too,
 * directly under the buttons, and the lists below keep their own inline editors
 * for changing something that already exists.
 *
 * The two are mutually exclusive. Both forms open at once would put two Brand
 * selects on screen with no way to tell which belongs to what.
 */
export function DevicesWorkspace({
  devices,
  brands,
  lines,
}: {
  devices: AdminDevice[];
  brands: AdminBrand[];
  lines: AdminDeviceLine[];
}) {
  const [adding, setAdding] = useState<Adding>(null);

  function toggle(which: Exclude<Adding, null>) {
    setAdding((current) => (current === which ? null : which));
  }

  return (
    <div className="grid gap-6">
      {/*
        Full-width and stacked at 360 px, side by side from `sm`. Two 44 px
        buttons sharing a phone's width leave neither enough room for its label
        (AGENTS.md section 2).
      */}
      <div className="grid gap-2 sm:flex sm:flex-wrap">
        <AddButton active={adding === "device"} onClick={() => toggle("device")}>
          {adding === "device" ? "Cancel" : "Add device"}
        </AddButton>
        <AddButton active={adding === "class"} onClick={() => toggle("class")}>
          {adding === "class" ? "Cancel" : "Add class"}
        </AddButton>
      </div>

      {adding === "device" ? (
        <DeviceForm brands={brands} lines={lines} onDone={() => setAdding(null)} />
      ) : null}
      {adding === "class" ? (
        <DeviceLineForm brands={brands} onDone={() => setAdding(null)} />
      ) : null}

      <DeviceList devices={devices} brands={brands} lines={lines} />
      <DeviceLineList lines={lines} brands={brands} />
    </div>
  );
}

function AddButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      // Pressed state said in words as well as colour: the label already reads
      // "Cancel", and `aria-expanded` says the same to a screen reader.
      aria-expanded={active}
      className={cn(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--pv-red)",
        active
          ? "border border-(--pv-red) bg-(--pv-red) text-(--pv-on-brand)"
          : "border border-(--pv-line) bg-(--pv-surface) text-(--pv-ink) hover:border-(--pv-red)",
      )}
    >
      {active ? (
        <X aria-hidden="true" size={16} weight="bold" />
      ) : (
        <Plus aria-hidden="true" size={16} weight="bold" />
      )}
      {children}
    </button>
  );
}
