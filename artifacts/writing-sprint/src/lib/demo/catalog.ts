import { DEMO_ITEM_DEFS, DEMO_RECIPE_DEFS, type ItemDef } from "./catalogData";

export const RARITIES = ["common", "uncommon", "rare", "epic", "mythic", "legendary"];
function sellValue(item: ItemDef) {
  if (item.sellValue !== undefined) return item.sellValue;
  if (item.isTradeable === false || item.category === "recipe" || (item.rarity === "legendary" && item.category !== "ingredient")) return 0;
  const values = item.category === "pill" ? [2, 6, 0, 20, 50, 0] : item.category === "ingredient" ? [1, 3, 8, 15, 25, 50] : [2, 8, 20, 55, 140, 0];
  return values[RARITIES.indexOf(item.rarity)] ?? 0;
}

export const DEMO_ITEMS = DEMO_ITEM_DEFS.map((item, index) => ({
  // The old placeholder used ID 1; reserve that ID when migrating old saves.
  id: index + 1000, item_id: index + 1000, name: item.name, description: item.description,
  category: item.category, rarity: item.rarity, icon: item.icon,
  effect_type: item.effectType ?? null, effect_value: item.effectValue ?? null,
  effect_duration: item.effectDuration ?? null, stack_limit: item.stackLimit ?? 1,
  sell_value: sellValue(item), is_storage_item: item.isStorageItem ?? false,
  storage_slot_count: item.storageSlotCount ?? null, is_chest_obtainable: item.isChestObtainable ?? true,
}));
export function demoItem(name: string) {
  const item = DEMO_ITEMS.find(item => item.name === name);
  if (!item) throw new Error(`Unknown demo catalog item: ${name}`);
  return item;
}
export const DEMO_RECIPES = DEMO_RECIPE_DEFS.map((recipe, index) => {
  const result = demoItem(recipe.result);
  const ingredients = recipe.ingredients.map(demoItem);
  return {
    id: index + 1, recipe_id: index + 1, result_item_id: result.item_id,
    result_name: result.name, result_icon: result.icon, result_rarity: result.rarity,
    result_description: result.description, required_cauldron: recipe.cauldron ?? null,
    base_success_rate: recipe.successRate, recipe_type: recipe.type,
    ingredient_1_id: ingredients[0]?.item_id ?? null, ingredient_2_id: ingredients[1]?.item_id ?? null,
    ingredient_3_id: ingredients[2]?.item_id ?? null, ingredient_4_id: ingredients[3]?.item_id ?? null,
    ing1_name: ingredients[0]?.name ?? null, ing1_icon: ingredients[0]?.icon ?? null, ing1_rarity: ingredients[0]?.rarity ?? null,
    ing2_name: ingredients[1]?.name ?? null, ing2_icon: ingredients[1]?.icon ?? null, ing2_rarity: ingredients[1]?.rarity ?? null,
    ing3_name: ingredients[2]?.name ?? null, ing3_icon: ingredients[2]?.icon ?? null, ing3_rarity: ingredients[2]?.rarity ?? null,
    ing4_name: ingredients[3]?.name ?? null, ing4_icon: ingredients[3]?.icon ?? null, ing4_rarity: ingredients[3]?.rarity ?? null,
  };
});

