import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@clerk/react";
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

const RARITY_COLORS: Record<string, string> = {
  common: "border-gray-400 bg-gray-900/40 text-gray-300",
  uncommon: "border-green-500 bg-green-900/30 text-green-300",
  rare: "border-blue-400 bg-blue-900/30 text-blue-300",
  epic: "border-purple-400 bg-purple-900/30 text-purple-300",
  mythic: "border-orange-400 bg-orange-900/30 text-orange-300",
  legendary: "border-yellow-400 bg-yellow-900/20 text-yellow-300",
};

const RARITY_BADGE: Record<string, string> = {
  common: "bg-gray-700 text-gray-300",
  uncommon: "bg-green-800 text-green-200",
  rare: "bg-blue-800 text-blue-200",
  epic: "bg-purple-800 text-purple-200",
  mythic: "bg-orange-800 text-orange-200",
  legendary: "bg-yellow-700 text-yellow-100",
};

const RARITY_GLOW: Record<string, string> = {
  legendary: "shadow-yellow-500/40 shadow-lg",
  mythic: "shadow-orange-500/30 shadow-md",
  epic: "shadow-purple-500/20 shadow-sm",
  rare: "",
  uncommon: "",
  common: "",
};

interface InventoryItem {
  id: number;
  item_id: number;
  quantity: number;
  acquired_at: string;
  name: string;
  description: string;
  category: string;
  rarity: string;
  effect_type: string | null;
  effect_value: number | null;
  effect_duration: number | null;
  icon: string;
  stack_limit: number;
}

interface ActiveEffect {
  id: number;
  item_name: string;
  icon: string;
  rarity: string;
  effect_type: string;
  effect_value: number;
  expires_at: string | null;
  metadata: string | null;
}

interface BagData {
  inventory: InventoryItem[];
  activeEffects: ActiveEffect[];
  totalSlots: number;
  failureAshes: number;
  cooldowns: Record<number, string>;
}

function formatDuration(ms: number): string {
  const m = Math.floor(ms / 60_000);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem > 0 ? `${h}h ${rem}m` : `${h}h`;
}

function formatExpiry(isoDate: string | null): string {
  if (!isoDate) return "∞";
  const d = new Date(isoDate);
  if (d.getFullYear() > new Date().getFullYear() + 10) return "∞";
  const diff = d.getTime() - Date.now();
  if (diff <= 0) return "expired";
  return formatDuration(diff);
}

