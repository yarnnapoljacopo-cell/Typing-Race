import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@clerk/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthedFetch } from "@/lib/authedFetch";
import { ArrowLeft, ShoppingBag, Loader2, Pin, PinOff, Sparkles, Flame, Clock, Gift, ScrollText } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { ChestIcon } from "@/components/ChestIcon";
import { ItemIcon } from "@/components/ItemIcon";
import { ChestAwardModal } from "@/components/ChestAwardModal";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

// ── Types ───────────────────────────────────────────────────────────────────
type Merchant = "mortal" | "earth" | "heaven";
type ListingType = "chest" | "item" | "recipe" | "mystery_crate";

interface ShopListing {
  id: number;
  name: string;
  description: string;
  item_type: string;
  quantity: number;
  price: number;
  icon: string;
  merchant: Merchant;
  listing_type: ListingType;
  result_item_id: number | null;
  result_recipe_id: number | null;
  featured_eligible: boolean;
  purchases_today?: number;
}

interface ShopData {
  balance: number;
  listings: ShopListing[];
  featured: {
    listing_id: number;
    discount_pct: number;
    ends_at: string;
  } | null;
  wishlist: {
    listing_id: number;
    pinned_at: string;
  } | null;
}

interface BuyResponse {
  new_balance: number;
  effective_price: number;
  featured_discount_applied: boolean;
  kind: ListingType;
  chest_type?: string;
  item_name?: string;
  item_icon?: string;
  item_rarity?: string;
  recipe_id?: number;
  newly_learned?: boolean;
  quantity_added?: number;
}

type AF = (url: string, opts?: RequestInit) => Promise<Response>;

async function fetchShop(af: AF): Promise<ShopData> {
  const res = await af(`${basePath}/api/shop`);
  if (!res.ok) throw new Error("Failed to load shop");
  return res.json();
}

async function buyListing(listingId: number, af: AF): Promise<BuyResponse> {
  const res = await af(`${basePath}/api/shop/buy`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ listing_id: listingId }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error ?? "Purchase failed");
  }
  return res.json();
}

async function pinWishlist(listingId: number, af: AF): Promise<void> {
  await af(`${basePath}/api/shop/wishlist`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ listing_id: listingId }),
  });
}
async function clearWishlist(af: AF): Promise<void> {
  await af(`${basePath}/api/shop/wishlist`, { method: "DELETE" });
}

// ── Display metadata ────────────────────────────────────────────────────────
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
  accent: string; // raw hex for progress rings, etc.
}

const CHEST_STYLES: Record<string, ChestStyle> = {
  mortal_chest: {
    card: "bg-gradient-to-br from-stone-50 to-zinc-100 dark:from-zinc-800/60 dark:to-zinc-900/80 border-zinc-200 dark:border-zinc-700",
    badge: "bg-zinc-200/80 dark:bg-zinc-700/80 text-zinc-600 dark:text-zinc-300",
    badgeText: "Common", glow: "",
    iconRing: "bg-zinc-200/70 dark:bg-zinc-700/60",
    priceText: "text-zinc-600 dark:text-zinc-300",
    buyBtn: "bg-zinc-600 hover:bg-zinc-700 text-white dark:bg-zinc-500 dark:hover:bg-zinc-400",
    label: "Mortal", stars: 1, accent: "#a1a1aa",
  },
  iron_chest: {
    card: "bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800/60 dark:to-slate-900/80 border-slate-300 dark:border-slate-600",
    badge: "bg-slate-200/80 dark:bg-slate-700/80 text-slate-600 dark:text-slate-300",
    badgeText: "Uncommon", glow: "",
    iconRing: "bg-slate-200/70 dark:bg-slate-700/60",
    priceText: "text-slate-600 dark:text-slate-300",
    buyBtn: "bg-slate-500 hover:bg-slate-600 text-white",
    label: "Iron", stars: 2, accent: "#64748b",
  },
  crystal_chest: {
    card: "bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/30 dark:to-cyan-900/30 border-blue-300 dark:border-blue-600",
    badge: "bg-blue-100 dark:bg-blue-800/60 text-blue-700 dark:text-blue-300",
    badgeText: "Rare", glow: "shadow-blue-200/60 dark:shadow-blue-900/40",
    iconRing: "bg-blue-100/80 dark:bg-blue-800/50",
    priceText: "text-blue-700 dark:text-blue-300",
    buyBtn: "bg-blue-600 hover:bg-blue-700 text-white",
    label: "Crystal", stars: 3, accent: "#3b82f6",
  },
  inferno_chest: {
    card: "bg-gradient-to-br from-orange-50 to-red-50 dark:from-orange-900/30 dark:to-red-900/30 border-orange-400 dark:border-orange-600",
    badge: "bg-orange-100 dark:bg-orange-800/60 text-orange-700 dark:text-orange-300",
    badgeText: "Epic", glow: "shadow-orange-200/70 dark:shadow-orange-900/50",
    iconRing: "bg-orange-100/80 dark:bg-orange-800/50",
    priceText: "text-orange-700 dark:text-orange-300",
    buyBtn: "bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white",
    label: "Inferno", stars: 4, accent: "#f97316",
  },
  immortal_chest: {
    card: "bg-gradient-to-br from-yellow-50 via-amber-50 to-yellow-100 dark:from-yellow-900/30 dark:via-amber-900/30 dark:to-yellow-900/30 border-yellow-400 dark:border-yellow-600",
    badge: "bg-yellow-100 dark:bg-yellow-800/60 text-yellow-800 dark:text-yellow-300",
    badgeText: "Mythic", glow: "shadow-yellow-300/60 dark:shadow-yellow-900/50",
    iconRing: "bg-yellow-100/80 dark:bg-yellow-800/50",
    priceText: "text-yellow-700 dark:text-yellow-400",
    buyBtn: "bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-600 hover:to-amber-600 text-white font-bold",
    label: "Immortal", stars: 5, accent: "#eab308",
  },
};

