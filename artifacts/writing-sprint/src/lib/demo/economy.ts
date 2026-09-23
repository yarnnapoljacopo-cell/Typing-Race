import { CHEST_RULES, DEMO_ITEMS, DEMO_LISTINGS, DEMO_RECIPES, demoFeatured, demoItem, RARITIES, weightedIndex } from "./catalog";

export type DemoInventoryItem = typeof DEMO_ITEMS[number] & {quantity: number; acquired_at: string; overflow_since: string | null};
type Effect = {id: number; item_name: string; icon: string; rarity: string; effect_type: string; effect_value: number; expires_at: string | null; metadata: string | null};
export function seedEconomy() {
  const stock = DEMO_ITEMS.filter(item => item.category === "ingredient" && RARITIES.indexOf(item.rarity) <= 2);
  stock.push(...["Qi Gathering Pill", "Body Tempering Pill", "Mortal Cultivation Jade Slip", "Bronze Alchemy Cauldron"].map(demoItem));
  return {catalogVersion: 2, knownRecipes: DEMO_RECIPES.filter(recipe => recipe.result_rarity === "common").map(recipe => recipe.id),
    activeEffects: [] as Effect[], craftingXpLost: 0, equippedStorageId: null as number | null,
    purchases: {} as Record<string, number>,
    inventory: stock.map(item => ({...item, quantity: item.category === "ingredient" ? 8 : 3, acquired_at: new Date().toISOString(), overflow_since: null})) as DemoInventoryItem[]};
}
type Economy = ReturnType<typeof seedEconomy> & {
  coins: number; chests: Record<string, number>; profile: {xp: number};
  wishlist: {listing_id: number; pinned_at: string} | null;
};

