import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@clerk/react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Package, Gift, FlaskConical, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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

const CHEST_INFO: Record<string, {
  label: string;
  emoji: string;
  bg: string;
  border: string;
  badgeBg: string;
  badgeText: string;
  titleColor: string;
  descColor: string;
  oddsColor: string;
  bonusColor: string;
  btnBg: string;
  btnText: string;
  btnHover: string;
  glow?: string;
  dropTable: string;
  description: string;
}> = {
  mortal: {
    label: "Mortal Chest",
    emoji: "📦",
    bg: "linear-gradient(135deg, #1c1c20 0%, #2a2a30 100%)",
    border: "rgba(148,163,184,0.2)",
    badgeBg: "rgba(148,163,184,0.12)",
    badgeText: "#94a3b8",
    titleColor: "#e2e8f0",
    descColor: "#94a3b8",
    oddsColor: "#64748b",
    bonusColor: "#94a3b8",
    btnBg: "#334155",
    btnText: "#e2e8f0",
    btnHover: "#475569",
    description: "Earned every sprint. Contains Common–Epic items. Tiny legendary chance.",
    dropTable: "55% Common · 30% Uncommon · 10% Rare · 5% Epic · 0.05% Legendary",
  },
  iron: {
    label: "Iron Chest",
    emoji: "⚙️",
    bg: "linear-gradient(135deg, #0f1a24 0%, #1e3448 100%)",
    border: "rgba(100,181,246,0.25)",
    badgeBg: "rgba(100,181,246,0.12)",
    badgeText: "#64b5f6",
    titleColor: "#e2e8f0",
    descColor: "#90caf9",
    oddsColor: "#4a8db5",
    bonusColor: "#64b5f6",
    btnBg: "#1565c0",
    btnText: "#ffffff",
    btnHover: "#1976d2",
    glow: "0 0 20px rgba(100,181,246,0.12)",
    description: "Awarded for winning a sprint. Contains Uncommon–Mythic items. Rare legendary chance.",
    dropTable: "10% Uncommon · 50% Rare · 30% Epic · 10% Mythic · 0.3% Legendary",
  },
  crystal: {
    label: "Crystal Chest",
    emoji: "💎",
    bg: "linear-gradient(135deg, #0a1628 0%, #0d2845 50%, #0e2038 100%)",
    border: "rgba(56,189,248,0.35)",
    badgeBg: "rgba(56,189,248,0.12)",
    badgeText: "#38bdf8",
    titleColor: "#bae6fd",
    descColor: "#7dd3fc",
    oddsColor: "#0e7490",
    bonusColor: "#38bdf8",
    btnBg: "#0284c7",
    btnText: "#ffffff",
    btnHover: "#0369a1",
    glow: "0 0 24px rgba(56,189,248,0.18)",
    description: "Rare reward. Contains Rare–Legendary items and Artifacts.",
    dropTable: "20% Rare · 45% Epic · 30% Mythic · 5% Legendary",
  },
  inferno: {
    label: "Inferno Chest",
    emoji: "🔥",
    bg: "linear-gradient(135deg, #1a0800 0%, #3d1200 50%, #2a0a00 100%)",
    border: "rgba(251,146,60,0.4)",
    badgeBg: "rgba(251,146,60,0.12)",
    badgeText: "#fb923c",
    titleColor: "#fed7aa",
    descColor: "#fdba74",
    oddsColor: "#9a3412",
    bonusColor: "#fb923c",
    btnBg: "#ea580c",
    btnText: "#ffffff",
    btnHover: "#c2410c",
    glow: "0 0 28px rgba(251,146,60,0.22)",
    description: "Prestigious chest. Contains Epic–Legendary items and high-tier Recipes.",
    dropTable: "10% Epic · 55% Mythic · 35% Legendary",
  },
  immortal: {
    label: "Immortal Chest",
    emoji: "⭐",
    bg: "linear-gradient(135deg, #1a1200 0%, #3d2e00 40%, #2a1e00 100%)",
    border: "rgba(250,204,21,0.5)",
    badgeBg: "rgba(250,204,21,0.12)",
    badgeText: "#facc15",
    titleColor: "#fef08a",
    descColor: "#fde047",
    oddsColor: "#854d0e",
    bonusColor: "#fbbf24",
    btnBg: "#ca8a04",
    btnText: "#000000",
    btnHover: "#eab308",
    glow: "0 0 32px rgba(250,204,21,0.25)",
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
  const queryClient = useQueryClient();

  const [chests, setChests] = useState<Chests | null>(null);
  const [loading, setLoading] = useState(true);
  const [opening, setOpening] = useState(false);
  const [openResult, setOpenResult] = useState<OpenResult | null>(null);
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
      await new Promise(r => setTimeout(r, 900));
      setOpenResult({
        items: data.items as ChestItem[],
        coins_awarded: data.coins_awarded ?? 0,
        new_coin_balance: data.new_coin_balance ?? null,
      });
      setSelectedChest(chestType);
      fetchChests();
      void queryClient.invalidateQueries({ queryKey: ["coinBalance"] });
    } catch {
      toast({ title: "Error", description: "Failed to open chest", variant: "destructive" });
    } finally {
      setOpening(false);
      setAnimating(false);
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
          <div className="space-y-3">
            <p className="text-muted-foreground text-sm mb-6 text-center">
              You earn a <strong className="text-foreground">Mortal Chest</strong> every sprint, and an{" "}
              <strong className="text-foreground">Iron Chest</strong> when you win. Higher-tier chests are obtained through crafting and events.
            </p>

            {CHEST_ORDER.map(chestType => {
              const qty = chests?.[chestType] ?? 0;
              const info = CHEST_INFO[chestType];
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
                  className="rounded-2xl overflow-hidden"
                  style={{
                    background: info.bg,
                    border: `1px solid ${info.border}`,
                    boxShadow: info.glow ?? "none",
                  }}
                >
                  <div className="flex items-center gap-4 px-5 py-4">
                    {/* Chest icon */}
                    <div
                      className="w-14 h-14 rounded-xl flex items-center justify-center shrink-0 text-3xl select-none"
                      style={{
                        background: info.badgeBg,
                        border: `1px solid ${info.border}`,
                      }}
                    >
                      {info.emoji}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-bold text-[15px]" style={{ color: info.titleColor }}>
                          {info.label}
                        </span>
                        <span
                          className="text-xs font-bold px-2 py-0.5 rounded-full"
                          style={{ background: info.badgeBg, color: info.badgeText }}
                        >
                          ×{qty}
                        </span>
                      </div>
                      <p className="text-xs leading-relaxed mb-1.5" style={{ color: info.descColor }}>
                        {info.description}
                      </p>
                      <p className="text-[11px] font-mono" style={{ color: info.oddsColor }}>
                        {info.dropTable}
                      </p>
                      {bonusLabel && (
                        <p className="text-[11px] font-semibold mt-1 flex items-center gap-1" style={{ color: info.bonusColor }}>
                          <span>✦</span>
                          <span>{bonusLabel}</span>
                        </p>
                      )}
                    </div>

                    {/* Open button */}
                    <button
                      disabled={qty === 0 || opening}
                      onClick={() => openChest(chestType)}
                      className="shrink-0 h-9 px-4 rounded-lg text-sm font-bold transition-all duration-150 flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                      style={qty > 0 ? {
                        background: info.btnBg,
                        color: info.btnText,
                      } : {
                        background: "rgba(255,255,255,0.06)",
                        color: "rgba(255,255,255,0.3)",
                      }}
                      onMouseEnter={e => {
                        if (qty > 0 && !opening) {
                          (e.currentTarget as HTMLButtonElement).style.background = info.btnHover;
                        }
                      }}
                      onMouseLeave={e => {
                        if (qty > 0 && !opening) {
                          (e.currentTarget as HTMLButtonElement).style.background = info.btnBg;
                        }
                      }}
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
        )}

        {/* Info footer */}
        {!loading && (
          <div className="mt-10 p-4 rounded-xl border border-border bg-muted/40 text-xs text-muted-foreground space-y-1.5">
            <div className="font-semibold text-foreground mb-2">Item Effects Guide</div>
            <div>Use items from your Bag to activate effects that boost sprint XP, guarantee rare drops, or enhance crafting.</div>
            <div>Recipe Scrolls from Iron+ chests unlock Alchemy recipes in the Crafting lab.</div>
            <div>Failure Ashes from failed crafting can be refined (×5 → 1 Common pill) using the Refining Furnace.</div>
          </div>
        )}
      </div>

      {/* Open Result Dialog */}
      <Dialog open={!!openResult} onOpenChange={(open) => { if (!open) closeResult(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center text-xl">
              {selectedChest && CHEST_INFO[selectedChest]?.label} Opened!
            </DialogTitle>
            <DialogDescription className="text-center text-sm">
              {openResult && openResult.items.length > 1
                ? `You received ${openResult.items.length} items!`
                : "You received:"}
            </DialogDescription>
          </DialogHeader>

          <div className={`flex gap-3 mt-2 ${openResult && openResult.items.length > 1 ? "flex-row justify-center flex-wrap" : "flex-col items-center"}`}>
            {openResult?.items.map((item, idx) => (
              <div
                key={idx}
                className={`flex flex-col items-center gap-2 p-4 rounded-xl border ${openResult.items.length > 1 ? "flex-1 min-w-[120px]" : "w-full"} ${RARITY_COLORS[item.rarity] ?? "border-border"}`}
              >
                <span className="text-5xl leading-none">{item.icon}</span>
                <div className="text-center">
                  <div className="font-bold text-base text-foreground">{item.name}</div>
                  <Badge className="mt-1 capitalize text-xs">{item.rarity}</Badge>
                </div>
              </div>
            ))}
          </div>

          {/* Coin drop display */}
          {openResult && openResult.coins_awarded > 0 && (
            <div className="mt-3 flex items-center justify-center gap-2 py-2 px-4 rounded-lg bg-yellow-900/20 border border-yellow-500/30">
              <span className="text-xl">🪙</span>
              <span className="text-yellow-300 font-semibold text-sm">
                +{openResult.coins_awarded} Spirit Coins
              </span>
              {openResult.new_coin_balance !== null && (
                <span className="text-yellow-400/50 text-xs ml-1">
                  ({openResult.new_coin_balance.toLocaleString()} total)
                </span>
              )}
            </div>
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
