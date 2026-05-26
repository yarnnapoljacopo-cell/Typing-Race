import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChestIcon } from "@/components/ChestIcon";
import { ChestOpenAnimation } from "@/components/ChestOpenAnimation";
import { ItemIcon } from "@/components/ItemIcon";
import { useAuthedFetch } from "@/lib/authedFetch";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

const CHEST_META: Record<string, { label: string; color: string; glow: string; tagline: string }> = {
  mortal:   { label: "Mortal Chest",   color: "#B8844C", glow: "rgba(184,132,76,0.45)",  tagline: "The first step on your cultivation journey." },
  iron:     { label: "Iron Chest",     color: "#7A8A9A", glow: "rgba(122,138,154,0.45)", tagline: "Forged in discipline and steady effort." },
  crystal:  { label: "Crystal Chest",  color: "#4090C8", glow: "rgba(64,144,200,0.5)",   tagline: "Clarity and precision sharpened to a point." },
  inferno:  { label: "Inferno Chest",  color: "#C04010", glow: "rgba(192,64,16,0.5)",    tagline: "Born from the flames of relentless writing." },
  immortal: { label: "Immortal Chest", color: "#D4A820", glow: "rgba(212,168,32,0.55)",  tagline: "A treasure beyond mortal comprehension." },
};

/**
 * Rarity styling: each rarity gets its own gradient backdrop, glow color,
 * ray colors, and particle counts so a Mythic reveal feels different from a
 * Common one without any per-rarity branching in the JSX.
 */
const RARITY_STYLE: Record<string, {
  border: string;
  bg: string;
  text: string;
  badge: string;
  hex: string;          // canonical accent color
  glow: string;         // box-shadow glow color (rgba)
  rayStops: string;     // two colors for the rotating-rays gradient
  gradient: string;     // background gradient for the card body
  particles: number;    // how many floating sparkles to spawn
  raysOpacity: number;  // how visible the ray fan is (lower = subtle)
}> = {
  common: {
    border: "#9ca3af", bg: "rgba(75,85,99,0.4)", text: "#d1d5db",
    badge: "bg-gray-600/70 text-gray-200",
    hex: "#9ca3af", glow: "rgba(156,163,175,0.55)",
    rayStops: "rgba(156,163,175,0.45) 0deg, transparent 18deg",
    gradient: "linear-gradient(160deg, rgba(75,85,99,0.45) 0%, rgba(31,41,55,0.55) 100%)",
    particles: 6, raysOpacity: 0.4,
  },
  uncommon: {
    border: "#22c55e", bg: "rgba(21,128,61,0.3)", text: "#86efac",
    badge: "bg-green-700/60 text-green-200",
    hex: "#22c55e", glow: "rgba(34,197,94,0.65)",
    rayStops: "rgba(34,197,94,0.55) 0deg, transparent 16deg",
    gradient: "linear-gradient(160deg, rgba(34,197,94,0.32) 0%, rgba(15,40,30,0.6) 100%)",
    particles: 10, raysOpacity: 0.55,
  },
  rare: {
    border: "#60a5fa", bg: "rgba(29,78,216,0.3)", text: "#93c5fd",
    badge: "bg-blue-700/60 text-blue-200",
    hex: "#60a5fa", glow: "rgba(96,165,250,0.7)",
    rayStops: "rgba(96,165,250,0.6) 0deg, transparent 14deg",
    gradient: "linear-gradient(160deg, rgba(59,130,246,0.34) 0%, rgba(15,23,55,0.6) 100%)",
    particles: 14, raysOpacity: 0.7,
  },
  epic: {
    border: "#c084fc", bg: "rgba(109,40,217,0.3)", text: "#d8b4fe",
    badge: "bg-purple-700/60 text-purple-200",
    hex: "#c084fc", glow: "rgba(192,132,252,0.78)",
    rayStops: "rgba(192,132,252,0.7) 0deg, transparent 12deg",
    gradient: "linear-gradient(160deg, rgba(168,85,247,0.36) 0%, rgba(40,15,60,0.7) 100%)",
    particles: 18, raysOpacity: 0.8,
  },
  mythic: {
    border: "#fb7185", bg: "rgba(190,18,60,0.3)", text: "#fda4af",
    badge: "bg-rose-700/60 text-rose-200",
    hex: "#fb7185", glow: "rgba(251,113,133,0.85)",
    rayStops: "rgba(251,113,133,0.8) 0deg, transparent 10deg",
    gradient: "linear-gradient(160deg, rgba(244,63,94,0.4) 0%, rgba(60,10,30,0.75) 100%)",
    particles: 22, raysOpacity: 0.9,
  },
  legendary: {
    border: "#fbbf24", bg: "rgba(120,53,15,0.3)", text: "#fde68a",
    badge: "bg-amber-600/60 text-amber-100 shadow shadow-amber-500/40",
    hex: "#fbbf24", glow: "rgba(251,191,36,0.95)",
    rayStops: "rgba(251,191,36,0.9) 0deg, transparent 8deg",
    gradient: "linear-gradient(160deg, rgba(251,191,36,0.45) 0%, rgba(70,40,5,0.8) 100%)",
    particles: 28, raysOpacity: 1,
  },
};

