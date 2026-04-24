import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@clerk/react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

interface ChestItem {
  id: number;
  name: string;
  rarity: string;
  icon: string;
  category: string;
}

interface Chests {
  mortal: number;
  iron: number;
  crystal: number;
  inferno: number;
  immortal: number;
}

const CHEST_INFO: Record<string, {
  label: string;
  icon: string;
  emoji: string;
  color: string;
  glow: string;
  dropTable: string;
  description: string;
}> = {
  mortal: {
    label: "Mortal Chest",
    icon: "📦",
    emoji: "📦",
    color: "from-gray-600/30 to-gray-800/30 border-gray-500/40",
    glow: "",
    description: "Earned every sprint. Contains Common–Epic items.",
    dropTable: "55% Common · 30% Uncommon · 10% Rare · 5% Epic",
  },
  iron: {
    label: "Iron Chest",
    icon: "🔩",
    emoji: "🔩",
    color: "from-slate-500/30 to-slate-700/30 border-slate-400/40",
    glow: "shadow-slate-500/20 shadow-md",
    description: "Awarded for winning a sprint. Contains Uncommon–Mythic items and Recipe Scrolls.",
    dropTable: "10% Uncommon · 50% Rare · 30% Epic · 10% Mythic",
  },
  crystal: {
    label: "Crystal Chest",
    icon: "💎",
    emoji: "💎",
    color: "from-blue-600/30 to-cyan-800/30 border-blue-400/40",
    glow: "shadow-blue-500/30 shadow-md",
    description: "Rare reward. Contains Rare–Legendary items and Artifacts.",
    dropTable: "20% Rare · 45% Epic · 30% Mythic · 5% Legendary",
  },
  inferno: {
    label: "Inferno Chest",
    icon: "🔥",
    emoji: "🔥",
    color: "from-red-700/30 to-orange-800/30 border-orange-500/40",
    glow: "shadow-orange-500/30 shadow-lg",
    description: "Prestigious chest. Contains Epic–Legendary items and high-tier Recipes.",
    dropTable: "10% Epic · 55% Mythic · 35% Legendary",
  },
  immortal: {
    label: "Immortal Chest",
    icon: "⭐",
    emoji: "⭐",
    color: "from-yellow-600/20 to-amber-800/20 border-yellow-400/50",
    glow: "shadow-yellow-500/40 shadow-xl",
    description: "Supreme chest. Guaranteed Mythic + 30% chance of a Legendary.",
    dropTable: "Guaranteed Mythic + 30% chance Legendary",
  },
};

const RARITY_COLORS: Record<string, string> = {
  common: "border-gray-400/50 bg-gray-900/60 text-gray-200",
  uncommon: "border-green-500/50 bg-green-900/40 text-green-200",
  rare: "border-blue-400/50 bg-blue-900/40 text-blue-200",
  epic: "border-purple-400/50 bg-purple-900/40 text-purple-200",
  mythic: "border-orange-400/50 bg-orange-900/40 text-orange-200",
  legendary: "border-yellow-400/60 bg-yellow-900/30 text-yellow-200 shadow-yellow-500/30 shadow-md",
};

