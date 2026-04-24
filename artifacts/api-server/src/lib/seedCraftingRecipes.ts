import { pool } from "@workspace/db";
import { logger } from "./logger";

interface RecipeDef {
  result: string;
  ingredients: string[];
  cauldron?: string;
  successRate: number;
  type: "alchemy" | "tribulation";
  discoverable?: boolean;
}

const RECIPES: RecipeDef[] = [
  // ── Common alchemy ─────────────────────────────────────────────────────────
  {
    result: "Qi Gathering Pill",
    ingredients: ["Common Spirit Herb", "Mortal Qi Grass"],
    successRate: 80, type: "alchemy",
  },
  {
    result: "Earth Qi Pill",
    ingredients: ["Ash Root", "Stone Fragment"],
    successRate: 80, type: "alchemy",
  },
  {
    result: "Mortal Cleansing Pill",
    ingredients: ["Common Spirit Herb", "Impure Qi Crystal"],
    successRate: 75, type: "alchemy",
  },
  {
    result: "Impure Pill",
    ingredients: ["Stone Fragment", "Mortal Qi Grass"],
    successRate: 80, type: "alchemy",
  },

  // ── Uncommon alchemy ────────────────────────────────────────────────────────
  {
    result: "Body Tempering Pill",
    ingredients: ["Thousand Year Ginseng", "Iron Core Dust"],
    successRate: 75, type: "alchemy",
  },
  {
    result: "Meridian Clearing Pill",
    ingredients: ["Spirit Moss", "Cold Spring Water"],
    successRate: 75, type: "alchemy",
  },
  {
    result: "Heaven Qi Pill",
    ingredients: ["Jade Flower", "Solar Flame Petal"],
    successRate: 70, type: "alchemy",
  },
  {
    result: "Yin Gathering Pill",
    ingredients: ["Cold Spring Water", "Jade Flower"],
    successRate: 70, type: "alchemy",
  },
  {
    result: "Yang Gathering Pill",
    ingredients: ["Solar Flame Petal", "Thousand Year Ginseng"],
    successRate: 70, type: "alchemy",
  },
  {
    result: "Qi Condensation Pill",
    ingredients: ["Thousand Year Ginseng", "Spirit Moss", "Iron Core Dust"],
    successRate: 65, type: "alchemy",
  },
  {
    result: "Luck Enhancing Pill",
    ingredients: ["Solar Flame Petal", "Cold Spring Water", "Jade Flower"],
    successRate: 65, type: "alchemy",
  },
  {
    result: "Beast Bloodline Pill",
    ingredients: ["Iron Core Dust", "Thousand Year Ginseng", "Cold Spring Water"],
    successRate: 65, type: "alchemy",
  },

  // ── Rare alchemy ────────────────────────────────────────────────────────────
  {
    result: "Foundation Pill",
    ingredients: ["Blood Lotus", "Heaven Dew Drop", "Iron Core Dust"],
    successRate: 65, type: "alchemy",
  },
  {
    result: "Heaven Earth Pill",
    ingredients: ["Thunder Bamboo", "Blood Lotus", "Nine Cold Ice Grass"],
    successRate: 60, type: "alchemy",
  },
  {
    result: "Yin-Yang Harmony Pill",
    ingredients: ["Blood Lotus", "Nine Cold Ice Grass", "Heaven Dew Drop"],
    successRate: 60, type: "alchemy",
  },
  {
    result: "Fortune Reversal Pill",
    ingredients: ["Spirit Python Gallbladder", "Nine Cold Ice Grass", "Heaven Dew Drop"],
    successRate: 55, type: "alchemy",
  },
  {
    result: "Dragon Bloodline Fragment Pill",
    ingredients: ["Spirit Python Gallbladder", "Thunder Bamboo", "Blood Lotus"],
    successRate: 55, type: "alchemy",
  },
  {
    result: "Time Acceleration Elixir",
    ingredients: ["Crimson Spirit Mushroom", "Heaven Dew Drop", "Thunder Bamboo"],
    successRate: 55, type: "alchemy",
  },
  {
    result: "Lightning Tribulation Remnant Pill",
    ingredients: ["Thunder Bamboo", "Nine Cold Ice Grass", "Spirit Python Gallbladder"],
    successRate: 50, type: "alchemy",
  },
  {
    result: "Fate Altering Pill",
    ingredients: ["Crimson Spirit Mushroom", "Blood Lotus", "Spirit Python Gallbladder", "Heaven Dew Drop"],
    successRate: 50, type: "alchemy",
  },

  // ── Epic alchemy ─────────────────────────────────────────────────────────────
  {
    result: "Core Pill",
    ingredients: ["Nine Leaf Immortal Grass", "Dragon Whisker", "Celestial Spring Water"],
    successRate: 50, type: "alchemy",
  },
  {
    result: "Triple XP Pill",
    ingredients: ["Phoenix Tail Feather", "Celestial Spring Water", "Nine Leaf Immortal Grass"],
    successRate: 45, type: "alchemy",
  },
  {
    result: "Taiji Pill",
    ingredients: ["Dragon Whisker", "True Blood Lotus", "Void Crystal Shard"],
    successRate: 45, type: "alchemy",
  },
  {
    result: "Karma Pill",
    ingredients: ["Ancient Tree Heartwood", "Heaven Defying Herb", "Phoenix Tail Feather"],
    successRate: 40, type: "alchemy",
  },
  {
    result: "Heaven Defying Luck Pill",
    ingredients: ["Heaven Defying Herb", "Void Crystal Shard", "Celestial Spring Water"],
    successRate: 40, type: "alchemy",
  },
  {
    result: "Dao Comprehension Pill",
    ingredients: ["Nine Leaf Immortal Grass", "Ancient Tree Heartwood", "True Blood Lotus"],
    successRate: 40, type: "alchemy",
  },
  {
    result: "Phoenix Bloodline Essence Pill",
    ingredients: ["Phoenix Tail Feather", "True Blood Lotus", "Dragon Whisker", "Ancient Tree Heartwood"],
    successRate: 35, type: "alchemy",
  },
  {
    result: "False Tribulation Pill",
    ingredients: ["Void Crystal Shard", "Heaven Defying Herb", "Ancient Tree Heartwood"],
    successRate: 35, type: "alchemy",
  },
  {
    result: "Destiny Pill",
    ingredients: ["Nine Leaf Immortal Grass", "Phoenix Tail Feather", "Ancient Tree Heartwood", "Void Crystal Shard"],
    successRate: 35, type: "alchemy",
  },
  {
    result: "Forbidden Technique Pill",
    ingredients: ["Celestial Spring Water", "True Blood Lotus", "Heaven Defying Herb", "Dragon Whisker"],
    successRate: 35, type: "alchemy",
  },

  // ── Mythic tribulation ──────────────────────────────────────────────────────
  {
    result: "Nascent Pill",
    ingredients: ["Dragon Soul Fragment", "Phoenix Core", "Qilin Blood Drop"],
    successRate: 40, type: "tribulation",
  },
  {
    result: "Nine Heavens Pill",
    ingredients: ["Nine Heavens Lightning Seed", "Heavenly Flame Essence", "Primordial Chaos Grass"],
    successRate: 35, type: "tribulation",
  },
  {
    result: "Heaven Swallowing Pill",
    ingredients: ["Heavenly Flame Essence", "Nine Heavens Lightning Seed", "Phoenix Core"],
    successRate: 35, type: "tribulation",
  },
  {
    result: "Dao Heart Pill",
    ingredients: ["Primordial Chaos Grass", "Dragon Soul Fragment", "Void Origin Crystal"],
    successRate: 30, type: "tribulation",
  },
  {
    result: "Primal Chaos Pill",
    ingredients: ["Void Origin Crystal", "Dragon Soul Fragment", "Primordial Chaos Grass"],
    successRate: 30, type: "tribulation",
  },
  {
    result: "Supreme Yin-Yang Pill",
    ingredients: ["Qilin Blood Drop", "Phoenix Core", "Nine Heavens Lightning Seed"],
    successRate: 30, type: "tribulation",
  },
  {
    result: "True Dragon Bloodline Pill",
    ingredients: ["Dragon Soul Fragment", "Qilin Blood Drop", "Phoenix Core", "Heavenly Flame Essence"],
    successRate: 30, type: "tribulation",
  },
  {
    result: "Celestial Bloodline Pill",
    ingredients: ["Phoenix Core", "Qilin Blood Drop", "Void Origin Crystal", "Dragon Soul Fragment"],
    successRate: 25, type: "tribulation",
  },
  {
    result: "Immortal Cultivation Pill",
    ingredients: ["Heavenly Flame Essence", "Nine Heavens Lightning Seed", "Dragon Soul Fragment"],
    successRate: 30, type: "tribulation",
  },
  {
    result: "Tribulation Evasion Pill",
    ingredients: ["Primordial Chaos Grass", "Qilin Blood Drop", "Heavenly Flame Essence"],
    successRate: 35, type: "tribulation",
  },
  {
    result: "Immortal Luck Pill",
    ingredients: ["Nine Heavens Lightning Seed", "Dragon Soul Fragment", "Primordial Chaos Grass", "Phoenix Core"],
    successRate: 25, type: "tribulation",
  },
  {
    result: "World Destroying Pill",
    ingredients: ["Heavenly Flame Essence", "Nine Heavens Lightning Seed", "Phoenix Core", "Void Origin Crystal"],
    successRate: 25, type: "tribulation",
  },

  // ── Legendary tribulation ───────────────────────────────────────────────────
  {
    result: "Undying Pill",
    ingredients: ["Heaven's Tear", "True Immortal Bone Fragment", "Dao Origin Seed"],
    successRate: 20, type: "tribulation",
  },
  {
    result: "Immortality Pill",
    ingredients: ["Dao Origin Seed", "Nuwa's Clay", "Heaven's Tear", "True Immortal Bone Fragment"],
    successRate: 20, type: "tribulation",
  },
  {
    result: "Creation Pill",
    ingredients: ["Pangu's Blood Drop", "Nuwa's Clay", "Creation Flame", "Dao Origin Seed"],
    successRate: 20, type: "tribulation",
  },
  {
    result: "True Immortal Pill",
    ingredients: ["True Immortal Bone Fragment", "Pangu's Blood Drop", "Heaven's Tear", "Creation Flame"],
    successRate: 15, type: "tribulation",
  },
  {
    result: "Chaos Pill",
    ingredients: ["Creation Flame", "Pangu's Blood Drop", "Heaven's Tear", "True Immortal Bone Fragment"],
    successRate: 15, type: "tribulation",
  },
];