interface LootItem {
  id: number;
  name: string;
  rarity: string;
  icon: string;
  category: string;
}

interface OpenResult {
  ok: boolean;
  items: LootItem[];
  coins_awarded: number;
  new_coin_balance: number | null;
}

interface ChestAwardModalProps {
  chestType: string;
  onClose: () => void;
}

type Phase = "awarded" | "opening" | "revealed";

export function ChestAwardModal({ chestType, onClose }: ChestAwardModalProps) {
  const authedFetch = useAuthedFetch();
  const [phase, setPhase] = useState<Phase>("awarded");
  const [loot, setLoot] = useState<OpenResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const meta = CHEST_META[chestType] ?? { label: `${chestType} Chest`, color: "#888", glow: "rgba(136,136,136,0.4)", tagline: "" };

  // Holds the API response so the cinematic can keep playing while the
  // network roundtrip happens in parallel. We don't flip to "revealed" until
  // BOTH (a) we have loot data and (b) the cinematic onComplete has fired —
  // whichever is later. This keeps the animation watchable even on a fast
  // network without making slow networks feel laggy.
  const pendingLootRef = useRef<OpenResult | null>(null);
  const animDoneRef = useRef(false);
  const tryReveal = () => {
    if (animDoneRef.current && pendingLootRef.current) {
      setLoot(pendingLootRef.current);
      setPhase("revealed");
    }
  };

  const handleOpenNow = async () => {
    setPhase("opening");
    setError(null);
    pendingLootRef.current = null;
    animDoneRef.current = false;
    try {
      const res = await authedFetch(`${basePath}/api/user/chests/open`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chestType }),
      });
      const data: OpenResult = await res.json();
      if (!res.ok || !data.ok) {
        setError("Couldn't open the chest. It's been saved to your inventory.");
        setPhase("awarded");
        return;
      }
      pendingLootRef.current = data;
      tryReveal();
    } catch {
      setError("Network error. The chest has been saved to your inventory.");
      setPhase("awarded");
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)" }}
    >
      <div
        className="relative w-full max-w-sm rounded-2xl p-6 flex flex-col items-center gap-5 animate-in zoom-in-90 duration-300"
        style={{
          background: "linear-gradient(160deg, #1a1a2e 0%, #12121f 100%)",
          border: `1.5px solid ${meta.color}55`,
          boxShadow: `0 0 60px ${meta.glow}, 0 8px 32px rgba(0,0,0,0.6)`,
        }}
      >
        {phase === "awarded" && <AwardedView meta={meta} chestType={chestType} error={error} onOpen={handleOpenNow} onClose={onClose} />}
        {phase === "opening" && (
          <OpeningView
            meta={meta}
            chestType={chestType}
            onAnimationComplete={() => { animDoneRef.current = true; tryReveal(); }}
          />
        )}
        {phase === "revealed" && loot && <RevealedView loot={loot} meta={meta} onClose={onClose} />}
      </div>
    </div>
  );
}