export default function Chests() {
  const [, setLocation] = useLocation();
  const { isSignedIn } = useAuth();
  const { toast } = useToast();

  const [chests, setChests] = useState<Chests | null>(null);
  const [loading, setLoading] = useState(true);
  const [opening, setOpening] = useState(false);
  const [openResult, setOpenResult] = useState<ChestItem[] | null>(null);
  const [selectedChest, setSelectedChest] = useState<string | null>(null);
  const [animating, setAnimating] = useState(false);

  const fetchChests = useCallback(async () => {
    try {
      const res = await fetch(`${basePath}/api/user/chests`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load chests");
      const data = await res.json();
      setChests(data);
    } catch {
      toast({ title: "Error", description: "Failed to load chests", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isSignedIn) { setLocation("/portal"); return; }
    fetchChests();
  }, [isSignedIn]);

  const openChest = async (chestType: string) => {
    setOpening(true);
    setAnimating(true);
    try {
      const res = await fetch(`${basePath}/api/user/chests/open`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chestType }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        toast({ title: "Cannot open chest", description: data.error ?? "Unknown error", variant: "destructive" });
        setAnimating(false);
        return;
      }
      // Brief animation delay then show results
      await new Promise(r => setTimeout(r, 900));
      setOpenResult(data.items as ChestItem[]);
      setSelectedChest(chestType);
      fetchChests();
    } catch {
      toast({ title: "Error", description: "Failed to open chest", variant: "destructive" });
    } finally {
      setOpening(false);
      setAnimating(false);
    }
  };

  const CHEST_ORDER: (keyof Chests)[] = ["mortal", "iron", "crystal", "inferno", "immortal"];
  const totalChests = chests ? CHEST_ORDER.reduce((sum, k) => sum + chests[k], 0) : 0;

  return (
    <div className="min-h-screen bg-[#0F1117] text-white">
      {/* Header */}
      <div className="border-b border-white/10 bg-[#15181F] sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => setLocation("/portal")}
            className="text-white/60 hover:text-white transition-colors text-sm flex items-center gap-1"
          >
            ← Portal
          </button>
          <div className="w-px h-4 bg-white/20" />
          <h1 className="font-bold text-lg">🎁 Cultivation Chests</h1>
          <div className="ml-auto flex items-center gap-2 text-xs text-white/50">
            {totalChests} chest{totalChests !== 1 ? "s" : ""} available
          </div>
          <button
            onClick={() => setLocation("/bag")}
            className="text-sm bg-indigo-700 hover:bg-indigo-600 px-3 py-1 rounded-lg font-medium transition-colors"
          >
            🎒 Bag
          </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {loading && (
          <div className="flex items-center justify-center py-20 text-white/40 text-sm">
            Loading chests…
          </div>
        )}

        {!loading && (
          <div className="space-y-4">
            <p className="text-white/50 text-sm mb-6 text-center">
              You earn a <strong className="text-white/80">Mortal Chest</strong> every sprint, and an <strong className="text-white/80">Iron Chest</strong> when you win. Higher-tier chests are obtained through crafting and events.
            </p>

            {CHEST_ORDER.map(chestType => {
              const qty = chests?.[chestType] ?? 0;
              const info = CHEST_INFO[chestType];
              return (
                <div
                  key={chestType}
                  className={`bg-gradient-to-r ${info.color} border rounded-2xl p-5 flex items-center gap-5 ${info.glow}`}
                >
                  <div className="text-5xl select-none">{info.emoji}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 mb-1">
                      <h3 className="font-bold text-base">{info.label}</h3>
                      <span className="text-white/50 text-sm">×{qty}</span>
                    </div>
                    <p className="text-xs text-white/60 mb-1">{info.description}</p>
                    <p className="text-[11px] text-white/40 font-mono">{info.dropTable}</p>
                  </div>
                  <Button
                    disabled={qty === 0 || opening}
                    onClick={() => openChest(chestType)}
                    className={`shrink-0 font-bold px-5 ${
                      qty > 0
                        ? chestType === "immortal"
                          ? "bg-yellow-500 hover:bg-yellow-400 text-black"
                          : chestType === "inferno"
                          ? "bg-orange-600 hover:bg-orange-500"
                          : chestType === "crystal"
                          ? "bg-blue-600 hover:bg-blue-500"
                          : "bg-white/10 hover:bg-white/20"
                        : "opacity-40 cursor-not-allowed"
                    }`}
                  >
                    {opening && selectedChest === chestType ? (
                      <span className="flex items-center gap-2">
                        <span className={`inline-block ${animating ? "animate-spin" : ""}`}>✨</span>
                        Opening…
                      </span>
                    ) : qty > 0 ? "Open" : "None"}
                  </Button>
                </div>
              );
            })}
          </div>
        )}

        {/* Info footer */}
        <div className="mt-10 p-4 rounded-xl border border-white/5 bg-white/2 text-xs text-white/40 space-y-1">
          <div className="font-semibold text-white/60 mb-2">Item Effects Guide</div>
          <div>Use items from your Bag to activate effects that boost sprint XP, guarantee rare drops, or enhance crafting.</div>
          <div>Recipe Scrolls from Iron+ chests unlock Alchemy recipes in the Crafting lab.</div>
          <div>Failure Ashes from failed crafting can be refined (×5 → 1 Common pill) using the Refining Furnace.</div>
        </div>
      </div>

      {/* Open Result Dialog */}
      <Dialog open={!!openResult} onOpenChange={(open) => { if (!open) { setOpenResult(null); setSelectedChest(null); } }}>
        <DialogContent className="bg-[#1A1D26] border-white/10 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center text-xl">
              {selectedChest && CHEST_INFO[selectedChest]?.emoji} {selectedChest && CHEST_INFO[selectedChest]?.label} Opened!
            </DialogTitle>
            <DialogDescription className="text-center text-white/60 text-sm">
              {openResult && openResult.length > 1 ? "You received these items:" : "You received:"}
            </DialogDescription>
          </DialogHeader>

          <div className={`flex gap-3 mt-2 ${openResult && openResult.length > 1 ? "flex-row justify-center" : "flex-col items-center"}`}>
            {openResult?.map((item, idx) => (
              <div
                key={idx}
                className={`flex flex-col items-center gap-2 p-4 rounded-xl border w-full ${RARITY_COLORS[item.rarity] ?? "border-white/20"}`}
              >
                <span className="text-5xl">{item.icon}</span>
                <div className="text-center">
                  <div className="font-bold text-base">{item.name}</div>
                  <div className="text-xs capitalize opacity-70">{item.rarity} {item.category}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-2 mt-4">
            <Button
              className="flex-1 bg-indigo-600 hover:bg-indigo-500"
              onClick={() => { setOpenResult(null); setSelectedChest(null); }}
            >
              Nice!
            </Button>
            <Button
              variant="outline"
              className="border-white/10 text-white/70 hover:bg-white/5"
              onClick={() => {
                setOpenResult(null);
                setSelectedChest(null);
                setLocation("/bag");
              }}
            >
              View Bag
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
