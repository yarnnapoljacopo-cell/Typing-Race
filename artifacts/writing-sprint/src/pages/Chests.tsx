import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@clerk/react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthedFetch } from "@/lib/authedFetch";
import { ArrowLeft, Package, Gift, FlaskConical, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ChestIcon } from "@/components/ChestIcon";
import { ChestOpenAnimation } from "@/components/ChestOpenAnimation";
import { ItemIcon } from "@/components/ItemIcon";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

interface ChestItem {
  id: number;
  name: string;
  rarity: string;
  icon: string;
  category: string;
}

interface OpenResult {
  items: ChestItem[];
  coins_awarded: number;
  new_coin_balance: number | null;
}

interface Chests {
  mortal: number;
  iron: number;
  crystal: number;
  inferno: number;
  immortal: number;
}

interface ChestStyle {
  card: string;
  badge: string;
  badgeText: string;
  glow: string;
  iconRing: string;
  openBtn: string;
  stars: number;
  label: string;
  description: string;
  dropTable: string;
}

const CHEST_STYLES: Record<string, ChestStyle> = {
  mortal: {
    card: "bg-gradient-to-br from-stone-50 to-zinc-100 dark:from-zinc-800/60 dark:to-zinc-900/80 border-zinc-200 dark:border-zinc-700",
    badge: "bg-zinc-200/80 dark:bg-zinc-700/80 text-zinc-600 dark:text-zinc-300",
    badgeText: "Common",
    glow: "",
    iconRing: "bg-zinc-200/70 dark:bg-zinc-700/60",
    openBtn: "bg-zinc-600 hover:bg-zinc-700 text-white dark:bg-zinc-500 dark:hover:bg-zinc-400",
    stars: 1,
    label: "Mortal Chest",
    description: "Earned every sprint. Contains Common–Epic items. Tiny legendary chance.",
    dropTable: "55% Common · 30% Uncommon · 10% Rare · 5% Epic · 0.05% Legendary",
  },
  iron: {
    card: "bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800/60 dark:to-slate-900/80 border-slate-300 dark:border-slate-600",
    badge: "bg-slate-200/80 dark:bg-slate-700/80 text-slate-600 dark:text-slate-300",
    badgeText: "Uncommon",
    glow: "",
    iconRing: "bg-slate-200/70 dark:bg-slate-700/60",
    openBtn: "bg-slate-500 hover:bg-slate-600 text-white",
    stars: 2,
    label: "Iron Chest",
    description: "Awarded for winning a sprint. Contains Uncommon–Mythic items. Rare legendary chance.",
    dropTable: "10% Uncommon · 50% Rare · 30% Epic · 10% Mythic · 0.3% Legendary",
  },
  crystal: {
    card: "bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/30 dark:to-cyan-900/30 border-blue-300 dark:border-blue-600",
    badge: "bg-blue-100 dark:bg-blue-800/60 text-blue-700 dark:text-blue-300",
    badgeText: "Rare",
    glow: "shadow-blue-200/60 dark:shadow-blue-900/40",
    iconRing: "bg-blue-100/80 dark:bg-blue-800/50",
    openBtn: "bg-blue-600 hover:bg-blue-700 text-white",
    stars: 3,
    label: "Crystal Chest",
    description: "Rare reward. Contains Rare–Legendary items and Artifacts.",
    dropTable: "20% Rare · 45% Epic · 30% Mythic · 5% Legendary",
  },
  inferno: {
    card: "bg-gradient-to-br from-orange-50 to-red-50 dark:from-orange-900/30 dark:to-red-900/30 border-orange-400 dark:border-orange-600",
    badge: "bg-orange-100 dark:bg-orange-800/60 text-orange-700 dark:text-orange-300",
    badgeText: "Epic",
    glow: "shadow-orange-200/70 dark:shadow-orange-900/50",
    iconRing: "bg-orange-100/80 dark:bg-orange-800/50",
    openBtn: "bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white",
    stars: 4,
    label: "Inferno Chest",
    description: "Prestigious chest. Contains Epic–Legendary items and high-tier Recipes.",
    dropTable: "10% Epic · 55% Mythic · 35% Legendary",
  },
  immortal: {
    card: "bg-gradient-to-br from-yellow-50 via-amber-50 to-yellow-100 dark:from-yellow-900/30 dark:via-amber-900/30 dark:to-yellow-900/30 border-yellow-400 dark:border-yellow-600",
    badge: "bg-yellow-100 dark:bg-yellow-800/60 text-yellow-800 dark:text-yellow-300",
    badgeText: "Mythic",
    glow: "shadow-yellow-300/60 dark:shadow-yellow-900/50",
    iconRing: "bg-yellow-100/80 dark:bg-yellow-800/50",
    openBtn: "bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-600 hover:to-amber-600 text-white font-bold",
    stars: 5,
    label: "Immortal Chest",
    description: "Supreme chest. Guaranteed 2 items. 40% legendary per roll.",
    dropTable: "60% Mythic · 40% Legendary",
  },
};

