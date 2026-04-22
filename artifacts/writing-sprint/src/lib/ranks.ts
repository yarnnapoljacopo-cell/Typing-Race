export interface Rank {
  index: number;
  emoji: string;
  title: string;
  subtitle: string;
  minXp: number;
  borderStyle: string;
  glowColor: string;
  badgeGradient: string;
}

export const RANKS: Rank[] = [
  {
    index: 0,
    emoji: "🩸",
    title: "The Blank Page",
    subtitle: "staring into the void, yet to begin",
    minXp: 0,
    borderStyle: "border-4 border-zinc-600",
    glowColor: "rgba(161,161,170,0.3)",
    badgeGradient: "from-zinc-700 to-zinc-900",
  },
  {
    index: 1,
    emoji: "⚔️",
    title: "The Scribbler",
    subtitle: "blade freshly drawn, first words hit the page",
    minXp: 250,
    borderStyle: "border-4 border-slate-400",
    glowColor: "rgba(148,163,184,0.4)",
    badgeGradient: "from-slate-500 to-slate-700",
  },
  {
    index: 2,
    emoji: "🔥",
    title: "The Wordsmith",
    subtitle: "forging sentences like steel, getting dangerous",
    minXp: 1000,
    borderStyle: "border-4 border-orange-500",
    glowColor: "rgba(249,115,22,0.45)",
    badgeGradient: "from-orange-500 to-red-700",
  },
  {
    index: 3,
    emoji: "🌑",
    title: "The Author",
    subtitle: "dark, deliberate, every word placed with intent",
    minXp: 3500,
    borderStyle: "border-4 border-violet-500",
    glowColor: "rgba(139,92,246,0.5)",
    badgeGradient: "from-violet-600 to-purple-900",
  },
  {
    index: 4,
    emoji: "💀",
    title: "The Ink Reaper",
    subtitle: "prolific and relentless, words fall like bodies",
    minXp: 10000,
    borderStyle: "border-4 border-red-600 shadow-red-600",
    glowColor: "rgba(220,38,38,0.6)",
    badgeGradient: "from-red-700 to-rose-950",
  },
  {
    index: 5,
    emoji: "👁️",
    title: "The Grand Scribe",
    subtitle: "ancient, all-seeing, language bends to their will",
    minXp: 25000,
    borderStyle: "border-4 border-yellow-400",
    glowColor: "rgba(250,204,21,0.6)",
    badgeGradient: "from-yellow-400 via-amber-500 to-orange-600",
  },
  {
    index: 6,
    emoji: "🌌",
    title: "The Eternal Quill",
    subtitle: "beyond mortal writing, their words outlive them",
    minXp: 75000,
    borderStyle: "border-4 border-cyan-400 shadow-cyan-400",
    glowColor: "rgba(34,211,238,0.7)",
    badgeGradient: "from-cyan-400 via-blue-500 to-indigo-700",
  },
  {
    index: 7,
    emoji: "👑",
    title: "The Ranker",
    subtitle: "sovereign of the leaderboard — their name is carved into the global record",
    minXp: 200000,
    borderStyle: "border-4 border-fuchsia-400 shadow-fuchsia-400",
    glowColor: "rgba(232,121,249,0.85)",
    badgeGradient: "from-fuchsia-400 via-pink-500 to-rose-600",
  },
];

export function getRankFromXp(xp: number): Rank {
  for (let i = RANKS.length - 1; i >= 0; i--) {
    if (xp >= RANKS[i].minXp) return RANKS[i];
  }
  return RANKS[0];
}

export function getNextRank(currentRank: Rank): Rank | null {
  if (currentRank.index >= RANKS.length - 1) return null;
  return RANKS[currentRank.index + 1];
}

export function xpProgressPercent(xp: number, currentRank: Rank, nextRank: Rank | null): number {
  if (!nextRank) return 100;
  const span = nextRank.minXp - currentRank.minXp;
  const progress = xp - currentRank.minXp;
  return Math.min(100, Math.floor((progress / span) * 100));
}

export function calculateSprintXp(wordCount: number, isFirstPlace: boolean): number {
  const base = Math.max(5, Math.ceil(wordCount / 5));
  return isFirstPlace ? base * 2 : base;
}
