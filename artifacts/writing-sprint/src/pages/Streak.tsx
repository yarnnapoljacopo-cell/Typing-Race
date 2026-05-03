import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useUser, useAuth } from "@clerk/react";
import { useAuthedFetch } from "@/lib/authedFetch";
import { ArrowLeft, ChevronLeft, ChevronRight, Flame, Trophy, CalendarDays, Loader2 } from "lucide-react";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

const CARD: React.CSSProperties = {
  background: "rgba(255,255,255,0.82)",
  backdropFilter: "blur(16px)",
  WebkitBackdropFilter: "blur(16px)",
  border: "1px solid rgba(255,255,255,0.9)",
  borderRadius: 18,
  boxShadow: "0 4px 24px rgba(107,143,212,0.09)",
};

interface DayEntry { day: string; wordsWritten: number; sprintsCompleted: number; }
interface StreakResponse {
  month: string;
  currentStreak: number;
  longestStreak: number;
  lastStreakDay: string | null;
  days: DayEntry[];
}

async function fetchStreak(
  af: (url: string, opts?: RequestInit) => Promise<Response>,
  month: string,
): Promise<StreakResponse> {
  const res = await af(`${basePath}/api/user/streak?month=${month}`);
  if (!res.ok) throw new Error("Failed to load streak");
  return res.json();
}