const BONUS_CHANCES: Record<string, [number, number]> = {
  mortal:   [0.15, 0],
  iron:     [0.25, 0.05],
  crystal:  [0.40, 0.12],
  inferno:  [0.55, 0.22],
  immortal: [1.0, 0.45],
};

/**
 * Cinematic per-rarity palette for the reveal animation. Tuned to look
 * vibrant over both light and dark dialog backgrounds — the gradient stops
 * include alpha so the underlying surface still shows through.
 */
interface RarityCinematic {
  hex: string;         // canonical accent
  glow: string;        // rgba glow color
  rayStops: string;    // two colors for the rotating-rays conic gradient
  gradient: string;    // background gradient for the card
  border: string;      // border color
  particles: number;   // floating sparkle count
  raysOpacity: number; // 0..1 — visibility of the ray fan
}
const RARITY_CINEMATIC: Record<string, RarityCinematic> = {
  common: {
    hex: "#9ca3af", glow: "rgba(156,163,175,0.55)",
    rayStops: "rgba(156,163,175,0.55) 0deg, transparent 18deg",
    gradient: "linear-gradient(160deg, rgba(156,163,175,0.22) 0%, rgba(75,85,99,0.45) 100%)",
    border: "rgba(156,163,175,0.7)", particles: 8, raysOpacity: 0.45,
  },
  uncommon: {
    hex: "#22c55e", glow: "rgba(34,197,94,0.65)",
    rayStops: "rgba(34,197,94,0.65) 0deg, transparent 16deg",
    gradient: "linear-gradient(160deg, rgba(34,197,94,0.28) 0%, rgba(21,80,55,0.5) 100%)",
    border: "rgba(34,197,94,0.7)", particles: 12, raysOpacity: 0.6,
  },
  rare: {
    hex: "#3b82f6", glow: "rgba(59,130,246,0.75)",
    rayStops: "rgba(96,165,250,0.7) 0deg, transparent 14deg",
    gradient: "linear-gradient(160deg, rgba(59,130,246,0.3) 0%, rgba(29,40,90,0.55) 100%)",
    border: "rgba(96,165,250,0.75)", particles: 16, raysOpacity: 0.75,
  },
  epic: {
    hex: "#a855f7", glow: "rgba(168,85,247,0.82)",
    rayStops: "rgba(192,132,252,0.78) 0deg, transparent 12deg",
    gradient: "linear-gradient(160deg, rgba(168,85,247,0.32) 0%, rgba(60,25,100,0.6) 100%)",
    border: "rgba(192,132,252,0.8)", particles: 20, raysOpacity: 0.85,
  },
  mythic: {
    hex: "#f43f5e", glow: "rgba(244,63,94,0.85)",
    rayStops: "rgba(251,113,133,0.85) 0deg, transparent 10deg",
    gradient: "linear-gradient(160deg, rgba(244,63,94,0.34) 0%, rgba(90,15,40,0.65) 100%)",
    border: "rgba(251,113,133,0.85)", particles: 24, raysOpacity: 0.95,
  },
  legendary: {
    hex: "#f59e0b", glow: "rgba(251,191,36,0.95)",
    rayStops: "rgba(253,224,71,0.9) 0deg, transparent 8deg",
    gradient: "linear-gradient(160deg, rgba(251,191,36,0.42) 0%, rgba(100,55,5,0.7) 100%)",
    border: "rgba(251,191,36,0.95)", particles: 30, raysOpacity: 1,
  },
};

/**
 * Smoothly counts from 0 to `target` using rAF + easeOutCubic. The coins
 * reward chip uses this so the number "rolls up" instead of pop-snapping.
 */
