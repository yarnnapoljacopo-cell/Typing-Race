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

  const TABS: { key: Tab; label: string; icon: string }[] = [
    { key: "fusion", label: "Fusion", icon: "🔮" },
    { key: "alchemy", label: "Alchemy", icon: "⚗️" },
    { key: "tribulation", label: "Tribulation", icon: "⚡" },
    { key: "recipes", label: "Recipe Book", icon: "📖" },
  ];

  return (
    <div className="min-h-screen bg-[#0F1117] text-white">
      {/* Header */}
      <div className="border-b border-white/10 bg-[#15181F] sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => setLocation("/portal")}
            className="text-white/60 hover:text-white transition-colors text-sm flex items-center gap-1"
          >
            ← Portal
          </button>
          <div className="w-px h-4 bg-white/20" />
          <h1 className="font-bold text-lg">⚗️ Crafting Lab</h1>
          <div className="ml-auto flex gap-2">
            <button onClick={() => setLocation("/bag")} className="text-sm bg-indigo-700 hover:bg-indigo-600 px-3 py-1 rounded-lg font-medium transition-colors">🎒 Bag</button>
            <button onClick={() => setLocation("/chests")} className="text-sm bg-amber-600 hover:bg-amber-500 px-3 py-1 rounded-lg font-medium transition-colors">🎁 Chests</button>
          </div>
        </div>

        {/* Tab nav */}
        <div className="max-w-5xl mx-auto px-4 flex gap-0 border-t border-white/5">
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-5 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
                activeTab === tab.key
                  ? "border-indigo-400 text-indigo-300"
                  : "border-transparent text-white/50 hover:text-white/80"
              }`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6">
        {loading && (
          <div className="flex items-center justify-center py-20 text-white/40 text-sm">
            Loading crafting lab…
          </div>
        )}

        {/* ── Fusion Tab ─────────────────────────────────────────────────── */}
        {!loading && activeTab === "fusion" && (
          <div className="space-y-6">
            <div className="p-4 rounded-xl border border-indigo-500/30 bg-indigo-900/20 text-sm text-indigo-300 space-y-1">
              <div className="font-semibold text-indigo-200">Fusion: 3 identical items → 1 upgraded item</div>
              <div className="text-indigo-400/80">Select 3 identical items from your bag to fuse them into a random item of the next rarity tier. Works up to Epic rarity.</div>
            </div>

            {/* Selection tray */}
            <div className="flex gap-3 p-4 bg-white/3 rounded-xl border border-white/10 min-h-[88px] items-center">
              <span className="text-xs text-white/40 shrink-0">Selected:</span>
              <div className="flex gap-2 flex-1 flex-wrap items-center">
                {fusionGroupItemId !== null && (() => {
                  const group = fusionCandidates[fusionGroupItemId] ?? [];
                  const item = group[0];
                  if (!item) return null;
                  return (
                    <button
                      onClick={() => setFusionGroupItemId(null)}
                      className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border text-sm ${RARITY_BORDER[item.rarity] ?? "border-white/20"} bg-indigo-900/30 hover:bg-red-900/20`}
                    >
                      {item.icon} {item.name} ×3
                      <span className="text-white/40 text-xs ml-1">✕</span>
                    </button>
                  );
                })()}
                {fusionGroupItemId === null && (
                  <span className="text-white/30 text-sm italic">Click an item below to select it for fusion…</span>
                )}
              </div>
              {fusionGroupItemId !== null && (
                <Button
                  onClick={performFusion}
                  disabled={processing}
                  className="shrink-0 bg-indigo-600 hover:bg-indigo-500 font-bold px-5"
                >
                  {processing ? "Fusing…" : "🔮 Fuse!"}
                </Button>
              )}
            </div>

            {fusableGroups.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-14">
                <div className="text-4xl opacity-30">🔮</div>
                <p className="text-white/40 text-sm text-center">You need at least 3 identical items to attempt Fusion.<br />Open chests to collect duplicates!</p>
              </div>
            ) : (
              <div className="space-y-2">
                <h3 className="text-xs text-white/50 uppercase tracking-wider">Fusable items (3+ copies in bag)</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {fusableGroups.map(group => {
                    const item = group[0];
                    const totalQty = group.reduce((s, i) => s + (i.quantity ?? 1), 0);
                    const isSelected = fusionGroupItemId === item.item_id;
                    return (
                      <button
                        key={item.item_id}
                        onClick={() => setFusionGroupItemId(isSelected ? null : item.item_id)}
                        className={`relative p-3 rounded-xl border transition-all text-center ${
                          RARITY_BORDER[item.rarity] ?? "border-white/20"
                        } ${isSelected ? "bg-indigo-900/40 border-indigo-400/60 scale-105" : "bg-white/3 hover:bg-white/8"}`}
                      >
                        <div className="text-3xl mb-1">{item.icon}</div>
                        <div className="text-xs font-medium leading-tight">{item.name}</div>
                        <div className="text-[10px] text-white/40 mt-1 capitalize">{item.rarity}</div>
                        <span className="absolute top-1.5 right-1.5 text-[10px] bg-black/60 px-1.5 py-0.5 rounded-full font-bold">
                          ×{totalQty}
                        </span>
                        {isSelected && (
                          <span className="absolute top-1.5 left-1.5 text-[10px] bg-indigo-600 px-1.5 py-0.5 rounded-full font-bold">
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
                    recipeFilter === f ? "bg-indigo-600 text-white" : "bg-white/5 text-white/50 hover:bg-white/10"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {filteredRecipes.length === 0 && (
                <div className="col-span-full text-center py-14 text-white/30 text-sm">
                  No recipes found. Open Iron Chests or above to discover Recipe Scrolls.
                </div>
              )}
              {filteredRecipes.map(recipe => (
                <div
                  key={recipe.id}
                  className={`p-4 rounded-xl border ${RARITY_BORDER[recipe.result_rarity] ?? "border-white/20"} ${
                    recipe.is_known ? "bg-white/4" : "bg-white/2 opacity-60"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-3xl shrink-0">{recipe.result_icon}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        <span className="font-semibold text-sm">{recipe.result_name}</span>
                        <Badge className={`text-[10px] capitalize ${RARITY_BADGE[recipe.result_rarity] ?? ""}`}>
                          {recipe.result_rarity}
                        </Badge>
                        {recipe.is_known && (
                          <Badge variant="outline" className="text-[10px] border-emerald-600 text-emerald-400">Known</Badge>
                        )}
                      </div>
                      <div className="text-xs text-white/40 mt-1 capitalize">{recipe.recipe_type} · {recipe.base_success_rate}% base success</div>
                      {recipe.required_cauldron && (
                        <div className="text-xs text-orange-400/80 mt-0.5">Requires: {recipe.required_cauldron.replace("cauldron_", "").replace(/^\w/, c => c.toUpperCase())} Cauldron</div>
                      )}
                      <div className="flex gap-1 mt-2 flex-wrap">
                        {[recipe.ing1_name, recipe.ing2_name, recipe.ing3_name, recipe.ing4_name]
                          .filter(Boolean)
                          .map((name, i) => {
                            const icons = [recipe.ing1_icon, recipe.ing2_icon, recipe.ing3_icon, recipe.ing4_icon];
                            return (
                              <span key={i} className="text-xs bg-white/5 px-2 py-0.5 rounded-full text-white/60">
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
        <DialogContent className="bg-[#1A1D26] border-white/10 text-white max-w-sm">
          {fusionResult && (
            <>
              <DialogHeader>
                <DialogTitle className="text-center text-xl">🔮 Fusion Complete!</DialogTitle>
                <DialogDescription className="text-center text-white/60 text-sm">
                  {fusionResult.message}
                </DialogDescription>
              </DialogHeader>
              <div className={`flex flex-col items-center gap-2 p-6 rounded-xl border mt-2 ${RARITY_BORDER[fusionResult.rarity] ?? "border-white/20"}`}>
                <span className="text-5xl">{fusionResult.icon}</span>
                <div className="font-bold text-lg">{fusionResult.name}</div>
                <Badge className={`capitalize ${RARITY_BADGE[fusionResult.rarity] ?? ""}`}>{fusionResult.rarity}</Badge>
              </div>
              <Button className="mt-2 bg-indigo-600 hover:bg-indigo-500 w-full" onClick={() => setFusionResult(null)}>
                Excellent!
              </Button>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Craft Result Dialog */}
      <Dialog open={!!craftResult} onOpenChange={(open) => { if (!open) { setCraftResult(null); setSelectedRecipe(null); } }}>
        <DialogContent className="bg-[#1A1D26] border-white/10 text-white max-w-sm">
          {craftResult && (
            <>
              <DialogHeader>
                <DialogTitle className="text-center text-xl">
                  {craftResult.success ? "✨ Success!" : craftResult.outcome === "backlash" ? "⚡ Backlash!" : "💀 Failed"}
                </DialogTitle>
                <DialogDescription className="text-center text-white/70 text-sm mt-2">
                  {craftResult.message}
                </DialogDescription>
              </DialogHeader>
              {craftResult.success && craftResult.result && (
                <div className={`flex flex-col items-center gap-2 p-5 rounded-xl border mt-2 ${RARITY_BORDER[craftResult.result.rarity] ?? "border-white/20"}`}>
                  <span className="text-4xl">{craftResult.result.icon}</span>
                  <div className="font-bold">{craftResult.result.name}</div>
                  <Badge className={`capitalize ${RARITY_BADGE[craftResult.result.rarity] ?? ""}`}>{craftResult.result.rarity}</Badge>
                </div>
              )}
              {!craftResult.success && (
                <div className="p-4 rounded-xl border border-red-800/50 bg-red-900/20 text-xs text-red-300/80 text-center">
                  {craftResult.outcome === "destroyed" && "All ingredients lost to the void."}
                  {craftResult.outcome === "consolation" && "Ingredients lost, but the heavens took pity on you."}
                  {craftResult.outcome === "backlash" && `You were struck by tribulation energy.${craftResult.xpLost ? ` −${craftResult.xpLost} XP.` : ""} Ingredients preserved — try again.`}
                </div>
              )}
              <Button className="mt-2 bg-indigo-600 hover:bg-indigo-500 w-full" onClick={() => { setCraftResult(null); setSelectedRecipe(null); }}>
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
        dangerMode ? "border-orange-500/30 bg-orange-900/20 text-orange-300" : "border-indigo-500/30 bg-indigo-900/20 text-indigo-300"
      }`}>
        <div>{description}</div>
        <div className={`text-xs ${dangerMode ? "text-orange-400/70" : "text-indigo-400/70"}`}>{cooldownNote}</div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {/* Recipe list */}
        <div className="md:col-span-2 space-y-2">
          <h3 className="text-xs uppercase tracking-wider text-white/40 font-semibold">Known Recipes</h3>
          {knownRecipes.length === 0 ? (
            <div className="text-center py-10 text-white/30 text-sm">
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
                      ? "border-indigo-400/60 bg-indigo-900/40"
                      : "border-white/10 bg-white/3 hover:bg-white/7"
                  }`}
                >
                  <span className="text-2xl shrink-0">{recipe.result_icon}</span>
                  <div className="min-w-0">
                    <div className="text-sm font-medium leading-tight truncate">{recipe.result_name}</div>
                    <div className="text-[10px] text-white/40 capitalize">
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
            <div className="flex items-center justify-center h-40 rounded-xl border border-dashed border-white/10 text-white/30 text-sm">
              ← Select a recipe to begin
            </div>
          ) : (
            <>
              {/* Recipe details */}
              <div className={`p-3 rounded-xl border ${RARITY_BORDER[selectedRecipe.result_rarity] ?? "border-white/20"} bg-white/3`}>
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-3xl">{selectedRecipe.result_icon}</span>
                  <div>
                    <div className="font-semibold">{selectedRecipe.result_name}</div>
                    <Badge className={`text-[10px] capitalize ${RARITY_BADGE[selectedRecipe.result_rarity] ?? ""}`}>
                      {selectedRecipe.result_rarity}
                    </Badge>
                  </div>
                </div>

                <div className="text-xs text-white/50 mb-2">Required ingredients:</div>
                <div className="flex gap-1.5 flex-wrap">
                  {[
                    { name: selectedRecipe.ing1_name, icon: selectedRecipe.ing1_icon, rarity: selectedRecipe.ing1_rarity },
                    { name: selectedRecipe.ing2_name, icon: selectedRecipe.ing2_icon, rarity: selectedRecipe.ing2_rarity },
                    { name: selectedRecipe.ing3_name, icon: selectedRecipe.ing3_icon, rarity: selectedRecipe.ing3_rarity },
                    { name: selectedRecipe.ing4_name, icon: selectedRecipe.ing4_icon, rarity: selectedRecipe.ing4_rarity },
                  ].filter(i => i.name).map((ing, idx) => (
                    <span key={idx} className="text-xs bg-white/5 px-2 py-0.5 rounded-full text-white/70">
                      {ing.icon} {ing.name}
                    </span>
                  ))}
                </div>
                {selectedRecipe.required_cauldron && (
                  <div className="text-xs text-orange-400 mt-2">
                    ⚗️ Cauldron required: {selectedRecipe.required_cauldron.replace("cauldron_", "").replace(/^\w/, c => c.toUpperCase())}
                  </div>
                )}
              </div>

              {/* Ingredient selection from bag */}
              <div className="space-y-2">
                <h4 className="text-xs text-white/40 uppercase tracking-wider">Select ingredients from bag:</h4>
                {inventory.filter(item => item.category === "ingredient").length === 0 ? (
                  <div className="text-white/30 text-xs py-4 text-center">No ingredients in bag. Open chests!</div>
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
                              ? "border-indigo-400/60 bg-indigo-900/40 text-indigo-200"
                              : "border-white/10 bg-white/3 text-white/70 hover:bg-white/8"
                          }`}
                        >
                          {item.icon} {item.name}
                          {isSelected && <span className="text-indigo-400">✓</span>}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <Button
                className={`w-full font-bold ${
                  dangerMode
                    ? "bg-orange-700 hover:bg-orange-600"
                    : "bg-indigo-600 hover:bg-indigo-500"
                }`}
                disabled={processing}
                onClick={onCraft}
              >
                {processing ? "Crafting…" : dangerMode ? "⚡ Attempt Tribulation" : "⚗️ Attempt Alchemy"}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
