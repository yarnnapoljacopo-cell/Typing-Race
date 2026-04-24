import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@clerk/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ShoppingBag, Loader2, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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

const CHEST_RARITY_COLOR: Record<string, string> = {
  mortal_chest: "bg-zinc-100 text-zinc-600 border-zinc-200",
  iron_chest: "bg-slate-100 text-slate-600 border-slate-300",
  crystal_chest: "bg-blue-100 text-blue-700 border-blue-200",
  inferno_chest: "bg-orange-100 text-orange-700 border-orange-200",
  immortal_chest: "bg-yellow-100 text-yellow-800 border-yellow-200",
};

const CHEST_CARD_BORDER: Record<string, string> = {
  mortal_chest: "border-l-zinc-400",
  iron_chest: "border-l-slate-400",
  crystal_chest: "border-l-blue-500",
  inferno_chest: "border-l-orange-500",
  immortal_chest: "border-l-yellow-500",
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
          <div className="space-y-3">
            {shopData.listings.map((listing) => {
              const canAfford = shopData.balance >= listing.price;
              return (
                <Card
                  key={listing.id}
                  className={`border-l-4 transition-shadow hover:shadow-md ${CHEST_CARD_BORDER[listing.item_type] ?? "border-l-border"}`}
                >
                  <CardContent className="p-4 flex items-center gap-4">
                    <span className="text-3xl">{listing.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="font-semibold">{listing.name}</span>
                        <Badge variant="outline" className={`text-xs ${CHEST_RARITY_COLOR[listing.item_type] ?? ""}`}>
                          {ITEM_TYPE_LABELS[listing.item_type] ?? listing.item_type}
                        </Badge>
                        {listing.quantity > 1 && (
                          <Badge variant="secondary" className="text-xs">×{listing.quantity}</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{listing.description}</p>
                    </div>
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <span className="font-bold text-yellow-600 dark:text-yellow-400">
                        🪙 {listing.price.toLocaleString()}
                      </span>
                      <Button
                        size="sm"
                        disabled={!canAfford || buyMutation.isPending}
                        onClick={() => setConfirmListing(listing)}
                      >
                        {!canAfford ? "Can't Afford" : "Buy"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
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