function useCountUp(target: number, durationMs = 900, delayMs = 0): number {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (target <= 0) { setValue(0); return; }
    let raf = 0;
    let startedAt: number | null = null;
    const ease = (t: number) => 1 - Math.pow(1 - t, 3);
    const timeout = setTimeout(() => {
      const step = (ts: number) => {
        if (startedAt == null) startedAt = ts;
        const t = Math.min(1, (ts - startedAt) / durationMs);
        setValue(Math.round(target * ease(t)));
        if (t < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    }, delayMs);
    return () => { clearTimeout(timeout); cancelAnimationFrame(raf); };
  }, [target, durationMs, delayMs]);
  return value;
}

/**
 * Single visual avatar for an item — uses the bag's custom SVG (ItemIcon) when
 * we have one for this name, otherwise falls back to the server-supplied
 * emoji. Keeps the chest-reveal and bag visuals in lock-step.
 */
function ItemAvatar({ name, fallbackEmoji, size }: { name: string; fallbackEmoji: string; size: number }) {
  // ItemIcon returns null when the name isn't in its ICONS map. We probe
  // by attempting to render and checking for `null` via React.isValidElement
  // would be expensive — simpler: always render ItemIcon, and parallel-render
  // the emoji absolutely positioned behind it as a guaranteed fallback so a
  // missing icon never shows nothing.
  const iconNode = <ItemIcon name={name} size={size} />;
  // ItemIcon returns `null` when name has no entry, in which case React just
  // renders nothing and the emoji shows through.
  return (
    <span
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <span
        aria-hidden
        className="absolute inset-0 flex items-center justify-center select-none"
        style={{ fontSize: Math.round(size * 0.85), lineHeight: 1 }}
      >
        {fallbackEmoji}
      </span>
      <span className="relative inline-flex items-center justify-center">
        {iconNode}
      </span>
    </span>
  );
}

/**
 * Coin reward chip — the gold pill below the item with the rolling number
 * counter, flipping coin, and a glow ring.
 */
function CoinRewardChip({ awarded, total }: { awarded: number; total: number | null }) {
  const display = useCountUp(awarded, 950, 700);
  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.85 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: 0.55, type: "spring", stiffness: 320, damping: 18 }}
      className="mt-3 mx-auto flex items-center justify-center gap-2.5 py-2 px-4 rounded-full"
      style={{
        background: "linear-gradient(95deg, rgba(251,191,36,0.18) 0%, rgba(212,168,32,0.1) 100%)",
        border: "1px solid rgba(251,191,36,0.55)",
        boxShadow: "0 0 20px rgba(251,191,36,0.22), inset 0 0 14px rgba(251,191,36,0.06)",
      }}
    >
      <motion.span
        className="text-xl inline-block"
        animate={{ rotateY: [0, 720], scale: [1, 1.18, 1] }}
        transition={{ duration: 1.3, times: [0, 0.7, 1], delay: 0.6, ease: "easeOut" }}
      >🪙</motion.span>
      <span className="font-bold text-sm" style={{ color: "#f59e0b", fontVariantNumeric: "tabular-nums" }}>
        +{display.toLocaleString()} Spirit Coins
      </span>
      {total !== null && (
        <span className="text-[11px] ml-0.5" style={{ color: "rgba(180,120,20,0.7)", fontVariantNumeric: "tabular-nums" }}>
          ({total.toLocaleString()} total)
        </span>
      )}
    </motion.div>
  );
}

/**
 * One reward card, fully cinematic:
 *   - Per-rarity gradient surface + ray fan + halo + sparkles
 *   - Item icon (emoji from item.icon) springs in oversized, then floats
 *   - Rarity badge pulses (epic+) with a shimmer sweep
 *   - Staggered entrance so multi-item rewards reveal in sequence
 */