export async function seedCraftingRecipes(): Promise<void> {
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      "SELECT COUNT(*)::int AS count FROM crafting_recipes",
    );
    if ((rows[0] as { count: number }).count > 0) {
      logger.info("Crafting recipes already seeded — skipping");
      return;
    }

    let inserted = 0;
    for (const recipe of RECIPES) {
      const { rows: res } = await client.query(
        "SELECT id FROM items_master WHERE name = $1 LIMIT 1",
        [recipe.result],
      );
      if (res.length === 0) {
        logger.warn({ result: recipe.result }, "Crafting recipe result item not found — skipping");
        continue;
      }
      const resultItemId = res[0].id as number;

      const ingredientIds: (number | null)[] = [null, null, null, null];
      let skip = false;
      for (let i = 0; i < Math.min(recipe.ingredients.length, 4); i++) {
        const { rows: ing } = await client.query(
          "SELECT id FROM items_master WHERE name = $1 LIMIT 1",
          [recipe.ingredients[i]],
        );
        if (ing.length === 0) {
          logger.warn({ ingredient: recipe.ingredients[i] }, "Crafting ingredient not found — skipping recipe");
          skip = true;
          break;
        }
        ingredientIds[i] = ing[0].id as number;
      }
      if (skip) continue;

      await client.query(
        `INSERT INTO crafting_recipes
           (result_item_id, ingredient_1_id, ingredient_2_id, ingredient_3_id,
            ingredient_4_id, required_cauldron, base_success_rate,
            is_discoverable, recipe_type)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [
          resultItemId,
          ingredientIds[0], ingredientIds[1], ingredientIds[2], ingredientIds[3],
          recipe.cauldron ?? null,
          recipe.successRate,
          recipe.discoverable ?? false,
          recipe.type,
        ],
      );
      inserted++;
    }

    logger.info({ inserted }, "Crafting recipes seeded");
  } finally {
    client.release();
  }
}
