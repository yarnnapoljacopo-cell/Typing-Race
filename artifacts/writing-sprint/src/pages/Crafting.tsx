import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@clerk/react";
import { ArrowLeft, Package, Gift, FlaskConical, Zap, BookOpen, Flame, Loader2 } from "lucide-react";
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

const RARITY_BADGE: Record<string, string> = {
  common: "bg-gray-700 text-gray-200",
  uncommon: "bg-green-800 text-green-200",
  rare: "bg-blue-800 text-blue-200",
  epic: "bg-purple-800 text-purple-200",
  mythic: "bg-orange-800 text-orange-200",
  legendary: "bg-yellow-700 text-yellow-100",
};

const RARITY_BORDER: Record<string, string> = {
  common: "border-gray-500/40",
  uncommon: "border-green-500/40",
  rare: "border-blue-400/40",
  epic: "border-purple-400/40",
  mythic: "border-orange-400/40",
  legendary: "border-yellow-400/50",
};

interface InventoryItem {
  id: number;
  item_id: number;
  quantity: number;
  name: string;
  rarity: string;
  category: string;
  icon: string;
  description: string;
}

interface Recipe {
  id: number;
  result_item_id: number;
  result_name: string;
  result_icon: string;
  result_rarity: string;
  result_description?: string;
  ingredient_1_id: number | null;
  ingredient_2_id: number | null;
  ingredient_3_id: number | null;
  ingredient_4_id: number | null;
  ing1_name: string | null;
  ing1_icon: string | null;
  ing1_rarity: string | null;
  ing2_name: string | null;
  ing2_icon: string | null;
  ing2_rarity: string | null;
  ing3_name: string | null;
  ing3_icon: string | null;
  ing3_rarity: string | null;
  ing4_name: string | null;
  ing4_icon: string | null;
  ing4_rarity: string | null;
  required_cauldron: string | null;
  base_success_rate: number;
  recipe_type: string;
  is_known: boolean;
}

type Tab = "fusion" | "alchemy" | "tribulation" | "recipes";

