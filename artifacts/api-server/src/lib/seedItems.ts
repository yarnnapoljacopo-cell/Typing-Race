import { pool } from "@workspace/db";
import { ALL_ITEMS, type ItemDef } from "./itemsData";
import { logger } from "./logger";

/**
 * Computes sell_value from rarity + category rules defined in the spec.
 * An explicit `sellValue` on the item definition overrides the computed value.
 */
function computeSellValue(item: ItemDef): number {
  if (item.sellValue !== undefined) return item.sellValue;
  if (item.isTradeable === false) return 0;
  if (item.category === "recipe") return 0;
  if (item.rarity === "legendary" && item.category !== "ingredient") return 0;

  switch (item.category) {
    case "pill": {
      const map: Record<string, number> = {
        common: 2, uncommon: 6, rare: 0, epic: 20, mythic: 50, legendary: 0,
      };
      return map[item.rarity] ?? 0;
    }
    case "treasure":
    case "artifact": {
      const map: Record<string, number> = {
        common: 2, uncommon: 8, rare: 20, epic: 55, mythic: 140, legendary: 0,
      };
      return map[item.rarity] ?? 0;
    }
    case "ingredient": {
      const map: Record<string, number> = {
        common: 1, uncommon: 3, rare: 8, epic: 15, mythic: 25, legendary: 50,
      };
      return map[item.rarity] ?? 0;
    }
    default:
      return 0;
  }
}

/**
 * Idempotent seed for items_master.
 * Uses ON CONFLICT (name) DO UPDATE so descriptions/values stay current
 * without duplicating rows.
 */
export async function seedItems(): Promise<void> {
  const client = await pool.connect();
  try {
    for (const item of ALL_ITEMS) {
      await client.query(
        `INSERT INTO items_master
           (name, description, category, rarity, effect_type, effect_value,
            effect_duration, is_craftable, is_tradeable, is_chest_obtainable,
            icon, stack_limit, sell_value, is_storage_item, storage_slot_count)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
         ON CONFLICT (name) DO UPDATE SET
           description         = EXCLUDED.description,
           category            = EXCLUDED.category,
           rarity              = EXCLUDED.rarity,
           effect_type         = EXCLUDED.effect_type,
           effect_value        = EXCLUDED.effect_value,
           effect_duration     = EXCLUDED.effect_duration,
           is_craftable        = EXCLUDED.is_craftable,
           is_tradeable        = EXCLUDED.is_tradeable,
           is_chest_obtainable = EXCLUDED.is_chest_obtainable,
           icon                = EXCLUDED.icon,
           stack_limit         = EXCLUDED.stack_limit,
           sell_value          = EXCLUDED.sell_value,
           is_storage_item     = EXCLUDED.is_storage_item,
           storage_slot_count  = EXCLUDED.storage_slot_count`,
        [
          item.name,
          item.description,
          item.category,
          item.rarity,
          item.effectType ?? null,
          item.effectValue ?? null,
          item.effectDuration ?? null,
          item.isCraftable ?? false,
          item.isTradeable ?? true,
          item.isChestObtainable ?? true,
          item.icon,
          item.stackLimit ?? 1,
          computeSellValue(item),
          item.isStorageItem ?? false,
          item.storageSlotCount ?? null,
        ],
      );
    }
    logger.info({ count: ALL_ITEMS.length }, "Items master seeded");
  } finally {
    client.release();
  }
}
