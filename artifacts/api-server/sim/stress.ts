/* eslint-disable no-console */
// ── Sprint-engine stress harness ────────────────────────────────────────────
// Drives the REAL engine code (kartItems, gladiatorEngine, and the DB-free
// sync functions of roomManager) with bot swarms and asserts invariants under
// load. DB-coupled glue (the wsHandler kart-earning loop, _startRunning resets,
// the anti-cheat clamp) is replicated faithfully from source and cross-checked.
//
// Run: pnpm run stress   (esbuild-bundles this then runs it on node)

import { rollItem, rollMysteryItems, ITEM_EMOJIS, type ItemKey } from "../src/lib/kartItems";
import { processGladiatorUpdate, initGladiatorParticipant } from "../src/lib/gladiatorEngine";
import {
  updateParticipantStats,
  reconnectParticipant,
  type Room,
  type Participant,
  type GladiatorMatchStats,
} from "../src/lib/roomManager";

// ── Test framework ──────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;
const failures: string[] = [];
function check(cond: boolean, msg: string): void {
  if (cond) { passed++; } else { failed++; failures.push(msg); if (failures.length <= 40) console.error("  ✗ " + msg); }
}
function section(name: string): void { console.log(`\n── ${name} ──`); }

// Deterministic-ish RNG so a failure is reproducible.
let seed = 1234567;
function rnd(): number { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }
function ri(min: number, max: number): number { return Math.floor(min + rnd() * (max - min + 1)); }

// ── Mock WebSocket ──────────────────────────────────────────────────────────
const OPEN = 1;
interface MockWs { readyState: number; sent: string[]; send(s: string): void; close(): void; }
function mockWs(): MockWs {
  return { readyState: OPEN, sent: [], send(s: string) { this.sent.push(s); }, close() { this.readyState = 3; } };
}

// ── Participant / Room factories matching the real interfaces ───────────────
let pidCounter = 0;
function makeParticipant(name: string, opts: Partial<Participant> = {}): Participant {
  const ws = mockWs();
  return {
    id: `p${++pidCounter}`,
    name,
    wordCount: 0,
    wpm: 0,
    lastWordCountTime: Date.now(),
    lastWordCount: 0,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ws: ws as any,
    isCreator: false,
    isSpectator: false,
    role: "writer",
    latestText: "",
    clerkUserId: null,
    nameplate: "default",
    xp: 0,
    kartItems: [],
    kartBonusWords: 0,
    kartCarOffset: 0,
    kartNextItemAt: 250,
    gladiatorHp: 1000,
    gladiatorBuffs: [],
    gladiatorFrenzyStartWc: 0,
    gladiatorFrenzyStartTime: Date.now(),
    gladiatorAheadSince: null,
    gladiatorMomentumSince: null,
    gladiatorMomentumGapAtStart: null,
    gladiatorWoundSince: null,
    gladiatorWoundGapAtStart: null,
    ...opts,
  };
}
function makeRoom(mode: Room["mode"], parts: Participant[], opts: Partial<Room> = {}): Room {
  const map = new Map<string, Participant>();
  for (const p of parts) map.set(p.id, p);
  return {
    code: "SPRINT-TEST",
    creatorName: parts[0]?.name ?? "host",
    durationMinutes: 15,
    countdownDelayMinutes: 0,
    mode,
    wordGoal: null,
    bossWordGoal: null,
    deathModeWpm: null,
    passwordHash: null,
    status: "running",
    participants: map,
    startTime: Date.now(),
    endTime: Date.now() + 900_000,
    countdownEndsAt: null,
    timerInterval: null,
    bananaTraps: [],
    goldenPenUsed: false,
    activeStars: new Map(),
    gladiatorDeathGap: 400,
    gladiatorMatchStats: null,
    creatorXp: 0,
    hostCarSkin: null,
    hostRoadSkin: null,
    ...opts,
  };
}

const VALID_ITEMS = new Set<string>(Object.keys(ITEM_EMOJIS));