function AwardedView({
  meta, chestType, error, onOpen, onClose,
}: {
  meta: typeof CHEST_META[string];
  chestType: string;
  error: string | null;
  onOpen: () => void;
  onClose: () => void;
}) {
  return (
    <>
      <div className="text-center">
        <div className="text-xs font-bold uppercase tracking-[0.2em] mb-1" style={{ color: meta.color }}>
          Sprint Complete
        </div>
        <h2 className="text-2xl font-black text-white">Chest Earned!</h2>
        <p className="text-sm text-white/50 mt-1">{meta.tagline}</p>
      </div>

      <div
        className="relative w-36 h-36 animate-bounce"
        style={{ filter: `drop-shadow(0 0 20px ${meta.glow})` }}
      >
        <ChestIcon type={chestType} className="w-full h-full" />
        <div
          className="absolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center text-xs font-black"
          style={{ background: meta.color, color: "#fff" }}
        >
          1
        </div>
      </div>

      <div
        className="w-full text-center py-3 px-4 rounded-xl"
        style={{ background: `${meta.color}15`, border: `1px solid ${meta.color}30` }}
      >
        <div className="text-lg font-black" style={{ color: meta.color }}>{meta.label}</div>
        <div className="text-xs text-white/40 mt-0.5">Added to your Cultivation Chests inventory</div>
      </div>

      {error && (
        <div className="w-full text-center text-xs text-red-400 bg-red-900/20 border border-red-500/30 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      <div className="flex flex-col w-full gap-2">
        <button
          onClick={onOpen}
          className="w-full py-3 rounded-xl text-sm font-black uppercase tracking-wider transition-all duration-150 hover:scale-[1.02] active:scale-95"
          style={{ background: meta.color, color: "#fff", boxShadow: `0 4px 20px ${meta.glow}` }}
        >
          Open Now ✨
        </button>
        <button
          onClick={onClose}
          className="w-full py-2.5 rounded-xl text-sm font-semibold text-white/50 hover:text-white/80 transition-colors"
          style={{ border: "1px solid rgba(255,255,255,0.12)" }}
        >
          Save for Later
        </button>
      </div>
    </>
  );
}

function OpeningView({
  meta, chestType, onAnimationComplete,
}: {
  meta: typeof CHEST_META[string];
  chestType: string;
  onAnimationComplete: () => void;
}) {
  return (
    <>
      <div className="text-center">
        <div className="text-xs font-bold uppercase tracking-[0.2em]" style={{ color: meta.color }}>
          Unsealing
        </div>
        <h2 className="text-xl font-black text-white mt-1">{meta.label}</h2>
      </div>
      <ChestOpenAnimation chestType={chestType} onComplete={onAnimationComplete} />
    </>
  );
}

/**
 * Counts up from 0 to `target` over `durationMs` for the coin reward chip.
 * Uses requestAnimationFrame so the easing curve feels smooth even on slow
 * devices, and clamps to the exact target on the final frame.
 */
function useCountUp(target: number, durationMs = 900, delayMs = 0): number {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (target <= 0) { setValue(0); return; }
    let raf = 0;
    let startedAt: number | null = null;
    const ease = (t: number) => 1 - Math.pow(1 - t, 3); // easeOutCubic
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

function RevealedView({ loot, meta, onClose }: { loot: OpenResult; meta: typeof CHEST_META[string]; onClose: () => void }) {
  // Top item drives the cinematic theming — rarest first if multiple.
  const RARITY_ORDER = ["legendary", "mythic", "epic", "rare", "uncommon", "common"];
  const headlineItem = [...loot.items].sort(
    (a, b) => RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity),
  )[0];
  const headlineRs = headlineItem
    ? (RARITY_STYLE[headlineItem.rarity] ?? RARITY_STYLE.common)
    : RARITY_STYLE.common;
  const coinsDisplay = useCountUp(loot.coins_awarded, 900, 600);

  return (
    <>
      {/* Local keyframes that aren't in tailwind/framer's vocabulary. */}
      <style>{`
        @keyframes chestRaysSpin   { from { transform: rotate(0deg); }   to { transform: rotate(360deg); } }
        @keyframes chestHaloPulse  { 0%,100% { transform: scale(1); opacity: 0.65; } 50% { transform: scale(1.12); opacity: 0.95; } }
        @keyframes chestSparkleFlt { 0% { transform: translate(0,0) scale(0.7); opacity: 0; } 20% { opacity: 1; } 100% { transform: translate(var(--dx),var(--dy)) scale(1.1); opacity: 0; } }
      `}</style>

      <div className="text-center">
        <motion.div
          initial={{ opacity: 0, y: -8, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: 0.05, duration: 0.35, ease: "easeOut" }}
          className="text-3xl mb-1"
        >🎉</motion.div>
        <motion.h2
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.35 }}
          className="text-2xl font-black text-white"
        >
          You received
        </motion.h2>
      </div>

      <div className="flex flex-col gap-3 w-full items-center">
        {loot.items.map((item, idx) => {
          const rs = RARITY_STYLE[item.rarity] ?? RARITY_STYLE.common;
          return <RewardCard key={item.id} item={item} rs={rs} index={idx} />;
        })}
        {loot.items.length === 0 && (
          <div className="text-sm text-white/40 text-center py-2">No items this time, but the chest dropped coins!</div>
        )}
      </div>

      {loot.coins_awarded > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 14, scale: 0.85 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: 0.5, type: "spring", stiffness: 320, damping: 18 }}
          className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-bold"
          style={{
            background: "linear-gradient(95deg, rgba(212,168,32,0.22) 0%, rgba(251,191,36,0.12) 100%)",
            border: "1px solid rgba(251,191,36,0.5)",
            color: "#fde047",
            boxShadow: "0 0 18px rgba(251,191,36,0.18), inset 0 0 12px rgba(251,191,36,0.06)",
          }}
        >
          <motion.span
            className="text-xl"
            animate={{ rotateY: [0, 360, 360], scale: [1, 1.15, 1] }}
            transition={{ duration: 1.1, times: [0, 0.55, 1], delay: 0.5 }}
          >🪙</motion.span>
          <span style={{ fontVariantNumeric: "tabular-nums" }}>+{coinsDisplay.toLocaleString()} Spirit Coins</span>
        </motion.div>
      )}

      <motion.button
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7, duration: 0.3 }}
        onClick={onClose}
        className="w-full py-3 rounded-xl text-sm font-black uppercase tracking-wider transition-all duration-150 hover:scale-[1.02] active:scale-95"
        style={{
          background: `linear-gradient(180deg, ${headlineRs.hex} 0%, ${meta.color} 100%)`,
          color: "#fff",
          boxShadow: `0 4px 24px ${headlineRs.glow}, 0 4px 12px ${meta.glow}`,
        }}
      >
        Claim Reward
      </motion.button>
    </>
  );
}

