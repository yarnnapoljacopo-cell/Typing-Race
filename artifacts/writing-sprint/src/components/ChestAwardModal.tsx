import { useState } from "react";
import { ChestIcon } from "@/components/ChestIcon";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

const CHEST_META: Record<string, { label: string; color: string; glow: string; tagline: string }> = {
  mortal:   { label: "Mortal Chest",   color: "#B8844C", glow: "rgba(184,132,76,0.45)",  tagline: "The first step on your cultivation journey." },
  iron:     { label: "Iron Chest",     color: "#7A8A9A", glow: "rgba(122,138,154,0.45)", tagline: "Forged in discipline and steady effort." },
  crystal:  { label: "Crystal Chest",  color: "#4090C8", glow: "rgba(64,144,200,0.5)",   tagline: "Clarity and precision sharpened to a point." },
  inferno:  { label: "Inferno Chest",  color: "#C04010", glow: "rgba(192,64,16,0.5)",    tagline: "Born from the flames of relentless writing." },
  immortal: { label: "Immortal Chest", color: "#D4A820", glow: "rgba(212,168,32,0.55)",  tagline: "A treasure beyond mortal comprehension." },
};

const RARITY_STYLE: Record<string, { border: string; bg: string; text: string; badge: string }> = {
  common:    { border: "#6b7280", bg: "rgba(75,85,99,0.4)",    text: "#d1d5db", badge: "bg-gray-600/70 text-gray-200" },
  uncommon:  { border: "#22c55e", bg: "rgba(21,128,61,0.3)",   text: "#86efac", badge: "bg-green-700/60 text-green-200" },
  rare:      { border: "#3b82f6", bg: "rgba(29,78,216,0.3)",   text: "#93c5fd", badge: "bg-blue-700/60 text-blue-200" },
  epic:      { border: "#a855f7", bg: "rgba(109,40,217,0.3)",  text: "#d8b4fe", badge: "bg-purple-700/60 text-purple-200" },
  mythic:    { border: "#f97316", bg: "rgba(194,65,12,0.3)",   text: "#fdba74", badge: "bg-orange-700/60 text-orange-200" },
  legendary: { border: "#eab308", bg: "rgba(161,98,7,0.25)",   text: "#fde047", badge: "bg-yellow-600/60 text-yellow-200 shadow shadow-yellow-500/30" },
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
  const [phase, setPhase] = useState<Phase>("awarded");
  const [loot, setLoot] = useState<OpenResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const meta = CHEST_META[chestType] ?? { label: `${chestType} Chest`, color: "#888", glow: "rgba(136,136,136,0.4)", tagline: "" };

  const handleOpenNow = async () => {
    setPhase("opening");
    setError(null);
    try {
      const res = await fetch(`${basePath}/api/user/chests/open`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chestType }),
      });
      const data: OpenResult = await res.json();
      if (!res.ok || !data.ok) {
        setError("Couldn't open the chest. It's been saved to your inventory.");
        setPhase("awarded");
        return;
      }
      setLoot(data);
      setPhase("revealed");
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
        {phase === "opening" && <OpeningView meta={meta} chestType={chestType} />}
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

function OpeningView({ meta, chestType }: { meta: typeof CHEST_META[string]; chestType: string }) {
  return (
    <>
      <div className="text-center">
        <h2 className="text-xl font-black text-white">Opening…</h2>
      </div>
      <div
        className="w-36 h-36"
        style={{
          filter: `drop-shadow(0 0 28px ${meta.glow})`,
          animation: "chestShake 0.5s ease-in-out infinite",
        }}
      >
        <ChestIcon type={chestType} className="w-full h-full" />
      </div>
      <div className="flex gap-1.5">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="w-2 h-2 rounded-full"
            style={{
              background: meta.color,
              animation: `dotPulse 0.9s ease-in-out ${i * 0.2}s infinite`,
            }}
          />
        ))}
      </div>
      <style>{`
        @keyframes chestShake {
          0%,100% { transform: rotate(0deg) scale(1); }
          20%      { transform: rotate(-6deg) scale(1.05); }
          40%      { transform: rotate(6deg) scale(1.08); }
          60%      { transform: rotate(-4deg) scale(1.05); }
          80%      { transform: rotate(4deg) scale(1.03); }
        }
        @keyframes dotPulse {
          0%,80%,100% { opacity: 0.3; transform: scale(0.9); }
          40%          { opacity: 1;   transform: scale(1.2); }
        }
      `}</style>
    </>
  );
}

function RevealedView({ loot, meta, onClose }: { loot: OpenResult; meta: typeof CHEST_META[string]; onClose: () => void }) {
  return (
    <>
      <div className="text-center">
        <div className="text-3xl mb-1">🎉</div>
        <h2 className="text-2xl font-black text-white">You got:</h2>
      </div>

      <div className="flex flex-wrap gap-3 w-full justify-center">
        {loot.items.map((item) => {
          const rs = RARITY_STYLE[item.rarity] ?? RARITY_STYLE.common;
          return (
            <div
              key={item.id}
              className="flex flex-col items-center gap-2 p-4 rounded-2xl flex-1 min-w-[120px] animate-in zoom-in-75 duration-300"
              style={{ background: rs.bg, border: `1.5px solid ${rs.border}`, color: rs.text }}
            >
              <span className="text-4xl">{item.icon}</span>
              <div className="text-center">
                <div className="text-sm font-black leading-tight">{item.name}</div>
                <div className="mt-1">
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${rs.badge}`}>
                    {item.rarity}
                  </span>
                </div>
                <div className="text-[10px] text-white/40 mt-0.5 capitalize">{item.category}</div>
              </div>
            </div>
          );
        })}
        {loot.items.length === 0 && (
          <div className="text-sm text-white/40 text-center py-2">No items this time, but the chest dropped coins!</div>
        )}
      </div>

      {loot.coins_awarded > 0 && (
        <div
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold"
          style={{ background: "rgba(212,168,32,0.15)", border: "1px solid rgba(212,168,32,0.4)", color: "#fde047" }}
        >
          <span className="text-xl">🪙</span>
          <span>+{loot.coins_awarded} Spirit Coins</span>
        </div>
      )}

      <button
        onClick={onClose}
        className="w-full py-3 rounded-xl text-sm font-black uppercase tracking-wider transition-all duration-150 hover:scale-[1.02] active:scale-95"
        style={{ background: meta.color, color: "#fff", boxShadow: `0 4px 20px ${meta.glow}` }}
      >
        Awesome, thanks!
      </button>
    </>
  );
}
