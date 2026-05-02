import "./Sidebar.css";
import { useLocation, Link } from "wouter";
import { useAuth, useUser } from "@clerk/react";
import { useQuery } from "@tanstack/react-query";
import { useAuthedFetch } from "@/lib/authedFetch";
import { useGuest } from "@/lib/guestContext";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

const HIDE_EXACT = new Set(["", "/"]);
const HIDE_PREFIX = ["/room", "/sign-in", "/sign-up", "/offline-sprint"];

function shouldHide(path: string): boolean {
  if (HIDE_EXACT.has(path)) return true;
  return HIDE_PREFIX.some(p => path === p || path.startsWith(p + "/") || path.startsWith(p + "?"));
}

function getActiveKey(path: string): string {
  if (path.startsWith("/portal")) return "sprint";
  if (path.startsWith("/my-files")) return "my-files";
  if (path.startsWith("/friends")) return "friends";
  if (path.startsWith("/global-ranking")) return "rankings";
  if (path.startsWith("/shop") || path.startsWith("/bag") || path.startsWith("/chests") || path.startsWith("/crafting")) return "shop";
  if (path.startsWith("/profile")) return "profile";
  return "";
}

export function Sidebar() {
  const [location] = useLocation();
  const { isSignedIn } = useAuth();
  const { user } = useUser();
  const { guestName } = useGuest();
  const af = useAuthedFetch();

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

  if (!isSignedIn || shouldHide(location)) return null;

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
    <aside className="sb">
      <div className="sb-logo">
        <img src={`${basePath}/logo-icon.png`} alt="Writing Sprint" />
      </div>

      <Link href="/portal" className={`ni${active === "sprint" ? " active" : ""}`}>
        <span className="ni-ico">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
          </svg>
        </span>
        <span className="ni-lbl">Sprint</span>
      </Link>

      <Link href="/my-files" className={`ni${active === "my-files" ? " active" : ""}`}>
        <span className="ni-ico">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
            <circle cx="9" cy="7" r="4"/>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
        </span>
        <span className="ni-lbl">Friends</span>
      </Link>

      <Link href="/global-ranking" className={`ni${active === "rankings" ? " active" : ""}`}>
        <span className="ni-ico">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <polyline points="12 6 12 12 16 14"/>
          </svg>
        </span>
        <span className="ni-lbl">Rankings</span>
      </Link>

      <div className="sb-sep" />

      <Link href="/shop" className={`ni${active === "shop" ? " active" : ""}`}>
        <span className="ni-ico">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
            <line x1="3" y1="6" x2="21" y2="6"/>
            <path d="M16 10a4 4 0 0 1-8 0"/>
          </svg>
        </span>
        <span className="ni-lbl">Shop</span>
      </Link>

      <Link href={profileHref} className={`ni${active === "profile" ? " active" : ""}`}>
        <span className="ni-ico">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
  );
}