/**
 * A single rarity-themed reward card with the full cinematic treatment:
 *   - Rotating ray fan behind the icon (conic-gradient)
 *   - Pulsing radial halo
 *   - Bouncing item icon (spring entrance)
 *   - Sparkle particles floating outward
 *   - Animated rarity badge with glow shimmer
 *   - Reveal-from-bottom card surface with rarity-themed gradient
 */
function RewardCard({
  item, rs, index,
}: {
  item: LootItem;
  rs: typeof RARITY_STYLE[string];
  index: number;
}) {
  // Stagger reveal for multi-item rewards.
  const baseDelay = 0.2 + index * 0.12;
  const cinematic = item.rarity === "legendary" || item.rarity === "mythic";

  // Generate sparkle trajectories once per mount.
  const sparkles = useRef<Array<{ dx: number; dy: number; delay: number; size: number }>>(
    Array.from({ length: rs.particles }).map(() => {
      const angle = Math.random() * Math.PI * 2;
      const dist = 60 + Math.random() * 80;
      return {
        dx: Math.cos(angle) * dist,
        dy: Math.sin(angle) * dist,
        delay: Math.random() * 0.8,
        size: 4 + Math.random() * 4,
      };
    }),
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.85 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: baseDelay, type: "spring", stiffness: 260, damping: 20 }}
      className="relative w-full overflow-hidden rounded-2xl"
      style={{
        background: rs.gradient,
        border: `1.5px solid ${rs.border}`,
        boxShadow: `0 0 32px ${rs.glow}, inset 0 0 24px ${rs.hex}22`,
      }}
    >
      {/* Rotating rays fan — sits behind everything. */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{ opacity: rs.raysOpacity }}
      >
        <div
          className="absolute left-1/2 top-1/2"
          style={{
            width: 360, height: 360,
            transform: "translate(-50%, -50%)",
            background: `repeating-conic-gradient(${rs.rayStops}, transparent 30deg)`,
            animation: "chestRaysSpin 14s linear infinite",
            mixBlendMode: "screen",
            filter: "blur(0.5px)",
            opacity: 0.85,
          }}
        />
      </div>

      {/* Halo behind the icon */}
      <div
        aria-hidden
        className="absolute left-1/2 top-[42%] pointer-events-none"
        style={{
          width: 180, height: 180,
          transform: "translate(-50%, -50%)",
          background: `radial-gradient(circle, ${rs.hex}55 0%, ${rs.hex}22 35%, transparent 70%)`,
          animation: "chestHaloPulse 2.4s ease-in-out infinite",
          filter: "blur(2px)",
        }}
      />

      {/* Sparkle particles */}
      {sparkles.current.map((s, i) => (
        <span
          key={i}
          aria-hidden
          className="absolute left-1/2 top-[42%] rounded-full pointer-events-none"
          style={{
            width: s.size, height: s.size,
            background: rs.hex,
            boxShadow: `0 0 ${s.size * 1.6}px ${rs.hex}, 0 0 ${s.size * 0.8}px #fff`,
            // CSS custom props feed the keyframe so each particle drifts to its
            // own random offset — no per-particle <style> tag needed.
            ['--dx' as string]: `${s.dx}px`,
            ['--dy' as string]: `${s.dy}px`,
            animation: `chestSparkleFlt 1.6s ease-out ${baseDelay + s.delay}s both`,
            transform: "translate(-50%, -50%)",
          }}
        />
      ))}

      {/* Main content */}
      <div className="relative flex flex-col items-center gap-3 py-7 px-5 z-10">
        {/* Item icon — springs in with a tilt-shake afterglow */}
        <motion.div
          initial={{ scale: 0.2, rotate: -22, opacity: 0 }}
          animate={{ scale: [0.2, 1.18, 1], rotate: [-22, 6, 0], opacity: 1 }}
          transition={{
            delay: baseDelay + 0.15,
            duration: 0.7,
            times: [0, 0.6, 1],
            ease: "easeOut",
          }}
          className="relative"
          style={{ filter: `drop-shadow(0 6px 18px ${rs.glow})` }}
        >
          <motion.div
            // Continuous gentle float after the entrance lands.
            animate={cinematic
              ? { y: [0, -3, 0], rotate: [0, 2, -2, 0] }
              : { y: [0, -2, 0] }
            }
            transition={{
              delay: baseDelay + 0.85,
              duration: cinematic ? 2.6 : 2.4,
              ease: "easeInOut",
              repeat: Infinity,
            }}
          >
            <span className="inline-flex items-center justify-center" style={{ width: 80, height: 80 }}>
              <ItemIcon name={item.name} size={80} />
            </span>
          </motion.div>

          {/* Sweep shimmer across the icon (only for epic+) */}
          {(item.rarity === "epic" || item.rarity === "mythic" || item.rarity === "legendary") && (
            <motion.span
              aria-hidden
              initial={{ x: "-120%", opacity: 0 }}
              animate={{ x: ["-120%", "220%"], opacity: [0, 0.85, 0] }}
              transition={{ delay: baseDelay + 0.9, duration: 1.4, ease: "easeOut", repeat: Infinity, repeatDelay: 2.6 }}
              className="absolute inset-0"
              style={{
                background: "linear-gradient(120deg, transparent 0%, rgba(255,255,255,0.55) 50%, transparent 100%)",
                mixBlendMode: "screen",
                pointerEvents: "none",
                width: "60%",
              }}
            />
          )}
        </motion.div>

        {/* Name + rarity badge */}
        <div className="text-center">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: baseDelay + 0.4, duration: 0.35 }}
            className="text-lg font-black leading-tight"
            style={{
              color: "#fff",
              textShadow: `0 1px 4px rgba(0,0,0,0.55), 0 0 14px ${rs.hex}66`,
              letterSpacing: "-0.005em",
            }}
          >
            {item.name}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: baseDelay + 0.55, type: "spring", stiffness: 380, damping: 18 }}
            className="mt-1.5 inline-flex"
          >
            <motion.span
              className="relative inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-[0.16em] px-2.5 py-1 rounded-full overflow-hidden"
              style={{
                color: "#fff",
                background: `linear-gradient(90deg, ${rs.hex} 0%, ${rs.hex}cc 100%)`,
                border: `1px solid ${rs.hex}`,
                boxShadow: `0 0 14px ${rs.glow}, inset 0 1px 0 rgba(255,255,255,0.25)`,
              }}
              animate={cinematic
                ? { boxShadow: [`0 0 14px ${rs.glow}`, `0 0 28px ${rs.glow}`, `0 0 14px ${rs.glow}`] }
                : undefined
              }
              transition={cinematic ? { duration: 1.6, repeat: Infinity, ease: "easeInOut" } : undefined}
            >
              {/* Shimmer sweep across the badge */}
              <motion.span
                aria-hidden
                initial={{ x: "-120%" }}
                animate={{ x: ["-120%", "220%"] }}
                transition={{ delay: baseDelay + 1.0, duration: 1.5, ease: "easeOut", repeat: Infinity, repeatDelay: 2.4 }}
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

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: baseDelay + 0.7, duration: 0.3 }}
            className="text-[10px] text-white/55 mt-1.5 capitalize tracking-wide"
          >
            {item.category}
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}

// Silence the lint warning when no items are present — `AnimatePresence` is
// imported for future expansion but currently unused. Keeping the import
// lets us drop in exit animations without re-wiring.
void AnimatePresence;
