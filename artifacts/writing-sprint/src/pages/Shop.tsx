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

function ChestIcon({ type, className = "w-full h-full" }: { type: string; className?: string }) {
  if (type === "mortal_chest") return (
    <svg viewBox="0 0 64 64" fill="none" className={className}>
      <defs>
        <linearGradient id="mc-lid" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#D4A870"/><stop offset="100%" stopColor="#9B6E40"/></linearGradient>
        <linearGradient id="mc-body" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#B8844C"/><stop offset="100%" stopColor="#7A4E28"/></linearGradient>
      </defs>
      {/* Body */}
      <rect x="7" y="32" width="50" height="24" rx="3" fill="url(#mc-body)" stroke="#5C3418" strokeWidth="1.5"/>
      {/* Lid */}
      <path d="M7 32 Q7 15 32 15 Q57 15 57 32Z" fill="url(#mc-lid)" stroke="#5C3418" strokeWidth="1.5"/>
      {/* Band strip */}
      <rect x="7" y="29.5" width="50" height="5" rx="0" fill="#5C3418" opacity="0.25"/>
      {/* Hinges */}
      <rect x="8" y="28" width="6" height="9" rx="2" fill="#8B6030" stroke="#5C3418" strokeWidth="1"/>
      <rect x="50" y="28" width="6" height="9" rx="2" fill="#8B6030" stroke="#5C3418" strokeWidth="1"/>
      {/* Lock plate */}
      <rect x="25" y="38" width="14" height="10" rx="2.5" fill="#C8A040" stroke="#8B6820" strokeWidth="1.5"/>
      {/* Lock shackle */}
      <path d="M29 38 Q29 33 32 33 Q35 33 35 38" stroke="#8B6820" strokeWidth="2" fill="none" strokeLinecap="round"/>
      {/* Lock keyhole */}
      <circle cx="32" cy="43" r="1.5" fill="#8B6820"/>
      {/* Wood grain */}
      {[37,43,49].map(y => (
        <g key={y}>
          <line x1="11" y1={y} x2="22" y2={y} stroke="#5C3418" strokeWidth="0.7" opacity="0.35"/>
          <line x1="42" y1={y} x2="53" y2={y} stroke="#5C3418" strokeWidth="0.7" opacity="0.35"/>
        </g>
      ))}
    </svg>
  );

  if (type === "iron_chest") return (
    <svg viewBox="0 0 64 64" fill="none" className={className}>
      <defs>
        <linearGradient id="ic-lid" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#7A8A9A"/><stop offset="100%" stopColor="#4A5568"/></linearGradient>
        <linearGradient id="ic-body" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#5A6A7A"/><stop offset="100%" stopColor="#2D3A48"/></linearGradient>
      </defs>
      <rect x="7" y="32" width="50" height="24" rx="3" fill="url(#ic-body)" stroke="#1A2530" strokeWidth="1.5"/>
      <path d="M7 32 Q7 15 32 15 Q57 15 57 32Z" fill="url(#ic-lid)" stroke="#1A2530" strokeWidth="1.5"/>
      {/* Metal bands */}
      <rect x="7" y="29" width="50" height="5" rx="0" fill="#1A2530" opacity="0.5"/>
      <rect x="7" y="39" width="50" height="3.5" rx="0" fill="#1A2530" opacity="0.35"/>
      <rect x="7" y="48" width="50" height="3.5" rx="0" fill="#1A2530" opacity="0.35"/>
      {/* Rivets on bands */}
      {[12, 28, 36, 52].map(x => (
        <circle key={x} cx={x} cy="30.5" r="1.8" fill="#8090A0" stroke="#1A2530" strokeWidth="0.7"/>
      ))}
      {/* Hinges */}
      <rect x="8" y="27" width="7" height="10" rx="2" fill="#6080A0" stroke="#1A2530" strokeWidth="1.2"/>
      <rect x="49" y="27" width="7" height="10" rx="2" fill="#6080A0" stroke="#1A2530" strokeWidth="1.2"/>
      {/* Lock */}
      <rect x="25" y="37" width="14" height="10" rx="2" fill="#78889A" stroke="#1A2530" strokeWidth="1.5"/>
      <path d="M29 37 Q29 32 32 32 Q35 32 35 37" stroke="#1A2530" strokeWidth="2" fill="none" strokeLinecap="round"/>
      <circle cx="32" cy="42" r="1.5" fill="#1A2530"/>
    </svg>
  );

  if (type === "crystal_chest") return (
    <svg viewBox="0 0 64 64" fill="none" className={className}>
      <defs>
        <linearGradient id="cc-lid" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#A8D8F0"/><stop offset="100%" stopColor="#4090C8"/></linearGradient>
        <linearGradient id="cc-body" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#70B8E8"/><stop offset="100%" stopColor="#2868A8"/></linearGradient>
      </defs>
      <rect x="7" y="32" width="50" height="24" rx="3" fill="url(#cc-body)" stroke="#1A4880" strokeWidth="1.5" opacity="0.9"/>
      <path d="M7 32 Q7 15 32 15 Q57 15 57 32Z" fill="url(#cc-lid)" stroke="#1A4880" strokeWidth="1.5" opacity="0.9"/>
      {/* Crystal facet lines on lid */}
      <path d="M32 15 L20 32 M32 15 L44 32 M32 15 L32 32" stroke="white" strokeWidth="0.8" opacity="0.5"/>
      {/* Shine */}
      <ellipse cx="24" cy="22" rx="4" ry="2.5" fill="white" opacity="0.3" transform="rotate(-30 24 22)"/>
      {/* Band */}
      <rect x="7" y="29" width="50" height="5" fill="#1A4880" opacity="0.3"/>
      {/* Hinges */}
      <rect x="8" y="27" width="6" height="10" rx="2" fill="#60A0D8" stroke="#1A4880" strokeWidth="1.2"/>
      <rect x="50" y="27" width="6" height="10" rx="2" fill="#60A0D8" stroke="#1A4880" strokeWidth="1.2"/>
      {/* Gem lock */}
      <rect x="25" y="37" width="14" height="10" rx="2" fill="#A8D0F0" stroke="#1A4880" strokeWidth="1.5"/>
      <polygon points="32,39 36,43 32,47 28,43" fill="#4890D0" stroke="#1A4880" strokeWidth="0.8"/>
      <polygon points="32,41 34,43 32,45 30,43" fill="white" opacity="0.7"/>
      {/* Corner gems */}
      <polygon points="10,35 13,38 10,41 7,38" fill="#60B0E8" opacity="0.7"/>
      <polygon points="54,35 57,38 54,41 51,38" fill="#60B0E8" opacity="0.7"/>
      {/* Sparkles */}
      <path d="M48 20 L49 22 L51 21 L49 23 L50 25 L49 23 L47 24 L49 23 Z" fill="white" opacity="0.8"/>
    </svg>
  );

  if (type === "inferno_chest") return (
    <svg viewBox="0 0 64 64" fill="none" className={className}>
      <defs>
        <linearGradient id="fc-lid" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#C04010"/><stop offset="100%" stopColor="#601008"/></linearGradient>
        <linearGradient id="fc-body" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#A03010"/><stop offset="100%" stopColor="#3A0808"/></linearGradient>
        <radialGradient id="fc-glow" cx="50%" cy="80%" r="60%"><stop offset="0%" stopColor="#FF6020" stopOpacity="0.6"/><stop offset="100%" stopColor="#FF6020" stopOpacity="0"/></radialGradient>
      </defs>
      {/* Glow */}
      <ellipse cx="32" cy="56" rx="26" ry="8" fill="url(#fc-glow)"/>
      <rect x="7" y="32" width="50" height="24" rx="3" fill="url(#fc-body)" stroke="#200808" strokeWidth="1.5"/>
      <path d="M7 32 Q7 15 32 15 Q57 15 57 32Z" fill="url(#fc-lid)" stroke="#200808" strokeWidth="1.5"/>
      {/* Glowing cracks */}
      <path d="M18 36 L22 42 L20 46 L24 52" stroke="#FF8030" strokeWidth="1.2" opacity="0.8"/>
      <path d="M42 34 L46 40 L44 50" stroke="#FF8030" strokeWidth="1" opacity="0.7"/>
      {/* Band */}
      <rect x="7" y="29" width="50" height="5" fill="#200808" opacity="0.5"/>
      {/* Metal bands with glow */}
      <rect x="7" y="40" width="50" height="3" fill="#200808" opacity="0.4"/>
      {/* Hinges */}
      <rect x="8" y="27" width="6" height="10" rx="2" fill="#803020" stroke="#200808" strokeWidth="1.2"/>
      <rect x="50" y="27" width="6" height="10" rx="2" fill="#803020" stroke="#200808" strokeWidth="1.2"/>
      {/* Ember lock */}
      <rect x="25" y="37" width="14" height="10" rx="2" fill="#C04010" stroke="#200808" strokeWidth="1.5"/>
      <ellipse cx="32" cy="42" rx="4" ry="4" fill="#FF6020" opacity="0.9"/>
      <ellipse cx="32" cy="42" rx="2" ry="2.5" fill="#FFCF00"/>
      {/* Flames coming from lid seam */}
      <path d="M18 31 Q20 25 18 20 Q23 26 21 31" fill="#FF8030" opacity="0.9"/>
      <path d="M30 31 Q32 22 30 16 Q36 24 34 31" fill="#FFA040" opacity="0.85"/>
      <path d="M44 31 Q46 26 44 21 Q49 27 47 31" fill="#FF8030" opacity="0.8"/>
    </svg>
  );

  if (type === "immortal_chest") return (
    <svg viewBox="0 0 64 64" fill="none" className={className}>
      <defs>
        <linearGradient id="imc-lid" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#F0D060"/><stop offset="100%" stopColor="#C09020"/></linearGradient>
        <linearGradient id="imc-body" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#D4A820"/><stop offset="100%" stopColor="#8B6810"/></linearGradient>
        <radialGradient id="imc-glow" cx="50%" cy="50%" r="60%"><stop offset="0%" stopColor="#FFE840" stopOpacity="0.5"/><stop offset="100%" stopColor="#FFE840" stopOpacity="0"/></radialGradient>
      </defs>
      {/* Divine aura */}
      <ellipse cx="32" cy="32" rx="28" ry="26" fill="url(#imc-glow)"/>
      <rect x="7" y="32" width="50" height="24" rx="3" fill="url(#imc-body)" stroke="#7A5010" strokeWidth="1.5"/>
      <path d="M7 32 Q7 15 32 15 Q57 15 57 32Z" fill="url(#imc-lid)" stroke="#7A5010" strokeWidth="1.5"/>
      {/* Ornate pattern on lid */}
      <path d="M20 26 Q32 18 44 26" stroke="#FFE840" strokeWidth="1" opacity="0.8" fill="none"/>
      <path d="M24 30 Q32 23 40 30" stroke="#FFE840" strokeWidth="0.8" opacity="0.6" fill="none"/>
      {/* Band */}
      <rect x="7" y="29" width="50" height="5" fill="#7A5010" opacity="0.4"/>
      {/* Ornate bands */}
      <rect x="7" y="40" width="50" height="3" fill="#7A5010" opacity="0.3"/>
      {/* Diamond pattern on body */}
      <path d="M14 37 L18 42 L14 47 L10 42Z" fill="#F0D060" opacity="0.5"/>
      <path d="M46 37 L50 42 L46 47 L42 42Z" fill="#F0D060" opacity="0.5"/>
      {/* Hinges - ornate */}
      <rect x="8" y="27" width="6" height="10" rx="2" fill="#D4A820" stroke="#7A5010" strokeWidth="1.2"/>
      <circle cx="11" cy="32" r="2" fill="#FFE840"/>
      <rect x="50" y="27" width="6" height="10" rx="2" fill="#D4A820" stroke="#7A5010" strokeWidth="1.2"/>
      <circle cx="53" cy="32" r="2" fill="#FFE840"/>
      {/* Lock - jeweled */}
      <rect x="25" y="37" width="14" height="10" rx="2.5" fill="#E8C030" stroke="#7A5010" strokeWidth="1.5"/>
      <path d="M29 37 Q29 32.5 32 32.5 Q35 32.5 35 37" stroke="#7A5010" strokeWidth="1.8" fill="none" strokeLinecap="round"/>
      {/* Center gemstone */}
      <polygon points="32,39 35,42 32,45 29,42" fill="#C040C0" stroke="#7A5010" strokeWidth="0.8"/>
      <polygon points="32,40.5 33.5,42 32,43.5 30.5,42" fill="white" opacity="0.7"/>
      {/* Divine sparkles */}
      <path d="M10 18 L11 21 L14 18 L11 21 L12 24 L11 21 L8 22 L11 21Z" fill="#FFE840" opacity="0.9"/>
      <path d="M50 12 L51 15 L54 12 L51 15 L52 18 L51 15 L48 16 L51 15Z" fill="#FFE840" opacity="0.8"/>
      <path d="M54 48 L55 50 L57 48 L55 50 L56 52 L55 50 L53 51 L55 50Z" fill="#FFE840" opacity="0.7"/>
    </svg>
  );

  return <span className="text-4xl">{}</span>;
}

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
                    <div className={`w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 p-1.5 ${style.iconRing}`}>
                      <ChestIcon type={listing.item_type} />
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