// Mystery crate uses its own purple-pink palette so it visually distinguishes
// itself from the regular chest progression.
const MYSTERY_STYLE: ChestStyle = {
  card: "bg-gradient-to-br from-purple-50 via-fuchsia-50 to-pink-50 dark:from-purple-900/40 dark:via-fuchsia-900/30 dark:to-pink-900/30 border-purple-400 dark:border-purple-500",
  badge: "bg-purple-200/80 dark:bg-purple-800/60 text-purple-700 dark:text-purple-200",
  badgeText: "Gamble", glow: "shadow-purple-200/70 dark:shadow-purple-900/50",
  iconRing: "bg-purple-200/80 dark:bg-purple-800/60",
  priceText: "text-purple-700 dark:text-purple-300",
  buyBtn: "bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-bold",
  label: "Mystery", stars: 0, accent: "#a855f7",
};

// Generic styling for non-chest listings (items, recipes).
const ITEM_LISTING_STYLE: ChestStyle = {
  card: "bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/30 dark:to-teal-900/30 border-emerald-300 dark:border-emerald-600",
  badge: "bg-emerald-200/80 dark:bg-emerald-800/60 text-emerald-700 dark:text-emerald-200",
  badgeText: "Item", glow: "",
  iconRing: "bg-emerald-100/80 dark:bg-emerald-800/50",
  priceText: "text-emerald-700 dark:text-emerald-300",
  buyBtn: "bg-emerald-600 hover:bg-emerald-700 text-white",
  label: "Item", stars: 0, accent: "#10b981",
};
const RECIPE_LISTING_STYLE: ChestStyle = {
  card: "bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/30 dark:to-orange-900/30 border-amber-300 dark:border-amber-600",
  badge: "bg-amber-200/80 dark:bg-amber-800/60 text-amber-700 dark:text-amber-200",
  badgeText: "Recipe", glow: "",
  iconRing: "bg-amber-100/80 dark:bg-amber-800/50",
  priceText: "text-amber-700 dark:text-amber-300",
  buyBtn: "bg-amber-600 hover:bg-amber-700 text-white",
  label: "Recipe", stars: 0, accent: "#d97706",
};

function styleFor(listing: ShopListing): ChestStyle {
  if (listing.listing_type === "mystery_crate") return MYSTERY_STYLE;
  if (listing.listing_type === "item") return ITEM_LISTING_STYLE;
  if (listing.listing_type === "recipe") return RECIPE_LISTING_STYLE;
  return CHEST_STYLES[listing.item_type] ?? CHEST_STYLES.mortal_chest;
}

// ── Custom merchant icons — bespoke SVGs that match the cultivation theme.
// Each is a single-component glyph drawn in the merchant's accent color, so
// it never looks generic next to the chests + bag illustrations.

/** Mortal merchant — a hanging shop banner on a bamboo pole. The classic
 *  "wineshop flag" silhouette from xianxia novels. */
