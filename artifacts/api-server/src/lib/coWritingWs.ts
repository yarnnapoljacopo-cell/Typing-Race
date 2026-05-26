import { WebSocket, WebSocketServer } from "ws";
import type { Server, IncomingMessage } from "http";
import * as Y from "yjs";
import * as syncProtocol from "y-protocols/sync";
import * as awarenessProtocol from "y-protocols/awareness";
import * as encoding from "lib0/encoding";
import * as decoding from "lib0/decoding";
import { logger } from "./logger";
import { db, coWritingDocStateTable, coWritingDocsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { coWritingIsMember } from "../routes/coWriting";

/**
 * Minimal y-websocket-compatible sync server. Each `roomId/docId` pair gets a
 * shared Y.Doc + awareness instance held in memory; clients subscribe via
 * WebSocket and the y-protocols framing handles bidirectional CRDT merging
 * + cursor/presence awareness.
 *
 * Persistence: the Y.Doc binary state is written to Postgres
 * (`co_writing_doc_state`) on a debounced 2-second schedule whenever it
 * mutates. A plain-text snapshot is also stored so the room list can show a
 * preview without decoding the binary state.
 *
 * Auth: the client connects with `?room=<id>&doc=<id>&user=<clerkUserId>`.
 * We verify `user` is in `co_writing_members(room_id, user_id)` before
 * relaying any messages. (MVP — for stronger auth swap in a Clerk JWT
 * verify step here.)
 */

// y-websocket protocol message types
const MESSAGE_SYNC = 0;
const MESSAGE_AWARENESS = 1;
// const MESSAGE_AUTH = 2;
// const MESSAGE_QUERY_AWARENESS = 3;

/** Each in-memory shared doc + its connected clients. Keyed by `roomId:docId`. */
interface SharedDoc {
  ydoc: Y.Doc;
  awareness: awarenessProtocol.Awareness;
  conns: Set<WebSocket>;
  saveTimer: NodeJS.Timeout | null;
  dirty: boolean;
}
const shared = new Map<string, SharedDoc>();

function shKey(roomId: number, docId: number) { return `${roomId}:${docId}`; }

export async function loadOrCreateDoc(roomId: number, docId: number): Promise<SharedDoc> {
  const key = shKey(roomId, docId);
  const existing = shared.get(key);
  if (existing) return existing;

  const ydoc = new Y.Doc();
  // Hydrate from persisted state if any. If the binary Y.Doc state is missing
  // but the plain-text snapshot has content (the HTTP fallback save path —
  // see snapshotDoc + the /snapshot route), seed the Y.Text with that HTML
  // so the user's content reappears even when the WS-based save never ran.
  try {
    const [row] = await db.select().from(coWritingDocStateTable).where(eq(coWritingDocStateTable.docId, docId));
    if (row?.state && row.state.length > 0) {
      Y.applyUpdate(ydoc, new Uint8Array(row.state));
    } else if (row?.textPreview && row.textPreview.length > 0) {
      ydoc.getText("body").insert(0, row.textPreview);
    }
  } catch (e) {
    logger.warn({ err: e, roomId, docId }, "co-writing: failed to hydrate Y.Doc from DB");
  }

  const awareness = new awarenessProtocol.Awareness(ydoc);
  awareness.setLocalState(null); // server doesn't claim a presence slot

  const sd: SharedDoc = { ydoc, awareness, conns: new Set(), saveTimer: null, dirty: false };
  shared.set(key, sd);

  // Mark dirty + schedule a save on every Y.Doc update.
  ydoc.on("update", (_update, origin) => {
    // Skip our own loads (origin === "db") to avoid feedback loops.
    if (origin === "db") return;
    sd.dirty = true;
    if (sd.saveTimer) clearTimeout(sd.saveTimer);
    sd.saveTimer = setTimeout(() => void persistDoc(roomId, docId, sd), 2000);
  });

  return sd;
}

async function persistDoc(roomId: number, docId: number, sd: SharedDoc): Promise<void> {
  if (!sd.dirty) return;
  sd.dirty = false;
  try {
    const state = Buffer.from(Y.encodeStateAsUpdate(sd.ydoc));
    // Persist the FULL body text (was sliced to 500 chars previously — useless
    // for restoration). This is the resilient fallback used by loadOrCreateDoc
    // if the binary Y.Doc state ever ends up missing or corrupt.
    const ytext = sd.ydoc.getText("body");
    const fullText = ytext.toString();
    const now = new Date();
    // Upsert state row.
    await db.insert(coWritingDocStateTable)
      .values({ docId, state, textPreview: fullText, updatedAt: now })
      .onConflictDoUpdate({
        target: [coWritingDocStateTable.docId],
        set: { state, textPreview: fullText, updatedAt: now },
      });
    // Bump doc.updated_at so room listings see freshness.
    await db.update(coWritingDocsTable).set({ updatedAt: now }).where(eq(coWritingDocsTable.id, docId));
  } catch (e) {
    logger.error({ err: e, roomId, docId }, "co-writing: failed to persist Y.Doc state");
    // Re-arm so we retry on the next update.
    sd.dirty = true;
  }
}

/**
 * HTTP-fallback save path: writes the client's current HTML to BOTH the
 * `text_preview` column (always — used by loadOrCreateDoc if Y state is
 * missing) AND the Y.Doc binary state (so subsequent reloads pick it up
 * via the normal state path).
 *
 * If a SharedDoc is currently in memory for this (room, doc) — i.e. there
 * are connected WS clients — we ALSO splice the new HTML into the live
 * Y.Text so everyone converges. We do this idempotently: if the body
 * already matches, no Yjs ops are emitted.
 */
export async function snapshotDoc(
  roomId: number, docId: number, html: string,
): Promise<void> {
  const trimmed = html.length > 200_000 ? html.slice(0, 200_000) : html;
  const now = new Date();

  // Update the live in-memory doc (if any) so connected clients see the
  // update too. This keeps the snapshot path and the WS path consistent.
  const key = shKey(roomId, docId);
  const live = shared.get(key);
  if (live) {
    const ytext = live.ydoc.getText("body");
    if (ytext.toString() !== trimmed) {
      live.ydoc.transact(() => {
        ytext.delete(0, ytext.length);
        if (trimmed.length > 0) ytext.insert(0, trimmed);
      }, "snapshot");
    }
    // The transaction above triggers ydoc.on("update") which already
    // schedules a debounced persistDoc — but we also write directly below
    // so we don't depend on that timer firing.
  }

  // Build a Y.Doc state encoding of just this HTML so the next load via
  // loadOrCreateDoc gets it back via the fast Y.Doc state path (skipping
  // the text-only fallback branch).
  const tempDoc = new Y.Doc();
  if (trimmed.length > 0) tempDoc.getText("body").insert(0, trimmed);
  const state = Buffer.from(Y.encodeStateAsUpdate(tempDoc));

  try {
    await db.insert(coWritingDocStateTable)
      .values({ docId, state, textPreview: trimmed, updatedAt: now })
      .onConflictDoUpdate({
        target: [coWritingDocStateTable.docId],
        set: { state, textPreview: trimmed, updatedAt: now },
      });
    await db.update(coWritingDocsTable).set({ updatedAt: now }).where(eq(coWritingDocsTable.id, docId));
  } catch (e) {
    logger.error({ err: e, roomId, docId }, "co-writing: snapshot save failed");
    throw e;
  }
}

// ── Per-connection message handling ───────────────────────────────────────
function send(ws: WebSocket, payload: Uint8Array) {
  if (ws.readyState !== WebSocket.OPEN) return;
  ws.send(payload, { binary: true }, (err) => {
    if (err) logger.warn({ err }, "co-writing: ws send failed");
  });
}

function broadcast(sd: SharedDoc, payload: Uint8Array, except?: WebSocket) {
  sd.conns.forEach((c) => { if (c !== except) send(c, payload); });
}

function handleSyncMessage(sd: SharedDoc, ws: WebSocket, decoder: decoding.Decoder): void {
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, MESSAGE_SYNC);
  // syncProtocol.readSyncMessage applies updates to ydoc and may write a
  // sync-step-2 / update message into `encoder` for the client.
  const messageType = syncProtocol.readSyncMessage(decoder, encoder, sd.ydoc, ws);
  // Only flush back if the protocol actually wrote a response.
  if (encoding.length(encoder) > 1) send(ws, encoding.toUint8Array(encoder));
  // Update messages should be re-broadcast to other clients too (the apply
  // above triggers the ydoc.on('update') hook which would broadcast — but
  // y-protocols' readSyncMessage applies via Y.applyUpdate which DOES
  // trigger update events, so we don't need to manually re-broadcast here).
  void messageType;
}

