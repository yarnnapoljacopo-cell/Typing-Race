import assert from "node:assert/strict";
import { fuseInventory } from "../src/lib/fuseInventory";

type Entry = {id: number; user_id: string; item_id: number; quantity: number; name: string; rarity: string; category: string; icon: string};
function inventory(id: number, quantity: number, overrides: Partial<Entry> = {}): Entry {
  return {id, user_id: "owner", item_id: 11, quantity, name: "Common Spirit Herb", rarity: "common", category: "ingredient", icon: "🌿", ...overrides};
}
function fixture(initial: Entry[], failGrant = false) {
  let rows = structuredClone(initial), snapshot = structuredClone(initial);
  const calls: string[] = [];
  const client = {async query(sql: string, params: unknown[] = []) {
    calls.push(sql);
    if (sql === "BEGIN") snapshot = structuredClone(rows);
    else if (sql === "ROLLBACK") rows = structuredClone(snapshot);
    else if (sql.startsWith("SELECT") && sql.includes("FROM user_inventory")) {
      assert.match(sql, /AND ui\.user_id = \$2/);
      assert.match(sql, /ORDER BY ui\.id FOR UPDATE OF ui/);
      return {rows: rows.filter(row => (params[0] as number[]).includes(row.id) && row.user_id === params[1])};
    } else if (sql.includes("FROM items_master")) {
      return {rows: [{id: 22, name: "Thousand Year Ginseng", rarity: "uncommon", icon: "🌿"}]};
    } else if (sql.startsWith("UPDATE user_inventory")) {
      const item = rows.find(row => row.id === params[0] && row.user_id === params[2]);
      assert.ok(item); item.quantity -= Number(params[1]);
    } else if (sql.startsWith("DELETE FROM user_inventory")) {
      rows = rows.filter(row => !(row.id === params[0] && row.user_id === params[1]));
    } else if (sql.startsWith("INSERT INTO user_inventory")) {
      if (failGrant) throw new Error("Simulated grant failure");
      rows.push(inventory(99, 1, {user_id: String(params[0]), item_id: Number(params[1]), rarity: "uncommon"}));
    }
    return {rows: []};
  }};
  return {client, calls, get rows() {return rows;}};
}

export async function runFusionRegressionTests(test: (name: string, run: () => Promise<void>) => Promise<void>) {
  await test("fusion consumes three quantities from one stack atomically", async () => {
    const db = fixture([inventory(1, 5)]);
    const result = await fuseInventory(db.client, "owner", [1, 1, 1]);
    assert.equal(result.ok, true);
    assert.equal(db.rows.find(row => row.id === 1)?.quantity, 2);
    assert.equal(db.rows.find(row => row.id === 99)?.quantity, 1);
    assert.equal(db.calls[0], "BEGIN"); assert.equal(db.calls.at(-1), "COMMIT");
  });
  await test("fusion accepts split stacks and consumes exactly three copies", async () => {
    const db = fixture([inventory(1, 2), inventory(2, 1)]);
    assert.equal((await fuseInventory(db.client, "owner", [1, 2, 1])).ok, true);
    assert.deepEqual(db.rows.map(row => row.id), [99]);
  });
  await test("fusion rejects missing quantities, foreign inventory, and mixed items without consuming anything", async () => {
    const cases = [
      {rows: [inventory(1, 2)], ids: [1, 1, 1]},
      {rows: [inventory(1, 2), inventory(2, 1, {user_id: "someone-else"})], ids: [1, 1, 2]},
      {rows: [inventory(1, 2), inventory(2, 1, {item_id: 12})], ids: [1, 1, 2]},
      {rows: [inventory(1, 3, {rarity: "epic"})], ids: [1, 1, 1]},
    ];
    for (const input of cases) {
      const db = fixture(input.rows);
      assert.equal((await fuseInventory(db.client, "owner", input.ids)).ok, false);
      assert.deepEqual(db.rows, input.rows);
      assert.equal(db.calls.at(-1), "ROLLBACK");
      assert.ok(!db.calls.some(sql => /^(INSERT|UPDATE|DELETE)/.test(sql)));
    }
  });
  await test("fusion rejects malformed IDs before querying and rolls back a failed grant", async () => {
    for (const input of [null, [], [1, 1], [1, 1, "1"], [0, 0, 0], [1.5, 1.5, 1.5]]) {
      const db = fixture([inventory(1, 3)]);
      assert.equal((await fuseInventory(db.client, "owner", input)).ok, false);
      assert.equal(db.calls.length, 0);
    }
    const original = [inventory(1, 3)];
    const db = fixture(original, true);
    await assert.rejects(fuseInventory(db.client, "owner", [1, 1, 1]), /Simulated grant failure/);
    assert.deepEqual(db.rows, original);
    assert.equal(db.calls.at(-1), "ROLLBACK");
  });
}