function MortalMerchantIcon({ size = 30, color }: { size?: number; color: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="mortal-banner" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity="0.95" />
          <stop offset="1" stopColor={color} stopOpacity="0.65" />
        </linearGradient>
      </defs>
      {/* Bamboo pole */}
      <line x1="9" y1="4" x2="9" y2="36" stroke={color} strokeWidth="2.2" strokeLinecap="round" opacity="0.85" />
      <line x1="7" y1="12" x2="11" y2="12" stroke={color} strokeWidth="1.4" strokeLinecap="round" opacity="0.7" />
      <line x1="7" y1="24" x2="11" y2="24" stroke={color} strokeWidth="1.4" strokeLinecap="round" opacity="0.7" />
      {/* Tassel */}
      <circle cx="9" cy="6" r="1.6" fill={color} />
      <line x1="9" y1="7.6" x2="9" y2="10" stroke={color} strokeWidth="1.2" strokeLinecap="round" />
      {/* Banner */}
      <path d="M11 8 L34 8 L31 20 L34 32 L11 32 Z" fill="url(#mortal-banner)" stroke={color} strokeWidth="1.4" strokeLinejoin="round" />
      {/* "Shop" mark — abstract brushstroke characters */}
      <line x1="18" y1="13" x2="27" y2="13" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" opacity="0.85" />
      <line x1="20" y1="19" x2="25" y2="19" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" opacity="0.85" />
      <line x1="18" y1="25" x2="27" y2="25" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" opacity="0.85" />
    </svg>
  );
}

/** Earth merchant — a three-legged alchemy cauldron (ding 鼎) with steam.
 *  The defining symbol of pill-refinement in cultivation lore. */
