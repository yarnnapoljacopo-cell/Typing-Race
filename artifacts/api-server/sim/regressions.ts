import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { generateKeyPairSync, sign } from "node:crypto";
import { WebSocket } from "ws";
import express from "express";
import * as Y from "yjs";
import * as encoding from "lib0/encoding";
import * as decoding from "lib0/decoding";
import * as syncProtocol from "y-protocols/sync";
import { setupWebSocketServer } from "../src/lib/wsHandler";
import { setupCoWritingWsServer, loadOrCreateDoc, snapshotDoc, documentSnapshot } from "../src/lib/coWritingWs";
import { createRoom, startSprint, restartSprint, restoreRoomsFromDB, getRoom } from "../src/lib/roomManager";
import { advanceGladiatorCombat, processGladiatorUpdate, gladiatorWinnerId } from "../src/lib/gladiatorEngine";
import { saveWriting } from "../src/lib/writingStore";
import { socketUserId } from "../src/lib/socketAuth";
import { FolioStore } from "../../writing-sprint/src/lib/folioStore";
import { control, records, writes } from "./regression-db";
import roomsRouter from "../src/routes/rooms";
import { runFusionRegressionTests } from "./fusion-regressions";

const app = express();
app.use(express.json());
app.use("/api", roomsRouter);
const server = createServer(app);
const sprintWs = setupWebSocketServer(server);
const coWs = setupCoWritingWsServer(server);
server.listen(0, "127.0.0.1");
await once(server, "listening");
const port = (server.address() as { port: number }).port;
const sockets: WebSocket[] = [];
let passed = 0;
let validJwt = "";
async function test(name: string, run: () => Promise<void>) {
  await run();
  passed++;
  console.log(`PASS ${name}`);
}
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => { resolve = r; });
  return { promise, resolve };
}
async function connect(path = "/ws") {
  const ws = new WebSocket(`ws://127.0.0.1:${port}${path}`);
  sockets.push(ws);
  await once(ws, "open");
  return ws;
}
function response(ws: WebSocket, message: unknown, type: string, raw = false): Promise<any> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { ws.off("message", listener); reject(new Error(`Timed out waiting for ${type}`)); }, 2000);
    function listener(raw: Buffer) {
      const data = JSON.parse(raw.toString());
      if (data.type !== type) return;
      clearTimeout(timer);
      ws.off("message", listener);
      resolve(data);
    }
    ws.on("message", listener);
    ws.send(raw ? String(message) : JSON.stringify(message));
  });
}

async function join(room: ReturnType<typeof createRoom>, name: string, extra: Record<string, unknown> = {}) {
  // This deliberately small DB stub does not evaluate SQL WHERE clauses.
  records.delete("sprint_writing");
  const ws = await connect();
  const joined = await response(ws, { type: "join_room", code: room.code, name, reconnectToken: `${room.code}:${name}`, ...extra }, "joined");
  return { ws, participant: room.participants.get(joined.participantId)!, joined };
}