function pad(n: number): string { return String(n).padStart(2, "0"); }
function monthKey(d: Date): string { return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`; }
function todayKey(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

function intensityColor(words: number): { bg: string; border: string; text: string } {
  if (words <= 0)    return { bg: "rgba(107,143,212,0.06)", border: "rgba(107,143,212,0.12)", text: "#9ca3af" };
  if (words < 200)   return { bg: "rgba(107,143,212,0.18)", border: "rgba(107,143,212,0.35)", text: "#1a1a2e" };
  if (words < 600)   return { bg: "rgba(107,143,212,0.42)", border: "rgba(107,143,212,0.6)",  text: "#fff" };
  if (words < 1500)  return { bg: "rgba(85,108,194,0.78)",  border: "rgba(85,108,194,0.9)",   text: "#fff" };
  return                     { bg: "linear-gradient(135deg,#6B4FD4,#e879a0)", border: "#e879a0", text: "#fff" };
}

const WEEK_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function Streak() {
  const [, setLocation] = useLocation();
  const { user } = useUser();
  const { isLoaded } = useAuth();
  const af = useAuthedFetch();

  const [viewMonth, setViewMonth] = useState(() => {
    const d = new Date();
    return monthKey(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)));
  });

  const { data, isLoading } = useQuery({
    queryKey: ["streak", viewMonth],
    queryFn: () => fetchStreak(af, viewMonth),
    enabled: !!user && isLoaded,
    staleTime: 30_000,
  });

  const dayMap = useMemo(() => {
    const m = new Map<string, DayEntry>();
    (data?.days ?? []).forEach((d) => m.set(d.day, d));
    return m;
  }, [data]);

  const grid = useMemo(() => {
    const [y, mo] = viewMonth.split("-").map(Number);
    const first = new Date(Date.UTC(y, mo - 1, 1));
    const daysInMonth = new Date(Date.UTC(y, mo, 0)).getUTCDate();
    // Mon = 0 ... Sun = 6
    const startWeekday = (first.getUTCDay() + 6) % 7;
    const cells: (string | null)[] = [];
    for (let i = 0; i < startWeekday; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push(`${y}-${pad(mo)}-${pad(d)}`);
    }
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [viewMonth]);

  const monthLabel = useMemo(() => {
    const [y, mo] = viewMonth.split("-").map(Number);
    // Format in UTC so the label matches the day_key buckets used by the
    // backend — otherwise users west of UTC see the previous month's name.
    return new Intl.DateTimeFormat(undefined, {
      month: "long", year: "numeric", timeZone: "UTC",
    }).format(new Date(Date.UTC(y, mo - 1, 1)));
  }, [viewMonth]);

  const stepMonth = (delta: number) => {
    const [y, mo] = viewMonth.split("-").map(Number);
    const nd = new Date(Date.UTC(y, mo - 1 + delta, 1));
    setViewMonth(monthKey(nd));
  };

  const today = todayKey();
  const daysWrittenThisMonth = (data?.days ?? []).filter(d => d.wordsWritten > 0).length;

  if (!isLoaded) return null;
  if (!user) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "#7a7a92" }}>
        Please sign in to view your streak.
      </div>
    );
  }

  return (
    <>
      <div style={{ position: "fixed", inset: 0, zIndex: 0, background: "var(--bg-solid)" }} />
      <div style={{
        position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none",
        backgroundImage: "linear-gradient(var(--bg-grid-color) 1px, transparent 1px), linear-gradient(90deg, var(--bg-grid-color) 1px, transparent 1px)",
        backgroundSize: "48px 48px",
      }} />
      <div style={{ position: "fixed", width: 500, height: 500, borderRadius: "50%", background: "var(--bg-orb1)", filter: "blur(90px)", top: -120, right: -100, pointerEvents: "none", zIndex: 0 }} />
      <div style={{ position: "fixed", width: 350, height: 350, borderRadius: "50%", background: "var(--bg-orb2)", filter: "blur(90px)", bottom: 0, left: -80, pointerEvents: "none", zIndex: 0 }} />

      <div style={{ position: "relative", zIndex: 1, minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 40, paddingBottom: 60, paddingLeft: 20, paddingRight: 20 }}>
        <div style={{ width: "100%", maxWidth: 560 }}>
          <button
            onClick={() => setLocation("/portal")}
            style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", color: "#7a7a92", fontSize: "0.85rem", fontWeight: 500, marginBottom: 24 }}
          >
            <ArrowLeft size={15} /> Back
          </button>

          <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: "2.2rem", fontWeight: 900, color: "#1a1a2e", textAlign: "center", marginBottom: 6 }}>
            Writing Streak
          </h1>
          <p style={{ textAlign: "center", color: "#7a7a92", fontSize: "0.9rem", marginBottom: 28 }}>
            Show up every day. Watch the calendar fill in.
          </p>

          {/* Stats row */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 18 }}>
            <div style={{ ...CARD, padding: "16px 10px", textAlign: "center" }}>
              <Flame size={20} style={{ color: "#f97316", marginBottom: 4 }} />
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: "1.7rem", fontWeight: 700, color: "#1a1a2e" }}>
                {data?.currentStreak ?? 0}
              </div>
              <div style={{ fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.08em", color: "#7a7a92", textTransform: "uppercase", marginTop: 4 }}>
                Current
              </div>
            </div>
            <div style={{ ...CARD, padding: "16px 10px", textAlign: "center" }}>
              <Trophy size={20} style={{ color: "#facc15", marginBottom: 4 }} />
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: "1.7rem", fontWeight: 700, color: "#1a1a2e" }}>
                {data?.longestStreak ?? 0}
              </div>
              <div style={{ fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.08em", color: "#7a7a92", textTransform: "uppercase", marginTop: 4 }}>
                Longest
              </div>
            </div>
            <div style={{ ...CARD, padding: "16px 10px", textAlign: "center" }}>
              <CalendarDays size={20} style={{ color: "#6B8FD4", marginBottom: 4 }} />
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: "1.7rem", fontWeight: 700, color: "#1a1a2e" }}>
                {daysWrittenThisMonth}
              </div>
              <div style={{ fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.08em", color: "#7a7a92", textTransform: "uppercase", marginTop: 4 }}>
                This Month
              </div>
            </div>
          </div>

          {/* Calendar */}
          <div style={{ ...CARD, padding: 18 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <button
                onClick={() => stepMonth(-1)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#7a7a92", padding: 4 }}
                aria-label="Previous month"
              >
                <ChevronLeft size={18} />
              </button>
              <div style={{ fontWeight: 700, fontSize: "1rem", color: "#1a1a2e" }}>
                {monthLabel}
                {isLoading && <Loader2 size={12} style={{ display: "inline", marginLeft: 8, animation: "spin 1s linear infinite", color: "#7a7a92" }} />}
              </div>
              <button
                onClick={() => stepMonth(1)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#7a7a92", padding: 4 }}
                aria-label="Next month"
              >
                <ChevronRight size={18} />
              </button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 5, marginBottom: 4 }}>
              {WEEK_LABELS.map((w) => (
                <div key={w} style={{ textAlign: "center", fontSize: "0.65rem", fontWeight: 700, color: "#9ca3af", letterSpacing: "0.05em", textTransform: "uppercase", padding: "4px 0" }}>
                  {w}
                </div>
              ))}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 5 }}>
              {grid.map((dayKey, i) => {
                if (!dayKey) return <div key={`pad-${i}`} />;
                const entry = dayMap.get(dayKey);
                const words = entry?.wordsWritten ?? 0;
                const c = intensityColor(words);
                const isToday = dayKey === today;
                const dayNum = Number(dayKey.slice(-2));
                return (
                  <div
                    key={dayKey}
                    title={
                      words > 0
                        ? `${dayKey} — ${words.toLocaleString()} words across ${entry?.sprintsCompleted ?? 0} sprint${entry?.sprintsCompleted === 1 ? "" : "s"}`
                        : `${dayKey} — no writing`
                    }
                    style={{
                      aspectRatio: "1",
                      borderRadius: 8,
                      background: c.bg,
                      border: `1.5px solid ${isToday ? "#1a1a2e" : c.border}`,
                      color: c.text,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "0.78rem",
                      fontWeight: 600,
                      position: "relative",
                      transition: "transform 0.15s",
                      cursor: "default",
                    }}
                  >
                    <span>{dayNum}</span>
                    {words > 0 && (
                      <span style={{ fontSize: "0.58rem", opacity: 0.85, marginTop: 1 }}>
                        {words >= 1000 ? `${(words / 1000).toFixed(1)}k` : words}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Legend */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 16, fontSize: "0.7rem", color: "#7a7a92" }}>
              <span>Less</span>
              {[0, 100, 400, 1000, 2000].map((w, i) => {
                const c = intensityColor(w);
                return (
                  <span key={i} style={{ width: 14, height: 14, borderRadius: 4, background: c.bg, border: `1px solid ${c.border}` }} />
                );
              })}
              <span>More</span>
            </div>
          </div>

          <p style={{ textAlign: "center", color: "#9ca3af", fontSize: "0.78rem", marginTop: 14 }}>
            A day counts when you complete a sprint. Streaks reset after one missed day.
          </p>
        </div>
      </div>
    </>
  );
}