function handleAwarenessMessage(sd: SharedDoc, ws: WebSocket, decoder: decoding.Decoder): void {
  // Apply the incoming awareness update to our local awareness instance and
  // broadcast to others. (We exclude `ws` because the client already has it.)
  const update = decoding.readVarUint8Array(decoder);
  awarenessProtocol.applyAwarenessUpdate(sd.awareness, update, ws);
  // No need to manually broadcast — we install an awareness change listener
  // below that handles broadcasting.
}

export function setupCoWritingWsServer(server: Server): WebSocketServer {
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (req: IncomingMessage, socket, head) => {
    try {
      const url = new URL(req.url ?? "", "http://localhost");
      // y-websocket appends the room name to the URL, so the incoming
      // pathname is `/ws/cowriting/<roomname>`, not exactly `/ws/cowriting`.
      // Match anything under the prefix and let the per-conn handler read
      // the room/doc/user from the query string.
      if (!url.pathname.startsWith("/ws/cowriting")) return;
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit("connection", ws, req);
      });
    } catch {
      socket.destroy();
    }
  });

  wss.on("connection", async (ws: WebSocket, req: IncomingMessage) => {
    let url: URL;
    try { url = new URL(req.url ?? "", "http://localhost"); }
    catch { ws.close(1008, "Bad URL"); return; }

    const roomId = parseInt(url.searchParams.get("room") ?? "", 10);
    const docId = parseInt(url.searchParams.get("doc") ?? "", 10);
    const userId = url.searchParams.get("user") ?? "";

    if (!Number.isFinite(roomId) || !Number.isFinite(docId) || !userId) {
      ws.close(1008, "Missing params"); return;
    }
    // Verify membership before joining the shared doc.
    try {
      if (!(await coWritingIsMember(roomId, userId))) {
        ws.close(1008, "Not a member of this room"); return;
      }
    } catch (e) {
      logger.warn({ err: e, roomId, userId }, "co-writing: membership check failed");
      ws.close(1011, "Server error"); return;
    }

    const sd = await loadOrCreateDoc(roomId, docId);
    sd.conns.add(ws);

    // ── Send initial sync (step 1) so the client can converge ──
    {
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, MESSAGE_SYNC);
      syncProtocol.writeSyncStep1(encoder, sd.ydoc);
      send(ws, encoding.toUint8Array(encoder));
    }
    // ── Send current awareness state so newcomer sees existing cursors ──
    {
      const states = sd.awareness.getStates();
      if (states.size > 0) {
        const encoder = encoding.createEncoder();
        encoding.writeVarUint(encoder, MESSAGE_AWARENESS);
        encoding.writeVarUint8Array(
          encoder,
          awarenessProtocol.encodeAwarenessUpdate(sd.awareness, Array.from(states.keys())),
        );
        send(ws, encoding.toUint8Array(encoder));
      }
    }

    // Awareness change listener — broadcast any changes to ALL clients so
    // they reflect each other's presence/cursors.
    const onAwarenessChange = (
      { added, updated, removed }: { added: number[]; updated: number[]; removed: number[] },
      origin: unknown,
    ) => {
      const changedClients = [...added, ...updated, ...removed];
      if (changedClients.length === 0) return;
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, MESSAGE_AWARENESS);
      encoding.writeVarUint8Array(
        encoder,
        awarenessProtocol.encodeAwarenessUpdate(sd.awareness, changedClients),
      );
      const payload = encoding.toUint8Array(encoder);
      // Re-broadcast to everyone EXCEPT the origin connection (it already has
      // the state locally). Origin may be a WebSocket or null for server-side.
      sd.conns.forEach((c) => { if (c !== origin) send(c, payload); });
    };
    sd.awareness.on("update", onAwarenessChange);

    // Doc update listener — broadcast incremental updates to other clients.
    const onDocUpdate = (update: Uint8Array, origin: unknown) => {
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, MESSAGE_SYNC);
      syncProtocol.writeUpdate(encoder, update);
      const payload = encoding.toUint8Array(encoder);
      sd.conns.forEach((c) => { if (c !== origin) send(c, payload); });
    };
    sd.ydoc.on("update", onDocUpdate);

    ws.on("message", (data: Buffer) => {
      try {
        const decoder = decoding.createDecoder(new Uint8Array(data));
        const messageType = decoding.readVarUint(decoder);
        if (messageType === MESSAGE_SYNC) {
          handleSyncMessage(sd, ws, decoder);
        } else if (messageType === MESSAGE_AWARENESS) {
          handleAwarenessMessage(sd, ws, decoder);
        }
        // Other message types (auth, queryAwareness) are intentionally
        // ignored for this MVP — the client never sends them in practice.
      } catch (e) {
        logger.warn({ err: e }, "co-writing: failed to decode WS message");
      }
    });

    const cleanup = () => {
      sd.conns.delete(ws);
      sd.ydoc.off("update", onDocUpdate);
      sd.awareness.off("update", onAwarenessChange);

      // Belt-and-suspenders: if this was the last connection AND there are
      // pending edits, flush them to DB right away — don't wait the 2s
      // debounce or the 30s eviction window. Losing unsaved work because
      // the client closed before the timer fired was the user-visible bug
      // ("everything inside deletes and doesn't save").
      if (sd.conns.size === 0 && sd.dirty) {
        if (sd.saveTimer) { clearTimeout(sd.saveTimer); sd.saveTimer = null; }
        void persistDoc(roomId, docId, sd);
      }

      // Keep the in-memory doc around for a short grace window so quick
      // reloads stay snappy (no DB round-trip) without holding state forever.
      if (sd.conns.size === 0) {
        setTimeout(() => {
          const key = shKey(roomId, docId);
          const current = shared.get(key);
          if (current && current.conns.size === 0) {
            if (current.saveTimer) {
              clearTimeout(current.saveTimer);
              current.saveTimer = null;
            }
            // One more chance to flush — covers updates that arrived between
            // the immediate flush above and this grace-window expiry.
            if (current.dirty) void persistDoc(roomId, docId, current);
            shared.delete(key);
          }
        }, 30_000);
      }
    };
    ws.on("close", cleanup);
    ws.on("error", (e) => { logger.warn({ err: e }, "co-writing: ws error"); cleanup(); });
  });

  return wss;
}