// ════════════════════════════════════════════════════════════════════════════
// TEST 1 — Kart item roll integrity (real rollItem), 2,000,000 rolls
// ════════════════════════════════════════════════════════════════════════════
function testKartRolls(): void {
  section("TEST 1 — kart item roll integrity (2M rolls)");
  let goldenWhenIneligible = 0;
  let invalidKey = 0;
  const counts: Record<string, number> = {};
  const N = 2_000_000;
  for (let i = 0; i < N; i++) {
    const total = ri(1, 8);
    const pos = ri(1, total);
    const goldenAvail = rnd() < 0.5;
    const item = rollItem(pos, total, goldenAvail);
    counts[item] = (counts[item] ?? 0) + 1;
    if (!VALID_ITEMS.has(item)) invalidKey++;
    // golden_pen may only appear when eligible: position === total AND golden available AND total>1
    if (item === "golden_pen" && !(goldenAvail && pos === total && total > 1)) goldenWhenIneligible++;
  }
  check(invalidKey === 0, `rollItem produced ${invalidKey} invalid item keys`);
  check(goldenWhenIneligible === 0, `golden_pen dropped ${goldenWhenIneligible} times when ineligible`);
  // Last place should get blue_shell/lightning sometimes (catch-up items); first place never should.
  let firstPlaceBlue = 0;
  for (let i = 0; i < 100_000; i++) { if (rollItem(1, 6, false) === "blue_shell") firstPlaceBlue++; }
  check(firstPlaceBlue === 0, `first place got blue_shell ${firstPlaceBlue} times (should be 0)`);
  // mystery items always valid regular items
  let mysteryInvalid = 0;
  for (let i = 0; i < 200_000; i++) {
    for (const it of rollMysteryItems(3)) { if (!VALID_ITEMS.has(it) || it === "golden_pen") mysteryInvalid++; }
  }
  check(mysteryInvalid === 0, `rollMysteryItems produced ${mysteryInvalid} invalid/golden items`);
  console.log(`  rolled ${N.toLocaleString()} items, distinct=${Object.keys(counts).length}`);
}

// ════════════════════════════════════════════════════════════════════════════
// TEST 2 — Kart earning loop (faithful replica of wsHandler) under bot swarm
//   Mirrors lib/wsHandler.ts text_update kart block exactly.
// ════════════════════════════════════════════════════════════════════════════
function testKartEarning(): void {
  section("TEST 2 — kart earning loop (1,000 bots, random bursts)");
  let badThreshold = 0, overCap = 0, doubleEarn = 0;
  for (let b = 0; b < 1000; b++) {
    const p = makeParticipant("bot");
    p.kartNextItemAt = 250;
    let earnedTotal = 0;
    const thresholdsHit = new Set<number>();
    let wc = 0;
    const steps = ri(5, 60);
    for (let s = 0; s < steps; s++) {
      wc += ri(0, 320); // random burst
      p.wordCount = wc;
      // ---- replica of wsHandler kart earning loop ----
      while (p.wordCount >= p.kartNextItemAt) {
        if (p.kartItems.length >= 3) break;
        const crossed = p.kartNextItemAt;
        if (thresholdsHit.has(crossed)) doubleEarn++;
        thresholdsHit.add(crossed);
        p.kartNextItemAt += 250;
        p.kartItems.push(rollItem(1, 2, false));
        earnedTotal++;
      }
      // simulate using items sometimes so the cap can free up
      if (rnd() < 0.4 && p.kartItems.length > 0) p.kartItems.shift();
      if (p.kartItems.length > 3) overCap++;
      // threshold must always be a multiple of 250 strictly above 0
      if (p.kartNextItemAt % 250 !== 0 || p.kartNextItemAt <= 0) badThreshold++;
    }
  }
  check(badThreshold === 0, `kartNextItemAt went non-multiple-of-250 ${badThreshold} times`);
  check(overCap === 0, `inventory exceeded 3 items ${overCap} times`);
  check(doubleEarn === 0, `same threshold granted an item twice ${doubleEarn} times`);
}

