// Open /sim/connection-regressions.html on the Vite dev server.
// Exercises the real React hook against deterministic network failures/events.
import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { RaceTrack } from "../src/components/RaceTrack";
import { countWritingWords, editorPlainText } from "../src/lib/writingText";
import "../src/index.css";
import { useSprintRoom, type RoomState, type Participant } from "../src/hooks/useSprintRoom";

const connections: FakeSocket[] = [];
const writer: Participant = { id: "writer", name: "Regression tester", wordCount: 123, wpm: 40, isCreator: true, role: "writer", kartCarOffset: 200, kartBonusWords: 400 };
const peer: Participant = { id: "peer", name: "Other writer", wordCount: 80, wpm: 30, isCreator: false, role: "writer" };
const snapshot = (overrides: Partial<RoomState> = {}): RoomState => ({
  code: "REGRESSION", status: "running", durationMinutes: 1, mode: "kart", timeLeft: 50,
  countdownDelayMinutes: 0, countdownTimeLeft: null, wordGoal: null, bossWordGoal: null,
  bossTotalWords: null, deathModeWpm: null, gladiatorDeathGap: null, creatorXp: 0,
  hostCarSkin: null, hostRoadSkin: null, participants: [writer, peer], starActiveIds: ["writer", "peer"],
  ...overrides,
});
const clearedParticipants = () => [writer, peer].map(p => ({ ...p, wordCount: 0, kartCarOffset: 0, kartBonusWords: 0 }));

class FakeSocket {
  static OPEN = 1;
  readyState = 0;
  joinRequested = false;
  sent: Array<{ type: string; text?: string; netWordCount?: number }> = [];
  currentRoom = snapshot();
  onopen: (() => void) | null = null;
  onclose: ((event: { code: number }) => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  constructor() {
    connections.push(this);
    const connectionNumber = connections.length;
    queueMicrotask(() => {
      if (connectionNumber === 1) { this.close(1006); return; }
      this.readyState = 1;
      this.onopen?.();
    });
  }
  emit(message: { type: string; room?: RoomState; [key: string]: unknown }) {
    if (message.room) this.currentRoom = message.room;
    this.onmessage?.({ data: JSON.stringify(message) });
  }
  completeJoin() {
    this.emit({ type: "joined", participantId: "writer", restoredWordCount: 123, kartItems: ["star"], room: this.currentRoom });
  }
  send(raw: string) {
    const data = JSON.parse(raw);
    this.sent.push(data);
    if (data.type === "join_room") {
      this.joinRequested = true;
      // The real server announces admission before the identity response.
      // Tests deliberately hold joined until React has rendered this event.
      this.emit({ type: "room_state", room: this.currentRoom });
    }
    if (data.type === "ping") this.emit({ type: "pong" });
    if (data.type === "restart_sprint") this.emit({ type: "room_state", room: {
      ...this.currentRoom, status: "waiting", timeLeft: null, participants: clearedParticipants(),
      starActiveIds: [], bossTotalWords: this.currentRoom.mode === "boss" ? 0 : null,
    } });
  }
  close(code = 1005) {
    if (this.readyState === 3) return;
    this.readyState = 3;
    this.onclose?.({ code });
  }
}
window.WebSocket = FakeSocket as unknown as typeof WebSocket;

const EXPECTED_CHECKS = 20;
const pause = (ms = 40) => new Promise<void>(resolve => setTimeout(resolve, ms));
async function waitFor(predicate: () => boolean, label: string) {
  const deadline = Date.now() + 5000;
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error(`Timed out: ${label}`);
    await pause(10);
  }
  // Let all state updates in the same event finish before checking companions.
  await pause();
}

