import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@clerk/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ShoppingBag, Loader2, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

interface ShopListing {
  id: number;
  name: string;
  description: string;
  item_type: string;
  quantity: number;
  price: number;
  icon: string;
}

interface ShopData {
  balance: number;
  listings: ShopListing[];
}

interface CoinData {
  balance: number;
  daily_coins_earned: number;
  daily_cap: number;
  resets_at: string;
  last_20_transactions: Array<{
    id: string;
    amount: number;
    transaction_type: string;
    description: string;
    created_at: string;
  }>;
}

async function fetchShop(): Promise<ShopData> {
  const res = await fetch(`${basePath}/api/shop`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to load shop");
  return res.json();
}

async function fetchCoins(): Promise<CoinData> {
  const res = await fetch(`${basePath}/api/coins`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to load coins");
  return res.json();
}

async function buyListing(listingId: number): Promise<{ new_balance: number; chest_type: string; quantity_added: number }> {
  const res = await fetch(`${basePath}/api/shop/buy`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ listing_id: listingId }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error ?? "Purchase failed");
  }
  return res.json();
}

const ITEM_TYPE_LABELS: Record<string, string> = {
  mortal_chest: "Mortal Chest",
  iron_chest: "Iron Chest",
  crystal_chest: "Crystal Chest",
  inferno_chest: "Inferno Chest",
  immortal_chest: "Immortal Chest",
};

interface ChestStyle {
  card: string;
  badge: string;
  badgeText: string;
  glow: string;
  iconRing: string;
  priceText: string;
  buyBtn: string;
  label: string;
  stars: number;
}

const CHEST_STYLES: Record<string, ChestStyle> = {
  mortal_chest: {
    card: "bg-gradient-to-br from-stone-50 to-zinc-100 dark:from-zinc-800/60 dark:to-zinc-900/80 border-zinc-200 dark:border-zinc-700",
    badge: "bg-zinc-200/80 dark:bg-zinc-700/80 text-zinc-600 dark:text-zinc-300",
    badgeText: "Common",
    glow: "",
    iconRing: "bg-zinc-200/70 dark:bg-zinc-700/60",
    priceText: "text-zinc-600 dark:text-zinc-300",
    buyBtn: "bg-zinc-600 hover:bg-zinc-700 text-white dark:bg-zinc-500 dark:hover:bg-zinc-400",
    label: "Mortal",
    stars: 1,
  },
  iron_chest: {
    card: "bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800/60 dark:to-slate-900/80 border-slate-300 dark:border-slate-600",
    badge: "bg-slate-200/80 dark:bg-slate-700/80 text-slate-600 dark:text-slate-300",
    badgeText: "Uncommon",
    glow: "",
    iconRing: "bg-slate-200/70 dark:bg-slate-700/60",
    priceText: "text-slate-600 dark:text-slate-300",
    buyBtn: "bg-slate-500 hover:bg-slate-600 text-white",
    label: "Iron",
    stars: 2,
  },
  crystal_chest: {
    card: "bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/30 dark:to-cyan-900/30 border-blue-300 dark:border-blue-600",
    badge: "bg-blue-100 dark:bg-blue-800/60 text-blue-700 dark:text-blue-300",
    badgeText: "Rare",
    glow: "shadow-blue-200/60 dark:shadow-blue-900/40",
    iconRing: "bg-blue-100/80 dark:bg-blue-800/50",
    priceText: "text-blue-700 dark:text-blue-300",
    buyBtn: "bg-blue-600 hover:bg-blue-700 text-white",
    label: "Crystal",
    stars: 3,
  },
  inferno_chest: {
    card: "bg-gradient-to-br from-orange-50 to-red-50 dark:from-orange-900/30 dark:to-red-900/30 border-orange-400 dark:border-orange-600",
    badge: "bg-orange-100 dark:bg-orange-800/60 text-orange-700 dark:text-orange-300",
    badgeText: "Epic",
    glow: "shadow-orange-200/70 dark:shadow-orange-900/50",
    iconRing: "bg-orange-100/80 dark:bg-orange-800/50",
    priceText: "text-orange-700 dark:text-orange-300",
    buyBtn: "bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white",
    label: "Inferno",
    stars: 4,
  },
  immortal_chest: {
    card: "bg-gradient-to-br from-yellow-50 via-amber-50 to-yellow-100 dark:from-yellow-900/30 dark:via-amber-900/30 dark:to-yellow-900/30 border-yellow-400 dark:border-yellow-600",
    badge: "bg-yellow-100 dark:bg-yellow-800/60 text-yellow-800 dark:text-yellow-300",
    badgeText: "Mythic",
    glow: "shadow-yellow-300/60 dark:shadow-yellow-900/50",
    iconRing: "bg-yellow-100/80 dark:bg-yellow-800/50",
    priceText: "text-yellow-700 dark:text-yellow-400",
    buyBtn: "bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-600 hover:to-amber-600 text-white font-bold",
    label: "Immortal",
    stars: 5,
  },
};