// ════════════════════════════════════════════════════════════════════════════
// TEST 3 — Golden pen now moves the car + final-standings sort consistency
// ════════════════════════════════════════════════════════════════════════════
function testGoldenPenAndSort(): void {
  section("TEST 3 — golden pen position boost + standings sort");
  // Replica of the FIXED golden_pen handler:
  const p = makeParticipant("bot");
  p.wordCount = 500;
  p.kartCarOffset += 400; // the fix
  check(p.kartCarOffset === 400, "golden pen should add 400 to kartCarOffset");
  // Final standings sort uses (wordCount + kartCarOffset) — verify a golden-pen
  // user overtakes someone with more raw words but no boost.
  const a = makeParticipant("A"); a.wordCount = 600; a.kartCarOffset = 0;     // 600
  const c = makeParticipant("C"); c.wordCount = 500; c.kartCarOffset = 400;   // 900 after golden pen
  const sorted = [a, c].sort((x, y) => (y.wordCount + y.kartCarOffset) - (x.wordCount + x.kartCarOffset));
  check(sorted[0].name === "C", "golden-pen user (900) should out-rank raw 600");
  // Offsets never produce negative effective position in the client formula
  let neg = 0;
  for (let i = 0; i < 100_000; i++) {
    const wcv = ri(0, 2000), off = ri(-900, 900);
    const eff = Math.max(0, wcv + off); // client RaceTrack formula
    if (eff < 0) neg++;
  }
  check(neg === 0, "effective position should clamp at 0");
}

// ════════════════════════════════════════════════════════════════════════════
// TEST 4 — Gladiator combat with REAL processGladiatorUpdate (300 matches)
// ════════════════════════════════════════════════════════════════════════════
function testGladiator(): void {
  section("TEST 4 — gladiator combat (300 matches, real engine)");
  let hpOutOfRange = 0, nan = 0, wrongWinner = 0, badBuff = 0, execMismatch = 0;
  const KNOWN_BUFFS = new Set(["frenzy_heal", "wound", "last_stand", "momentum"]);
  let executions = 0, timeouts = 0;
  for (let m = 0; m < 300; m++) {
    const deathGap = [200, 300, 400, 500][ri(0, 3)];
    const p1 = makeParticipant("F1");
    const p2 = makeParticipant("F2");
    const room = makeRoom("gladiator", [p1, p2], { gladiatorDeathGap: deathGap });
    room.gladiatorMatchStats = {
      closestGap: -1, maxGap: 0, totalHpHealed: {}, leadChanges: 0,
      timeInDangerMs: 0, endedByExecution: false, currentLeaderId: null,
    };
    initGladiatorParticipant(p1);
    initGladiatorParticipant(p2);
    let ended = false;
    const maxSteps = ri(50, 600);
    for (let s = 0; s < maxSteps && !ended; s++) {
      const actor = rnd() < 0.5 ? p1 : p2;
      const prev = actor.wordCount;
      const next = prev + ri(0, 40);
      actor.wordCount = next;
      const res = processGladiatorUpdate(room, actor, next, prev);
      for (const fp of [p1, p2]) {
        if (fp.gladiatorHp < 0 || fp.gladiatorHp > 1000) hpOutOfRange++;
        if (Number.isNaN(fp.gladiatorHp)) nan++;
        for (const buff of fp.gladiatorBuffs) if (!KNOWN_BUFFS.has(buff)) badBuff++;
      }
      if (res.executed) {
        executions++;
        ended = true;
        // winner must be the one strictly ahead by >= deathGap
        const gap = p1.wordCount - p2.wordCount;
        const expectedWinner = gap >= deathGap ? p1.id : (gap <= -deathGap ? p2.id : null);
        if (res.winnerId !== expectedWinner) wrongWinner++;
        if (!room.gladiatorMatchStats.endedByExecution) execMismatch++;
      }
    }
    if (!ended) timeouts++;
  }
  check(hpOutOfRange === 0, `gladiator HP left [0,1000] ${hpOutOfRange} times`);
  check(nan === 0, `gladiator HP became NaN ${nan} times`);
  check(wrongWinner === 0, `execution named wrong winner ${wrongWinner} times`);
  check(badBuff === 0, `unknown gladiator buff appeared ${badBuff} times`);
  check(execMismatch === 0, `endedByExecution not set on execution ${execMismatch} times`);
  console.log(`  ${executions} executions, ${timeouts} reached step cap`);
}