function CinematicRewardCard({
  item, index, single,
}: {
  item: ChestItem;
  index: number;
  single: boolean;
}) {
  const rs = RARITY_CINEMATIC[item.rarity] ?? RARITY_CINEMATIC.common;
  const baseDelay = 0.18 + index * 0.12;
  const isHighTier = item.rarity === "epic" || item.rarity === "mythic" || item.rarity === "legendary";

  // Pre-roll sparkle trajectories once per mount so each card has its own
  // unique constellation of drifting particles.
  const sparkles = useRef<Array<{ dx: number; dy: number; delay: number; size: number }>>(
    Array.from({ length: rs.particles }).map(() => {
      const angle = Math.random() * Math.PI * 2;
      const dist = 60 + Math.random() * 90;
      return {
        dx: Math.cos(angle) * dist,
        dy: Math.sin(angle) * dist,
        delay: Math.random() * 0.9,
        size: 3 + Math.random() * 5,
      };
    }),
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 24, scale: 0.85 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: baseDelay, type: "spring", stiffness: 240, damping: 22 }}
      className={`relative overflow-hidden rounded-2xl ${single ? "w-full" : "flex-1 min-w-[160px]"}`}
      style={{
        background: rs.gradient,
        border: `1.5px solid ${rs.border}`,
        boxShadow: `0 0 36px ${rs.glow}, inset 0 0 28px ${rs.hex}22, 0 8px 22px rgba(0,0,0,0.18)`,
      }}
    >
      {/* Rotating ray fan */}
      <div aria-hidden className="absolute inset-0 pointer-events-none" style={{ opacity: rs.raysOpacity }}>
        <div
          className="absolute left-1/2 top-1/2"
          style={{
            width: 380, height: 380,
            transform: "translate(-50%, -50%)",
            background: `repeating-conic-gradient(${rs.rayStops}, transparent 30deg)`,
            animation: "chestRaysSpin 14s linear infinite",
            mixBlendMode: "screen",
            filter: "blur(0.5px)",
            opacity: 0.9,
          }}
        />
      </div>

      {/* Radial halo behind the icon */}
      <div
        aria-hidden
        className="absolute left-1/2 pointer-events-none"
        style={{
          top: "44%",
          width: 200, height: 200,
          transform: "translate(-50%, -50%)",
          background: `radial-gradient(circle, ${rs.hex}66 0%, ${rs.hex}22 38%, transparent 72%)`,
          animation: "chestHaloPulse 2.4s ease-in-out infinite",
          filter: "blur(2px)",
        }}
      />

      {/* Drifting sparkle particles */}
      {sparkles.current.map((s, i) => (
        <span
          key={i}
          aria-hidden
          className="absolute left-1/2 rounded-full pointer-events-none"
          style={{
            top: "44%",
            width: s.size, height: s.size,
            background: rs.hex,
            boxShadow: `0 0 ${s.size * 1.8}px ${rs.hex}, 0 0 ${s.size * 0.9}px #fff`,
            ['--dx' as string]: `${s.dx}px`,
            ['--dy' as string]: `${s.dy}px`,
            animation: `chestSparkleFlt 1.8s ease-out ${baseDelay + s.delay}s both`,
            transform: "translate(-50%, -50%)",
          }}
        />
      ))}

      {/* Content */}
      <div className="relative flex flex-col items-center gap-3 py-8 px-5 z-10">
        {/* Big bouncing item icon */}
        <motion.div
          initial={{ scale: 0.15, rotate: -28, opacity: 0 }}
          animate={{ scale: [0.15, 1.25, 1], rotate: [-28, 8, 0], opacity: 1 }}
          transition={{ delay: baseDelay + 0.18, duration: 0.75, times: [0, 0.6, 1], ease: "easeOut" }}
          className="relative"
          style={{ filter: `drop-shadow(0 8px 22px ${rs.glow})` }}
        >
          <motion.div
            animate={isHighTier
              ? { y: [0, -4, 0], rotate: [0, 3, -3, 0] }
              : { y: [0, -3, 0] }
            }
            transition={{
              delay: baseDelay + 0.95,
              duration: isHighTier ? 2.4 : 2.6,
              ease: "easeInOut",
              repeat: Infinity,
            }}
            className="inline-flex items-center justify-center select-none"
            style={{ filter: `drop-shadow(0 0 18px ${rs.glow})` }}
          >
            {/* Render the canonical bag SVG when we have a custom illustration
                for this item; fall back to the server-supplied emoji otherwise
                so we never end up with a blank tile for newer items. */}
            <ItemAvatar name={item.name} fallbackEmoji={item.icon} size={104} />
          </motion.div>

          {/* Shimmer sweep across the icon (epic+) */}
          {isHighTier && (
            <motion.span
              aria-hidden
              initial={{ x: "-150%", opacity: 0 }}
              animate={{ x: ["-150%", "200%"], opacity: [0, 0.85, 0] }}
              transition={{ delay: baseDelay + 1.0, duration: 1.4, ease: "easeOut", repeat: Infinity, repeatDelay: 2.4 }}
              className="absolute inset-0 pointer-events-none"
              style={{
                background: "linear-gradient(120deg, transparent 0%, rgba(255,255,255,0.55) 50%, transparent 100%)",
                mixBlendMode: "screen",
                width: "60%",
              }}
            />
          )}
        </motion.div>

        {/* Name */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: baseDelay + 0.45, duration: 0.35 }}
          className="text-xl font-black leading-tight text-center"
          style={{
            color: "#fff",
            textShadow: `0 1px 4px rgba(0,0,0,0.6), 0 0 18px ${rs.hex}80`,
            letterSpacing: "-0.005em",
          }}
        >
          {item.name}
        </motion.div>

        {/* Rarity badge with glow pulse + shimmer */}
        <motion.div
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: baseDelay + 0.6, type: "spring", stiffness: 380, damping: 18 }}
        >
          <motion.span
            className="relative inline-flex items-center gap-1 text-[10.5px] font-black uppercase tracking-[0.18em] px-3 py-1.5 rounded-full overflow-hidden"
            style={{
              color: "#fff",
              background: `linear-gradient(90deg, ${rs.hex} 0%, ${rs.hex}cc 100%)`,
              border: `1px solid ${rs.hex}`,
              boxShadow: `0 0 16px ${rs.glow}, inset 0 1px 0 rgba(255,255,255,0.25)`,
            }}
            animate={isHighTier
              ? { boxShadow: [`0 0 16px ${rs.glow}`, `0 0 32px ${rs.glow}`, `0 0 16px ${rs.glow}`] }
              : undefined
            }
            transition={isHighTier ? { duration: 1.6, repeat: Infinity, ease: "easeInOut" } : undefined}
          >
            <motion.span
              aria-hidden
              initial={{ x: "-130%" }}
              animate={{ x: ["-130%", "230%"] }}
              transition={{ delay: baseDelay + 1.1, duration: 1.5, ease: "easeOut", repeat: Infinity, repeatDelay: 2.2 }}
              className="absolute inset-0"
              style={{
                background: "linear-gradient(100deg, transparent 0%, rgba(255,255,255,0.7) 50%, transparent 100%)",
                width: "60%",
                mixBlendMode: "screen",
                pointerEvents: "none",
              }}
            />
            <span className="relative">{item.rarity}</span>
          </motion.span>
        </motion.div>
      </div>
    </motion.div>
  );
}