function Tests() {
  const sprint = useSprintRoom({ code: "REGRESSION", name: "Regression tester" });
  const latest = useRef(sprint);
  latest.current = sprint;
  const [checks, setChecks] = useState<string[]>([]);
  const [done, setDone] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    function check(label: string, pass: boolean) {
      if (cancelled) return;
      setChecks(previous => [...previous, `${pass ? "PASS" : "FAIL"} ${label}`]);
      if (!pass) throw new Error(label);
    }
    async function run() {
      await waitFor(() => document.querySelectorAll(".race-vehicle").length === 4, "track layout");
      for (const mode of ["regular", "kart"]) {
        const vehicles = Array.from(document.querySelectorAll(`.race-track-${mode} .race-vehicle`));
        const left = vehicles.map(vehicle => vehicle.getBoundingClientRect().left);
        check(`${mode} cars share the same start despite different name lengths`, vehicles.length === 2 && vehicles.every(vehicle => vehicle.getBoundingClientRect().width > 0) && Math.abs(left[0] - left[1]) < 0.6);
      }
      const textSample = document.createElement("div");
      textSample.innerHTML = "first<p>second&amp;third</p><p>fourth<br>fifth&nbsp;sixth</p>";
      check("native paragraph, entity and soft-break boundaries count correctly", countWritingWords(editorPlainText(textSample)) === 5);

      await waitFor(() => connections.at(-1)?.joinRequested === true, "initial retry");
      let socket = connections.at(-1)!;
      check("reconnects after initial connection failure", connections.length === 2);
      check("ignores room snapshots until joined supplies identity", latest.current.room === null && latest.current.participantId === null && latest.current.restoredWordCount === null);
      socket.completeJoin();
      await waitFor(() => latest.current.isConnected, "joined response");
      check("restores identity and word count together on joining", latest.current.participantId === "writer" && latest.current.restoredWordCount === 123 && latest.current.room?.status === "running");
      check("restores authoritative kart stars, inventory, boost and bonus", latest.current.kartState.starActive && latest.current.kartState.starActiveIds.includes("peer") && latest.current.kartState.items[0] === "star" && latest.current.kartState.carOffsets.writer === 200 && latest.current.kartState.bonusWords === 400);

      latest.current.setLatestText("", 0);
      socket.close(1006);
      await waitFor(() => connections.length === 3 && connections.at(-1)?.joinRequested === true, "empty-draft reconnect");
      socket = connections.at(-1)!;
      socket.completeJoin();
      await waitFor(() => latest.current.isConnected, "empty-draft rejoined");
      check("reconnect resends an intentionally cleared draft and zero score", socket.sent.some(message => message.type === "text_update" && message.text === "" && message.netWordCount === 0));

      const activateStar = (duration: number) => {
        socket.emit({ type: "item_effect_start", effect: "star", duration });
        socket.emit({ type: "item_used", item: "star", effect: "star", sourceId: "writer", targetId: "writer", duration });
      };
      activateStar(120);
      await pause(50);
      activateStar(400);
      await pause(170); // Past the first expiry, safely before the second.
      check("overlapping stars keep the latest activation alive", latest.current.kartState.starActive && latest.current.kartState.starActiveIds.includes("writer"));

      socket.emit({ type: "item_effect_start", effect: "blur_counter", duration: 350 });
      socket.emit({ type: "item_effect_start", effect: "bold_text", duration: 350 });
      activateStar(350);
      await pause();
      latest.current.restartSprint(1);
      await waitFor(() => latest.current.room?.status === "waiting", "kart reset");
      const cleared = latest.current.kartState;
      check("restart clears kart inventory, effects, stars and restored score", cleared.items.length === 0 && cleared.effects.length === 0 && !cleared.starActive && cleared.starActiveIds.length === 0 && !cleared.blurCounter && !cleared.boldText && cleared.carOffsets.writer === 0 && cleared.bonusWords === 0 && latest.current.restoredWordCount === null);
      socket.emit({ type: "room_state", room: snapshot({ participants: clearedParticipants(), starActiveIds: [] }) });
      activateStar(900);
      await pause(420); // Any uncleared timeout from the previous round has fired.
      check("previous-round timers cannot cancel new-round stars", latest.current.kartState.starActive && latest.current.kartState.starActiveIds.includes("writer") && !latest.current.kartState.blurCounter && !latest.current.kartState.boldText);
      latest.current.restartSprint(1); // Clear the remaining star timers.
      await waitFor(() => latest.current.room?.status === "waiting", "inter-scenario reset");

      socket.emit({ type: "room_state", room: snapshot({ mode: "gladiator", gladiatorDeathGap: 400, starActiveIds: [] }) });
      socket.emit({ type: "gladiator_state", myHp: 700, opponentHp: 300, myWordCount: 250, opponentWordCount: 120, gap: 130, iAhead: true, deathGap: 400, myBuffs: ["momentum"], opponentBuffs: [] });
      socket.emit({ type: "gladiator_execution", outcome: "victory", myHp: 700, opponentHp: 300, myWordCount: 250, opponentWordCount: 120,
        stats: { closestGap: 10, maxGap: 130, leadChanges: 1, timeInDangerMs: 0, endedByExecution: false, totalHpHealed: {} } });
      socket.emit({ type: "sprint_ended", results: [writer, peer] });
      await waitFor(() => latest.current.room?.status === "finished", "duel completion");
      check("retains the gladiator result when sprint completion arrives", latest.current.gladiatorState.executionResult?.outcome === "victory" && latest.current.gladiatorState.myHp === 700);
      // The old hook disconnected at eight seconds, silently disabling restart.
      await pause(8500);
      check("connection survives sprint completion", socket.readyState === 1 && latest.current.isConnected);
      latest.current.restartSprint(1);
      await waitFor(() => latest.current.room?.status === "waiting", "post-results restart");
      check("restart works after the results screen", latest.current.room?.status === "waiting");
      check("restart resets gladiator results, health and buffs", latest.current.gladiatorState.executionResult === null && latest.current.gladiatorState.myHp === 1000 && latest.current.gladiatorState.opponentHp === 1000 && latest.current.gladiatorState.myBuffs.length === 0 && latest.current.gladiatorState.gap === 0);

      const editor: Participant = { ...peer, id: "editor", name: "Editor", role: "editor", wordCount: 999 };
      socket.emit({ type: "room_state", room: snapshot({ mode: "boss", bossWordGoal: 500, bossTotalWords: 203, participants: [writer, peer, editor], starActiveIds: [] }) });
      socket.emit({ type: "participant_update", participant: { ...writer, wordCount: 200 } });
      await waitFor(() => latest.current.room?.bossTotalWords === 280, "live boss contribution");
      check("live boss totals exclude editor notes", latest.current.room?.bossTotalWords === 280);
      socket.emit({ type: "boss_defeated", bossTotalWords: 510 });
      await waitFor(() => latest.current.room?.bossTotalWords === 510, "boss victory event");
      check("boss victory immediately records its final total", latest.current.room?.bossTotalWords === 510);
      socket.emit({ type: "sprint_ended", results: [{ ...writer, wordCount: 430 }, peer] });
      await waitFor(() => latest.current.room?.status === "finished", "boss completion");
      check("finished boss retains victory total and zero time remaining", latest.current.room?.bossTotalWords === 510 && latest.current.room?.timeLeft === 0);

      latest.current.restartSprint(1);
      await waitFor(() => latest.current.room?.status === "waiting", "recoverable-error setup");
      socket.emit({ type: "error", message: "Two writers must join before the duel can start." });
      await waitFor(() => latest.current.actionError !== null, "recoverable action error");
      check("recoverable action errors preserve the connected room", latest.current.error === null && latest.current.isConnected && latest.current.room?.status === "waiting" && socket.readyState === 1);
      latest.current.clearActionError();
      await waitFor(() => latest.current.actionError === null, "dismiss action error");
      check("recoverable action notices can be dismissed", latest.current.actionError === null && latest.current.room !== null);
    }
    run().catch(error => { if (!cancelled) setFailure(String(error)); }).finally(() => { if (!cancelled) setDone(true); });
    return () => { cancelled = true; };
  }, []);
  const passed = done && !failure && checks.length === EXPECTED_CHECKS && checks.every(check => check.startsWith("PASS"));
  return <main data-test-status={!done ? "running" : passed ? "passed" : "failed"}>
    <h1>Sprint connection regression tests</h1>
    <p>{!done ? `Running… ${checks.length}/${EXPECTED_CHECKS} (about 11 seconds)` : passed ? `All ${EXPECTED_CHECKS} checks passed` : "FAILED"}</p>
    {failure && <pre>{failure}</pre>}
    <ul>{checks.map(check => <li key={check}>{check}</li>)}</ul>
    <p>Room state: {sprint.room?.status ?? "connecting"}</p>
    <div style={{ width: 800, maxWidth: "100%" }} aria-hidden="true">
      <RaceTrack participants={[{ ...writer, wordCount: 0, kartCarOffset: 0 }, { ...peer, name: "A writer with a much longer name", wordCount: 0 }]} currentParticipantId="writer" durationMinutes={5} />
      <RaceTrack participants={[{ ...writer, wordCount: 0, kartCarOffset: 0 }, { ...peer, name: "A writer with a much longer name", wordCount: 0 }]} currentParticipantId="writer" durationMinutes={5} isKartMode />
    </div>
  </main>;
}
createRoot(document.getElementById("root")!).render(<Tests />);