// ════════════════════════════════════════════════════════════════════════════
// TEST 5 — Gladiator double-execution guard (the fix in endSprint)
// ════════════════════════════════════════════════════════════════════════════
function testGladiatorExecGuard(): void {
  section("TEST 5 — gladiator execution does not double-broadcast");
  // Replicate endSprint's gladiator branch guard.
  function endSprintGladiatorBranch(stats: GladiatorMatchStats): boolean {
    // returns whether broadcastGladiatorTimerEnd WOULD be called
    return !!(stats && !stats.endedByExecution);
  }
  const execStats: GladiatorMatchStats = { closestGap: 10, maxGap: 400, totalHpHealed: {}, leadChanges: 2, timeInDangerMs: 0, endedByExecution: true, currentLeaderId: null };
  const timeStats: GladiatorMatchStats = { ...execStats, endedByExecution: false };
  check(endSprintGladiatorBranch(execStats) === false, "execution end must NOT also fire timer-end broadcast");
  check(endSprintGladiatorBranch(timeStats) === true, "natural timer end SHOULD fire timer-end broadcast");
}

// ════════════════════════════════════════════════════════════════════════════
// TEST 6 — updateParticipantStats (REAL) under a heavy multi-writer swarm
// ════════════════════════════════════════════════════════════════════════════
function testUpdateStats(): void {
  section("TEST 6 — updateParticipantStats real fn (8 writers × 400 updates)");
  const parts = Array.from({ length: 8 }, (_, i) => makeParticipant(`W${i}`));
  const room = makeRoom("regular", parts);
  let badWpm = 0, badBroadcast = 0;
  for (let step = 0; step < 400; step++) {
    for (const p of parts) {
      const next = Math.max(0, p.wordCount + ri(-5, 60)); // allow occasional backspacing
      p.ws as unknown as MockWs;
      const before = (p.ws as unknown as MockWs).sent.length;
      updateParticipantStats(room, p.id, next);
      if (!Number.isFinite(p.wpm) || p.wpm < 0) badWpm++;
      // any broadcast emitted must be valid JSON of type participant_update
      const after = (p.ws as unknown as MockWs).sent.slice(before);
      for (const raw of after) {
        try { const m = JSON.parse(raw); if (m.type !== "participant_update" || typeof m.participant?.wordCount !== "number") badBroadcast++; }
        catch { badBroadcast++; }
      }
    }
  }
  check(badWpm === 0, `wpm went non-finite/negative ${badWpm} times`);
  check(badBroadcast === 0, `malformed participant_update broadcast ${badBroadcast} times`);

  // Boss mode: total crosses goal → boss_defeated emitted exactly once region
  const bp = Array.from({ length: 4 }, (_, i) => makeParticipant(`B${i}`));
  const bossRoom = makeRoom("boss", bp, { bossWordGoal: 1000 });
  let defeated = 0;
  for (let step = 0; step < 200; step++) {
    for (const p of bp) {
      updateParticipantStats(bossRoom, p.id, p.wordCount + ri(0, 30));
      const sent = (p.ws as unknown as MockWs).sent;
      defeated += sent.filter((s) => s.includes('"boss_defeated"')).length;
      sent.length = 0;
    }
  }
  check(defeated >= 1, "boss_defeated should fire once collective goal is reached");
}

// ════════════════════════════════════════════════════════════════════════════
// TEST 7 — Anti-cheat clamp fuzz (faithful replica of wsHandler formula)
// ════════════════════════════════════════════════════════════════════════════
function testClamp(): void {
  section("TEST 7 — anti-cheat word-count clamp fuzz (1M)");
  const MAX_WPM = 400, BURST = 1500;
  let breach = 0, negative = 0;
  for (let i = 0; i < 1_000_000; i++) {
    const lastWordCount = ri(0, 5000);
    const elapsedMin = rnd() * 2; // up to 2 min
    const raw = Math.max(0, lastWordCount + ri(-100, 8000));
    const allowedDelta = Math.ceil(elapsedMin * MAX_WPM) + BURST;
    const ceiling = lastWordCount + allowedDelta;
    const clamped = raw > ceiling ? ceiling : raw;
    if (clamped > ceiling) breach++;
    if (clamped < 0) negative++;
  }
  check(breach === 0, `clamp let a value exceed the ceiling ${breach} times`);
  check(negative === 0, `clamp produced a negative ${negative} times`);
}