export function createDemoEconomy(data: Economy, save: () => void, random = Math.random) {
  const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), {status, headers: {"Content-Type": "application/json"}});
  const error = (message: string, status = 400) => reply({error: message}, status);
  const grant = (itemId: number, quantity = 1) => {
    const definition = DEMO_ITEMS.find(item => item.item_id === itemId)!;
    let owned = data.inventory.find(item => item.item_id === itemId);
    if (owned) owned.quantity += quantity;
    else { owned = {...definition, quantity, acquired_at: new Date().toISOString(), overflow_since: null}; data.inventory.push(owned); }
    return owned;
  };
  const consume = (item: DemoInventoryItem, quantity = 1) => {
    item.quantity -= quantity;
    data.inventory = data.inventory.filter(entry => entry.quantity > 0);
  };
  const liveEffects = () => data.activeEffects.filter(effect => !effect.expires_at || Date.parse(effect.expires_at) > Date.now());
  const storage = () => DEMO_ITEMS.find(item => item.item_id === data.equippedStorageId);
  const slots = () => 100 + (storage()?.storage_slot_count ?? 0);
  function grantSprintXp(words: number) {
    const effects = liveEffects();
    let multiplier = 1;
    for (const effect of effects) {
      if (["xp_double_next_sprint", "xp_timed_double"].includes(effect.effect_type)) multiplier = Math.max(multiplier, 2);
      if (effect.effect_type === "xp_triple_next_sprints") multiplier = Math.max(multiplier, 3);
      if (effect.effect_type === "xp_timed_bonus") multiplier += effect.effect_value / 100;
    }
    const gained = Math.max(0, Math.round(words * multiplier));
    data.profile.xp += gained;
    data.activeEffects = effects.filter(effect => {
      if (effect.effect_type === "xp_double_next_sprint") return false;
      if (effect.effect_type === "xp_triple_next_sprints") return --effect.effect_value > 0;
      return true;
    });
    return gained;
  }
  function handle(path: string, method: string, body: any): Response | null {
    if (path === "/demo/wallet/refill" && method === "POST") { data.coins += 25000; save(); return reply({balance: data.coins}); }
    if (path === "/shop" && method === "GET") return reply({balance: data.coins, featured: demoFeatured(), wishlist: data.wishlist,
      listings: DEMO_LISTINGS.map(item => ({...item, purchases_today: data.purchases[`${new Date().toISOString().slice(0, 10)}:${item.id}`] ?? 0}))});
    if (path === "/shop/wishlist") {
      if (method === "DELETE") data.wishlist = null;
      else if (method === "PUT" && DEMO_LISTINGS.some(item => item.id === Number(body.listing_id))) data.wishlist = {listing_id: Number(body.listing_id), pinned_at: new Date().toISOString()};
      else return error("Choose an available listing.");
      save(); return reply({ok: true});
    }
    if (path === "/shop/buy" && method === "POST") {
      const item = DEMO_LISTINGS.find(item => item.id === Number(body.listing_id));
      if (!item) return error("Listing not available.", 404);
      const discounted = item.id === demoFeatured().listing_id;
      const price = discounted ? Math.max(1, Math.floor(item.price * .75)) : item.price;
      if (data.coins < price) return error("Insufficient demo Spirit Coins. Use Refill demo coins to continue exploring.");
      if (item.listing_type === "recipe" && data.knownRecipes.includes(item.result_recipe_id!)) return error("This recipe is already in your tome. Your coins were kept.", 409);
      const result: Record<string, unknown> = {new_balance: data.coins - price, effective_price: price, featured_discount_applied: discounted, kind: item.listing_type, quantity_added: item.quantity};
      if (item.listing_type === "chest" || item.listing_type === "mystery_crate") {
        const type = item.listing_type === "chest" ? item.item_type.replace("_chest", "") : ["mortal", "iron", "crystal", "inferno", "immortal"][weightedIndex([50, 26, 14, 7, 3], random)];
        data.chests[type] = (data.chests[type] ?? 0) + item.quantity;
        result.chest_type = type;
      } else if (item.listing_type === "item") {
        const reward = grant(item.result_item_id!, item.quantity);
        Object.assign(result, {item_name: reward.name, item_icon: reward.icon, item_rarity: reward.rarity});
      } else { data.knownRecipes.push(item.result_recipe_id!); Object.assign(result, {recipe_id: item.result_recipe_id, newly_learned: true}); }
      data.coins -= price;
      const key = `${new Date().toISOString().slice(0, 10)}:${item.id}`;
      data.purchases[key] = (data.purchases[key] ?? 0) + 1;
      save(); return reply(result);
    }
    if (path === "/user/chests" && method === "GET") return reply(data.chests);
    if (path === "/user/chests/open" && method === "POST") {
      const type = body.chestType ?? body.chest_type;
      const rules = CHEST_RULES[type];
      if (!rules || !(data.chests[type] > 0)) return error("No chests of that type remain.");
      const effects = liveEffects();
      const count = 1 + Number(random() < rules.bonus[0]) + Number(random() < rules.bonus[1]);
      const rewards: DemoInventoryItem[] = [];
      for (let n = 0; n < count; n++) {
        let rarity = weightedIndex(rules.weights, random);
        if (effects.some(effect => effect.effect_type === "fortune_reversal") && rarity === 0) rarity = weightedIndex(rules.weights, random);
        if (effects.some(effect => effect.effect_type === "reroll_chest_rarity")) rarity = weightedIndex(rules.weights, random);
        if (effects.some(effect => effect.effect_type === "chest_luck")) rarity = Math.min(5, rarity + 1);
        const pool = DEMO_ITEMS.filter(item => item.rarity === RARITIES[rarity] && item.is_chest_obtainable && (type !== "mortal" || item.category !== "recipe") && (type !== "inferno" || item.category !== "ingredient"));
        const reward = pool[Math.floor(random() * pool.length)];
        if (reward) rewards.push({...grant(reward.item_id), quantity: 1});
      }
      data.activeEffects = effects.filter(effect => {
        if (["fortune_reversal", "reroll_chest_rarity"].includes(effect.effect_type)) return false;
        if (effect.effect_type === "chest_luck") return --effect.effect_value > 0;
        return true;
      });
      const coins = rules.coins[0] + Math.floor(random() * (rules.coins[1] - rules.coins[0] + 1));
      data.chests[type]--; data.coins += coins; save();
      return reply({ok: true, items: rewards, coins_awarded: coins, new_coin_balance: data.coins});
    }
    if (path === "/user/bag" && method === "GET") return reply({inventory: data.inventory, activeEffects: liveEffects(), totalSlots: slots(), failureAshes: data.craftingXpLost, cooldowns: {}});
    if (path === "/user/items-stats") return reply({collected: data.inventory.length, total: DEMO_ITEMS.length});
    if (path === "/storage/equipped" && method === "GET") {
      const item = storage();
      return reply({id: "demo-storage", user_id: "local-demo-writer", item_id: item?.item_id ?? null, slot_count: slots(), item_name: item?.name ?? null, item_icon: item?.icon ?? null, item_rarity: item?.rarity ?? null, items_used: data.inventory.length});
    }
    if (path === "/storage/equip" && method === "POST") {
      const item = data.inventory.find(item => item.id === Number(body.inventory_id));
      if (!item?.is_storage_item) return error("Choose a storage item from your bag.");
      const previous = storage();
      consume(item); if (previous) grant(previous.item_id);
      data.equippedStorageId = item.item_id; save();
      return reply({ok: true, new_slot_count: slots(), previously_equipped_item: previous ?? null});
    }
    if ((path === "/coins/sell" && method === "POST") || (path === "/user/bag/discard" && method === "DELETE")) {
      const item = data.inventory.find(item => item.id === Number(body.inventory_id ?? body.inventoryId));
      if (!item) return error("This item is no longer in your bag.", 404);
      const value = path === "/coins/sell" ? item.sell_value : 0;
      if (path === "/coins/sell" && !value) return error("This item cannot be sold.");
      consume(item); data.coins += value; save();
      return reply({ok: true, coins_earned: value, new_balance: data.coins});
    }
    if (path === "/user/bag/use" && method === "POST") {
      const item = data.inventory.find(item => item.id === Number(body.inventoryId));
      if (!item) return error("This item is no longer in your bag.", 404);
      const effect = item.effect_type ?? "";
      let xp = 0;
      if (effect === "xp_instant") xp = item.effect_value ?? 0;
      else if (effect === "impure_pill") xp = random() < .2 ? 0 : item.effect_value ?? 0;
      else if (effect === "karma_xp") { xp = Math.min(10000, data.craftingXpLost); data.craftingXpLost = 0; }
      else if (["xp_double_next_sprint", "xp_triple_next_sprints", "xp_timed_double", "chest_luck", "fortune_reversal", "reroll_chest_rarity", "xp_timed_bonus"].includes(effect)) {
        data.activeEffects = liveEffects().filter(active => active.effect_type !== effect);
        data.activeEffects.push({id: Date.now(), item_name: item.name, icon: item.icon, rarity: item.rarity, effect_type: effect,
          effect_value: item.effect_value ?? 1, expires_at: item.effect_duration ? new Date(Date.now() + item.effect_duration * 60000).toISOString() : null, metadata: null});
      } else if (item.category === "recipe") {
        const recipe = [...DEMO_RECIPES].sort((a,b) => b.result_name.length-a.result_name.length).find(recipe => item.description.includes(recipe.result_name));
        if (!recipe) return error("This rare technique needs a live account. The item stays in your bag.", 409);
        if (data.knownRecipes.includes(recipe.id)) return error("You already know this recipe.", 409);
        data.knownRecipes.push(recipe.id);
      } else return error("This special artifact needs a live account. The item stays in your bag.", 409);
      data.profile.xp += xp; consume(item); save();
      return reply({ok: true, message: xp ? `Cultivation increased by ${xp.toLocaleString()} XP.` : effect === "impure_pill" ? "The impure pill dissolved without granting Qi." : `${item.name} activated.`, xpGained: xp, xp: data.profile.xp});
    }
    if ((path === "/user/crafting/all-recipes" || path === "/user/crafting/recipes") && method === "GET") return reply(DEMO_RECIPES.map(recipe => ({...recipe, is_known: data.knownRecipes.includes(recipe.id)})).filter(recipe => path.endsWith("all-recipes") || recipe.is_known));
    if (path === "/user/crafting/fusion" && method === "POST") {
      const ids: unknown[] = Array.isArray(body.inventoryIds) ? body.inventoryIds : [];
      const item = data.inventory.find(item => item.id === Number(ids[0]));
      if (ids.length !== 3 || !item || !ids.every(id => id === item.id) || item.quantity < 3) return error("Fusion requires three copies of the same item.");
      const next = RARITIES[RARITIES.indexOf(item.rarity) + 1];
      if (RARITIES.indexOf(item.rarity) >= 3) return error("Fusion cannot produce Mythic or Legendary items.");
      const choices = DEMO_ITEMS.filter(candidate => candidate.rarity === next && candidate.category === item.category);
      if (!choices.length) return error("This item cannot be fused further.");
      consume(item, 3); const result = grant(choices[Math.floor(random() * choices.length)].item_id); save();
      return reply({ok: true, result, message: `Three ${item.name} refined into ${result.name}.`});
    }
    if (/^\/user\/crafting\/(alchemy|tribulation)$/.test(path) && method === "POST") {
      const recipe = DEMO_RECIPES.find(recipe => recipe.id === Number(body.recipeId) && path.endsWith(recipe.recipe_type));
      if (!recipe || !data.knownRecipes.includes(recipe.id)) return error("Learn this recipe before crafting it.", 403);
      const ids: unknown[] = Array.isArray(body.inventoryIds) ? body.inventoryIds : [];
      const selected = ids.map(id => data.inventory.find(item => item.id === Number(id)));
      const required = [recipe.ingredient_1_id, recipe.ingredient_2_id, recipe.ingredient_3_id, recipe.ingredient_4_id].filter(id => id !== null);
      if (selected.length !== required.length || selected.some(item => !item) || [...new Set(ids)].length !== ids.length || !required.every(id => selected.some(item => item!.item_id === id))) return error("Select exactly the ingredients listed in this recipe.");
      const bonuses: Record<string, number> = {cauldron_bronze: 20, cauldron_spirit: 35, cauldron_heaven: 40, cauldron_chaos: 40};
      const cauldron = Math.max(0, ...data.inventory.map(item => bonuses[item.effect_type ?? ""] ?? 0));
      if (recipe.required_cauldron && !data.inventory.some(item => item.effect_type === recipe.required_cauldron)) return error("This recipe requires its listed cauldron.");
      selected.forEach(item => consume(item!));
      const success = random() * 100 < Math.min(100, recipe.base_success_rate + cauldron);
      const result = success ? grant(recipe.result_item_id) : undefined;
      save(); return reply({ok: true, success, result, outcome: success ? "success" : "destroyed", message: success ? `${recipe.result_name} refined successfully.` : "The refinement failed. The ingredients were consumed."});
    }
    return null;
  }
  return {handle, grantSprintXp};
}
