import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useUser, useAuth } from "@clerk/react";
import { useAuthedFetch } from "@/lib/authedFetch";
import { ArrowLeft, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

const CARD: React.CSSProperties = {
  background: "rgba(255,255,255,0.82)",
  backdropFilter: "blur(16px)",
  WebkitBackdropFilter: "blur(16px)",
  border: "1px solid rgba(255,255,255,0.9)",
  borderRadius: 18,
  boxShadow: "0 4px 24px rgba(107,143,212,0.09)",
};

interface SprintRecord {
  id: number;
  roomCode: string;
  wordCount: number;
  roomMode: string;
  wordGoal: number | null;
  updatedAt: string;
  wpm: number | null;
}
interface ItemsStats { collected: number; total: number; }

async function fetchSprintHistory(
  af: (url: string, opts?: RequestInit) => Promise<Response>,
): Promise<SprintRecord[]> {
  const res = await af(`${basePath}/api/user/sprints`);
  if (!res.ok) return [];
  return res.json();
}

async function fetchItemsStats(
  af: (url: string, opts?: RequestInit) => Promise<Response>,
): Promise<ItemsStats> {
  const res = await af(`${basePath}/api/user/items-stats`);
  if (!res.ok) return { collected: 0, total: 0 };
  return res.json();
}

const MODE_LABELS: Record<string, string> = {
  regular: "Regular", goal: "Goal", kart: "Kart Race",
  gladiator: "Gladiator", boss: "Boss Battle", death: "Death Mode",
};
const MODE_EMOJI: Record<string, string> = {
  regular: "✍️", goal: "🎯", kart: "🏎️", gladiator: "⚔️", boss: "👾", death: "💀",
};

export default function Stats() {
  const [, setLocation] = useLocation();
  const { user } = useUser();
  const { isLoaded } = useAuth();
  const af = useAuthedFetch();
  const [advancedOpen, setAdvancedOpen] = useState(true);

  const { data: sprintHistory, isLoading } = useQuery({
    queryKey: ["sprint-history"],
    queryFn: () => fetchSprintHistory(af),
    enabled: !!user && isLoaded,
    staleTime: 60_000,
  });

  const { data: itemsStats } = useQuery({
    queryKey: ["items-stats"],
    queryFn: () => fetchItemsStats(af),
    enabled: !!user && isLoaded,
    staleTime: 60_000,
  });

  const stats = useMemo(() => {
    if (!sprintHistory || sprintHistory.length === 0) return null;

    const wpmSeries = [...sprintHistory]
      .filter((s) => typeof s.wpm === "number" && s.wpm! > 0)
      .reverse()
      .map((s, i) => ({
        idx: i + 1,
        wpm: s.wpm!,
        date: new Date(s.updatedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      }));

    const avgWpm = wpmSeries.length > 0
      ? Math.round(wpmSeries.reduce((s, p) => s + p.wpm, 0) / wpmSeries.length)
      : null;

    const bestWpmSprint = wpmSeries.length > 0
      ? wpmSeries.reduce((best, p) => (p.wpm > best.wpm ? p : best), wpmSeries[0])
      : null;

    const hourBuckets = new Array<number>(24).fill(0);
    for (const s of sprintHistory) {
      const h = new Date(s.updatedAt).getHours();
      hourBuckets[h] += s.wordCount;
    }
    const peakHour = hourBuckets.reduce(
      (best, words, hour) => (words > best.words ? { hour, words } : best),
      { hour: -1, words: 0 },
    );
    const formatHour = (h: number): string => {
      if (h < 0) return "—";
      const ampm = h < 12 ? "AM" : "PM";
      const h12 = h % 12 === 0 ? 12 : h % 12;
      const next = (h + 1) % 24;
      const nextAmpm = next < 12 ? "AM" : "PM";
      const next12 = next % 12 === 0 ? 12 : next % 12;
      return `${h12}${ampm}–${next12}${nextAmpm}`;
    };

    const modeCounts: Record<string, number> = {};
    let goalTotal = 0, goalMet = 0;
    for (const s of sprintHistory) {
      const m = s.roomMode ?? "regular";
      modeCounts[m] = (modeCounts[m] ?? 0) + 1;
      if (m === "goal" && s.wordGoal != null) {
        goalTotal++;
        if (s.wordCount >= s.wordGoal) goalMet++;
      }
    }
    const sortedModes = Object.entries(modeCounts).sort((a, b) => b[1] - a[1]);
    const favMode = sortedModes[0] ? {
      key: sortedModes[0][0],
      label: MODE_LABELS[sortedModes[0][0]] ?? sortedModes[0][0],
      emoji: MODE_EMOJI[sortedModes[0][0]] ?? "✍️",
      count: sortedModes[0][1],
      pct: Math.round((sortedModes[0][1] / sprintHistory.length) * 100),
    } : null;

    const totalWords = sprintHistory.reduce((s, x) => s + x.wordCount, 0);
    const avgWords = Math.round(totalWords / sprintHistory.length);

    return {
      wpmSeries, avgWpm, bestWpmSprint,
      peakHour: peakHour.hour >= 0 ? { ...peakHour, label: formatHour(peakHour.hour) } : null,
      favMode, sortedModes, totalTracked: sprintHistory.length,
      goalTotal, goalMet, avgWords,
    };
  }, [sprintHistory]);

  if (!isLoaded) return null;
  if (!user) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "#7a7a92" }}>
        Please sign in to view your statistics.
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
            Statistics
          </h1>
          <p style={{ textAlign: "center", color: "#7a7a92", fontSize: "0.9rem", marginBottom: 28 }}>
            Your writing performance, broken down.
          </p>

          {isLoading && (
            <div style={{ ...CARD, padding: 40, textAlign: "center", color: "#7a7a92" }}>
              <Loader2 size={20} style={{ display: "inline", marginRight: 8, animation: "spin 1s linear infinite" }} />
              Loading…
            </div>
          )}

          {!isLoading && (!sprintHistory || sprintHistory.length === 0) && (
            <div style={{ ...CARD, padding: 40, textAlign: "center", color: "#7a7a92" }}>
              No sprints recorded yet. Finish your first sprint to start collecting analytics.
            </div>
          )}

          {stats && (
            <>
              {/* WPM chart */}
              <div style={{ ...CARD, padding: "16px 14px 8px", marginBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 10 }}>
                  <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "#1a1a2e" }}>WPM Over Time</div>
                  {stats.avgWpm != null && (
                    <div style={{ fontSize: "0.75rem", color: "#7a7a92" }}>
                      Avg <strong style={{ color: "#6B8FD4" }}>{stats.avgWpm}</strong> wpm
                    </div>
                  )}
                </div>
                {stats.wpmSeries.length >= 2 ? (
                  <div style={{ width: "100%", height: 200 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={stats.wpmSeries} margin={{ top: 6, right: 8, left: -16, bottom: 0 }}>
                        <CartesianGrid stroke="rgba(107,143,212,0.12)" strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#7a7a92" }} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={28} />
                        <YAxis tick={{ fontSize: 10, fill: "#7a7a92" }} axisLine={false} tickLine={false} width={32} />
                        <Tooltip
                          contentStyle={{ background: "rgba(255,255,255,0.96)", border: "1px solid rgba(107,143,212,0.2)", borderRadius: 10, fontSize: "0.78rem" }}
                          labelStyle={{ color: "#7a7a92", fontWeight: 600 }}
                          formatter={(v: number) => [`${v} wpm`, "Speed"]}
                        />
                        <Line type="monotone" dataKey="wpm" stroke="#6B8FD4" strokeWidth={2.2} dot={{ r: 2.5, fill: "#6B8FD4" }} activeDot={{ r: 4 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div style={{ padding: "20px 0", textAlign: "center", color: "#7a7a92", fontSize: "0.82rem" }}>
                    Finish a couple more sprints to see your typing speed trend.
                  </div>
                )}
              </div>

              {/* 4-tile grid */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10, marginBottom: 12 }}>
                <div style={{ ...CARD, padding: "14px 12px", textAlign: "center" }}>
                  <div style={{ fontSize: "1.2rem", marginBottom: 4 }}>⚡</div>
                  <div style={{ fontFamily: "'Playfair Display', serif", fontSize: "1.6rem", fontWeight: 700, color: "#1a1a2e" }}>
                    {stats.bestWpmSprint ? stats.bestWpmSprint.wpm : "–"}
                  </div>
                  <div style={{ fontSize: "0.66rem", fontWeight: 700, letterSpacing: "0.08em", color: "#7a7a92", textTransform: "uppercase", marginTop: 4 }}>Best WPM</div>
                </div>

                <div style={{ ...CARD, padding: "14px 12px", textAlign: "center" }}>
                  <div style={{ fontSize: "1.2rem", marginBottom: 4 }}>🕒</div>
                  <div style={{ fontFamily: "'Playfair Display', serif", fontSize: "1.2rem", fontWeight: 700, color: "#1a1a2e", lineHeight: 1.1 }}>
                    {stats.peakHour ? stats.peakHour.label : "–"}
                  </div>
                  <div style={{ fontSize: "0.66rem", fontWeight: 700, letterSpacing: "0.08em", color: "#7a7a92", textTransform: "uppercase", marginTop: 4 }}>Most Productive</div>
                </div>

                <div style={{ ...CARD, padding: "14px 12px", textAlign: "center" }}>
                  <div style={{ fontSize: "1.2rem", marginBottom: 4 }}>{stats.favMode?.emoji ?? "🎮"}</div>
                  <div style={{ fontFamily: "'Playfair Display', serif", fontSize: "1.2rem", fontWeight: 700, color: "#1a1a2e", lineHeight: 1.1 }}>
                    {stats.favMode ? stats.favMode.label : "–"}
                  </div>
                  <div style={{ fontSize: "0.66rem", fontWeight: 700, letterSpacing: "0.08em", color: "#7a7a92", textTransform: "uppercase", marginTop: 4 }}>
                    Favourite Mode{stats.favMode ? ` · ${stats.favMode.pct}%` : ""}
                  </div>
                </div>

                <div style={{ ...CARD, padding: "14px 12px", textAlign: "center" }}>
                  <div style={{ fontSize: "1.2rem", marginBottom: 4 }}>🎒</div>
                  <div style={{ fontFamily: "'Playfair Display', serif", fontSize: "1.6rem", fontWeight: 700, color: "#1a1a2e" }}>
                    {itemsStats ? `${itemsStats.collected}/${itemsStats.total}` : "–"}
                  </div>
                  <div style={{ fontSize: "0.66rem", fontWeight: 700, letterSpacing: "0.08em", color: "#7a7a92", textTransform: "uppercase", marginTop: 4 }}>Items in Bag</div>
                  {itemsStats && itemsStats.total > 0 && (
                    <div style={{ height: 4, background: "rgba(107,143,212,0.12)", borderRadius: 99, overflow: "hidden", marginTop: 6 }}>
                      <div style={{ height: "100%", width: `${Math.min(100, Math.round((itemsStats.collected / itemsStats.total) * 100))}%`, background: "#6B8FD4", borderRadius: 99 }} />
                    </div>
                  )}
                </div>
              </div>

              {/* Advanced */}
              <div style={{ ...CARD, marginBottom: 20, overflow: "hidden" }}>
                <button
                  onClick={() => setAdvancedOpen(v => !v)}
                  style={{
                    width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "14px 18px", background: "none", border: "none", cursor: "pointer",
                    color: "#7a7a92", fontFamily: "'DM Sans', sans-serif",
                  }}
                >
                  <span style={{ fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>
                    Advanced Stats
                  </span>
                  {advancedOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                </button>

                {advancedOpen && (
                  <div style={{ padding: "4px 18px 16px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderTop: "1px solid rgba(107,143,212,0.1)", fontSize: "0.85rem" }}>
                      <span style={{ color: "#7a7a92" }}>Avg words / sprint</span>
                      <span style={{ fontWeight: 700, color: "#1a1a2e" }}>{stats.avgWords.toLocaleString()}</span>
                    </div>

                    <div style={{ marginTop: 8, paddingTop: 10, borderTop: "1px solid rgba(107,143,212,0.1)" }}>
                      <div style={{ color: "#7a7a92", fontSize: "0.85rem", marginBottom: 8 }}>Mode breakdown</div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        {stats.sortedModes.map(([mode, count]) => {
                          const pct = Math.round((count / stats.totalTracked) * 100);
                          return (
                            <div key={mode} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <span style={{ width: 22, textAlign: "center" }}>{MODE_EMOJI[mode] ?? "✍️"}</span>
                              <span style={{ flex: 1, color: "#1a1a2e", fontSize: "0.82rem" }}>{MODE_LABELS[mode] ?? mode}</span>
                              <div style={{ width: 100, height: 5, borderRadius: 99, background: "rgba(107,143,212,0.12)", overflow: "hidden" }}>
                                <div style={{ height: "100%", width: `${pct}%`, background: "#6B8FD4" }} />
                              </div>
                              <span style={{ fontSize: "0.75rem", color: "#7a7a92", minWidth: 56, textAlign: "right" }}>
                                {count} <span style={{ opacity: 0.6 }}>({pct}%)</span>
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {stats.goalTotal > 0 && (
                      <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0 0", marginTop: 10, borderTop: "1px solid rgba(107,143,212,0.1)", fontSize: "0.85rem" }}>
                        <span style={{ color: "#7a7a92" }}>Goal completion</span>
                        <span style={{ fontWeight: 700, color: stats.goalMet / stats.goalTotal >= 0.5 ? "#16a34a" : "#dc2626" }}>
                          {stats.goalMet}/{stats.goalTotal}{" "}
                          <span style={{ fontWeight: 400, color: "#7a7a92", fontSize: "0.78rem" }}>
                            ({Math.round((stats.goalMet / stats.goalTotal) * 100)}%)
                          </span>
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