export default function Crafting() {
  const [, setLocation] = useLocation();
  const { isSignedIn } = useAuth();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<Tab>("fusion");
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  // Fusion
  const [fusionResult, setFusionResult] = useState<{ name: string; icon: string; rarity: string; message: string } | null>(null);

  // Alchemy / Tribulation
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [alchemySelected, setAlchemySelected] = useState<InventoryItem[]>([]);
  const [craftResult, setCraftResult] = useState<{
    success: boolean;
    message: string;
    result?: { name: string; icon: string; rarity: string };
    outcome?: string;
    xpLost?: number;
  } | null>(null);

  const [recipeFilter, setRecipeFilter] = useState<"all" | "known" | "unknown">("all");

  const fetchData = useCallback(async () => {
    try {
      const [invRes, recRes] = await Promise.all([
        fetch(`${basePath}/api/user/bag`, { credentials: "include" }),
        fetch(`${basePath}/api/user/crafting/all-recipes`, { credentials: "include" }),
      ]);
      if (invRes.ok) {
        const invData = await invRes.json();
        setInventory(invData.inventory ?? []);
      }
      if (recRes.ok) {
        const recData = await recRes.json();
        setRecipes(recData);
      }
    } catch {
      toast({ title: "Error", description: "Failed to load crafting data", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isSignedIn) { setLocation("/portal"); return; }
    fetchData();
  }, [isSignedIn]);

  // ── Fusion logic ────────────────────────────────────────────────────────────
  // fusionGroupItemId tracks which item_id group the user has selected to fuse
  const [fusionGroupItemId, setFusionGroupItemId] = useState<number | null>(null);

  const performFusion = async () => {
    if (fusionGroupItemId === null) return;
    // Collect up to 3 inventory IDs from the group (repeating same ID if qty > 1)
    const group = (fusionCandidates[fusionGroupItemId] ?? []).sort((a, b) => a.id - b.id);
    const ids: number[] = [];
    for (const inv of group) {
      const qty = inv.quantity ?? 1;
      for (let i = 0; i < qty && ids.length < 3; i++) {
        ids.push(inv.id);
      }
    }
    if (ids.length < 3) {
      toast({ title: "Not enough items", description: "You need 3 of the same item.", variant: "destructive" });
      return;
    }
    setProcessing(true);
    try {
      const res = await fetch(`${basePath}/api/user/crafting/fusion`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inventoryIds: ids }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        toast({ title: "Fusion failed", description: data.error ?? "Unknown error", variant: "destructive" });
        return;
      }
      setFusionResult({ ...data.result, message: data.message });
      setFusionGroupItemId(null);
      fetchData();
    } catch {
      toast({ title: "Error", description: "Fusion request failed", variant: "destructive" });
    } finally {
      setProcessing(false);
    }
  };

  // ── Alchemy / Tribulation ───────────────────────────────────────────────────

  const performCraft = async (recipeType: "alchemy" | "tribulation") => {
    if (!selectedRecipe) return;
    setProcessing(true);
    try {
      const endpoint = recipeType === "alchemy" ? "alchemy" : "tribulation";
      const res = await fetch(`${basePath}/api/user/crafting/${endpoint}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipeId: selectedRecipe.id,
          inventoryIds: alchemySelected.map(i => i.id),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Cannot craft", description: data.error ?? "Unknown error", variant: "destructive" });
        return;
      }
      setCraftResult(data);
      setAlchemySelected([]);
      fetchData();
    } catch {
      toast({ title: "Error", description: "Crafting request failed", variant: "destructive" });
    } finally {
      setProcessing(false);
    }
  };

  const filteredRecipes = recipes.filter(r => {
    if (activeTab === "alchemy") return r.recipe_type === "alchemy";
    if (activeTab === "tribulation") return r.recipe_type === "tribulation";
    return true;
  }).filter(r => {
    if (recipeFilter === "known") return r.is_known;
    if (recipeFilter === "unknown") return !r.is_known;
    return true;
  });

  // Grouped for fusion — items that appear ≥3 times in total quantity (same item_id)
  const fusionCandidates = inventory.reduce<Record<number, InventoryItem[]>>((acc, item) => {
    if (!acc[item.item_id]) acc[item.item_id] = [];
    acc[item.item_id].push(item);
    return acc;
  }, {});

  const fusableGroups = Object.values(fusionCandidates).filter(g => {
    const totalQty = g.reduce((s, i) => s + (i.quantity ?? 1), 0);
    return totalQty >= 3;
  });

  const TABS: { key: Tab; label: string; icon: JSX.Element }[] = [
    { key: "fusion", label: "Fusion", icon: <Flame className="w-3.5 h-3.5" /> },
    { key: "alchemy", label: "Alchemy", icon: <FlaskConical className="w-3.5 h-3.5" /> },
    { key: "tribulation", label: "Tribulation", icon: <Zap className="w-3.5 h-3.5" /> },
    { key: "recipes", label: "Recipe Book", icon: <BookOpen className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
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
            <FlaskConical className="w-4 h-4 text-primary/70" />
            <h1 className="font-semibold text-base text-foreground">Crafting Lab</h1>
          </div>

          <div className="ml-auto flex gap-1.5">
            <Button variant="outline" size="sm" onClick={() => setLocation("/bag")} className="h-8 gap-1.5 text-xs">
              <Package className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Bag</span>
            </Button>
            <Button variant="outline" size="sm" onClick={() => setLocation("/chests")} className="h-8 gap-1.5 text-xs">
              <Gift className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Chests</span>
            </Button>
          </div>
        </div>

        {/* Tab nav */}
        <div className="max-w-5xl mx-auto px-4 flex border-t border-border/50">
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
                activeTab === tab.key
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6">
        {loading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* ── Fusion Tab ─────────────────────────────────────────────────── */}
        {!loading && activeTab === "fusion" && (
          <div className="space-y-6">
            <div className="p-4 rounded-xl border border-primary/20 bg-primary/5 text-sm text-foreground space-y-1">
              <div className="font-semibold">Fusion: 3 identical items → 1 upgraded item</div>
              <div className="text-muted-foreground text-xs">Select 3 identical items from your bag to fuse them into a random item of the next rarity tier. Works up to Epic rarity.</div>
            </div>

            {/* Selection tray */}
            <div className="flex gap-3 p-4 bg-card rounded-xl border border-border min-h-[88px] items-center">
              <span className="text-xs text-muted-foreground shrink-0">Selected:</span>
              <div className="flex gap-2 flex-1 flex-wrap items-center">
                {fusionGroupItemId !== null && (() => {
                  const group = fusionCandidates[fusionGroupItemId] ?? [];
                  const item = group[0];
                  if (!item) return null;
                  return (
                    <button
                      onClick={() => setFusionGroupItemId(null)}
                      className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border text-sm ${RARITY_BORDER[item.rarity] ?? "border-border"} bg-primary/10 hover:bg-destructive/10`}
                    >
                      {item.icon} {item.name} ×3
                      <span className="text-muted-foreground text-xs ml-1">✕</span>
                    </button>
                  );
                })()}
                {fusionGroupItemId === null && (
                  <span className="text-muted-foreground text-sm italic">Click an item below to select it for fusion…</span>
                )}
              </div>
              {fusionGroupItemId !== null && (
                <Button
                  onClick={performFusion}
                  disabled={processing}
                  className="shrink-0 font-semibold px-5"
                >
                  {processing ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Fusing…</> : <><Flame className="w-4 h-4 mr-2" />Fuse!</>}
                </Button>
              )}
            </div>

            {fusableGroups.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-14">
                <Package className="w-12 h-12 text-muted-foreground/20" />
                <p className="text-muted-foreground text-sm text-center">You need at least 3 identical items to attempt Fusion.<br />Open chests to collect duplicates!</p>
              </div>
            ) : (
              <div className="space-y-2">
                <h3 className="text-xs text-muted-foreground uppercase tracking-wider">Fusable items (3+ copies in bag)</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {fusableGroups.map(group => {
                    const item = group[0];
                    const totalQty = group.reduce((s, i) => s + (i.quantity ?? 1), 0);
                    const isSelected = fusionGroupItemId === item.item_id;
                    return (
                      <button
                        key={item.item_id}
                        onClick={() => setFusionGroupItemId(isSelected ? null : item.item_id)}
                        className={`relative p-3 rounded-xl border-l-4 border transition-all text-center bg-card ${
                          RARITY_BORDER[item.rarity] ?? "border-border"
                        } ${isSelected ? "bg-primary/10 scale-105 shadow-sm" : "hover:bg-muted"}`}
                      >
                        <div className="text-3xl mb-1 leading-none">{item.icon}</div>
                        <div className="text-xs font-medium leading-tight text-foreground">{item.name}</div>
                        <div className="text-[10px] text-muted-foreground mt-1 capitalize">{item.rarity}</div>
                        <span className="absolute top-1.5 right-1.5 text-[10px] bg-foreground/10 text-foreground px-1.5 py-0.5 rounded-full font-bold">
                          ×{totalQty}
                        </span>
                        {isSelected && (
                          <span className="absolute top-1.5 left-1.5 text-[10px] bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full font-bold">
                            ✓
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Alchemy Tab ─────────────────────────────────────────────────── */}
        {!loading && activeTab === "alchemy" && (
          <AlchemyPanel
            recipes={filteredRecipes}
            inventory={inventory}
            processing={processing}
            selectedRecipe={selectedRecipe}
            alchemySelected={alchemySelected}
            setSelectedRecipe={setSelectedRecipe}
            setAlchemySelected={setAlchemySelected}
            onCraft={() => performCraft("alchemy")}
            recipeFilter={recipeFilter}
            setRecipeFilter={setRecipeFilter}
            description="Mix ingredients and use known recipes to produce pills and artifacts. Base success rate: 60–80%. Equip a Cauldron to improve odds."
            cooldownNote="1-hour cooldown between attempts (30 min with Alchemy Mastery)"
          />
        )}

        {/* ── Tribulation Tab ─────────────────────────────────────────────── */}
        {!loading && activeTab === "tribulation" && (
          <AlchemyPanel
            recipes={filteredRecipes}
            inventory={inventory}
            processing={processing}
            selectedRecipe={selectedRecipe}
            alchemySelected={alchemySelected}
            setSelectedRecipe={setSelectedRecipe}
            setAlchemySelected={setAlchemySelected}
            onCraft={() => performCraft("tribulation")}
            recipeFilter={recipeFilter}
            setRecipeFilter={setRecipeFilter}
            description="Attempt to forge Mythic and Legendary items through Tribulation crafting. High risk: 30% base success. Failure may destroy ingredients or cost XP."
            cooldownNote="24-hour cooldown between attempts"
            dangerMode
          />
        )}

        {/* ── Recipe Book Tab ─────────────────────────────────────────────── */}
        {!loading && activeTab === "recipes" && (
          <div className="space-y-4">
            <div className="flex gap-2 flex-wrap">
              {(["all", "known", "unknown"] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setRecipeFilter(f)}
                  className={`px-3 py-1 rounded-full text-xs font-medium capitalize transition-colors ${
                    recipeFilter === f ? "bg-foreground text-background" : "bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {filteredRecipes.length === 0 && (
                <div className="col-span-full text-center py-14 text-muted-foreground text-sm">
                  No recipes found. Open Iron Chests or above to discover Recipe Scrolls.
                </div>
              )}
              {filteredRecipes.map(recipe => (
                <div
                  key={recipe.id}
                  className={`p-4 rounded-xl border bg-card ${RARITY_BORDER[recipe.result_rarity] ?? "border-border"} ${
                    !recipe.is_known ? "opacity-60" : ""
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-3xl shrink-0 leading-none">{recipe.result_icon}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2 flex-wrap">
                        <span className="font-semibold text-sm text-foreground">{recipe.result_name}</span>
                        <Badge className={`text-[10px] capitalize ${RARITY_BADGE[recipe.result_rarity] ?? ""}`}>
                          {recipe.result_rarity}
                        </Badge>
                        {recipe.is_known && (
                          <Badge variant="outline" className="text-[10px] border-green-500/50 text-green-600 dark:text-green-400">Known</Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1 capitalize">{recipe.recipe_type} · {recipe.base_success_rate}% base success</div>
                      {recipe.required_cauldron && (
                        <div className="text-xs text-orange-600 dark:text-orange-400 mt-0.5">Requires: {recipe.required_cauldron.replace("cauldron_", "").replace(/^\w/, c => c.toUpperCase())} Cauldron</div>
                      )}
                      <div className="flex gap-1 mt-2 flex-wrap">
                        {[recipe.ing1_name, recipe.ing2_name, recipe.ing3_name, recipe.ing4_name]
                          .filter(Boolean)
                          .map((name, i) => {
                            const icons = [recipe.ing1_icon, recipe.ing2_icon, recipe.ing3_icon, recipe.ing4_icon];
                            return (
                              <span key={i} className="text-xs bg-muted px-2 py-0.5 rounded-full text-muted-foreground">
                                {icons[i]} {name}
                              </span>
                            );
                          })}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Fusion Result Dialog */}
      <Dialog open={!!fusionResult} onOpenChange={(open) => { if (!open) setFusionResult(null); }}>
        <DialogContent className="max-w-sm">
          {fusionResult && (
            <>
              <DialogHeader>
                <DialogTitle className="text-center text-xl">Fusion Complete!</DialogTitle>
                <DialogDescription className="text-center text-sm">
                  {fusionResult.message}
                </DialogDescription>
              </DialogHeader>
              <div className={`flex flex-col items-center gap-2 p-6 rounded-xl border mt-2 ${RARITY_BORDER[fusionResult.rarity] ?? "border-border"}`}>
                <span className="text-5xl leading-none">{fusionResult.icon}</span>
                <div className="font-bold text-lg text-foreground">{fusionResult.name}</div>
                <Badge className={`capitalize ${RARITY_BADGE[fusionResult.rarity] ?? ""}`}>{fusionResult.rarity}</Badge>
              </div>
              <Button className="mt-2 w-full" onClick={() => setFusionResult(null)}>
                Excellent!
              </Button>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Craft Result Dialog */}
      <Dialog open={!!craftResult} onOpenChange={(open) => { if (!open) { setCraftResult(null); setSelectedRecipe(null); } }}>
        <DialogContent className="max-w-sm">
          {craftResult && (
            <>
              <DialogHeader>
                <DialogTitle className="text-center text-xl">
                  {craftResult.success ? "Success!" : craftResult.outcome === "backlash" ? "Backlash!" : "Failed"}
                </DialogTitle>
                <DialogDescription className="text-center text-sm mt-1">
                  {craftResult.message}
                </DialogDescription>
              </DialogHeader>
              {craftResult.success && craftResult.result && (
                <div className={`flex flex-col items-center gap-2 p-5 rounded-xl border mt-2 ${RARITY_BORDER[craftResult.result.rarity] ?? "border-border"}`}>
                  <span className="text-4xl leading-none">{craftResult.result.icon}</span>
                  <div className="font-bold text-foreground">{craftResult.result.name}</div>
                  <Badge className={`capitalize ${RARITY_BADGE[craftResult.result.rarity] ?? ""}`}>{craftResult.result.rarity}</Badge>
                </div>
              )}
              {!craftResult.success && (
                <div className="p-4 rounded-xl border border-destructive/30 bg-destructive/5 text-xs text-destructive/80 text-center">
                  {craftResult.outcome === "destroyed" && "All ingredients lost to the void."}
                  {craftResult.outcome === "consolation" && "Ingredients lost, but the heavens took pity on you."}
                  {craftResult.outcome === "backlash" && `Struck by tribulation energy.${craftResult.xpLost ? ` −${craftResult.xpLost} XP.` : ""} Ingredients preserved — try again.`}
                </div>
              )}
              <Button className="mt-2 w-full" onClick={() => { setCraftResult(null); setSelectedRecipe(null); }}>
                OK
              </Button>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Shared Alchemy / Tribulation Panel ───────────────────────────────────────

function AlchemyPanel({
  recipes,
  inventory,
  processing,
  selectedRecipe,
  alchemySelected,
  setSelectedRecipe,
  setAlchemySelected,
  onCraft,
  recipeFilter,
  setRecipeFilter,
  description,
  cooldownNote,
  dangerMode = false,
}: {
  recipes: Recipe[];
  inventory: InventoryItem[];
  processing: boolean;
  selectedRecipe: Recipe | null;
  alchemySelected: InventoryItem[];
  setSelectedRecipe: (r: Recipe | null) => void;
  setAlchemySelected: (items: InventoryItem[]) => void;
  onCraft: () => void;
  recipeFilter: string;
  setRecipeFilter: (f: any) => void;
  description: string;
  cooldownNote: string;
  dangerMode?: boolean;
}) {
  const knownRecipes = recipes.filter(r => r.is_known);

  return (
    <div className="space-y-5">
      <div className={`p-4 rounded-xl border text-sm space-y-1 ${
        dangerMode
          ? "border-orange-300/40 bg-orange-50 text-orange-700 dark:border-orange-700/40 dark:bg-orange-950/30 dark:text-orange-300"
          : "border-primary/20 bg-primary/5 text-foreground"
      }`}>
        <div>{description}</div>
        <div className="text-xs text-muted-foreground">{cooldownNote}</div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {/* Recipe list */}
        <div className="md:col-span-2 space-y-2">
          <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Known Recipes</h3>
          {knownRecipes.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground text-sm">
              No recipes known. Use Recipe Scrolls from your bag!
            </div>
          ) : (
            <div className="space-y-1.5 max-h-[420px] overflow-y-auto pr-1">
              {knownRecipes.map(recipe => (
                <button
                  key={recipe.id}
                  onClick={() => {
                    setSelectedRecipe(recipe);
                    setAlchemySelected([]);
                  }}
                  className={`w-full flex items-center gap-2.5 p-2.5 rounded-lg border text-left transition-colors ${
                    selectedRecipe?.id === recipe.id
                      ? "border-primary/40 bg-primary/10"
                      : "border-border bg-card hover:bg-muted"
                  }`}
                >
                  <span className="text-2xl shrink-0 leading-none">{recipe.result_icon}</span>
                  <div className="min-w-0">
                    <div className="text-sm font-medium leading-tight truncate text-foreground">{recipe.result_name}</div>
                    <div className="text-[10px] text-muted-foreground capitalize">
                      {recipe.result_rarity} · {recipe.base_success_rate}%
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Crafting area */}
        <div className="md:col-span-3 space-y-3">
          {!selectedRecipe ? (
            <div className="flex items-center justify-center h-40 rounded-xl border border-dashed border-border text-muted-foreground text-sm">
              Select a recipe to begin
            </div>
          ) : (
            <>
              {/* Recipe details */}
              <div className={`p-3 rounded-xl border bg-card ${RARITY_BORDER[selectedRecipe.result_rarity] ?? "border-border"}`}>
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-3xl leading-none">{selectedRecipe.result_icon}</span>
                  <div>
                    <div className="font-semibold text-foreground">{selectedRecipe.result_name}</div>
                    <Badge className={`text-[10px] capitalize ${RARITY_BADGE[selectedRecipe.result_rarity] ?? ""}`}>
                      {selectedRecipe.result_rarity}
                    </Badge>
                  </div>
                </div>

                <div className="text-xs text-muted-foreground mb-2">Required ingredients:</div>
                <div className="flex gap-1.5 flex-wrap">
                  {[
                    { name: selectedRecipe.ing1_name, icon: selectedRecipe.ing1_icon, rarity: selectedRecipe.ing1_rarity },
                    { name: selectedRecipe.ing2_name, icon: selectedRecipe.ing2_icon, rarity: selectedRecipe.ing2_rarity },
                    { name: selectedRecipe.ing3_name, icon: selectedRecipe.ing3_icon, rarity: selectedRecipe.ing3_rarity },
                    { name: selectedRecipe.ing4_name, icon: selectedRecipe.ing4_icon, rarity: selectedRecipe.ing4_rarity },
                  ].filter(i => i.name).map((ing, idx) => (
                    <span key={idx} className="text-xs bg-muted px-2 py-0.5 rounded-full text-muted-foreground">
                      {ing.icon} {ing.name}
                    </span>
                  ))}
                </div>
                {selectedRecipe.required_cauldron && (
                  <div className="text-xs text-orange-600 dark:text-orange-400 mt-2 flex items-center gap-1">
                    <FlaskConical className="w-3 h-3" />
                    Cauldron required: {selectedRecipe.required_cauldron.replace("cauldron_", "").replace(/^\w/, c => c.toUpperCase())}
                  </div>
                )}
              </div>

              {/* Ingredient selection from bag */}
              <div className="space-y-2">
                <h4 className="text-xs text-muted-foreground uppercase tracking-wider">Select ingredients from bag:</h4>
                {inventory.filter(item => item.category === "ingredient").length === 0 ? (
                  <div className="text-muted-foreground text-xs py-4 text-center">No ingredients in bag. Open chests!</div>
                ) : (
                  <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                    {inventory.filter(i => i.category === "ingredient").map(item => {
                      const isSelected = alchemySelected.some(i => i.id === item.id);
                      return (
                        <button
                          key={item.id}
                          onClick={() => {
                            setAlchemySelected(
                              isSelected
                                ? alchemySelected.filter(i => i.id !== item.id)
                                : [...alchemySelected, item],
                            );
                          }}
                          className={`flex items-center gap-1 px-2 py-1 rounded-lg border text-xs transition-colors ${
                            isSelected
                              ? "border-primary/50 bg-primary/10 text-foreground"
                              : "border-border bg-card text-muted-foreground hover:bg-muted"
                          }`}
                        >
                          {item.icon} {item.name}
                          {isSelected && <span className="text-primary font-bold ml-0.5">✓</span>}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <Button
                variant={dangerMode ? "destructive" : "default"}
                className="w-full font-semibold"
                disabled={processing}
                onClick={onCraft}
              >
                {processing ? (
                  <><Loader2 className="w-4 h-4 animate-spin mr-2" />Crafting…</>
                ) : dangerMode ? (
                  <><Zap className="w-4 h-4 mr-2" />Attempt Tribulation</>
                ) : (
                  <><FlaskConical className="w-4 h-4 mr-2" />Attempt Alchemy</>
                )}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
