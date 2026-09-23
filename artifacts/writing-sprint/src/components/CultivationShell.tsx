import { Link, useLocation } from "wouter";
import { useEffect } from "react";
import { PiFeatherThin, PiFlowerLotusThin, PiMoonStarsThin, PiBookOpenThin } from "react-icons/pi";
import { useCultivation } from "@/lib/cultivation";
import { useDarkMode } from "@/lib/darkModeContext";
import "./cultivation.css";

export function CultivationToggle({ floating = false }: { floating?: boolean }) {
  const { enabled, toggle } = useCultivation();
  return <button type="button" className={`cultivation-toggle${floating ? " cultivation-toggle--floating" : ""}`} aria-pressed={enabled} onClick={toggle} title="Toggle cultivation skin">
    <PiFlowerLotusThin size={22} aria-hidden="true" /><span>{enabled ? "Cultivation" : "Cultivation skin"}</span><span className="cultivation-toggle-state">{enabled ? "On" : "Off"}</span>
  </button>;
}
export function CultivationShell() {
  const { enabled } = useCultivation();
  const { toggleDarkMode, isDark } = useDarkMode();
  const [path] = useLocation();
  const room = path.startsWith("/room") || path.startsWith("/offline-sprint") || path.startsWith("/sim/") || path.startsWith("/co-writing/");
  const embedded = new URLSearchParams(location.search).get("embed") === "folio";
  useEffect(() => { document.documentElement.dataset.cultivationPage = room ? "room" : path.split("/")[1] || "home"; }, [path, room]);
  if (path === "/portal" || embedded) return null;
  if (!enabled || room) return <CultivationToggle floating />;
  return <header className="cultivation-header">
    <Link href="/portal" className="cultivation-brand"><PiFeatherThin size={34} /><span>Writing Sprint</span></Link>
    <p>“Discipline turns thoughts into worlds.”</p>
    <div className="cultivation-header-actions"><Link href="/my-files" aria-label="Open your writing library"><PiBookOpenThin size={28} /></Link><CultivationToggle /><button onClick={toggleDarkMode} aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}><PiMoonStarsThin size={27} /></button></div>
  </header>;
}
