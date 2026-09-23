interface FusionClient { query(sql: string, params?: unknown[]): Promise<{rows: any[]}> }
type FusionResult = {ok: true; result: {id: number; name: string; icon: string; rarity: string}; message: string}
  | {ok: false; status: number; error: string};
const RARITIES = ["common", "uncommon", "rare", "epic", "mythic", "legendary"];

/** Own one transaction: repeated IDs represent quantities from the same stack. */
export async function fuseInventory(client: FusionClient, userId: string, inventoryIds: unknown): Promise<FusionResult> {
  if (!Array.isArray(inventoryIds) || inventoryIds.length !== 3 || !inventoryIds.every(id => Number.isSafeInteger(id) && id > 0)) {
    return {ok: false, status: 400, error: "Select exactly 3 identical items"};
  }
  const counts = new Map<number, number>();
  for (const id of inventoryIds) counts.set(id, (counts.get(id) ?? 0) + 1);
  const fail = (error: string): FusionResult => ({ok: false, status: 400, error});
  let committed = false;
  await client.query("BEGIN");
  try {
    // Stable lock order prevents two overlapping fusion requests from spending
    // the same quantities or deadlocking when clients send IDs in reverse order.
    const {rows} = await client.query(
      `SELECT ui.id, ui.item_id, ui.quantity, im.name, im.rarity, im.category, im.icon
       FROM user_inventory ui JOIN items_master im ON im.id = ui.item_id
       WHERE ui.id = ANY($1::int[]) AND ui.user_id = $2
       ORDER BY ui.id FOR UPDATE OF ui`, [[...counts.keys()], userId]);
    if (rows.length !== counts.size || rows.some(row => !counts.has(row.id) || row.quantity < counts.get(row.id)!)) {
      return fail("Not enough of these items in your bag");
    }
    if (new Set(rows.map(row => row.item_id)).size !== 1) return fail("All 3 items must be identical");
    const item = rows[0];
    const tier = RARITIES.indexOf(item.rarity);
    if (tier < 0 || tier >= RARITIES.indexOf("epic")) return fail("Fusion cannot produce Mythic or Legendary items");
    const {rows: candidates} = await client.query(
      `SELECT id, name, icon, rarity FROM items_master
       WHERE category = $1 AND rarity = $2 AND is_chest_obtainable = TRUE
       ORDER BY RANDOM() LIMIT 1`, [item.category, RARITIES[tier + 1]]);
    if (!candidates.length) return fail("No items of the next rarity exist in this category");
    for (const row of rows) {
      const quantity = counts.get(row.id)!;
      if (row.quantity > quantity) await client.query(
        "UPDATE user_inventory SET quantity = quantity - $2 WHERE id = $1 AND user_id = $3", [row.id, quantity, userId]);
      else await client.query("DELETE FROM user_inventory WHERE id = $1 AND user_id = $2", [row.id, userId]);
    }
    const result = candidates[0];
    await client.query("INSERT INTO user_inventory (user_id, item_id, quantity) VALUES ($1,$2,1)", [userId, result.id]);
    await client.query("COMMIT");
    committed = true;
    return {ok: true, result: {id: result.id, name: result.name, icon: result.icon, rarity: result.rarity}, message: `Fusion successful! 3× ${item.name} → ${result.name} (${result.rarity})`};
  } finally {
    if (!committed) await client.query("ROLLBACK");
  }
}