export default function Bag() {
  const [, setLocation] = useLocation();
  const { isSignedIn } = useAuth();
  const { toast } = useToast();

  const [bagData, setBagData] = useState<BagData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [usingItem, setUsingItem] = useState(false);
  const [activeTab, setActiveTab] = useState<"items" | "effects">("items");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterRarity, setFilterRarity] = useState<string>("all");

  const fetchBag = useCallback(async () => {
    try {
      const res = await fetch(`${basePath}/api/user/bag`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load bag");
      const data = await res.json();
      setBagData(data);
    } catch (e) {
      toast({ title: "Error", description: "Failed to load bag", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isSignedIn) {
      setLocation("/portal");
      return;
    }
    fetchBag();
  }, [isSignedIn]);

  const useItem = async (item: InventoryItem) => {
    setUsingItem(true);
    try {
      const res = await fetch(`${basePath}/api/user/bag/use`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inventoryId: item.id }),
      });
      const data = await res.json();
      if (!res.ok || data.ok === false) {
        toast({ title: "Cannot use item", description: data.message ?? data.error, variant: "destructive" });
      } else {
        toast({ title: `✨ ${item.name}`, description: data.message });
        setSelectedItem(null);
        fetchBag();
      }
    } catch (e) {
      toast({ title: "Error", description: "Failed to use item", variant: "destructive" });
    } finally {
      setUsingItem(false);
    }
  };

  const discardItem = async (item: InventoryItem) => {
    try {
      const res = await fetch(`${basePath}/api/user/bag/discard`, {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inventoryId: item.id }),
      });
      if (!res.ok) throw new Error("Failed to discard");
      toast({ title: "Item discarded", description: `${item.name} removed from bag.` });
      setSelectedItem(null);
      fetchBag();
    } catch (e) {
      toast({ title: "Error", description: "Failed to discard item", variant: "destructive" });
    }
  };

  const categories = bagData
    ? ["all", ...new Set(bagData.inventory.map(i => i.category))]
    : ["all"];

  const rarities = ["all", "common", "uncommon", "rare", "epic", "mythic", "legendary"];

  const filteredItems = bagData?.inventory.filter(item => {
    const catOk = filterCategory === "all" || item.category === filterCategory;
    const rarOk = filterRarity === "all" || item.rarity === filterRarity;
    return catOk && rarOk;
  }) ?? [];

  const usedSlots = bagData?.inventory.length ?? 0;
  const totalSlots = bagData?.totalSlots ?? 20;
  const slotPct = Math.min(100, (usedSlots / totalSlots) * 100);

  return (
    <div className="min-h-screen bg-[#0F1117] text-white">
      {/* Header */}
      <div className="border-b border-white/10 bg-[#15181F] sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => setLocation("/portal")}
            className="text-white/60 hover:text-white transition-colors text-sm flex items-center gap-1"
          >
            ← Portal
          </button>
          <div className="w-px h-4 bg-white/20" />
          <h1 className="font-bold text-lg">🎒 Cultivation Bag</h1>

          {/* Slot meter */}
          <div className="ml-auto flex items-center gap-2">
            {bagData && (
              <>
                <span className="text-xs text-white/50">
                  {usedSlots} / {totalSlots} slots
                </span>
                <div className="w-24 h-2 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      slotPct > 90 ? "bg-red-500" : slotPct > 70 ? "bg-orange-500" : "bg-emerald-500"
                    }`}
                    style={{ width: `${slotPct}%` }}
                  />
                </div>
              </>
            )}
            <button
              onClick={() => setLocation("/chests")}
              className="ml-2 text-sm bg-amber-600 hover:bg-amber-500 px-3 py-1 rounded-lg font-medium transition-colors"
            >
              🎁 Chests
            </button>
            <button
              onClick={() => setLocation("/crafting")}
              className="text-sm bg-indigo-700 hover:bg-indigo-600 px-3 py-1 rounded-lg font-medium transition-colors"
            >
              ⚗️ Crafting
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="max-w-6xl mx-auto px-4 pb-0 flex gap-0 border-t border-white/5">
          {(["items", "effects"] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-5 py-2 text-sm font-medium border-b-2 transition-colors capitalize ${
                activeTab === tab
                  ? "border-indigo-400 text-indigo-300"
                  : "border-transparent text-white/50 hover:text-white/80"
              }`}
            >
              {tab === "items" ? `Items (${bagData?.inventory.length ?? 0})` : `Active Effects (${bagData?.activeEffects.length ?? 0})`}
            </button>
          ))}
          {bagData && bagData.failureAshes > 0 && (
            <div className="ml-auto flex items-center gap-1 px-4 text-xs text-orange-400/80">
              🔥 {bagData.failureAshes} Failure Ash{bagData.failureAshes !== 1 ? "es" : ""}
            </div>
          )}
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6">
        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="text-white/40 text-sm">Loading bag…</div>
          </div>
        )}

        {!loading && activeTab === "items" && (
          <>
            {/* Filters */}
            <div className="flex flex-wrap gap-2 mb-4">
              <div className="flex gap-1">
                {categories.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setFilterCategory(cat)}
                    className={`px-3 py-1 rounded-full text-xs font-medium capitalize transition-colors ${
                      filterCategory === cat
                        ? "bg-indigo-600 text-white"
                        : "bg-white/5 text-white/50 hover:bg-white/10"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
              <div className="flex gap-1 ml-auto">
                {rarities.map(rar => (
                  <button
                    key={rar}
                    onClick={() => setFilterRarity(rar)}
                    className={`px-3 py-1 rounded-full text-xs font-medium capitalize transition-colors ${
                      filterRarity === rar
                        ? "bg-indigo-600 text-white"
                        : "bg-white/5 text-white/50 hover:bg-white/10"
                    }`}
                  >
                    {rar}
                  </button>
                ))}
              </div>
            </div>

            {/* Item grid */}
            {filteredItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <div className="text-5xl opacity-30">🎒</div>
                <p className="text-white/40 text-sm">
                  {bagData?.inventory.length === 0
                    ? "Your bag is empty. Complete sprints to earn chests!"
                    : "No items match these filters."}
                </p>
                <button
                  onClick={() => setLocation("/chests")}
                  className="text-sm text-amber-400 hover:text-amber-300 transition-colors"
                >
                  Open Chests →
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {filteredItems.map(item => {
                  const cooldownEnd = bagData?.cooldowns[item.item_id];
                  const onCooldown = cooldownEnd && new Date(cooldownEnd) > new Date();
                  return (
                    <Tooltip key={item.id}>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => setSelectedItem(item)}
                          className={`relative flex flex-col items-center gap-1 p-3 rounded-xl border transition-all hover:scale-105 text-center ${
                            RARITY_COLORS[item.rarity] ?? "border-white/20 bg-white/5"
                          } ${RARITY_GLOW[item.rarity] ?? ""}`}
                        >
                          <span className="text-3xl">{item.icon}</span>
                          <span className="text-xs font-medium leading-tight line-clamp-2">{item.name}</span>
                          {item.quantity > 1 && (
                            <span className="absolute top-1.5 right-1.5 text-[10px] bg-black/60 px-1.5 py-0.5 rounded-full font-bold">
                              ×{item.quantity}
                            </span>
                          )}
                          {onCooldown && (
                            <span className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/60 text-xs text-white/70 font-mono">
                              ⏱ {formatDuration(new Date(cooldownEnd!).getTime() - Date.now())}
                            </span>
                          )}
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold capitalize ${RARITY_BADGE[item.rarity] ?? "bg-white/10"}`}>
                            {item.rarity}
                          </span>
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-xs bg-gray-900 border-white/20 text-white">
                        <div className="font-semibold mb-1">{item.name}</div>
                        <div className="text-xs text-white/70">{item.description}</div>
                        <div className="text-xs text-white/40 mt-1 capitalize">{item.category}</div>
                      </TooltipContent>
                    </Tooltip>
                  );
                })}

                {/* Empty slot placeholders */}
                {Array.from({ length: Math.max(0, Math.min(10, totalSlots - filteredItems.length)) }).map((_, i) => (
                  <div
                    key={`empty-${i}`}
                    className="flex items-center justify-center h-24 rounded-xl border border-dashed border-white/10 bg-white/2"
                  >
                    <span className="text-white/15 text-xs">empty</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {!loading && activeTab === "effects" && (
          <div>
            {bagData?.activeEffects.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <div className="text-4xl opacity-30">✨</div>
                <p className="text-white/40 text-sm">No active effects. Use items from your bag to activate effects!</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {bagData?.activeEffects.map(eff => {
                  let meta: Record<string, unknown> = {};
                  try { meta = JSON.parse(eff.metadata ?? "{}"); } catch { /* ignore */ }
                  return (
                    <div
                      key={eff.id}
                      className={`flex gap-3 p-4 rounded-xl border ${RARITY_COLORS[eff.rarity] ?? "border-white/20 bg-white/5"}`}
                    >
                      <span className="text-3xl shrink-0 mt-0.5">{eff.icon}</span>
                      <div className="min-w-0">
                        <div className="font-semibold text-sm leading-tight">{eff.item_name}</div>
                        <div className="text-xs text-white/50 capitalize mt-0.5">
                          {eff.effect_type.replace(/_/g, " ")}
                          {eff.effect_value ? ` · ${eff.effect_value}` : ""}
                        </div>
                        {meta.sprints_remaining && (
                          <div className="text-xs text-indigo-400 mt-1">
                            {String(meta.sprints_remaining)} sprint{Number(meta.sprints_remaining) !== 1 ? "s" : ""} remaining
                          </div>
                        )}
                        <div className="text-xs text-white/40 mt-1">
                          {eff.expires_at
                            ? (new Date(eff.expires_at).getFullYear() > new Date().getFullYear() + 10
                              ? "∞ permanent"
                              : `Expires in ${formatExpiry(eff.expires_at)}`)
                            : "∞ permanent"}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Back button */}
        {!loading && (
          <div className="mt-10 pt-6 border-t border-white/10 flex justify-center">
            <button
              onClick={() => setLocation("/portal")}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 hover:text-white transition-all text-sm font-medium"
            >
              ← Back to Portal
            </button>
          </div>
        )}
      </div>

      {/* Item Detail Dialog */}
      <Dialog open={!!selectedItem} onOpenChange={(open) => !open && setSelectedItem(null)}>
        <DialogContent className="bg-[#1A1D26] border-white/10 text-white max-w-sm">
          {selectedItem && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-xl">
                  <span className="text-3xl">{selectedItem.icon}</span>
                  {selectedItem.name}
                </DialogTitle>
                <DialogDescription asChild>
                  <div>
                    <Badge className={`mb-3 capitalize ${RARITY_BADGE[selectedItem.rarity] ?? ""}`}>
                      {selectedItem.rarity}
                    </Badge>
                    {selectedItem.quantity > 1 && (
                      <Badge variant="outline" className="ml-2 border-white/20 text-white/70">
                        ×{selectedItem.quantity}
                      </Badge>
                    )}
                    <p className="text-sm text-white/80 mt-2">{selectedItem.description}</p>
                    <div className="text-xs text-white/40 mt-2 capitalize">
                      Category: {selectedItem.category}
                    </div>
                    {selectedItem.effect_value && (
                      <div className="text-xs text-indigo-300 mt-1">
                        Effect value: {selectedItem.effect_value}
                        {selectedItem.effect_duration ? ` · Duration: ${selectedItem.effect_duration >= 1440 ? `${Math.round(selectedItem.effect_duration / 1440)}d` : `${Math.round(selectedItem.effect_duration / 60)}h`}` : ""}
                      </div>
                    )}
                  </div>
                </DialogDescription>
              </DialogHeader>
              <div className="flex gap-2 mt-2">
                <Button
                  className="flex-1 bg-indigo-600 hover:bg-indigo-500"
                  disabled={usingItem}
                  onClick={() => useItem(selectedItem)}
                >
                  {usingItem ? "Using…" : "Use Item"}
                </Button>
                <Button
                  variant="outline"
                  className="border-red-800 text-red-400 hover:bg-red-900/30"
                  onClick={() => {
                    if (confirm(`Discard ${selectedItem.name}? This cannot be undone.`)) {
                      discardItem(selectedItem);
                    }
                  }}
                >
                  Discard
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