try {
  await test("room creation rejects invalid durations, targets, and countdowns", async () => {
    const invalid = [
      { durationMinutes: 0 }, { durationMinutes: 181 }, { creatorName: "  " },
      { mode: "boss" }, { mode: "goal" }, { wordGoal: -10 }, { bossWordGoal: 0 },
      { countdownDelayMinutes: -1 }, { countdownDelayMinutes: 31 },
    ];
    for (const override of invalid) {
      const result = await fetch(`http://127.0.0.1:${port}/api/rooms`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ creatorName: "Tester", durationMinutes: 15, mode: "regular", ...override }),
      });
      assert.equal(result.status, 400, JSON.stringify(override));
    }
    const nonFinite = await fetch(`http://127.0.0.1:${port}/api/rooms`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: '{"creatorName":"Tester","durationMinutes":15,"bossWordGoal":1e400}',
    });
    assert.equal(nonFinite.status, 400);
  });

  const room = createRoom("Tester", 1);
  const first = await connect();
  let id: string;
  await test("malformed messages do not crash or poison the connection", async () => {
    for (const message of [null, [], { type: "join_room", code: 123, name: "Tester" }]) {
      await response(first, message, "error");
    }
    const joined = await response(first, { type: "join_room", code: room.code, name: "Tester", reconnectToken: "test-session" }, "joined");
    id = joined.participantId;
    assert.equal(joined.isCreator, true);
  });

  await test("duplicate joins on one socket cannot leave orphan participants", async () => {
    await response(first, { type: "join_room", code: room.code, name: "Other" }, "error");
    assert.equal(room.participants.size, 1);
  });

  await test("a user ID alone cannot claim an account", async () => {
    const attacker = await connect();
    const result = await response(attacker, { type: "join_room", code: room.code, name: "Pretender", clerkUserId: "user_victim" }, "error");
    assert.equal(result.code, "AUTH_REQUIRED");
    assert.equal(room.participants.size, 1);
  });

  await test("another guest cannot take an existing name", async () => {
    const attacker = await connect();
    const result = await response(attacker, { type: "join_room", code: room.code, name: "Tester", reconnectToken: "different-session" }, "error");
    assert.equal(result.code, "NAME_IN_USE");
  });

  let replacement: WebSocket;
  await test("reconnect preserves deletions and old close cannot evict the writer", async () => {
    const participant = room.participants.get(id!)!;
    participant.wordCount = 0;
    participant.latestText = "";
    records.set("sprint_writing", [{ text: "stale backup", wordCount: 90, clerkUserId: null }]);
    replacement = await connect();
    const closed = once(first, "close");
    const joined = await response(replacement, { type: "join_room", code: room.code, name: "Tester", reconnectToken: "test-session" }, "joined");
    await closed;
    assert.equal(joined.participantId, id);
    assert.equal(participant.wordCount, 0);
    assert.equal(participant.latestText, "");
    assert.equal(participant.disconnectTimer, undefined);
    records.delete("sprint_writing");
  });

  await test("non-finite word counts and invalid restart durations are rejected", async () => {
    startSprint(room);
    // JSON permits an exponent that overflows Number to Infinity.
    await response(replacement!, '{"type":"text_update","text":"hello","netWordCount":1e400}', "error", true);
    assert.equal(room.participants.get(id!)!.wordCount, 0);
    room.status = "finished";
    await response(replacement!, { type: "restart_sprint", durationMinutes: -1 }, "error");
    assert.equal(room.status, "finished");
    assert.equal(room.durationMinutes, 1);
    if (room.timerInterval) clearInterval(room.timerInterval);
  });

  await test("kart attacks target the actual race positions including boosts and penalties", async () => {
    const race = createRoom("Leader", 1, "kart");
    const a = await join(race, "Leader");
    const b = await join(race, "Boosted");
    const c = await join(race, "Attacker");
    startSprint(race);
    if (race.timerInterval) clearInterval(race.timerInterval);
    a.participant.wordCount = 1000;
    a.participant.kartCarOffset = -600; // score 400, third
    b.participant.wordCount = 700;
    b.participant.kartCarOffset = 200; // score 900, first
    c.participant.wordCount = 600; // second
    c.participant.kartItems = ["red_shell", "blue_shell"];
    for (const item of ["red_shell", "blue_shell"]) {
      const used = await response(c.ws, { type: "use_item", item }, "item_used");
      assert.equal(used.targetId, b.participant.id);
    }
    assert.equal(b.participant.kartCarOffset, 0);
    race.activeStars.set(b.participant.id, Date.now() + 30_000);
    b.participant.kartItems = ["mushroom"];
    c.participant.kartItems = ["boo"];
    await response(c.ws, { type: "use_item", item: "boo" }, "kart_inventory");
    assert.deepEqual(b.participant.kartItems, ["mushroom"], "star protects inventory from theft");
    const rejoined = await join(race, "Boosted");
    assert.ok(rejoined.joined.room.starActiveIds.includes(b.participant.id));
    race.status = "finished";
    restartSprint(race, 1);
    assert.equal(race.activeStars.size, 0, "waiting-room snapshot must already be clear");
    assert.equal(b.participant.kartCarOffset, 0);
    assert.deepEqual(b.participant.kartItems, []);
    startSprint(race);
    assert.equal(race.activeStars.size, 0);
    assert.deepEqual(b.participant.kartItems, []);
    assert.equal(b.participant.kartCarOffset, 0);
    if (race.timerInterval) clearInterval(race.timerInterval);
  });

  await test("banana traps wait for an actual crossing and respect boosted positions", async () => {
    const race = createRoom("Trap owner", 1, "kart");
    const owner = await join(race, "Trap owner");
    const ahead = await join(race, "Already ahead");
    const behind = await join(race, "Behind");
    startSprint(race);
    if (race.timerInterval) clearInterval(race.timerInterval);
    owner.participant.wordCount = 100;
    owner.participant.kartCarOffset = 200;
    owner.participant.kartItems = ["banana"];
    ahead.participant.wordCount = 400;
    behind.participant.wordCount = 200;
    await response(owner.ws, { type: "use_item", item: "banana" }, "item_used");
    assert.equal(race.bananaTraps[0].threshold, 300);
    ahead.ws.send(JSON.stringify({ type: "text_update", text: "draft", netWordCount: 401 }));
    await response(ahead.ws, { type: "ping" }, "pong");
    assert.equal(race.bananaTraps.length, 1, "writer already ahead cannot trip a newly placed trap");
    behind.participant.kartItems = ["mushroom"];
    let hit = false;
    behind.ws.on("message", (raw: Buffer) => {
      const event = JSON.parse(raw.toString());
      if (event.type === "item_used" && event.item === "banana" && event.targetId === behind.participant.id) hit = true;
    });
    await response(behind.ws, { type: "use_item", item: "mushroom" }, "kart_inventory");
    assert.equal(hit, true);
    assert.equal(race.bananaTraps.length, 0);
  });

  await test("late packets cannot extend a sprint past its deadline", async () => {
    for (const type of ["text_update", "use_item"]) {
      const race = createRoom("Writer", 1, "kart");
      const writer = await join(race, "Writer");
      startSprint(race);
      if (race.timerInterval) clearInterval(race.timerInterval);
      writer.participant.kartItems = ["mushroom"];
      race.endTime = Date.now() - 1;
      await response(writer.ws, { type, text: "late", netWordCount: 100, item: "mushroom" }, "sprint_ended");
      assert.equal(writer.participant.wordCount, 0);
      assert.equal(writer.participant.kartCarOffset, 0);
    }
  });

  await test("gladiator damage follows elapsed time, never text packet frequency", async () => {
    const duel = createRoom("Fighter", 1, "gladiator");
    const a = await join(duel, "Fighter");
    const b = await join(duel, "Opponent");
    startSprint(duel);
    if (duel.timerInterval) clearInterval(duel.timerInterval);
    duel.endTime = 20_000;
    duel.gladiatorMatchStats!.lastDamageAt = 1000;
    a.participant.wordCount = 350;
    advanceGladiatorCombat(duel, 2000);
    assert.equal(b.participant.gladiatorHp, 996);
    for (let i = 0; i < 100; i++) processGladiatorUpdate(duel, a.participant, 350, 350);
    assert.equal(b.participant.gladiatorHp, 996, "duplicate/mid-word packets do not add damage");
    advanceGladiatorCombat(duel, 11_000);
    assert.equal(b.participant.gladiatorHp, 960, "idle combat still advances");
    assert.equal(duel.gladiatorMatchStats!.timeInDangerMs, 10_000);
    advanceGladiatorCombat(duel, 50_000);
    assert.equal(b.participant.gladiatorHp, 924, "damage stops exactly at the timer deadline");
  });

  await test("a gladiator duel waits for two writers and rejects a third fighter", async () => {
    const duel = createRoom("Fighter", 1, "gladiator");
    const a = await join(duel, "Fighter");
    await response(a.ws, { type: "start_sprint" }, "error");
    assert.equal(duel.status, "waiting");
    await join(duel, "Opponent");
    const extra = await connect();
    const rejected = await response(extra, { type: "join_room", code: duel.code, name: "Third" }, "error");
    assert.equal(rejected.code, "ARENA_FULL");
    assert.equal(duel.participants.size, 2);
    startSprint(duel);
    if (duel.timerInterval) clearInterval(duel.timerInterval);
    a.participant.gladiatorHp = 321;
    const rejoined = await join(duel, "Fighter", { spectator: true });
    assert.equal(rejoined.participant.gladiatorHp, 321);
    assert.equal(rejoined.participant.isSpectator, false, "reconnect cannot change roles during combat");
  });

  await test("restored gladiator rooms resume combat instead of silently disabling it", async () => {
    records.set("rooms", [{ code: "SPRINT-RESTORED", creatorName: "Restored", mode: "gladiator", durationMinutes: 1,
      status: "running", startTime: Date.now() - 10_000, endTime: Date.now() + 50_000, gladiatorDeathGap: 400 }]);
    await restoreRoomsFromDB();
    const duel = getRoom("SPRINT-RESTORED")!;
    assert.ok(duel.gladiatorMatchStats);
    const a = await join(duel, "Restored");
    await join(duel, "Opponent");
    if (duel.timerInterval) clearInterval(duel.timerInterval);
    const result = await response(a.ws, { type: "text_update", text: "draft", netWordCount: 400 }, "gladiator_execution");
    assert.equal(result.outcome, "victory");
    assert.equal(result.stats.endedByExecution, true);
    records.delete("rooms");
  });

  await test("gladiator healing cannot be farmed by deleting and retyping", async () => {
    const duel = createRoom("Fighter", 1, "gladiator");
    const a = await join(duel, "Fighter");
    await join(duel, "Opponent");
    startSprint(duel);
    if (duel.timerInterval) clearInterval(duel.timerInterval);
    a.participant.gladiatorHp = 500;
    a.participant.wordCount = 10;
    processGladiatorUpdate(duel, a.participant, 10, 0);
    assert.equal(a.participant.gladiatorHp, 505);
    a.participant.wordCount = 0;
    processGladiatorUpdate(duel, a.participant, 0, 10);
    a.participant.wordCount = 10;
    processGladiatorUpdate(duel, a.participant, 10, 0);
    assert.equal(a.participant.gladiatorHp, 505);
    assert.equal(duel.gladiatorMatchStats!.totalHpHealed[a.participant.id], 5);
  });

  await test("gladiator timer standings follow the HP winner and preserve draws", async () => {
    const duel = createRoom("More words", 1, "gladiator");
    const a = await join(duel, "More words");
    const b = await join(duel, "More health");
    startSprint(duel);
    if (duel.timerInterval) clearInterval(duel.timerInterval);
    a.participant.wordCount = 500;
    a.participant.gladiatorHp = 400;
    b.participant.wordCount = 450;
    b.participant.gladiatorHp = 800;
    const ended = await response(a.ws, { type: "end_sprint" }, "sprint_ended");
    assert.equal(ended.results[0].id, b.participant.id);
    assert.equal(gladiatorWinnerId(duel), b.participant.id);
    a.participant.gladiatorHp = 780;
    assert.equal(gladiatorWinnerId(duel), null, "within 50 HP is a draw");
  });

  await test("boss completion counts writers only and ends exactly once", async () => {
    const battle = createRoom("Writer", 1, "boss", 0, null, null, 10);
    const writer = await join(battle, "Writer");
    const editor = await join(battle, "Editor", { role: "editor" });
    startSprint(battle);
    if (battle.timerInterval) clearInterval(battle.timerInterval);
    editor.ws.send(JSON.stringify({ type: "text_update", text: "notes", netWordCount: 100 }));
    await response(editor.ws, { type: "ping" }, "pong");
    assert.equal(battle.status, "running");
    let defeats = 0;
    writer.ws.on("message", (raw: Buffer) => { if (JSON.parse(raw.toString()).type === "boss_defeated") defeats++; });
    await response(writer.ws, { type: "text_update", text: "draft", netWordCount: 10 }, "sprint_ended");
    writer.ws.send(JSON.stringify({ type: "text_update", text: "draft", netWordCount: 20 }));
    await response(writer.ws, { type: "ping" }, "pong");
    assert.equal(defeats, 1);
  });

  await test("both WebSocket routes share one HTTP server without aborting upgrades", async () => {
    const ws = await connect("/ws/cowriting/1-2?room=1&doc=2&user=spoofed");
    const [code] = await once(ws, "close");
    assert.equal(code, 1008); // upgraded successfully, then rejected by auth
  });

  await test("socket identity is verified using a signed, unexpired JWT", async () => {
    const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    process.env.CLERK_JWT_KEY = publicKey.export({ type: "spki", format: "pem" }).toString();
    const part = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
    const now = Math.floor(Date.now() / 1000);
    const jwt = (exp: number) => {
      const body = `${part({ alg: "RS256", typ: "JWT", kid: "test" })}.${part({ sub: "user_test", sid: "sess_test", iss: "https://test.clerk.accounts.dev", iat: now, nbf: now - 1, exp })}`;
      return `${body}.${sign("RSA-SHA256", Buffer.from(body), privateKey).toString("base64url")}`;
    };
    validJwt = jwt(now + 60);
    assert.equal(await socketUserId({ headers: {} } as any, validJwt), "user_test");
    await assert.rejects(socketUserId({ headers: {} } as any, jwt(now - 100)));
    await assert.rejects(socketUserId({ headers: {} } as any, "forged"));
  });

  await test("authenticated co-writers receive one update per edit", async () => {
    records.set("co_writing_members", [{ id: 1, roomId: 31, userId: "user_test" }]);
    records.set("co_writing_docs", [{ id: 32, roomId: 31 }]);
    const url = `/ws/cowriting/31-32?room=31&doc=32&token=${validJwt}`;
    const firstPeer = await connect(url);
    await once(firstPeer, "message");
    const secondPeer = await connect(url);
    await once(secondPeer, "message");
    let updates = 0;
    secondPeer.on("message", (raw: Buffer) => {
      const decoder = decoding.createDecoder(new Uint8Array(raw));
      if (decoding.readVarUint(decoder) === 0 && decoding.readVarUint(decoder) === 2) updates++;
    });
    const client = new Y.Doc();
    client.getText("body").insert(0, "shared writing");
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, 0);
    syncProtocol.writeUpdate(encoder, Y.encodeStateAsUpdate(client));
    const delivered = once(secondPeer, "message");
    firstPeer.send(encoding.toUint8Array(encoder));
    await delivered;
    await new Promise((resolve) => setTimeout(resolve, 25));
    assert.equal(updates, 1);
    assert.equal((await documentSnapshot(31, 32)).html, "shared writing");
    client.destroy();
  });

  await test("concurrent document loads share one CRDT", async () => {
    records.delete("co_writing_doc_state");
    const gate = deferred();
    control.readGate = gate.promise;
    const firstLoad = loadOrCreateDoc(11, 12);
    const secondLoad = loadOrCreateDoc(11, 12);
    gate.resolve();
    const [a, b] = await Promise.all([firstLoad, secondLoad]);
    control.readGate = null;
    assert.equal(a, b);
  });

  await test("failed hydration cannot create an empty replacement document", async () => {
    control.failReads = true;
    await assert.rejects(loadOrCreateDoc(21, 22));
    control.failReads = false;
    const loaded = await loadOrCreateDoc(21, 22);
    assert.equal(loaded.ydoc.getText("body").toString(), "");
  });

  await test("delayed snapshots preserve concurrent edits and document identity", async () => {
    const sd = await loadOrCreateDoc(11, 12);
    sd.ydoc.getText("body").insert(0, "First");
    const staleClient = new Y.Doc();
    Y.applyUpdate(staleClient, Y.encodeStateAsUpdate(sd.ydoc));
    sd.ydoc.getText("body").insert(5, " latest");
    const gate = deferred();
    control.writeGate = gate.promise;
    control.maxWrites = 0;
    const firstSave = snapshotDoc(11, 12, "ignored", Y.encodeStateAsUpdate(staleClient));
    await new Promise((resolve) => setImmediate(resolve));
    sd.ydoc.getText("body").insert(12, "!");
    const secondSave = snapshotDoc(11, 12, "ignored", Y.encodeStateAsUpdate(staleClient));
    control.writeGate = null;
    gate.resolve();
    await Promise.all([firstSave, secondSave]);
    assert.equal(control.maxWrites, 1);
    const snapshot = await documentSnapshot(11, 12);
    Y.applyUpdate(staleClient, new Uint8Array(snapshot.state));
    assert.equal(staleClient.getText("body").toString(), "First latest!");
    const saved = writes.filter((w) => w.table === "co_writing_doc_state").at(-1)!;
    assert.equal(saved.values.textPreview, "First latest!");
    staleClient.destroy();
  });

  await test("writing save failures are reported to callers", async () => {
    control.failWrites = true;
    assert.equal(await saveWriting("SPRINT-TEST", "Tester", "draft", 1), false);
    control.failWrites = false;
  });

  await test("Folio saves are serialized and the latest edit wins", async () => {
    Object.defineProperty(globalThis, "navigator", { value: { onLine: true }, configurable: true });
    const store = new FolioStore();
    const firstGate = deferred();
    const payloads: any[] = [];
    let active = 0;
    let maxActive = 0;
    store.configure(async (_url, options) => {
      active++;
      maxActive = Math.max(maxActive, active);
      payloads.push(JSON.parse(options!.body as string));
      if (payloads.length === 1) await firstGate.promise;
      active--;
      return new Response("{}", { status: 200 });
    });
    store.setState({ projects: [], notes: { note: "first" } });
    const firstPush = store.pushToServer();
    store.setState({ projects: [], notes: { note: "latest" } });
    const secondPush = store.pushToServer();
    assert.equal(payloads.length, 1);
    assert.equal(store.isSyncing, true);
    firstGate.resolve();
    await Promise.all([firstPush, secondPush]);
    assert.equal(maxActive, 1);
    assert.equal(payloads.at(-1).state.notes.note, "latest");
    assert.equal(store.isSyncing, false);
  });

  await runFusionRegressionTests(test);

  console.log(`\n${passed} regression tests passed.`);
  process.exitCode = 0;
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  sockets.forEach((ws) => ws.terminate());
  sprintWs.close();
  coWs.close();
  server.close();
  // Production rooms and stores own long grace/heartbeat timers.
  setTimeout(() => process.exit(process.exitCode ?? 1), 20);
}
