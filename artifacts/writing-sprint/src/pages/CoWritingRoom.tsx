import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useLocation, useParams } from "wouter";
import { useAuth, useUser } from "@clerk/react";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import { useAuthedFetch } from "@/lib/authedFetch";
import "./CoWriting.css";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

interface Member {
  userId: string;
  displayName: string;
  color: string;
  role: string;
  joinedAt: string;
  lastSeenAt: string;
}
interface Doc {
  id: number;
  name: string;
  orderIndex: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}
interface RoomDetails {
  room: { id: number; name: string; inviteCode: string; ownerUserId: string; isOwner: boolean };
  members: Member[];
  docs: Doc[];
}

interface AwarenessUser {
  name: string;
  color: string;
  userId: string;
}
interface AwarenessState {
  user: AwarenessUser;
  cursor?: { anchor: number; head: number } | null;
}

/** Build the y-websocket URL targeting our server. We can't use the standard
 *  ws:// prefix here — y-websocket appends `/<roomName>` itself, so we feed it
 *  the base URL up to the query string and pass auth via query params. */
function buildWsUrl(): string {
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${window.location.host}/ws/cowriting`;
}

export default function CoWritingRoom() {
  const [, setLocation] = useLocation();
  const params = useParams<{ id: string }>();
  const roomIdNum = parseInt(params.id ?? "", 10);
  const { isLoaded, isSignedIn, userId } = useAuth();
  const { user } = useUser();
  const authedFetch = useAuthedFetch();

  const [details, setDetails] = useState<RoomDetails | null>(null);
  const [activeDocId, setActiveDocId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Yjs state — one Y.Doc per active document. When user switches docs we
  // tear down the previous provider and stand up a fresh one.
  const ydocRef = useRef<Y.Doc | null>(null);
  const providerRef = useRef<WebsocketProvider | null>(null);
  const [connState, setConnState] = useState<"connecting" | "online" | "offline">("connecting");
  // Map of clientID → awareness state (other users). We mirror it into React
  // state so the members panel + cursor overlay can render reactively.
  const [remoteStates, setRemoteStates] = useState<Map<number, AwarenessState>>(new Map());

  // Refs used by the editor binding + cursor renderer
  const editorRef = useRef<HTMLTextAreaElement | null>(null);
  const titleRef = useRef<HTMLInputElement | null>(null);

  // Bootstrap room details on mount + when the route changes
  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) { setLocation("/portal"); return; }
    if (!Number.isFinite(roomIdNum)) { setError("Invalid room id"); setLoading(false); return; }
    setLoading(true); setError(null);
    authedFetch(`${basePath}/api/co-writing/rooms/${roomIdNum}`)
      .then(async (r) => {
        if (r.status === 403) { setError("You're not a member of this room."); return; }
        if (!r.ok) throw new Error("Failed to load room");
        const data = await r.json() as RoomDetails;
        setDetails(data);
        // Auto-select first doc
        if (data.docs.length > 0) setActiveDocId(data.docs[0].id);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Failed to load room"))
      .finally(() => setLoading(false));
  }, [isLoaded, isSignedIn, roomIdNum, authedFetch, setLocation]);

  // ── Yjs provider lifecycle — re-create whenever the active doc changes ──
  useEffect(() => {
    if (!activeDocId || !userId || !details) return;

    // Tear down previous provider before bringing up a new one.
    providerRef.current?.destroy();
    ydocRef.current?.destroy();

    const ydoc = new Y.Doc();
    ydocRef.current = ydoc;

    // y-websocket convention: roomName is appended to the URL by the provider.
    // Our server reads `room`/`doc`/`user` from the query string. Pass those
    // by setting `params` on the provider (it appends them to the URL).
    const provider = new WebsocketProvider(buildWsUrl(), `${roomIdNum}-${activeDocId}`, ydoc, {
      params: { room: String(roomIdNum), doc: String(activeDocId), user: userId },
      connect: true,
    });
    providerRef.current = provider;

    // Seed our own awareness state so other clients see us.
    const myMember = details.members.find((m) => m.userId === userId);
    const myDisplay = myMember?.displayName ?? (user?.firstName ?? user?.username ?? "Writer");
    const myColor = myMember?.color ?? "#3b6ea5";
    provider.awareness.setLocalStateField("user", {
      userId, name: myDisplay, color: myColor,
    } satisfies AwarenessUser);

    // Mirror remote awareness into React state.
    const handleAwarenessChange = () => {
      const map = new Map<number, AwarenessState>();
      provider.awareness.getStates().forEach((state, clientID) => {
        if (clientID === provider.awareness.clientID) return; // skip self
        if (state && (state as AwarenessState).user) map.set(clientID, state as AwarenessState);
      });
      setRemoteStates(map);
    };
    provider.awareness.on("change", handleAwarenessChange);
    handleAwarenessChange();

    const handleStatus = (e: { status: "connected" | "disconnected" | "connecting" }) => {
      if (e.status === "connected") setConnState("online");
      else if (e.status === "disconnected") setConnState("offline");
      else setConnState("connecting");
    };
    provider.on("status", handleStatus);

    return () => {
      provider.awareness.off("change", handleAwarenessChange);
      provider.off("status", handleStatus);
      provider.destroy();
      ydoc.destroy();
      providerRef.current = null;
      ydocRef.current = null;
      setRemoteStates(new Map());
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDocId, roomIdNum, userId, details?.room.id]);

  // ── Bind Y.Text to the textarea ─────────────────────────────────────────
  // Plain-text MVP: the Y.Text "body" map is the single source of truth.
  // Local input → applies diff to Y.Text. Y.Text observe → writes value into
  // textarea while preserving the caret.
  useEffect(() => {
    const ydoc = ydocRef.current;
    const editor = editorRef.current;
    if (!ydoc || !editor) return;
    const ytext = ydoc.getText("body");

    // Initial paint
    editor.value = ytext.toString();

    let applyingRemote = false;

    const observer = () => {
      // Remote update → rewrite textarea while keeping cursor near where the
      // user was. Simple approach: remember anchor offsets relative to the
      // text end, then restore. Good enough for plain text.
      if (document.activeElement !== editor) {
        editor.value = ytext.toString();
        return;
      }
      const oldLen = editor.value.length;
      const selStart = editor.selectionStart;
      const selEnd = editor.selectionEnd;
      const fromEndStart = oldLen - selStart;
      const fromEndEnd = oldLen - selEnd;
      applyingRemote = true;
      editor.value = ytext.toString();
      const newLen = editor.value.length;
      editor.selectionStart = Math.max(0, newLen - fromEndStart);
      editor.selectionEnd = Math.max(0, newLen - fromEndEnd);
      applyingRemote = false;
    };
    ytext.observe(observer);

    // Local input → diff against ytext and apply the smallest change.
    const onInput = () => {
      if (applyingRemote) return;
      const next = editor.value;
      const prev = ytext.toString();
      if (next === prev) return;
      // Find common prefix + suffix to produce a minimal delete/insert.
      let start = 0;
      const maxStart = Math.min(prev.length, next.length);
      while (start < maxStart && prev[start] === next[start]) start++;
      let endPrev = prev.length;
      let endNext = next.length;
      while (endPrev > start && endNext > start && prev[endPrev - 1] === next[endNext - 1]) {
        endPrev--; endNext--;
      }
      ydoc.transact(() => {
        if (endPrev > start) ytext.delete(start, endPrev - start);
        if (endNext > start) ytext.insert(start, next.slice(start, endNext));
      }, "local");
    };
    editor.addEventListener("input", onInput);

    // Local selection → write into awareness so other clients can render
    // our cursor + selection.
    const onSel = () => {
      const provider = providerRef.current;
      if (!provider) return;
      provider.awareness.setLocalStateField("cursor", {
        anchor: editor.selectionStart,
        head: editor.selectionEnd,
      });
    };
    editor.addEventListener("select", onSel);
    editor.addEventListener("click", onSel);
    editor.addEventListener("keyup", onSel);

    return () => {
      ytext.unobserve(observer);
      editor.removeEventListener("input", onInput);
      editor.removeEventListener("select", onSel);
      editor.removeEventListener("click", onSel);
      editor.removeEventListener("keyup", onSel);
    };
  }, [activeDocId]);

  // ── Members panel data: merge persisted members with live awareness ─────
  const onlineUserIds = useMemo(() => {
    const set = new Set<string>();
    remoteStates.forEach((s) => { if (s.user?.userId) set.add(s.user.userId); });
    if (userId) set.add(userId); // we count ourselves as online when connected
    return set;
  }, [remoteStates, userId]);

  // ── Cursor overlay positioning ──────────────────────────────────────────
  // Build a hidden div mirror of the textarea content, measure character
  // offsets there, then position the cursor + selection divs accordingly.
  // This is the same trick most "cursor overlay" implementations use.
  const mirrorRef = useRef<HTMLDivElement | null>(null);
  const [cursorRects, setCursorRects] = useState<Array<{
    clientID: number; name: string; color: string;
    caret: { left: number; top: number } | null;
    selection: { left: number; top: number; width: number } | null;
  }>>([]);

  useEffect(() => {
    const editor = editorRef.current;
    const mirror = mirrorRef.current;
    if (!editor || !mirror) return;

    function recompute() {
      if (!editor || !mirror) return;
      const text = editor.value;
      const rects: typeof cursorRects = [];
      remoteStates.forEach((state, clientID) => {
        const cursor = state.cursor;
        const user = state.user;
        if (!cursor || !user) return;
        const anchor = Math.max(0, Math.min(text.length, cursor.anchor));
        const head = Math.max(0, Math.min(text.length, cursor.head));
        const caretOff = head;
        // Build mirror content with a span at the caret position.
        mirror.innerHTML = "";
        const before = document.createTextNode(text.slice(0, caretOff));
        const span = document.createElement("span");
        span.textContent = "​"; // zero-width space so it has a layout box
        const after = document.createTextNode(text.slice(caretOff));
        mirror.appendChild(before);
        mirror.appendChild(span);
        mirror.appendChild(after);
        const spanRect = span.getBoundingClientRect();
        const editorRect = editor.getBoundingClientRect();
        const caret = {
          left: spanRect.left - editorRect.left + editor.scrollLeft,
          top:  spanRect.top  - editorRect.top  + editor.scrollTop,
        };
        // Selection rect — only if non-collapsed AND on the same line.
        let selection: { left: number; top: number; width: number } | null = null;
        if (anchor !== head) {
          const start = Math.min(anchor, head);
          const end = Math.max(anchor, head);
          mirror.innerHTML = "";
          const beforeSel = document.createTextNode(text.slice(0, start));
          const selSpan = document.createElement("span");
          selSpan.textContent = text.slice(start, end) || "​";
          const afterSel = document.createTextNode(text.slice(end));
          mirror.appendChild(beforeSel);
          mirror.appendChild(selSpan);
          mirror.appendChild(afterSel);
          const selRect = selSpan.getBoundingClientRect();
          // Only render the highlight if it's on the same visual line as the
          // caret (multi-line selection drawing is intentionally skipped to
          // keep the overlay simple).
          if (Math.abs(selRect.top - spanRect.top) < 4) {
            selection = {
              left: selRect.left - editorRect.left + editor.scrollLeft,
              top:  selRect.top  - editorRect.top  + editor.scrollTop,
              width: selRect.width,
            };
          }
        }
        rects.push({ clientID, name: user.name, color: user.color, caret, selection });
      });
      setCursorRects(rects);
    }
    recompute();
    // Re-measure on textarea scroll/resize so cursors track the visible content.
    const ro = new ResizeObserver(recompute);
    ro.observe(editor);
    editor.addEventListener("scroll", recompute);
    return () => {
      ro.disconnect();
      editor.removeEventListener("scroll", recompute);
    };
  // Re-run whenever remote cursors change OR doc body changes (we use the
  // textarea value via the value-change observer wired earlier).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remoteStates, activeDocId]);

  // ── Doc title sync ─────────────────────────────────────────────────────
  // Title isn't part of Y.Text (it's a server-side field). We sync changes
  // via a debounced PATCH. Keeping this simple — co-titles can race; last
  // writer wins.
  const titleSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleTitleChange = useCallback((val: string) => {
    if (!details || !activeDocId) return;
    const next = val.slice(0, 200);
    setDetails((prev) => prev && {
      ...prev,
      docs: prev.docs.map((d) => d.id === activeDocId ? { ...d, name: next } : d),
    });
    if (titleSaveTimer.current) clearTimeout(titleSaveTimer.current);
    titleSaveTimer.current = setTimeout(() => {
      authedFetch(`${basePath}/api/co-writing/rooms/${roomIdNum}/docs/${activeDocId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: next }),
      }).catch(() => {});
    }, 600);
  }, [authedFetch, roomIdNum, activeDocId, details]);

  const createDoc = useCallback(async () => {
    if (!details) return;
    const res = await authedFetch(`${basePath}/api/co-writing/rooms/${roomIdNum}/docs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Untitled" }),
    });
    if (!res.ok) return;
    const data = await res.json() as { doc?: Doc };
    if (data.doc) {
      setDetails((prev) => prev && { ...prev, docs: [...prev.docs, { ...data.doc!, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), createdBy: userId ?? "" } as Doc] });
      setActiveDocId(data.doc.id);
    }
  }, [authedFetch, roomIdNum, details, userId]);

  const copyInviteCode = useCallback(() => {
    if (!details) return;
    navigator.clipboard?.writeText(details.room.inviteCode).catch(() => {});
  }, [details]);

  // ── Render ─────────────────────────────────────────────────────────────
  if (loading) return <div className="cw-room-root"><div className="cw-empty">Loading room…</div></div>;
  if (error)   return <div className="cw-room-root"><div className="cw-empty cw-error">{error} <button className="cw-btn cw-btn-ghost" style={{ marginLeft: 12 }} onClick={() => setLocation("/co-writing")}>Back</button></div></div>;
  if (!details) return null;

  const activeDoc = details.docs.find((d) => d.id === activeDocId) ?? null;

  return (
    <div className="cw-room-root">
      <div className="cw-room-topbar">
        <button className="cw-back-btn" onClick={() => setLocation("/co-writing")} title="Back to rooms">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <div className="cw-room-title">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--accent)" }}>
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
          <span className="cw-room-title-name">{details.room.name}</span>
        </div>
        <button className="cw-room-invite" onClick={copyInviteCode} title="Copy invite code">
          {details.room.inviteCode}
        </button>
        <div className="editor-topbar-spacer" style={{ flex: 1 }} />
        <div className="cw-room-conn">
          <span className={`cw-conn-dot cw-conn-dot--${connState}`} />
          {connState === "online" ? "Live" : connState === "offline" ? "Offline" : "Connecting…"}
        </div>
      </div>

      <div className="cw-room-body">
        {/* Doc list */}
        <aside className="cw-doc-list">
          <div className="cw-doc-list-header">
            <span>Chapters</span>
            <button className="cw-doc-list-new" onClick={createDoc} title="New chapter">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            </button>
          </div>
          <div className="cw-doc-list-body">
            {details.docs.length === 0 && (
              <div className="cw-doc-list-empty">No chapters yet. Click + to create one.</div>
            )}
            {details.docs.map((d) => (
              <button
                key={d.id}
                className={`cw-doc-item${d.id === activeDocId ? " active" : ""}`}
                onClick={() => setActiveDocId(d.id)}
              >
                <span className="cw-doc-item-dot" />
                <span className="cw-doc-item-name">{d.name || "Untitled"}</span>
              </button>
            ))}
          </div>
        </aside>

        {/* Editor */}
        <div className="cw-editor-wrap">
          {!activeDoc ? (
            <div className="cw-empty-doc">
              <h3>No chapter selected</h3>
              <p>Create or pick a chapter from the sidebar to start writing together.</p>
              <button className="cw-btn cw-btn-primary" onClick={createDoc}>Create a chapter</button>
            </div>
          ) : (
            <div className="cw-editor-scroll">
              <div className="cw-paper">
                <input
                  ref={titleRef}
                  className="cw-doc-title-input"
                  value={activeDoc.name}
                  placeholder="Chapter title…"
                  onChange={(e) => handleTitleChange(e.target.value)}
                />
                {/* Hidden mirror used to measure caret/selection rects for the
                    cursor overlay. Mirrors the textarea's font/size/padding. */}
                <div
                  ref={mirrorRef}
                  aria-hidden
                  style={{
                    position: "absolute", visibility: "hidden",
                    whiteSpace: "pre-wrap", wordWrap: "break-word",
                    font: "inherit", fontFamily: "'Lora',serif", fontSize: 15, lineHeight: 1.9,
                    padding: 0, margin: 0, border: 0, boxSizing: "border-box",
                    width: "100%", maxWidth: 740 - 56 * 2,
                    top: 0, left: 0,
                  }}
                />
                <div style={{ position: "relative" }}>
                  <textarea
                    ref={editorRef}
                    className="cw-editor-body"
                    placeholder="Start writing together…"
                    spellCheck
                  />
                  {/* Remote cursor + selection overlay */}
                  <div className="cw-remote-cursor-layer">
                    {cursorRects.map((c) => (
                      <div key={c.clientID}>
                        {c.selection && (
                          <div
                            className="cw-remote-selection"
                            style={{
                              left: c.selection.left,
                              top: c.selection.top,
                              width: c.selection.width,
                              background: c.color,
                            }}
                          />
                        )}
                        {c.caret && (
                          <div
                            className="cw-remote-cursor"
                            data-name={c.name}
                            style={{
                              left: c.caret.left,
                              top: c.caret.top,
                              background: c.color,
                            }}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Members panel */}
        <aside className="cw-members-panel">
          <div className="cw-members-header">Members · {details.members.length}</div>
          <div className="cw-members-list">
            {details.members.map((m) => {
              const online = onlineUserIds.has(m.userId);
              const isYou = m.userId === userId;
              return (
                <div key={m.userId} className="cw-member-row">
                  <div className="cw-member-avatar" style={{ background: m.color }}>
                    {m.displayName.charAt(0).toUpperCase()}
                    <span className={`cw-member-presence cw-member-presence--${online ? "online" : "offline"}`} />
                  </div>
                  <div className="cw-member-info">
                    <span className="cw-member-name">{m.displayName}{isYou ? " (you)" : ""}</span>
                    <span className="cw-member-status">{online ? "Online" : "Offline"}</span>
                  </div>
                  {m.role === "owner" && <span className="cw-member-role-tag">Owner</span>}
                </div>
              );
            })}
          </div>
        </aside>
      </div>
    </div>
  );
}
