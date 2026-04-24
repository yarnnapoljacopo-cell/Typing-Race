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
import { ChestIcon } from "@/components/ChestIcon";

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
    setSelectedChest(chestType);
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
        return;
      }
      await new Promise(r => setTimeout(r, 700));
      setOpenResult({
        items: data.items as ChestItem[],
        coins_awarded: data.coins_awarded ?? 0,
        new_coin_balance: data.new_coin_balance ?? null,
      });
      fetchChests();
      void queryClient.invalidateQueries({ queryKey: ["coinBalance"] });
    } catch {
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
