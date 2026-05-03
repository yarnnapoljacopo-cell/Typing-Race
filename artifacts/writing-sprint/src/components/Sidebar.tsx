import "./Sidebar.css";
import { useEffect, useState } from "react";
import { useLocation, Link } from "wouter";
import { useAuth, useUser } from "@clerk/react";
import { useQuery } from "@tanstack/react-query";
import { useAuthedFetch } from "@/lib/authedFetch";
import { useGuest } from "@/lib/guestContext";
import { GuildBell } from "@/components/GuildBell";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

const HIDE_EXACT = new Set(["", "/"]);
const HIDE_PREFIX = ["/room", "/sign-in", "/sign-up", "/offline-sprint", "/my-files"];

function shouldHide(path: string): boolean {
  if (HIDE_EXACT.has(path)) return true;
  return HIDE_PREFIX.some(p => path === p || path.startsWith(p + "/") || path.startsWith(p + "?"));
}

function getActiveKey(path: string): string {
  if (path.startsWith("/portal")) return "sprint";
  if (path.startsWith("/my-files")) return "my-files";
  if (path.startsWith("/friends")) return "friends";
  if (path.startsWith("/guild")) return "guild";
  if (path.startsWith("/global-ranking")) return "rankings";
  if (path.startsWith("/shop") || path.startsWith("/bag") || path.startsWith("/chests") || path.startsWith("/crafting")) return "shop";
  if (path.startsWith("/quests")) return "quests";
  if (path.startsWith("/streak")) return "streak";
  if (path.startsWith("/stats")) return "stats";
  if (path.startsWith("/profile")) return "profile";
  return "";
}

export function Sidebar() {
  const [location] = useLocation();
  const { isSignedIn } = useAuth();
  const { user } = useUser();
  const { guestName } = useGuest();
  const af = useAuthedFetch();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close drawer on route change.
  useEffect(() => { setMobileOpen(false); }, [location]);

  // Close on Escape.
  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setMobileOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileOpen]);

  const { data: ownPrefs } = useQuery({
    queryKey: ["ownPrefs"],
    queryFn: async () => {
      const res = await af(`${basePath}/api/user/profile`);
      if (!res.ok) throw new Error("Not authenticated");
      const data = await res.json();
      return {
        writerName: (data.writerName ?? "") as string,
        nameplate: (data.activeNameplate ?? "default") as string,
        skin: (data.activeSkin ?? "default") as string,
        xp: (data.xp ?? 0) as number,
      };
    },
    enabled: !!isSignedIn,
    staleTime: 5 * 60_000,
  });

  // TEMP DEV: allow guests to see the sidebar so /my-files is reachable.
  // RESTORE BEFORE PUSHING TO PROD — change back to: if (!isSignedIn || shouldHide(location)) return null;
  if (shouldHide(location)) return null;

  const active = getActiveKey(location);
  const writerName = ownPrefs?.writerName ?? "";
  const profileHref = writerName ? `/profile/${encodeURIComponent(writerName)}` : "/portal";

  let avatarLetter = "?";
  if (isSignedIn && user) {
    avatarLetter = (
      user.firstName?.[0] ??
      user.emailAddresses?.[0]?.emailAddress?.[0] ??
      "?"
    ).toUpperCase();
  } else if (guestName) {
    avatarLetter = guestName[0].toUpperCase();
  }

  return (
    <>
      <button
        type="button"
        className="sb-toggle"
        aria-label={mobileOpen ? "Close menu" : "Open menu"}
        aria-expanded={mobileOpen}
        onClick={() => setMobileOpen((v) => !v)}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          {mobileOpen ? (
            <>
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </>
          ) : (
            <>
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </>
          )}
        </svg>
      </button>
      <div
        className={`sb-backdrop${mobileOpen ? " sb-backdrop-open" : ""}`}
        onClick={() => setMobileOpen(false)}
        aria-hidden="true"
      />
    <aside className={`sb${mobileOpen ? " sb-open" : ""}`}>
      <div className="sb-logo" aria-hidden="true">
        <span className="sb-logo-shine" />
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ position: "relative", zIndex: 2 }}>
          <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
          <path d="m15 5 4 4"/>
        </svg>
        <span className="sb-logo-spark" />
      </div>

      <Link href="/portal" className={`ni${active === "sprint" ? " active" : ""}`}>
        <span className="ni-ico">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
          </svg>
        </span>
        <span className="ni-lbl">Sprint</span>
      </Link>

      <Link href="/my-files" className={`ni${active === "my-files" ? " active" : ""}`}>
        <span className="ni-ico">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="16" y1="13" x2="8" y2="13"/>
            <line x1="16" y1="17" x2="8" y2="17"/>
          </svg>
        </span>
        <span className="ni-lbl">My Files</span>
      </Link>

      <Link href="/friends" className={`ni${active === "friends" ? " active" : ""}`}>
        <span className="ni-ico">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
            <circle cx="9" cy="7" r="4"/>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
        </span>
        <span className="ni-lbl">Friends</span>
      </Link>

      <Link href="/guild" className={`ni${active === "guild" ? " active" : ""}`}>
        <span className="ni-ico" style={{ position: "relative" }}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          </svg>
        </span>
        <span className="ni-lbl">Guild</span>
        <span style={{ marginLeft: "auto" }}><GuildBell /></span>
      </Link>

      <Link href="/quests" className={`ni${active === "quests" ? " active" : ""}`}>
        <span className="ni-ico">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 11l3 3L22 4"/>
            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
          </svg>
        </span>
        <span className="ni-lbl">Quests</span>
      </Link>

      <Link href="/global-ranking" className={`ni${active === "rankings" ? " active" : ""}`}>
        <span className="ni-ico">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <polyline points="12 6 12 12 16 14"/>
          </svg>
        </span>
        <span className="ni-lbl">Rankings</span>
      </Link>

      <Link href="/streak" className={`ni${active === "streak" ? " active" : ""}`}>
        <span className="ni-ico">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>
          </svg>
        </span>
        <span className="ni-lbl">Streak</span>
      </Link>

      <Link href="/stats" className={`ni${active === "stats" ? " active" : ""}`}>
        <span className="ni-ico">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="20" x2="18" y2="10"/>
            <line x1="12" y1="20" x2="12" y2="4"/>
            <line x1="6" y1="20" x2="6" y2="14"/>
            <line x1="3" y1="20" x2="21" y2="20"/>
          </svg>
        </span>
        <span className="ni-lbl">Statistics</span>
      </Link>

      <div className="sb-sep" />

      <Link href="/shop" className={`ni${active === "shop" ? " active" : ""}`}>
        <span className="ni-ico">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
            <line x1="3" y1="6" x2="21" y2="6"/>
            <path d="M16 10a4 4 0 0 1-8 0"/>
          </svg>
        </span>
        <span className="ni-lbl">Shop</span>
      </Link>

      <Link href={profileHref} className={`ni${active === "profile" ? " active" : ""}`}>
        <span className="ni-ico">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
            <circle cx="12" cy="7" r="4"/>
          </svg>
        </span>
        <span className="ni-lbl">My Profile</span>
      </Link>

      <Link href={profileHref} className="sb-foot">
        {avatarLetter}
      </Link>
    </aside>
    </>
  );
}