function EarthMerchantIcon({ size = 30, color }: { size?: number; color: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="earth-cauldron" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity="0.95" />
          <stop offset="1" stopColor={color} stopOpacity="0.55" />
        </linearGradient>
      </defs>
      {/* Steam wisps */}
      <path d="M14 9 Q12 6 14 4 Q16 6 14 9" stroke={color} strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.55" />
      <path d="M20 8 Q22 5 20 2 Q18 5 20 8" stroke={color} strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.7" />
      <path d="M26 9 Q24 6 26 4 Q28 6 26 9" stroke={color} strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.55" />
      {/* Rim of the cauldron with handles */}
      <ellipse cx="20" cy="14" rx="13" ry="2.4" fill={color} opacity="0.9" />
      <rect x="3.5" y="12" width="3" height="3" rx="0.8" fill={color} />
      <rect x="33.5" y="12" width="3" height="3" rx="0.8" fill={color} />
      {/* Body — pot belly */}
      <path
        d="M8 14 Q6 24 12 30 L28 30 Q34 24 32 14 Z"
        fill="url(#earth-cauldron)"
        stroke={color}
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      {/* Decorative ring */}
      <line x1="11" y1="21" x2="29" y2="21" stroke="#fff" strokeWidth="0.9" opacity="0.55" />
      {/* Three legs */}
      <path d="M11 30 L9 36" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
      <path d="M20 30 L20 37" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
      <path d="M29 30 L31 36" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

/** Heaven vendor — a lotus blossom rising from cloud wisps. Lotus =
 *  enlightenment, clouds = immortal realm. The Hermit's calling card. */
function HeavenMerchantIcon({ size = 30, color }: { size?: number; color: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="heaven-glow" cx="0.5" cy="0.5" r="0.55">
          <stop offset="0" stopColor={color} stopOpacity="0.32" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </radialGradient>
        <linearGradient id="heaven-petal" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity="0.95" />
          <stop offset="1" stopColor={color} stopOpacity="0.45" />
        </linearGradient>
      </defs>
      {/* Soft halo */}
      <circle cx="20" cy="18" r="16" fill="url(#heaven-glow)" />
      {/* Outer petals */}
      <path d="M20 6 Q14 13 20 22 Q26 13 20 6 Z" fill="url(#heaven-petal)" stroke={color} strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M8 14 Q12 17 20 22 Q18 13 8 14 Z" fill="url(#heaven-petal)" stroke={color} strokeWidth="1.2" strokeLinejoin="round" opacity="0.88" />
      <path d="M32 14 Q28 17 20 22 Q22 13 32 14 Z" fill="url(#heaven-petal)" stroke={color} strokeWidth="1.2" strokeLinejoin="round" opacity="0.88" />
      {/* Center petal */}
      <path d="M20 12 Q17 19 20 24 Q23 19 20 12 Z" fill="#fff" opacity="0.75" stroke={color} strokeWidth="0.9" />
      {/* Cloud wisps below */}
      <path d="M6 30 Q10 28 14 30 Q18 28 22 30 Q26 28 30 30 Q34 28 36 30" stroke={color} strokeWidth="1.8" strokeLinecap="round" fill="none" opacity="0.7" />
      <path d="M9 34 Q13 32 17 34 Q21 32 25 34 Q29 32 33 34" stroke={color} strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.45" />
      {/* Sparkle */}
      <circle cx="20" cy="9" r="1.3" fill="#fff" stroke={color} strokeWidth="0.6" />
    </svg>
  );
}

function MerchantIcon({ merchant, size, color }: { merchant: Merchant; size?: number; color: string }) {
  if (merchant === "mortal") return <MortalMerchantIcon size={size} color={color} />;
  if (merchant === "earth")  return <EarthMerchantIcon  size={size} color={color} />;
  return <HeavenMerchantIcon size={size} color={color} />;
}

// ── Merchant identity / flavor text ─────────────────────────────────────────
const MERCHANTS: Record<Merchant, {
  name: string;
  title: string;
  tagline: string;
  accent: string;
  background: string;
}> = {
  mortal: {
    name: "Old Liang",
    title: "Mortal Merchant",
    tagline: "\"Try one, eh? Won't hurt your purse.\"",
    accent: "#92400e",
    background: "linear-gradient(135deg, rgba(252,211,77,0.15), rgba(180,83,9,0.08))",
  },
  earth: {
    name: "The Veiled Apothecary",
    title: "Earth Merchant",
    tagline: "\"My pills work. My recipes are older. Choose wisely.\"",
    accent: "#047857",
    background: "linear-gradient(135deg, rgba(16,185,129,0.18), rgba(6,95,70,0.08))",
  },
  heaven: {
    name: "The Hermit",
    title: "Heaven Vendor",
    tagline: "\"What I have cannot be found below. Spend deliberately.\"",
    accent: "#7c3aed",
    background: "linear-gradient(135deg, rgba(167,139,250,0.2), rgba(76,29,149,0.12))",
  },
};

// ── Daily Featured countdown hook ──────────────────────────────────────────
function useCountdown(endsAtIso: string | null | undefined): string {
  const [, tick] = useState(0);
  useEffect(() => {
    if (!endsAtIso) return;
    const id = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [endsAtIso]);
  if (!endsAtIso) return "";
  const ms = new Date(endsAtIso).getTime() - Date.now();
  if (ms <= 0) return "Refreshing…";
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${h}h ${m.toString().padStart(2, "0")}m ${s.toString().padStart(2, "0")}s`;
}

// ── Component ───────────────────────────────────────────────────────────────
export default function Shop() {
  const [, setLocation] = useLocation();
  const { isLoaded, isSignedIn } = useAuth();
  const authedFetch = useAuthedFetch();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [confirmListing, setConfirmListing] = useState<ShopListing | null>(null);
  const [activeMerchant, setActiveMerchant] = useState<Merchant>("mortal");
  const [pendingChest, setPendingChest] = useState<string | null>(null);

  const { data: shopData, isLoading, error } = useQuery<ShopData>({
    queryKey: ["shop"],
    queryFn: () => fetchShop(authedFetch),
    enabled: isLoaded && !!isSignedIn,
    staleTime: 30_000,
  });

  // Notify once when the user can finally afford their wishlist target.
  // Stored per-listing in localStorage so we don't spam every page load.
  const lastWishlistNotifyRef = useRef<string | null>(null);
  useEffect(() => {
    if (!shopData?.wishlist) return;
    const pinned = shopData.listings.find(l => l.id === shopData.wishlist!.listing_id);
    if (!pinned) return;
    if (shopData.balance < pinned.price) return;
    const lsKey = `shop:wishlist-notified:${pinned.id}`;
    if (typeof window !== "undefined") {
      const last = window.localStorage.getItem(lsKey);
      if (last === "yes") return;
      window.localStorage.setItem(lsKey, "yes");
    }
    if (lastWishlistNotifyRef.current === String(pinned.id)) return;
    lastWishlistNotifyRef.current = String(pinned.id);
    toast({
      title: "Wishlist unlocked",
      description: `You can now afford the ${pinned.name}.`,
    });
  }, [shopData?.balance, shopData?.wishlist, shopData?.listings, toast]);

  // Reset the "notified" flag once the user actually buys it OR re-pins.
  useEffect(() => {
    if (!shopData?.wishlist || typeof window === "undefined") return;
    const lsKey = `shop:wishlist-notified:${shopData.wishlist.listing_id}`;
    const pinned = shopData.listings.find(l => l.id === shopData.wishlist!.listing_id);
    // Below-affording threshold again → arm the notification for next time.
    if (pinned && shopData.balance < pinned.price) {
      window.localStorage.removeItem(lsKey);
    }
  }, [shopData?.balance, shopData?.wishlist, shopData?.listings]);

  const buyMutation = useMutation({
    mutationFn: (listingId: number) => buyListing(listingId, authedFetch),
    onSuccess: (data) => {
      // Tailor the toast to the kind of thing we just bought.
      let title = "Purchase successful!";
      let description = `New balance: 🪙 ${data.new_balance}`;
      if (data.featured_discount_applied) {
        description += " (Daily Featured discount applied)";
      }
      if (data.kind === "chest") {
        description = `${data.chest_type} chest added. ${description}`;
      } else if (data.kind === "item") {
        title = `${data.item_name} acquired!`;
        description = `Added to your bag. ${description}`;
      } else if (data.kind === "recipe") {
        title = data.newly_learned ? "Recipe learned" : "Recipe already known";
        description = data.newly_learned
          ? `Added to your Crafting tome. ${description}`
          : `(You already knew this recipe — coins were still spent.) ${description}`;
      } else if (data.kind === "mystery_crate") {
        title = "Mystery Crate opened!";
        description = `The heavens rolled: ${data.chest_type?.toUpperCase()} chest! ${description}`;
        // Auto-launch the cinematic chest reveal so the gamble feels rewarding.
        if (data.chest_type) setPendingChest(data.chest_type);
      }
      toast({ title, description });
      setConfirmListing(null);
      queryClient.invalidateQueries({ queryKey: ["shop"] });
      queryClient.invalidateQueries({ queryKey: ["coinBalance"] });
      queryClient.invalidateQueries({ queryKey: ["coinHistory"] });
      queryClient.invalidateQueries({ queryKey: ["userChests"] });
      queryClient.invalidateQueries({ queryKey: ["userInventory"] });
      queryClient.invalidateQueries({ queryKey: ["knownRecipes"] });
    },
    onError: (err: Error) => {
      toast({ title: "Purchase failed", description: err.message, variant: "destructive" });
    },
  });

  const wishlistMutation = useMutation({
    mutationFn: async (target: { action: "pin" | "clear"; listingId?: number }) => {
      if (target.action === "clear") await clearWishlist(authedFetch);
      else if (target.listingId != null) await pinWishlist(target.listingId, authedFetch);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shop"] });
    },
    onError: (err: Error) => {
      toast({ title: "Couldn't update wishlist", description: err.message, variant: "destructive" });
    },
  });

  const merchantListings = useMemo(() => {
    if (!shopData) return [];
    return shopData.listings.filter(l => l.merchant === activeMerchant);
  }, [shopData, activeMerchant]);

  const featuredListing = useMemo(() => {
    if (!shopData?.featured) return null;
    return shopData.listings.find(l => l.id === shopData.featured!.listing_id) ?? null;
  }, [shopData]);

  const wishlistListing = useMemo(() => {
    if (!shopData?.wishlist) return null;
    return shopData.listings.find(l => l.id === shopData.wishlist!.listing_id) ?? null;
  }, [shopData]);

  const countdown = useCountdown(shopData?.featured?.ends_at);

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
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/portal")} className="shrink-0">
            <ArrowLeft size={18} />
          </Button>
          <div className="flex items-center gap-2 flex-1">
            <ShoppingBag size={18} className="text-primary" />
            <h1 className="font-bold text-lg">Spirit Coin Shop</h1>
          </div>
          <Button variant="outline" size="sm" onClick={() => setLocation("/skins")} className="shrink-0">
            Skins
          </Button>
          {shopData && (
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 font-bold text-sm tabular-nums">
              🪙 {shopData.balance.toLocaleString()}
            </span>
          )}
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">
        {/* Wishlist banner */}
        <AnimatePresence>
          {wishlistListing && shopData && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="rounded-2xl border-2 border-purple-300 dark:border-purple-700 bg-gradient-to-br from-purple-50 to-fuchsia-50 dark:from-purple-950/40 dark:to-fuchsia-950/30 p-4 flex items-center gap-4"
            >
              <ProgressRing
                progress={Math.min(1, shopData.balance / wishlistListing.price)}
                color="#a855f7"
                size={56}
              />
              <div className="flex-1 min-w-0">
                <div className="text-[10px] font-bold uppercase tracking-widest text-purple-700 dark:text-purple-300 flex items-center gap-1.5">
                  <Pin size={11} className="-rotate-45" />
                  Saving up for
                </div>
                <div className="font-bold text-base truncate">{wishlistListing.name}</div>
                <div className="text-xs text-muted-foreground tabular-nums">
                  🪙 {shopData.balance.toLocaleString()} / {wishlistListing.price.toLocaleString()}
                  {shopData.balance >= wishlistListing.price && (
                    <span className="ml-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-purple-600 text-white text-[10px] font-bold uppercase tracking-wider">
                      Ready
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={() => wishlistMutation.mutate({ action: "clear" })}
                className="shrink-0 p-2 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900/40 text-purple-700 dark:text-purple-300"
                title="Clear wishlist"
              >
                <PinOff size={16} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Daily Featured banner */}
        {featuredListing && shopData?.featured && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="rounded-2xl border-2 border-amber-300 dark:border-amber-700 bg-gradient-to-br from-amber-50 via-yellow-50 to-orange-50 dark:from-amber-950/40 dark:via-yellow-950/30 dark:to-orange-950/30 p-4 relative overflow-hidden"
          >
            {/* Background sparkle */}
            <div className="absolute -right-4 -top-4 opacity-30 dark:opacity-20 pointer-events-none">
              <Sparkles size={80} className="text-amber-400" />
            </div>
            <div className="relative flex items-start gap-4">
              <div className="shrink-0 w-14 h-14 rounded-xl bg-amber-200/70 dark:bg-amber-800/50 flex items-center justify-center">
                {featuredListing.listing_type === "chest" || featuredListing.listing_type === "mystery_crate" ? (
                  <ChestIcon type={featuredListing.item_type} />
                ) : (
                  <span className="text-2xl">{featuredListing.icon}</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-amber-700 dark:text-amber-300">
                    <Flame size={11} /> Today's Featured
                  </span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-amber-600 text-white text-[10px] font-bold tabular-nums">
                    -{shopData.featured.discount_pct}%
                  </span>
                </div>
                <div className="font-bold text-base leading-tight">{featuredListing.name}</div>
                <div className="text-xs text-muted-foreground line-clamp-1">{featuredListing.description}</div>
                <div className="flex items-center gap-3 mt-1.5">
                  <span className="text-lg font-black tabular-nums text-amber-700 dark:text-amber-300">
                    🪙 {Math.max(1, Math.floor(featuredListing.price * (100 - shopData.featured.discount_pct) / 100)).toLocaleString()}
                  </span>
                  <span className="text-xs text-muted-foreground line-through tabular-nums">
                    🪙 {featuredListing.price.toLocaleString()}
                  </span>
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-muted-foreground ml-auto">
                    <Clock size={11} /> {countdown}
                  </span>
                </div>
              </div>
              <Button
                size="sm"
                disabled={shopData.balance < Math.floor(featuredListing.price * (100 - shopData.featured.discount_pct) / 100)}
                onClick={() => {
                  setActiveMerchant(featuredListing.merchant);
                  setConfirmListing(featuredListing);
                }}
                className="shrink-0 bg-amber-600 hover:bg-amber-700 text-white"
              >
                Buy
              </Button>
            </div>
          </motion.div>
        )}

        {/* Merchant tabs */}
        <div className="grid grid-cols-3 gap-2">
          {(["mortal", "earth", "heaven"] as Merchant[]).map((m) => {
            const meta = MERCHANTS[m];
            const active = activeMerchant === m;
            return (
              <button
                key={m}
                onClick={() => setActiveMerchant(m)}
                className={`rounded-xl border-2 px-3 py-2.5 text-left transition-all flex items-center gap-2.5 ${
                  active
                    ? "border-foreground/50 bg-foreground/[0.06] shadow-md"
                    : "border-border bg-card hover:border-foreground/30"
                }`}
                style={active ? { background: meta.background, borderColor: `${meta.accent}aa` } : undefined}
              >
                <span
                  className="shrink-0 flex items-center justify-center w-9 h-9 rounded-lg"
                  style={{
                    background: active ? `${meta.accent}1f` : "transparent",
                    filter: active ? `drop-shadow(0 2px 6px ${meta.accent}55)` : undefined,
                  }}
                >
                  <MerchantIcon merchant={m} size={28} color={meta.accent} />
                </span>
                <div className="min-w-0">
                  <div className="text-[10px] font-bold uppercase tracking-wider opacity-60">{meta.title}</div>
                  <div className="text-sm font-bold truncate" style={active ? { color: meta.accent } : undefined}>
                    {meta.name}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Merchant flavor text */}
        <div
          className="rounded-xl px-4 py-3 text-sm italic"
          style={{
            background: MERCHANTS[activeMerchant].background,
            color: MERCHANTS[activeMerchant].accent,
            borderLeft: `3px solid ${MERCHANTS[activeMerchant].accent}`,
          }}
        >
          <span className="font-serif">{MERCHANTS[activeMerchant].tagline}</span>
          <span className="ml-2 not-italic text-xs opacity-70">— {MERCHANTS[activeMerchant].name}</span>
        </div>

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
            {merchantListings.map((listing) => (
              <ListingCard
                key={listing.id}
                listing={listing}
                balance={shopData.balance}
                isPinned={shopData.wishlist?.listing_id === listing.id}
                isFeatured={shopData.featured?.listing_id === listing.id}
                featuredDiscountPct={shopData.featured?.discount_pct ?? 0}
                onBuy={() => setConfirmListing(listing)}
                onPin={() =>
                  wishlistMutation.mutate(
                    shopData.wishlist?.listing_id === listing.id
                      ? { action: "clear" }
                      : { action: "pin", listingId: listing.id },
                  )
                }
              />
            ))}
            {merchantListings.length === 0 && (
              <div className="col-span-full text-center text-muted-foreground py-8 text-sm italic">
                {MERCHANTS[activeMerchant].name} has no stock today.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Confirm Purchase Dialog */}
      <Dialog open={!!confirmListing} onOpenChange={(open) => !open && setConfirmListing(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Confirm Purchase</DialogTitle>
            <DialogDescription>
              {confirmListing && (() => {
                const isFeatured = shopData?.featured?.listing_id === confirmListing.id;
                const pct = shopData?.featured?.discount_pct ?? 0;
                const effective = isFeatured
                  ? Math.max(1, Math.floor(confirmListing.price * (100 - pct) / 100))
                  : confirmListing.price;
                return (
                  <>
                    Buy <strong>{confirmListing.name}</strong> for <strong>🪙 {effective.toLocaleString()}</strong> Spirit Coins?
                    {isFeatured && (
                      <span className="block mt-1 text-xs font-semibold text-amber-600 dark:text-amber-400">
                        ✨ Daily Featured discount applied (-{pct}%)
                      </span>
                    )}
                    {confirmListing.listing_type === "mystery_crate" && (
                      <span className="block mt-1 text-xs text-purple-600 dark:text-purple-400">
                        The chest tier is rolled at purchase — anything from Common to Immortal is possible.
                      </span>
                    )}
                    {confirmListing.listing_type === "recipe" && (
                      <span className="block mt-1 text-xs text-amber-600 dark:text-amber-400">
                        If you already know this recipe, your coins will still be spent.
                      </span>
                    )}
                    <br />
                    <span className="text-xs mt-1 block">Balance after: 🪙 {((shopData?.balance ?? 0) - effective).toLocaleString()}</span>
                  </>
                );
              })()}
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

      {/* Mystery Crate cinematic reveal — auto-fires after a successful roll */}
      {pendingChest && (
        <ChestAwardModal
          chestType={pendingChest}
          autoOpen
          onClose={() => setPendingChest(null)}
        />
      )}
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────

function ProgressRing({ progress, color, size }: { progress: number; color: string; size: number }) {
  const stroke = 5;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const dashOffset = circumference * (1 - Math.min(1, Math.max(0, progress)));
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="currentColor" strokeOpacity={0.15} strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          style={{ transition: "stroke-dashoffset 600ms ease-out" }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-[11px] font-black tabular-nums" style={{ color }}>
        {Math.round(progress * 100)}%
      </div>
    </div>
  );
}

function ListingCard({
  listing, balance, isPinned, isFeatured, featuredDiscountPct, onBuy, onPin,
}: {
  listing: ShopListing;
  balance: number;
  isPinned: boolean;
  isFeatured: boolean;
  featuredDiscountPct: number;
  onBuy: () => void;
  onPin: () => void;
}) {
  const style = styleFor(listing);
  const effectivePrice = isFeatured
    ? Math.max(1, Math.floor(listing.price * (100 - featuredDiscountPct) / 100))
    : listing.price;
  const canAfford = balance >= effectivePrice;
  const isBundle = listing.quantity > 1;

  // Icon depends on listing_type — chests use the dedicated ChestIcon SVG,
  // items use the bag's ItemIcon for visual parity with /bag, recipes use a
  // scroll glyph, mystery crate gets its own gift icon.
  const iconNode = (() => {
    if (listing.listing_type === "mystery_crate") {
      return <Gift size={36} className="text-purple-600 dark:text-purple-300" />;
    }
    if (listing.listing_type === "recipe") {
      return <ScrollText size={36} className="text-amber-600 dark:text-amber-300" />;
    }
    if (listing.listing_type === "item") {
      // ItemIcon returns null if no custom illustration is defined; emoji is the fallback.
      return (
        <span className="relative inline-flex items-center justify-center" style={{ width: 48, height: 48 }}>
          <span className="absolute inset-0 flex items-center justify-center text-3xl select-none" aria-hidden>{listing.icon}</span>
          <span className="relative inline-flex"><ItemIcon name={listing.name.replace(/ ×\d+$/, "").trim()} size={48} /></span>
        </span>
      );
    }
    return <ChestIcon type={listing.item_type} />;
  })();

  const titleNode = (() => {
    if (listing.listing_type === "chest") {
      const label = ITEM_TYPE_LABELS[listing.item_type] ?? listing.name;
      return (
        <>
          {isBundle ? (
            <>
              {label}
              <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-foreground/10 text-foreground">
                ×{listing.quantity}
              </span>
            </>
          ) : label}
        </>
      );
    }
    return listing.name;
  })();

  return (
    <div
      className={`relative rounded-2xl border-2 p-5 flex flex-col gap-4 transition-all hover:scale-[1.02] hover:shadow-xl ${style.card} ${style.glow ? `shadow-lg ${style.glow}` : "shadow-sm"} ${isFeatured ? "ring-2 ring-amber-400 ring-offset-2 ring-offset-background" : ""}`}
    >
      {/* Pin button */}
      <button
        onClick={onPin}
        className={`absolute top-3 right-3 p-1.5 rounded-lg transition-all ${
          isPinned
            ? "bg-purple-500 text-white shadow-md"
            : "bg-foreground/5 text-muted-foreground hover:bg-foreground/10"
        }`}
        title={isPinned ? "Remove from wishlist" : "Pin as wishlist target"}
      >
        <Pin size={13} className={isPinned ? "-rotate-45" : ""} />
      </button>

      {/* Tier badge + featured indicator */}
      <div className="flex items-center justify-between pr-10">
        <span className={`text-[11px] font-bold uppercase tracking-widest px-2.5 py-0.5 rounded-full ${style.badge}`}>
          {style.badgeText}
        </span>
        {isFeatured ? (
          <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-400">
            <Sparkles size={11} /> Featured
          </span>
        ) : style.stars > 0 ? (
          <span className="text-xs tracking-tight opacity-60">
            {"★".repeat(style.stars)}{"☆".repeat(5 - style.stars)}
          </span>
        ) : null}
      </div>

      {/* Icon + title */}
      <div className="flex items-center gap-4">
        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 p-1.5 ${style.iconRing}`}>
          {iconNode}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-base leading-tight">{titleNode}</h3>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed line-clamp-2">
            {listing.description}
          </p>
        </div>
      </div>

      {/* Price + Buy */}
      <div className="flex items-center justify-between mt-auto pt-1 border-t border-black/5 dark:border-white/5">
        <div className="flex flex-col">
          <span className={`text-xl font-black tabular-nums ${style.priceText}`}>
            🪙 {effectivePrice.toLocaleString()}
          </span>
          {isFeatured && (
            <span className="text-xs text-muted-foreground line-through tabular-nums leading-none">
              🪙 {listing.price.toLocaleString()}
            </span>
          )}
        </div>
        <button
          disabled={!canAfford}
          onClick={onBuy}
          className={`px-5 py-1.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed ${style.buyBtn}`}
        >
          {!canAfford ? "Can't Afford" : isBundle ? `Buy ×${listing.quantity}` : listing.listing_type === "mystery_crate" ? "Roll" : "Buy"}
        </button>
      </div>
    </div>
  );
}
