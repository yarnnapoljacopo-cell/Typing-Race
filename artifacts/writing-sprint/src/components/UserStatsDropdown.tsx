import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth, useUser } from "@clerk/react";
import { useAuthedFetch } from "@/lib/authedFetch";
import { useDarkMode } from "@/lib/darkModeContext";
import { Flame, X, ShoppingBag, ChevronDown, Shield } from "lucide-react";
import { GuildCrest } from "@/components/GuildCrests";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

type AF = (url: string, opts?: RequestInit) => Promise<Response>;

interface DayEntry { day: string; wordsWritten: number; sprintsCompleted: number; }
interface StreakResponse {
  month: string;
  currentStreak: number;
  longestStreak: number;
  lastStreakDay: string | null;
  days: DayEntry[];
}
interface CoinData { balance: number; }
interface GuildSummary {
  guild: { id: number; name: string; tag: string; crest?: string } | null;
  role?: string;
}

function pad(n: number) { return String(n).padStart(2, "0"); }
function monthKey(d: Date) { return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`; }
function todayKey() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

async function fetchStreak(af: AF, month: string): Promise<StreakResponse> {
  const r = await af(`${basePath}/api/user/streak?month=${month}`);
  if (!r.ok) throw new Error("Failed to load streak");
  return r.json();
}
async function fetchCoins(af: AF): Promise<CoinData> {
  const r = await af(`${basePath}/api/coins`);
  if (!r.ok) throw new Error("Failed to load coins");
  return r.json();
}
async function fetchGuild(af: AF): Promise<GuildSummary> {
  const r = await af(`${basePath}/api/guilds/me`);
  if (!r.ok) throw new Error("Failed to load guild");
  return r.json();
}
// Same shape & query key as Sidebar so React Query dedupes the request and
// both surfaces show the SAME writer name (the DB is the source of truth;
// Clerk publicMetadata can drift after a rename).
async function fetchOwnPrefs(af: AF) {
  const r = await af(`${basePath}/api/user/profile`);
  if (!r.ok) throw new Error("Not authenticated");
  const data = await r.json();
  return { writerName: (data.writerName ?? "") as string };
}

export function UserStatsDropdown() {
  const { isLoaded, isSignedIn } = useAuth();
  const { user } = useUser();
  const { isDark } = useDarkMode();
  const af = useAuthedFetch();

  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelId = "user-stats-panel";

  const enabled = isLoaded && !!isSignedIn;
  const month = monthKey(new Date());

  const { data: streak } = useQuery({
    queryKey: ["streak", month],
    queryFn: () => fetchStreak(af, month),
    enabled,
    staleTime: 30_000,
  });
  const { data: coins } = useQuery({
    queryKey: ["coinBalance"],
    queryFn: () => fetchCoins(af),
    enabled,
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  });
  const { data: guild } = useQuery({
    queryKey: ["guild-me-summary"],
    queryFn: () => fetchGuild(af),
    enabled,
    staleTime: 60_000,
  });
  const { data: ownPrefs } = useQuery({
    queryKey: ["ownPrefs"],
    queryFn: () => fetchOwnPrefs(af),
    enabled,
    staleTime: 5 * 60_000,
  });

  // Close on Escape / outside click.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    const onPointer = (e: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onPointer);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  if (!enabled) return null;

  const today = todayKey();
  const todayEntry = streak?.days.find((d) => d.day === today);
  const wordsToday = todayEntry?.wordsWritten ?? 0;
  const currentStreak = streak?.currentStreak ?? 0;
  const coinBalance = coins?.balance ?? 0;

  // Prefer the DB writerName (same source the Sidebar uses) so the profile
  // link in the top bar matches the one in the sidebar. Fall back to Clerk
  // fields only while the profile request is still in flight.
  const writerName =
    ownPrefs?.writerName ||
    (user?.publicMetadata?.writerName as string | undefined) ||
    user?.username ||
    user?.fullName ||
    "Writer";
  const initial = writerName.charAt(0).toUpperCase();
  const avatarUrl = user?.imageUrl;

  // Theme-aware colors so the widget reads well in both light and dark mode.
  const triggerBorder = isDark ? "1px solid rgba(255,255,255,0.12)" : "1px solid rgba(107,143,212,0.18)";
  const triggerBg     = isDark ? "rgba(255,255,255,0.07)" : "rgba(107,143,212,0.07)";
  const triggerText   = isDark ? "rgba(255,255,255,0.9)" : "#1a1a2e";
  const subText       = isDark ? "rgba(255,255,255,0.55)" : "#7a7a92";

  const panelBg       = isDark ? "rgba(28,28,46,0.98)" : "rgba(255,255,255,0.98)";
  const panelBorder   = isDark ? "1px solid rgba(255,255,255,0.12)" : "1px solid rgba(107,143,212,0.2)";
  const panelText     = isDark ? "rgba(255,255,255,0.92)" : "#1a1a2e";
  const panelMuted    = isDark ? "rgba(255,255,255,0.6)" : "#7a7a92";
  const rowDivider    = isDark ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(107,143,212,0.12)";

  return (
    <div
      ref={containerRef}
      style={{ position: "relative", display: "flex", alignItems: "center" }}
    >
      {/* Hide the trigger text labels on very narrow viewports so the
          navbar brand never gets squeezed. The avatar + chevron remain
          tappable on mobile. */}
      <style>{`
        @media (max-width: 520px) {
          .usd-trigger-text { display: none !important; }
        }
      `}</style>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={`${writerName} — ${wordsToday} words today. Open stats menu.`}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 9,
          height: 36,
          padding: "0 10px 0 4px",
          borderRadius: 999,
          border: triggerBorder,
          background: triggerBg,
          color: triggerText,
          cursor: "pointer",
          transition: "all 0.18s",
          maxWidth: 220,
          minWidth: 0,
          overflow: "hidden",
        }}
        onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-1px)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.transform = ""; }}
      >
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt=""
            style={{ width: 28, height: 28, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }}
          />
        ) : (
          <span style={{
            width: 28, height: 28, borderRadius: "50%",
            background: "linear-gradient(135deg,#6B8FD4,#5a82d0)",
            color: "white", fontSize: "0.78rem", fontWeight: 700,
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
          }}>
            {initial}
          </span>
        )}
        <span
          className="usd-trigger-text"
          style={{
            display: "flex", flexDirection: "column",
            alignItems: "flex-start", lineHeight: 1.1,
            fontFamily: "'DM Sans', sans-serif",
            minWidth: 0, flex: "0 1 auto", overflow: "hidden",
          }}
        >
          <span style={{
            fontSize: "0.78rem", fontWeight: 700, letterSpacing: "-0.01em",
            maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {writerName}
          </span>
          <span style={{
            fontSize: "0.65rem", color: subText, fontWeight: 500,
            maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {wordsToday.toLocaleString()} {wordsToday === 1 ? "word" : "words"} today
          </span>
        </span>
        <ChevronDown
          size={14}
          style={{
            color: subText,
            transition: "transform 0.15s",
            transform: open ? "rotate(180deg)" : "none",
            flexShrink: 0,
          }}
        />
      </button>

      {open && (
        <div
          id={panelId}
          role="menu"
          aria-label="Your stats"
          style={{
            position: "absolute",
            top: "calc(100% + 10px)",
            right: 0,
            zIndex: 60,
            width: "min(300px, calc(100vw - 24px))",
            background: panelBg,
            backdropFilter: "blur(14px)",
            WebkitBackdropFilter: "blur(14px)",
            border: panelBorder,
            borderRadius: 16,
            boxShadow: isDark
              ? "0 18px 48px rgba(0,0,0,0.5)"
              : "0 18px 48px rgba(26,26,46,0.18)",
            padding: 16,
            color: panelText,
            animation: "fadeIn 0.14s ease-out",
          }}
        >
          {/* Header — avatar + name + close */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt=""
                style={{ width: 44, height: 44, borderRadius: 12, objectFit: "cover", flexShrink: 0 }}
              />
            ) : (
              <span style={{
                width: 44, height: 44, borderRadius: 12,
                background: "linear-gradient(135deg,#6B8FD4,#5a82d0)",
                color: "white", fontSize: "1.05rem", fontWeight: 700,
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
              }}>
                {initial}
              </span>
            )}
            <Link
              href={`/profile/${encodeURIComponent(writerName)}`}
              onClick={() => setOpen(false)}
              style={{
                flex: 1, minWidth: 0,
                fontFamily: "'Playfair Display', Georgia, serif",
                fontWeight: 700, fontSize: "1.15rem",
                color: "inherit", textDecoration: "none",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}
              title="View your profile"
            >
              {writerName}
            </Link>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close stats"
              style={{
                background: "none", border: "none", padding: 4, cursor: "pointer",
                color: panelMuted, display: "flex", alignItems: "center",
                borderRadius: 6,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
            >
              <X size={16} />
            </button>
          </div>

          {/* Stat rows */}
          <StatRow
            label="Words today"
            value={wordsToday.toLocaleString()}
            muted={panelMuted}
            divider={rowDivider}
          />
          <StatRow
            label={<>Current <span style={{ color: "#a855f7", fontWeight: 700 }}>Streak</span></>}
            value={
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                {currentStreak > 0 && <Flame size={14} style={{ color: "#f97316" }} />}
                {currentStreak} {currentStreak === 1 ? "day" : "days"}
              </span>
            }
            muted={panelMuted}
            divider={rowDivider}
          />
          <StatRow
            label={
              <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                <span style={{
                  width: 18, height: 18, borderRadius: "50%",
                  background: "linear-gradient(135deg,#f5c542,#e8933a)",
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  fontSize: 9, color: "white", boxShadow: "0 2px 4px rgba(232,168,56,0.3)",
                }}>✦</span>
                Coins
              </span>
            }
            value={coinBalance.toLocaleString()}
            muted={panelMuted}
            divider={rowDivider}
          />
          <StatRow
            label={
              <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                {guild?.guild?.crest ? (
                  <GuildCrest id={guild.guild.crest} size={18} color={isDark ? "#e0e7ff" : "#1a1a2e"} />
                ) : (
                  <Shield size={16} style={{ color: panelMuted }} />
                )}
                Guild
              </span>
            }
            value={
              guild?.guild ? (
                <Link
                  href="/guild"
                  onClick={() => setOpen(false)}
                  style={{ color: "#6B8FD4", fontWeight: 700, textDecoration: "none" }}
                >
                  {guild.guild.name}
                </Link>
              ) : (
                <Link
                  href="/guild"
                  onClick={() => setOpen(false)}
                  style={{ color: panelMuted, fontWeight: 600, textDecoration: "none", fontSize: "0.85rem" }}
                >
                  Join one →
                </Link>
              )
            }
            muted={panelMuted}
            divider="none"
          />

          {/* Quick actions */}
          <div style={{ marginTop: 14, display: "flex", gap: 8 }}>
            <Link
              href="/shop"
              onClick={() => setOpen(false)}
              style={{
                flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
                padding: "9px 12px", borderRadius: 10,
                background: "linear-gradient(135deg, #6B8FD4, #5a82d0)",
                color: "white", fontWeight: 700, fontSize: "0.84rem",
                textDecoration: "none",
                boxShadow: "0 4px 12px rgba(107,143,212,0.3)",
              }}
            >
              <ShoppingBag size={14} /> Shop
            </Link>
            <Link
              href={`/profile/${encodeURIComponent(writerName)}`}
              onClick={() => setOpen(false)}
              style={{
                flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center",
                padding: "9px 12px", borderRadius: 10,
                background: isDark ? "rgba(255,255,255,0.08)" : "rgba(107,143,212,0.1)",
                color: isDark ? "rgba(255,255,255,0.9)" : "#6B8FD4",
                fontWeight: 700, fontSize: "0.84rem", textDecoration: "none",
                border: isDark ? "1px solid rgba(255,255,255,0.1)" : "1px solid rgba(107,143,212,0.2)",
              }}
            >
              Profile
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

function StatRow({
  label, value, muted, divider,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  muted: string;
  divider: string;
}) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "10px 0",
      borderBottom: divider === "none" ? "none" : divider,
      gap: 12,
    }}>
      <span style={{ fontSize: "0.86rem", color: muted, fontWeight: 600 }}>
        {label}
      </span>
      <span style={{ fontSize: "0.92rem", fontWeight: 700, color: "inherit" }}>
        {value}
      </span>
    </div>
  );
}
