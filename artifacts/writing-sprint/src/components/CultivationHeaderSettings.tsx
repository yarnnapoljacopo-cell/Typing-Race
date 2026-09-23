import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { PiFlowerLotusThin, PiGearSixThin } from "react-icons/pi";
import { useCultivation } from "@/lib/cultivation";
import { UserStatsDropdown } from "./UserStatsDropdown";

export function CultivationHeaderSettings() {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const { enabled, toggle } = useCultivation();

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const closeOutside = (event: PointerEvent) => {
      if (root.current && !root.current.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    window.addEventListener("pointerdown", closeOutside);
    return () => {
      window.removeEventListener("keydown", closeOnEscape);
      window.removeEventListener("pointerdown", closeOutside);
    };
  }, [open]);

  return <div className="cultivation-header-settings" ref={root}>
    <button type="button" className="cultivation-header-icon" aria-label="Open appearance and account menu" aria-expanded={open} aria-controls="cultivation-header-settings-panel" onClick={() => setOpen(value => !value)}>
      <PiGearSixThin size={29} aria-hidden="true" />
    </button>
    {open && <div className="cultivation-header-settings-panel" id="cultivation-header-settings-panel">
      <p>Appearance & account</p>
      <button type="button" className="cultivation-toggle" aria-pressed={enabled} onClick={toggle}><PiFlowerLotusThin size={22} aria-hidden="true" /><span>{enabled ? "Cultivation" : "Cultivation skin"}</span><span className="cultivation-toggle-state">{enabled ? "On" : "Off"}</span></button>
      <UserStatsDropdown />
      <Link href="/stats" onClick={() => setOpen(false)}>Writing statistics</Link>
    </div>}
  </div>;
}
