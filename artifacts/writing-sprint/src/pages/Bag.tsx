import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@clerk/react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Package, Gift, FlaskConical, Sparkles, Flame, Loader2, ShoppingBag, Coins, AlertTriangle, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { CoinBalance } from "@/components/CoinBalance";
import { ItemIcon } from "@/components/ItemIcon";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

const RARITY_BORDER_LEFT: Record<string, string> = {
  common: "border-l-zinc-400",
  uncommon: "border-l-green-500",
  rare: "border-l-blue-500",
  epic: "border-l-purple-500",
  mythic: "border-l-orange-500",
  legendary: "border-l-yellow-500",
};

const RARITY_BADGE: Record<string, string> = {
  common: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
  uncommon: "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-400",
  rare: "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-400",
  epic: "bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-400",
  mythic: "bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-400",
  legendary: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300",
};

const RARITY_DIALOG_BADGE: Record<string, string> = {
  common: "bg-zinc-100 text-zinc-700 border-zinc-200",
  uncommon: "bg-green-50 text-green-700 border-green-200",
  rare: "bg-blue-50 text-blue-700 border-blue-200",
  epic: "bg-purple-50 text-purple-700 border-purple-200",
  mythic: "bg-orange-50 text-orange-700 border-orange-200",
  legendary: "bg-yellow-50 text-yellow-700 border-yellow-200",
};

interface InventoryItem {
  id: number;
  item_id: number;
  quantity: number;
  acquired_at: string;
  overflow_since: string | null;
  name: string;
  description: string;
  category: string;
  rarity: string;
  effect_type: string | null;
  effect_value: number | null;
  effect_duration: number | null;
  icon: string;
  stack_limit: number;
  sell_value: number;
  is_storage_item: boolean;
  storage_slot_count: number | null;
}