export default function Chests() {
  const [, setLocation] = useLocation();
  const { isSignedIn, isLoaded } = useAuth();
  const authedFetch = useAuthedFetch();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [chests, setChests] = useState<Chests | null>(null);
  const [loading, setLoading] = useState(true);
  const [opening, setOpening] = useState(false);
  const [openResult, setOpenResult] = useState<OpenResult | null>(null);
  const [selectedChest, setSelectedChest] = useState<string | null>(null);
  // Cinematic-overlay state: while `cinematicChest` is set, the full-screen
  // chest-open animation plays. The result dialog (openResult) only appears
  // once both the API has returned AND the cinematic has finished playing.
  const [cinematicChest, setCinematicChest] = useState<string | null>(null);
  const [pendingResult, setPendingResult] = useState<OpenResult | null>(null);
  const [cinematicDone, setCinematicDone] = useState(false);

  // Reveal as soon as both prerequisites are met.
  useEffect(() => {
    if (cinematicChest && cinematicDone && pendingResult) {
      setOpenResult(pendingResult);
      setCinematicChest(null);
      setPendingResult(null);
      setCinematicDone(false);
    }
  }, [cinematicChest, cinematicDone, pendingResult]);

  const fetchChests = useCallback(async () => {
    try {
      const res = await authedFetch(`${basePath}/api/user/chests`);
      if (!res.ok) throw new Error("Failed to load chests");
      const data = await res.json();
      setChests(data);
    } catch {
      toast({ title: "Error", description: "Failed to load chests", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authedFetch]);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) { setLocation("/portal"); return; }
    fetchChests();
  }, [isLoaded, isSignedIn]);

  const openChest = async (chestType: string) => {
    setOpening(true);
    setSelectedChest(chestType);
    // Kick off the full-screen cinematic immediately so the animation runs
    // in parallel with the API request — no dead air while the network resolves.
    setCinematicChest(chestType);
    setCinematicDone(false);
    setPendingResult(null);
    try {
      const res = await authedFetch(`${basePath}/api/user/chests/open`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chestType }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        // Bail out of the cinematic on error and surface the toast as before.
        setCinematicChest(null);
        setCinematicDone(false);
        toast({ title: "Cannot open chest", description: data.error ?? "Unknown error", variant: "destructive" });
        return;
      }
      // Stash the result — the cinematicDone effect will swap it into the
      // visible result dialog once the animation finishes.
      setPendingResult({
        items: data.items as ChestItem[],
        coins_awarded: data.coins_awarded ?? 0,
        new_coin_balance: data.new_coin_balance ?? null,
      });
      fetchChests();
      void queryClient.invalidateQueries({ queryKey: ["coinBalance"] });
    } catch {
      setCinematicChest(null);
      setCinematicDone(false);
      toast({ title: "Error", description: "Failed to open chest", variant: "destructive" });
    } finally {
      setOpening(false);
    }
  };

  const closeResult = () => { setOpenResult(null); setSelectedChest(null); };

  const CHEST_ORDER: (keyof Chests)[] = ["mortal", "iron", "crystal", "inferno", "immortal"];
  const totalChests = chests ? CHEST_ORDER.reduce((sum, k) => sum + chests[k], 0) : 0;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLocation("/portal")}
            className="gap-1.5 text-muted-foreground -ml-2 h-8"
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </Button>

          <div className="w-px h-5 bg-border" />

          <div className="flex items-center gap-2">
            <Gift className="w-4 h-4 text-primary/70" />
            <h1 className="font-semibold text-base text-foreground">Cultivation Chests</h1>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-muted-foreground hidden sm:block">
              {totalChests} {totalChests !== 1 ? "chests" : "chest"} available
            </span>
            <Button variant="outline" size="sm" onClick={() => setLocation("/bag")} className="h-8 gap-1.5 text-xs">
              <Package className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Bag</span>
            </Button>
            <Button variant="outline" size="sm" onClick={() => setLocation("/crafting")} className="h-8 gap-1.5 text-xs">
              <FlaskConical className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Crafting</span>
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8">
        {loading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {!loading && (
          <>
            <p className="text-muted-foreground text-sm mb-6 text-center">
              You earn a <strong className="text-foreground">Mortal Chest</strong> every sprint, and an{" "}
              <strong className="text-foreground">Iron Chest</strong> when you win. Higher-tier chests are obtained through crafting and events.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {CHEST_ORDER.map(chestType => {
                const qty = chests?.[chestType] ?? 0;
                const style = CHEST_STYLES[chestType];
                const [b2, b3] = BONUS_CHANCES[chestType] ?? [0, 0];
                const bonusLabel = b2 === 1.0
                  ? `Guaranteed 2 items · ${Math.round(b3 * 100)}% chance of 3rd`
                  : b2 > 0
                  ? `${Math.round(b2 * 100)}% chance of 2nd item${b3 > 0 ? ` · ${Math.round(b3 * 100)}% chance of 3rd` : ""}`
                  : "";
                const isOpening = opening && selectedChest === chestType;

                return (
                  <div
                    key={chestType}
                    className={`relative rounded-2xl border-2 p-5 flex flex-col gap-4 transition-all hover:scale-[1.02] hover:shadow-xl ${style.card} ${style.glow ? `shadow-lg ${style.glow}` : "shadow-sm"}`}
                  >
                    {/* Tier badge + stars */}
                    <div className="flex items-center justify-between">
                      <span className={`text-[11px] font-bold uppercase tracking-widest px-2.5 py-0.5 rounded-full ${style.badge}`}>
                        {style.badgeText}
                      </span>
                      <span className="text-xs tracking-tight opacity-50">
                        {"★".repeat(style.stars)}{"☆".repeat(5 - style.stars)}
                      </span>
                    </div>

                    {/* Icon + title row */}
                    <div className="flex items-center gap-4">
                      <div className={`w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 p-1.5 ${style.iconRing}`}>
                        <ChestIcon type={chestType} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                          <h3 className="font-bold text-base leading-tight">{style.label}</h3>
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${style.badge}`}>
                            ×{qty}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                          {style.description}
                        </p>
                      </div>
                    </div>

                    {/* Drop odds + bonus */}
                    <div className="space-y-1">
                      <p className="text-[11px] font-mono text-muted-foreground/70">
                        {style.dropTable}
                      </p>
                      {bonusLabel && (
                        <p className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
                          <span>✦</span>
                          <span>{bonusLabel}</span>
                        </p>
                      )}
                    </div>

                    {/* Open button (with divider like shop's price row) */}
                    <div className="flex items-center justify-between mt-auto pt-1 border-t border-black/5 dark:border-white/5">
                      <span className="text-sm text-muted-foreground">
                        {qty > 0 ? `${qty} available` : "None owned"}
                      </span>
                      <button
                        disabled={qty === 0 || opening}
                        onClick={() => openChest(chestType)}
                        className={`px-5 py-1.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 ${style.openBtn}`}
                      >
                        {isOpening ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            Opening…
                          </>
                        ) : qty > 0 ? "Open" : "None"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Info footer */}
            <div className="mt-10 p-4 rounded-xl border border-border bg-muted/40 text-xs text-muted-foreground space-y-1.5">
              <div className="font-semibold text-foreground mb-2">Item Effects Guide</div>
              <div>Use items from your Bag to activate effects that boost sprint XP, guarantee rare drops, or enhance crafting.</div>
              <div>Recipe Scrolls from Iron+ chests unlock Alchemy recipes in the Crafting lab.</div>
              <div>Failure Ashes from failed crafting can be refined (×5 → 1 Common pill) using the Refining Furnace.</div>
            </div>
          </>
        )}
      </div>

      {/* Full-screen cinematic overlay — plays the chest-open animation */}
      {cinematicChest && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center"
          style={{
            background: "radial-gradient(circle at center, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.95) 100%)",
            backdropFilter: "blur(8px)",
            animation: "chestOverlayIn 0.3s ease-out",
          }}
        >
          <ChestOpenAnimation
            chestType={cinematicChest}
            onComplete={() => setCinematicDone(true)}
          />
          <style>{`@keyframes chestOverlayIn { from { opacity: 0; } to { opacity: 1; } }`}</style>
        </div>
      )}

      {/* Open Result Dialog */}
      <Dialog open={!!openResult} onOpenChange={(open) => { if (!open) closeResult(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center text-xl">
              {selectedChest && CHEST_STYLES[selectedChest]?.label} Opened!
            </DialogTitle>
            <DialogDescription className="text-center text-sm">
              {openResult && openResult.items.length > 1
                ? `You received ${openResult.items.length} items!`
                : "You received:"}
            </DialogDescription>
          </DialogHeader>

          {/* Keyframes for the cinematic card — defined once per dialog mount. */}
          <style>{`
            @keyframes chestRaysSpin   { from { transform: rotate(0deg); }   to { transform: rotate(360deg); } }
            @keyframes chestHaloPulse  { 0%,100% { transform: translate(-50%, -50%) scale(1);    opacity: 0.6; } 50% { transform: translate(-50%, -50%) scale(1.14); opacity: 0.95; } }
            @keyframes chestSparkleFlt { 0% { transform: translate(-50%, -50%) scale(0.7); opacity: 0; } 18% { opacity: 1; } 100% { transform: translate(calc(-50% + var(--dx)), calc(-50% + var(--dy))) scale(1.15); opacity: 0; } }
          `}</style>

          <div className={`flex gap-3 mt-2 ${openResult && openResult.items.length > 1 ? "flex-row justify-center flex-wrap" : "flex-col items-center"}`}>
            {openResult?.items.map((item, idx) => (
              <CinematicRewardCard
                key={`${item.id}-${idx}`}
                item={item}
                index={idx}
                single={openResult.items.length === 1}
              />
            ))}
          </div>

          {openResult && openResult.coins_awarded > 0 && (
            <CoinRewardChip
              awarded={openResult.coins_awarded}
              total={openResult.new_coin_balance}
            />
          )}

          {openResult && openResult.coins_awarded === 0 && (
            <div className="mt-3 text-center text-xs text-muted-foreground">
              Daily coin limit reached — coins reset every 24 hours.
            </div>
          )}

          <div className="flex gap-2 mt-4">
            <Button className="flex-1" onClick={closeResult}>
              Nice!
            </Button>
            <Button
              variant="outline"
              onClick={() => { closeResult(); setLocation("/bag"); }}
            >
              View Bag
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
