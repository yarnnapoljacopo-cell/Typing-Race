import { pool } from "@workspace/db";
import { ALL_ITEMS } from "./itemsData";
import { logger } from "./logger";

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
            icon, stack_limit)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
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
           stack_limit         = EXCLUDED.stack_limit`,
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
        ],
      );
    }
    logger.info({ count: ALL_ITEMS.length }, "Items master seeded");
  } finally {
    client.release();
  }
}