type Merchant = "mortal" | "earth" | "heaven";
type Kind = "chest" | "item" | "recipe" | "mystery_crate";
function listing(id: number, name: string, merchant: Merchant, kind: Kind, target: string, quantity: number, price: number, description: string) {
  const item = kind === "item" ? demoItem(target) : null;
  const recipe = kind === "recipe" ? DEMO_RECIPES.find(recipe => recipe.result_name === target) : null;
  if (kind === "recipe" && !recipe) throw new Error(`Unknown recipe: ${target}`);
  return { id, name, merchant, listing_type: kind, item_type: kind === "chest" ? `${target}_chest` : kind,
    quantity, price, description, icon: item?.icon ?? (kind === "recipe" ? "📜" : "🎁"),
    result_item_id: item?.item_id ?? null, result_recipe_id: recipe?.id ?? null,
    featured_eligible: kind !== "mystery_crate", purchases_today: 0 };
}
// Match ensureSchema.ts: all three merchants, original prices and bundle sizes.
export const DEMO_LISTINGS = [
  listing(1, "Mortal Chest", "mortal", "chest", "mortal", 1, 50, "A basic chest of common cultivation resources."),
  listing(2, "Iron Chest", "mortal", "chest", "iron", 1, 300, "Improved rewards with higher rarity drops."),
  listing(3, "Iron Chest ×3", "mortal", "chest", "iron", 3, 800, "Three Iron Chests for a bulk discount."),
  listing(4, "Crystal Chest", "mortal", "chest", "crystal", 1, 800, "Crystalline chest with rare cultivation treasures."),
  listing(5, "Inferno Chest", "mortal", "chest", "inferno", 1, 2500, "Forged in heavenly flames. Exceptional rewards."),
  listing(6, "Immortal Chest", "mortal", "chest", "immortal", 1, 7000, "The pinnacle chest. Mythic power within."),
  listing(7, "Mystery Crate", "mortal", "mystery_crate", "", 1, 500, "A sealed box. Roll the heavens for a random chest tier — Common to Immortal."),
  listing(100, "Body Tempering Pill ×3", "earth", "item", "Body Tempering Pill", 3, 120, "Three uncommon pills, +150 XP each."),
  listing(101, "Meridian Clearing Pill", "earth", "item", "Meridian Clearing Pill", 1, 220, "Doubles XP from your next sprint. The Apothecary swears by it."),
  listing(102, "Heaven Qi Pill ×2", "earth", "item", "Heaven Qi Pill", 2, 240, "Condensed heavenly Qi — two doses, +150 XP each."),
  listing(103, "Luck Enhancing Pill", "earth", "item", "Luck Enhancing Pill", 1, 180, "Bends fortune over your next 3 chests."),
  listing(104, "Foundation Pill", "earth", "item", "Foundation Pill", 1, 360, "Solidifies your foundation — a single dose grants 400 XP."),
  listing(105, "Time Acceleration Elixir", "earth", "item", "Time Acceleration Elixir", 1, 700, "Doubles XP for 60 minutes of active sprint writing."),
  listing(106, "Fortune Reversal Pill", "earth", "item", "Fortune Reversal Pill", 1, 450, "If your next chest yields Common, it is automatically rerolled once."),
  listing(120, "Recipe: Yin-Yang Harmony Pill", "earth", "recipe", "Yin-Yang Harmony Pill", 1, 1200, "Adds the Yin-Yang Harmony Pill recipe to your Crafting tome."),
  listing(121, "Recipe: Foundation Pill", "earth", "recipe", "Foundation Pill", 1, 1500, "Adds the Foundation Pill recipe to your Crafting tome."),
  listing(122, "Recipe: Lightning Tribulation Remnant", "earth", "recipe", "Lightning Tribulation Remnant Pill", 1, 1800, "Adds the Lightning Tribulation Remnant Pill recipe."),
  listing(123, "Recipe: Dragon Bloodline Fragment Pill", "earth", "recipe", "Dragon Bloodline Fragment Pill", 1, 2200, "Adds the Dragon Bloodline Fragment Pill recipe to your Crafting tome."),
  listing(200, "Triple XP Pill", "heaven", "item", "Triple XP Pill", 1, 3200, "The Hermit's rarest stock. Triples XP from your next 3 sprints."),
  listing(201, "Fate Altering Pill", "heaven", "item", "Fate Altering Pill", 1, 2400, "Rewrites destiny — rerolls the rarity tier of the next chest you open."),
  listing(202, "Karma Pill", "heaven", "item", "Karma Pill", 1, 5000, "Recovers XP lost through crafting failures, capped at 10,000."),
  listing(203, "Taiji Pill", "heaven", "item", "Taiji Pill", 1, 2200, "Primordial balance condensed — instant 1,500 XP."),
  listing(204, "Core Pill", "heaven", "item", "Core Pill", 1, 1600, "Forms a true core of condensed Qi. +1,000 XP, immediately."),
  listing(220, "Inferno Chest ×2", "heaven", "chest", "inferno", 2, 4500, "Two Infernos at a discount only the Hermit will offer."),
  listing(221, "Immortal Chest ×2", "heaven", "chest", "immortal", 2, 12000, "Two Immortal Chests — the Hermit's benevolence."),
];

export function demoFeatured(now = Date.now()) {
  const eligible = DEMO_LISTINGS.filter(item => item.featured_eligible);
  const day = Math.floor(now / 86400000);
  return { listing_id: eligible[day % eligible.length].id, discount_pct: 25, ends_at: new Date((day + 1) * 86400000).toISOString() };
}

export const CHEST_RULES: Record<string, {weights: number[]; bonus: [number, number]; coins: [number, number]}> = {
  mortal: {weights: [54.95, 30, 10, 5, 0, .05], bonus: [.15, 0], coins: [2, 5]},
  iron: {weights: [0, 9.7, 50, 30, 10, .3], bonus: [.25, .05], coins: [5, 15]},
  crystal: {weights: [0, 0, 20, 45, 30, 5], bonus: [.4, .12], coins: [10, 25]},
  inferno: {weights: [0, 0, 0, 10, 55, 35], bonus: [.55, .22], coins: [25, 50]},
  immortal: {weights: [0, 0, 0, 0, 60, 40], bonus: [1, .45], coins: [50, 100]},
};
export function weightedIndex(weights: number[], random = Math.random) {
  let value = random() * weights.reduce((total, weight) => total + weight, 0);
  for (let i = 0; i < weights.length; i++) { value -= weights[i]; if (value < 0) return i; }
  return weights.length - 1;
}