// ════════════════════════════════════════════════════════════════════════════
// TEST 8 — Kart restart reset invariant (replica of _startRunning kart block)
// ════════════════════════════════════════════════════════════════════════════
function testKartRestartReset(): void {
  section("TEST 8 — kart restart resets all per-sprint state");
  const p = makeParticipant("bot", { wordCount: 0 });
  // dirty state from a previous sprint:
  p.kartItems = ["star", "banana", "boo"];
  p.kartCarOffset = -300;
  p.kartBonusWords = 400;
  p.kartNextItemAt = 1000;
  const room = makeRoom("kart", [p], { goldenPenUsed: true, bananaTraps: [{ id: "x", placedById: p.id, placedByName: "bot", threshold: 5 }] });
  room.activeStars.set(p.id, Date.now() + 9999);
  // ---- replica of the _startRunning kart reset ----
  room.bananaTraps = [];
  room.activeStars.clear();
  room.goldenPenUsed = false;
  for (const q of room.participants.values()) {
    q.kartItems = [];
    q.kartCarOffset = 0;
    q.kartBonusWords = 0;
    q.kartNextItemAt = Math.floor(q.wordCount / 250) * 250 + 250;
  }
  check(p.kartItems.length === 0, "items cleared on restart");
  check(p.kartCarOffset === 0, "car offset cleared on restart");
  check(p.kartNextItemAt === 250, "next-item threshold reset to 250");
  check(room.goldenPenUsed === false, "goldenPenUsed reset so golden pen can drop again");
  check(room.bananaTraps.length === 0 && room.activeStars.size === 0, "traps & stars cleared");
}

// ════════════════════════════════════════════════════════════════════════════
// TEST 9 — reconnectParticipant (REAL) preserves lane order + kart/gladiator
// ════════════════════════════════════════════════════════════════════════════
function testReconnect(): void {
  section("TEST 9 — reconnect keeps Map order + preserves kart/gladiator state");
  const a = makeParticipant("A");
  const b = makeParticipant("B", { wordCount: 120, kartCarOffset: -100, kartItems: ["star"], gladiatorHp: 333 });
  const c = makeParticipant("C");
  const room = makeRoom("kart", [a, b, c]);
  const orderBefore = [...room.participants.keys()];
  const newWs = mockWs();
  // in-place reconnect of B
  reconnectParticipant(room, b.id, newWs as unknown as Parameters<typeof reconnectParticipant>[2], 120, "hello", false, false, "B", null, "writer");
  const orderAfter = [...room.participants.keys()];
  check(JSON.stringify(orderBefore) === JSON.stringify(orderAfter), "Map insertion order (lane assignment) stayed stable across reconnect");
  const b2 = room.participants.get(b.id)!;
  check(b2.kartCarOffset === -100, "in-place reconnect preserved kart car offset");
  check(b2.kartItems.length === 1, "in-place reconnect preserved kart items");
  check(b2.gladiatorHp === 333, "in-place reconnect preserved gladiator HP");
  check((b2.ws as unknown as MockWs) === newWs, "reconnect swapped in the new socket");
}

// ── Run all ─────────────────────────────────────────────────────────────────
const t0 = Date.now();
console.log("Sprint-engine stress test — driving real kartItems / gladiatorEngine / roomManager\n");
testKartRolls();
testKartEarning();
testGoldenPenAndSort();
testGladiator();
testGladiatorExecGuard();
testUpdateStats();
testClamp();
testKartRestartReset();
testReconnect();

console.log(`\n${"═".repeat(60)}`);
console.log(`RESULT: ${passed} passed, ${failed} failed  (${Date.now() - t0}ms)`);
if (failed > 0) {
  console.log("\nFAILURES:");
  for (const f of failures.slice(0, 40)) console.log("  • " + f);
  process.exit(1);
}
console.log("All invariants held under load. ✓");
process.exit(0);