export default function Shop() {
  const [, setLocation] = useLocation();
  const { isSignedIn } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [confirmListing, setConfirmListing] = useState<ShopListing | null>(null);

  const { data: shopData, isLoading, error } = useQuery<ShopData>({
    queryKey: ["shop"],
    queryFn: fetchShop,
    enabled: !!isSignedIn,
    staleTime: 30_000,
  });

  const { data: coinData } = useQuery<CoinData>({
    queryKey: ["coinHistory"],
    queryFn: fetchCoins,
    enabled: !!isSignedIn,
    staleTime: 30_000,
  });

  const buyMutation = useMutation({
    mutationFn: (listingId: number) => buyListing(listingId),
    onSuccess: (data, listingId) => {
      const listing = shopData?.listings.find(l => l.id === listingId);
      toast({
        title: "Purchase successful!",
        description: `${listing?.name ?? "Item"} added to your chests. New balance: 🪙 ${data.new_balance}`,
      });
      setConfirmListing(null);
      queryClient.invalidateQueries({ queryKey: ["shop"] });
      queryClient.invalidateQueries({ queryKey: ["coinBalance"] });
      queryClient.invalidateQueries({ queryKey: ["coinHistory"] });
      queryClient.invalidateQueries({ queryKey: ["userChests"] });
    },
    onError: (err: Error) => {
      toast({ title: "Purchase failed", description: err.message, variant: "destructive" });
    },
  });

  if (!isSignedIn) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Please sign in to access the shop.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/portal")} className="shrink-0">
            <ArrowLeft size={18} />
          </Button>
          <div className="flex items-center gap-2 flex-1">
            <ShoppingBag size={18} className="text-primary" />
            <h1 className="font-bold text-lg">Spirit Coin Shop</h1>
          </div>
          {shopData && (
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 font-bold text-sm">
              🪙 {shopData.balance.toLocaleString()}
            </span>
          )}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Daily cap info */}
        {coinData && (
          <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/50 p-3 text-sm text-muted-foreground">
            <Info size={15} className="mt-0.5 shrink-0" />
            <span>
              You've earned <strong className="text-foreground">{coinData.daily_coins_earned}</strong>/{coinData.daily_cap} coins today from chests and item sales.
              Shop purchases are unlimited and don't count toward the cap.
              Daily cap resets at midnight UTC.
            </span>
          </div>
        )}

        {/* Listings */}
        {isLoading && (
          <div className="flex justify-center py-12">
            <Loader2 size={28} className="animate-spin text-muted-foreground" />
          </div>
        )}
        {error && (
          <p className="text-center text-destructive py-8">Failed to load shop. Please try again.</p>
        )}
        {shopData && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {shopData.listings.map((listing) => {
              const style = CHEST_STYLES[listing.item_type] ?? CHEST_STYLES.mortal_chest;
              const canAfford = shopData.balance >= listing.price;
              const isBundle = listing.quantity > 1;
              return (
                <div
                  key={listing.id}
                  className={`relative rounded-2xl border-2 p-5 flex flex-col gap-4 transition-all hover:scale-[1.02] hover:shadow-xl ${style.card} ${style.glow ? `shadow-lg ${style.glow}` : "shadow-sm"}`}
                >
                  {/* Tier badge */}
                  <div className="flex items-center justify-between">
                    <span className={`text-[11px] font-bold uppercase tracking-widest px-2.5 py-0.5 rounded-full ${style.badge}`}>
                      {style.badgeText}
                    </span>
                    {/* Stars */}
                    <span className="text-xs tracking-tight opacity-60">
                      {"★".repeat(style.stars)}{"☆".repeat(5 - style.stars)}
                    </span>
                  </div>

                  {/* Icon + title */}
                  <div className="flex items-center gap-4">
                    <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-4xl shrink-0 ${style.iconRing}`}>
                      {listing.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-base leading-tight">
                        {isBundle ? (
                          <>
                            {ITEM_TYPE_LABELS[listing.item_type] ?? style.label}
                            <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-foreground/10 text-foreground">
                              ×{listing.quantity}
                            </span>
                          </>
                        ) : (
                          ITEM_TYPE_LABELS[listing.item_type] ?? listing.name
                        )}
                      </h3>
                      <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed line-clamp-2">
                        {listing.description}
                      </p>
                    </div>
                  </div>

                  {/* Price + Buy */}
                  <div className="flex items-center justify-between mt-auto pt-1 border-t border-black/5 dark:border-white/5">
                    <span className={`text-xl font-black tabular-nums ${style.priceText}`}>
                      🪙 {listing.price.toLocaleString()}
                    </span>
                    <button
                      disabled={!canAfford || buyMutation.isPending}
                      onClick={() => setConfirmListing(listing)}
                      className={`px-5 py-1.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed ${style.buyBtn}`}
                    >
                      {!canAfford ? "Can't Afford" : isBundle ? `Buy ×${listing.quantity}` : "Buy"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Transaction History */}
        {coinData && coinData.last_20_transactions.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide">
              Recent Transactions
            </h2>
            <div className="space-y-1.5">
              {coinData.last_20_transactions.map((tx) => (
                <div key={tx.id} className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2 text-sm">
                  <span className="text-muted-foreground truncate flex-1 mr-2">{tx.description}</span>
                  <span className={`font-semibold shrink-0 ${tx.amount >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                    {tx.amount >= 0 ? "+" : ""}{tx.amount} 🪙
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Confirm Purchase Dialog */}
      <Dialog open={!!confirmListing} onOpenChange={(open) => !open && setConfirmListing(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Confirm Purchase</DialogTitle>
            <DialogDescription>
              {confirmListing && (
                <>
                  Buy <strong>{confirmListing.name}</strong> for <strong>🪙 {confirmListing.price.toLocaleString()}</strong> Spirit Coins?
                  {confirmListing.quantity > 1 && <> (×{confirmListing.quantity} chests)</>}
                  <br />
                  <span className="text-xs mt-1 block">Balance after: 🪙 {((shopData?.balance ?? 0) - confirmListing.price).toLocaleString()}</span>
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 justify-end mt-2">
            <Button variant="outline" onClick={() => setConfirmListing(null)}>Cancel</Button>
            <Button
              onClick={() => confirmListing && buyMutation.mutate(confirmListing.id)}
              disabled={buyMutation.isPending}
            >
              {buyMutation.isPending ? <Loader2 size={15} className="animate-spin mr-1" /> : null}
              Confirm
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