function overflowTimeLeft(overflow_since: string): string {
  const expiresAt = new Date(overflow_since).getTime() + 24 * 60 * 60 * 1000;
  const msLeft = expiresAt - Date.now();
  if (msLeft <= 0) return "Expiring soon";
  const h = Math.floor(msLeft / 3_600_000);
  const m = Math.floor((msLeft % 3_600_000) / 60_000);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

interface EquippedStorage {
  id: string;
  user_id: string;
  item_id: number | null;
  slot_count: number;
  item_name: string | null;
  item_icon: string | null;
  item_rarity: string | null;
  items_used: number;
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
  if (!isoDate) return "permanent";
  const d = new Date(isoDate);
  if (d.getFullYear() > new Date().getFullYear() + 10) return "permanent";
  const diff = d.getTime() - Date.now();
  if (diff <= 0) return "expired";
  return formatDuration(diff);
}

export default function Bag() {
  const [, setLocation] = useLocation();
  const { isSignedIn } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [bagData, setBagData] = useState<BagData | null>(null);
  const [equippedStorage, setEquippedStorage] = useState<EquippedStorage | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [usingItem, setUsingItem] = useState(false);
  const [sellingItem, setSellingItem] = useState(false);
  const [equippingItem, setEquippingItem] = useState(false);
  const [activeTab, setActiveTab] = useState<"items" | "effects">("items");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterRarity, setFilterRarity] = useState<string>("all");

  const fetchBag = useCallback(async () => {
    try {
      const [bagRes, storageRes] = await Promise.all([
        fetch(`${basePath}/api/user/bag`, { credentials: "include" }),
        fetch(`${basePath}/api/storage/equipped`, { credentials: "include" }),
      ]);
      if (!bagRes.ok) throw new Error("Failed to load bag");
      const data = await bagRes.json();
      setBagData(data);
      if (storageRes.ok) {
        setEquippedStorage(await storageRes.json());
      }
    } catch {
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
        toast({ title: item.name, description: data.message });
        setSelectedItem(null);
        fetchBag();
      }
    } catch {
      toast({ title: "Error", description: "Failed to use item", variant: "destructive" });
    } finally {
      setUsingItem(false);
    }
  };

  const sellItem = async (item: InventoryItem) => {
    setSellingItem(true);
    try {
      const res = await fetch(`${basePath}/api/coins/sell`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inventory_id: item.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Cannot sell item", description: data.error, variant: "destructive" });
      } else {
        toast({
          title: `${item.name} sold`,
          description: `+${data.coins_earned} 🪙 Spirit Coins. New balance: ${data.new_balance}`,
        });
        setSelectedItem(null);
        fetchBag();
        queryClient.invalidateQueries({ queryKey: ["coinBalance"] });
      }
    } catch {
      toast({ title: "Error", description: "Failed to sell item", variant: "destructive" });
    } finally {
      setSellingItem(false);
    }
  };

  const equipStorageItem = async (item: InventoryItem) => {
    setEquippingItem(true);
    try {
      const res = await fetch(`${basePath}/api/storage/equip`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inventory_id: item.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Cannot equip item", description: data.error, variant: "destructive" });
      } else {
        toast({
          title: `${item.name} equipped`,
          description: `Your bag now holds ${data.new_slot_count} items.${data.previously_equipped_item ? ` ${data.previously_equipped_item.name} returned to bag.` : ""}`,
        });
        setSelectedItem(null);
        fetchBag();
      }
    } catch {
      toast({ title: "Error", description: "Failed to equip item", variant: "destructive" });
    } finally {
      setEquippingItem(false);
    }
  };

  const unequipStorage = async () => {
    try {
      const res = await fetch(`${basePath}/api/storage/unequip`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Cannot unequip", description: data.error, variant: "destructive" });
      } else {
        toast({ title: "Storage unequipped", description: `${data.returned_item?.name ?? "Item"} returned to bag. Bag reset to 20 slots.` });
        fetchBag();
      }
    } catch {
      toast({ title: "Error", description: "Failed to unequip storage", variant: "destructive" });
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
    } catch {
      toast({ title: "Error", description: "Failed to discard item", variant: "destructive" });
    }
  };

  const categories = bagData
    ? ["all", ...Array.from(new Set(bagData.inventory.map(i => i.category))).sort()]
    : ["all"];

  const rarities = ["all", "common", "uncommon", "rare", "epic", "mythic", "legendary"];

  const filteredItems = bagData?.inventory.filter(item => {
    const catOk = filterCategory === "all" || item.category === filterCategory;
    const rarOk = filterRarity === "all" || item.rarity === filterRarity;
    return catOk && rarOk;
  }) ?? [];

  const overflowItems = bagData?.inventory.filter(i => i.overflow_since) ?? [];

  const usedSlots = bagData?.inventory.length ?? 0;
  const totalSlots = bagData?.totalSlots ?? 20;
  const slotPct = Math.min(100, (usedSlots / totalSlots) * 100);

  return (
    <div className="min-h-screen bg-background">

      {/* Sticky header */}
      <div className="border-b border-border bg-card sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
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
            <Package className="w-4 h-4 text-primary/70" />
            <h1 className="font-semibold text-base text-foreground">Bag</h1>
          </div>

          {bagData && (
            <div className="ml-auto flex items-center gap-2">
              <span className="text-xs text-muted-foreground font-mono hidden sm:block">
                {usedSlots} / {totalSlots} slots
              </span>
              <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden hidden sm:block">
                <div
                  className={`h-full rounded-full transition-all ${
                    slotPct > 90 ? "bg-red-500" : slotPct > 70 ? "bg-orange-400" : "bg-primary"
                  }`}
                  style={{ width: `${slotPct}%` }}
                />
              </div>
            </div>
          )}

          <div className="flex items-center gap-1.5 ml-2">
            <CoinBalance />
            <Button variant="outline" size="sm" onClick={() => setLocation("/shop")} className="h-8 gap-1.5 text-xs">
              <ShoppingBag className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Shop</span>
            </Button>
            <Button variant="outline" size="sm" onClick={() => setLocation("/chests")} className="h-8 gap-1.5 text-xs">
              <Gift className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Chests</span>
            </Button>
            <Button variant="outline" size="sm" onClick={() => setLocation("/crafting")} className="h-8 gap-1.5 text-xs">
              <FlaskConical className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Crafting</span>
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <div className="max-w-6xl mx-auto px-4 flex items-center border-t border-border/50">
          {(["items", "effects"] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab === "items"
                ? `Items${bagData ? ` (${bagData.inventory.length})` : ""}`
                : `Active Effects${bagData ? ` (${bagData.activeEffects.length})` : ""}`}
            </button>
          ))}
          {bagData && bagData.failureAshes > 0 && (
            <div className="ml-auto flex items-center gap-1.5 px-4 text-xs text-orange-500">
              <Flame className="w-3 h-3" />
              {bagData.failureAshes} Failure {bagData.failureAshes !== 1 ? "Ashes" : "Ash"}
            </div>
          )}
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6">

        {loading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* ── Items tab ─────────────────────────────────────────────────── */}
        {!loading && activeTab === "items" && (
          <>
            {/* Equipped Storage */}
            {equippedStorage && (
              <div className="mb-5 flex items-center gap-3 rounded-xl border border-border bg-muted/30 px-4 py-3">
                <ItemIcon name={equippedStorage.item_name ?? ""} size={32} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">
                    {equippedStorage.item_name ?? "Cloth Bag"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {equippedStorage.items_used} / {equippedStorage.slot_count} slots used
                    {equippedStorage.item_rarity && (
                      <span className="ml-1 capitalize text-muted-foreground/70">· {equippedStorage.item_rarity}</span>
                    )}
                  </p>
                </div>
                {equippedStorage.item_id && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs text-muted-foreground h-7"
                    onClick={() => {
                      if (confirm("Unequip storage item? Your bag will revert to 20 slots.")) {
                        unequipStorage();
                      }
                    }}
                  >
                    Unequip
                  </Button>
                )}
                {!equippedStorage.item_id && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs text-primary h-7"
                    onClick={() => setLocation("/shop")}
                  >
                    Get more slots →
                  </Button>
                )}
              </div>
            )}

            {/* Overflow warning banner */}
            {overflowItems.length > 0 && (
              <div className="mb-4 flex items-start gap-3 rounded-xl border border-red-500/60 bg-red-50 dark:bg-red-950/30 px-4 py-3">
                <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-red-700 dark:text-red-400">
                    Bag over capacity — {overflowItems.length} item{overflowItems.length > 1 ? "s" : ""} will be deleted
                  </p>
                  <p className="text-xs text-red-600/80 dark:text-red-400/70 mt-0.5">
                    Your lowest-rarity overflow items (shown in red) will be permanently deleted 24 hours after they entered overflow. Use, equip a storage ring, or free up slots to save them.
                  </p>
                </div>
              </div>
            )}

            {/* Category filter */}
            <div className="space-y-2 mb-5">
              <div className="flex flex-wrap gap-1.5">
                {categories.map(cat => {
                  const count = cat === "all"
                    ? (bagData?.inventory.length ?? 0)
                    : (bagData?.inventory.filter(i => i.category === cat).length ?? 0);
                  return (
                    <button
                      key={cat}
                      onClick={() => { setFilterCategory(cat); setFilterRarity("all"); }}
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-colors capitalize ${
                        filterCategory === cat
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80"
                      }`}
                    >
                      {cat === "all" ? "All items" : cat}
                      <span className={`text-[10px] font-bold tabular-nums ${filterCategory === cat ? "opacity-70" : "opacity-50"}`}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Rarity filter */}
              <div className="flex flex-wrap gap-1">
                {rarities.map(rar => (
                  <button
                    key={rar}
                    onClick={() => setFilterRarity(rar)}
                    className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium capitalize transition-colors ${
                      filterRarity === rar
                        ? "bg-foreground text-background"
                        : "bg-muted/60 text-muted-foreground hover:text-foreground"
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
                <Package className="w-12 h-12 text-muted-foreground/20" />
                <p className="text-muted-foreground text-sm text-center">
                  {bagData?.inventory.length === 0
                    ? "Your bag is empty. Complete sprints to earn chests!"
                    : "No items match these filters."}
                </p>
                {bagData?.inventory.length === 0 && (
                  <Button variant="outline" size="sm" onClick={() => setLocation("/chests")}>
                    Open Chests
                  </Button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {filteredItems.map(item => {
                  const cooldownEnd = bagData?.cooldowns[item.item_id];
                  const onCooldown = !!(cooldownEnd && new Date(cooldownEnd) > new Date());
                  return (
                    <Tooltip key={item.id}>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => setSelectedItem(item)}
                          className={`relative flex flex-col items-center gap-1.5 p-3 rounded-xl border border-l-4 transition-all hover:scale-[1.03] hover:shadow-sm text-center ${
                            item.overflow_since
                              ? "bg-red-50 dark:bg-red-950/30 border-red-500 border-l-red-500"
                              : `bg-card ${RARITY_BORDER_LEFT[item.rarity] ?? "border-l-border"}`
                          }`}
                        >
                          <ItemIcon name={item.name} size={36} />
                          <span className={`text-xs font-medium leading-tight line-clamp-2 ${item.overflow_since ? "text-red-700 dark:text-red-400" : "text-foreground"}`}>
                            {item.name}
                          </span>
                          {item.quantity > 1 && (
                            <span className="absolute top-1.5 right-1.5 text-[10px] bg-foreground/10 text-foreground px-1.5 py-0.5 rounded-full font-bold">
                              ×{item.quantity}
                            </span>
                          )}
                          {onCooldown && !item.overflow_since && (
                            <span className="absolute inset-0 flex items-center justify-center rounded-xl bg-background/85 text-xs text-muted-foreground font-mono">
                              {formatDuration(new Date(cooldownEnd!).getTime() - Date.now())}
                            </span>
                          )}
                          {item.overflow_since ? (
                            <span className="flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full font-semibold bg-red-500 text-white">
                              <Trash2 className="w-2.5 h-2.5" />
                              {overflowTimeLeft(item.overflow_since)}
                            </span>
                          ) : (
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold capitalize ${RARITY_BADGE[item.rarity] ?? "bg-muted text-muted-foreground"}`}>
                              {item.rarity}
                            </span>
                          )}
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-xs">
                        <div className="font-semibold mb-1">{item.name}</div>
                        <div className="text-xs text-foreground/80">{item.description}</div>
                        {item.overflow_since && (
                          <div className="text-xs text-red-500 font-semibold mt-1.5 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            Overflow — deletes in {overflowTimeLeft(item.overflow_since)}
                          </div>
                        )}
                        <div className="text-xs text-muted-foreground/60 mt-1 capitalize">{item.category}</div>
                      </TooltipContent>
                    </Tooltip>
                  );
                })}

                {/* Empty slot placeholders */}
                {Array.from({ length: Math.max(0, Math.min(10, totalSlots - filteredItems.length)) }).map((_, i) => (
                  <div
                    key={`empty-${i}`}
                    className="flex items-center justify-center h-24 rounded-xl border border-dashed border-border text-muted-foreground/25 text-xs"
                  >
                    empty
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── Active Effects tab ─────────────────────────────────────────── */}
        {!loading && activeTab === "effects" && (
          <div>
            {bagData?.activeEffects.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <Sparkles className="w-12 h-12 text-muted-foreground/20" />
                <p className="text-muted-foreground text-sm text-center">
                  No active effects.<br />Use items from your bag to activate them.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {bagData?.activeEffects.map(eff => {
                  let meta: Record<string, unknown> = {};
                  try { meta = JSON.parse(eff.metadata ?? "{}"); } catch { /* ignore */ }
                  return (
                    <Card key={eff.id} className={`border-l-4 ${RARITY_BORDER_LEFT[eff.rarity] ?? ""}`}>
                      <CardContent className="pt-4 pb-4 px-4 flex gap-3">
                        <ItemIcon name={eff.item_name} size={30} />
                        <div className="min-w-0">
                          <div className="font-semibold text-sm leading-tight text-foreground">{eff.item_name}</div>
                          <div className="text-xs text-muted-foreground capitalize mt-0.5">
                            {eff.effect_type.replace(/_/g, " ")}
                            {eff.effect_value ? ` · ${eff.effect_value}` : ""}
                          </div>
                          {meta.sprints_remaining && (
                            <div className="text-xs text-primary mt-1">
                              {String(meta.sprints_remaining)} sprint{Number(meta.sprints_remaining) !== 1 ? "s" : ""} remaining
                            </div>
                          )}
                          <div className="text-xs text-muted-foreground/60 mt-1">
                            {eff.expires_at
                              ? (new Date(eff.expires_at).getFullYear() > new Date().getFullYear() + 10
                                ? "Permanent"
                                : `Expires in ${formatExpiry(eff.expires_at)}`)
                              : "Permanent"}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Item Detail Dialog */}
      <Dialog open={!!selectedItem} onOpenChange={(open) => !open && setSelectedItem(null)}>
        <DialogContent className="max-w-sm">
          {selectedItem && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2.5 text-lg">
                  <ItemIcon name={selectedItem.name} size={40} />
                  {selectedItem.name}
                </DialogTitle>
                <DialogDescription asChild>
                  <div>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge className={`capitalize text-xs ${RARITY_DIALOG_BADGE[selectedItem.rarity] ?? ""}`}>
                        {selectedItem.rarity}
                      </Badge>
                      {selectedItem.quantity > 1 && (
                        <Badge variant="outline" className="text-xs">
                          ×{selectedItem.quantity}
                        </Badge>
                      )}
                      <span className="text-xs text-muted-foreground capitalize">{selectedItem.category}</span>
                    </div>
                    <p className="text-sm text-foreground mt-3 leading-relaxed">{selectedItem.description}</p>
                    {selectedItem.overflow_since && (
                      <div className="mt-3 flex items-start gap-2 rounded-lg border border-red-400/60 bg-red-50 dark:bg-red-950/40 px-3 py-2">
                        <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" />
                        <p className="text-xs text-red-700 dark:text-red-400 font-medium">
                          Bag overflow — this item will be permanently deleted in <strong>{overflowTimeLeft(selectedItem.overflow_since)}</strong> unless you use it or free up bag space.
                        </p>
                      </div>
                    )}
                    {selectedItem.effect_value && (
                      <div className="text-xs text-primary/80 mt-2 font-medium">
                        Effect: {selectedItem.effect_value}
                        {selectedItem.effect_duration
                          ? ` · ${selectedItem.effect_duration >= 1440 ? `${Math.round(selectedItem.effect_duration / 1440)}d` : `${Math.round(selectedItem.effect_duration / 60)}h`}`
                          : ""}
                      </div>
                    )}
                  </div>
                </DialogDescription>
              </DialogHeader>
              {/* Sell value info */}
              {selectedItem.sell_value > 0 && (
                <div className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">
                  🪙 Sell value: {selectedItem.sell_value} Spirit Coin{selectedItem.sell_value !== 1 ? "s" : ""}
                </div>
              )}
              {selectedItem.is_storage_item && selectedItem.storage_slot_count && (
                <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                  💾 Adds {selectedItem.storage_slot_count} extra bag slots when equipped (total: {20 + selectedItem.storage_slot_count})
                </div>
              )}

              <div className="flex flex-col gap-2 mt-3">
                {/* Storage equip or use */}
                {selectedItem.is_storage_item ? (
                  <Button
                    className="w-full"
                    disabled={equippingItem}
                    onClick={() => equipStorageItem(selectedItem)}
                  >
                    {equippingItem ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Equipping…</> : "Equip as Storage"}
                  </Button>
                ) : (
                  <Button
                    className="flex-1"
                    disabled={usingItem}
                    onClick={() => useItem(selectedItem)}
                  >
                    {usingItem ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Using…</> : "Use Item"}
                  </Button>
                )}
                {/* Sell + Discard row */}
                <div className="flex gap-2">
                  {selectedItem.sell_value > 0 && (
                    <Button
                      variant="outline"
                      className="flex-1 gap-1.5 text-yellow-600 dark:text-yellow-400 border-yellow-300 dark:border-yellow-700 hover:bg-yellow-50 dark:hover:bg-yellow-900/20"
                      disabled={sellingItem}
                      onClick={() => {
                        if (confirm(`Sell ${selectedItem.name} for 🪙 ${selectedItem.sell_value} Spirit Coin${selectedItem.sell_value !== 1 ? "s" : ""}?`)) {
                          sellItem(selectedItem);
                        }
                      }}
                    >
                      {sellingItem ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                      Sell 🪙{selectedItem.sell_value}
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    className="flex-1 text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => {
                      if (confirm(`Discard ${selectedItem.name}? This cannot be undone.`)) {
                        discardItem(selectedItem);
                      }
                    }}
                  >
                    Discard
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
