import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useLocation, useParams } from "wouter";
import { useAuth, useUser } from "@clerk/react";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import { useAuthedFetch } from "@/lib/authedFetch";
import { WritingToolbar, type WritingStyle, type FormatType } from "@/components/WritingToolbar";
import { CoWritingCardsPanel } from "@/components/CoWritingCardsPanel";
import { CoWritingNotesPanel } from "@/components/CoWritingNotesPanel";
import "./CoWriting.css";
// MyFiles.css owns all the .nncards-*, .cn-*, .card.* styles we need to make
// the Folio Cards panel look identical inside the co-writing room.
import "./MyFiles.css";

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

/** Build the y-websocket URL targeting our server. y-websocket appends the
 *  room name to the URL, and our server reads `room`/`doc`/`user` from the
 *  query string. */
function buildWsUrl(): string {
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${window.location.host}/ws/cowriting`;
}

const DEFAULT_STYLE: WritingStyle = {
  fontFamily: "'Lora', Georgia, serif",
  fontSize: 18,
  lineHeight: 1.75,
  paragraphMode: "none",
  typewriterMode: false,
};

// localStorage key for the per-user writing style (so it survives reloads).
const STYLE_LS_KEY = "cowriting:writing-style:v1";

function loadStyle(): WritingStyle {
  try {
    const raw = localStorage.getItem(STYLE_LS_KEY);
    if (!raw) return DEFAULT_STYLE;
    const parsed = JSON.parse(raw) as Partial<WritingStyle>;
    return { ...DEFAULT_STYLE, ...parsed };
  } catch {
    return DEFAULT_STYLE;
  }
}

/** Walk text nodes inside `root` and return the {node, offset} that
 *  corresponds to `targetOffset` characters from the start of root.innerText. */
function locateOffset(root: Node, targetOffset: number): { node: Node; offset: number } | null {
  let remaining = targetOffset;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let last: Text | null = null;
  while (walker.nextNode()) {
    const t = walker.currentNode as Text;
    const len = t.data.length;
    if (remaining <= len) return { node: t, offset: Math.max(0, remaining) };
    remaining -= len;
    last = t;
  }
  if (last) return { node: last, offset: last.data.length };
  return { node: root, offset: 0 };
}

/** Convert the current selection inside `root` to a {anchor, head} pair of
 *  character offsets relative to root's plain text. */
function selectionToOffsets(root: HTMLElement): { anchor: number; head: number } | null {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;
  const range = sel.getRangeAt(0);
  if (!root.contains(range.startContainer) || !root.contains(range.endContainer)) return null;

  const computeOffset = (container: Node, offset: number) => {
    const r = document.createRange();
    r.setStart(root, 0);
    r.setEnd(container, offset);
    return r.toString().length;
  };
  const start = computeOffset(range.startContainer, range.startOffset);
  const end = computeOffset(range.endContainer, range.endOffset);
  const backwards =
    sel.anchorNode === range.endContainer && sel.anchorOffset === range.endOffset;
  return backwards ? { anchor: end, head: start } : { anchor: start, head: end };
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

  // Per-user writing style (font, size, line-height, paragraph mode, typewriter).
  // NOT synced with other writers — every user gets to choose their own display
  // preferences. Same component as Folio sprints.
  const [writingStyle, setWritingStyle] = useState<WritingStyle>(() => loadStyle());
  useEffect(() => {
    try { localStorage.setItem(STYLE_LS_KEY, JSON.stringify(writingStyle)); } catch { /* ignore quota errors */ }
  }, [writingStyle]);
  const [activeFormats, setActiveFormats] = useState<{ bold: boolean; italic: boolean; underline: boolean }>({
    bold: false, italic: false, underline: false,
  });

  // Yjs state — one Y.Doc per active document. When user switches docs we
  // tear down the previous provider and stand up a fresh one.
  const ydocRef = useRef<Y.Doc | null>(null);
  const providerRef = useRef<WebsocketProvider | null>(null);
  const [connState, setConnState] = useState<"connecting" | "online" | "offline">("connecting");
  const [remoteStates, setRemoteStates] = useState<Map<number, AwarenessState>>(new Map());

  const editorRef = useRef<HTMLDivElement | null>(null);
  const titleRef = useRef<HTMLInputElement | null>(null);

  // Live word count of the active chapter (computed from the editor's plain
  // text on every input). Stored in React state so the header updates as the
  // user types.
  const [wordCount, setWordCount] = useState(0);
  const countWords = useCallback((text: string): number => {
    const trimmed = text.trim();
    return trimmed.length === 0 ? 0 : trimmed.split(/\s+/).length;
  }, []);

  // ── Bulletproof HTTP fallback save ─────────────────────────────────────
  // The WebSocket sync path is the primary save mechanism, but if it fails
  // for any reason (proxy issues, deploy hiccups, lost connection, …) the
  // user's words MUST not disappear. We push the current editor HTML to a
  // server endpoint on a debounce + on every "I'm about to lose this" hook:
  // beforeunload (sendBeacon, survives page close), visibilitychange→hidden
  // (tab switch / mobile background), and just before switching docs.
  const snapshotTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSnapshotHtmlRef = useRef<string>("");
  const pushSnapshot = useCallback(async (html: string, options?: { beacon?: boolean }): Promise<void> => {
    if (!activeDocId || !userId) return;
    if (html === lastSnapshotHtmlRef.current) return;
    lastSnapshotHtmlRef.current = html;
    const url = `${basePath}/api/co-writing/rooms/${roomIdNum}/docs/${activeDocId}/snapshot`;
    const body = JSON.stringify({ html, userId });
    if (options?.beacon && navigator.sendBeacon) {
      // sendBeacon can't carry the Clerk Authorization header — that's why
      // the route also accepts userId in the body as a fallback identity.
      const blob = new Blob([body], { type: "application/json" });
      navigator.sendBeacon(url, blob);
      return;
    }
    try {
      await authedFetch(url, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body,
      });
    } catch { /* network error — next debounce retries */ }
  }, [activeDocId, userId, roomIdNum, authedFetch]);

  // Re-arm the debounced snapshot save whenever the editor content changes.
  const scheduleSnapshot = useCallback(() => {
    if (snapshotTimerRef.current) clearTimeout(snapshotTimerRef.current);
    snapshotTimerRef.current = setTimeout(() => {
      const editor = editorRef.current;
      if (!editor) return;
      void pushSnapshot(editor.innerHTML);
    }, 1500);
  }, [pushSnapshot]);

  // Save on tab close / refresh — sendBeacon is THE reliable transport for
  // this; fetch with keepalive is best-effort and fetch alone gets cancelled.
  useEffect(() => {
    function flush() {
      const editor = editorRef.current;
      if (!editor) return;
      // Force-bypass the "html unchanged" early-out by clearing the cache so
      // the beacon definitely fires with the latest content.
      lastSnapshotHtmlRef.current = "";
      void pushSnapshot(editor.innerHTML, { beacon: true });
    }
    const onBeforeUnload = () => flush();
    const onVisibility = () => { if (document.visibilityState === "hidden") flush(); };
    window.addEventListener("beforeunload", onBeforeUnload);
    window.addEventListener("pagehide", onBeforeUnload);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      window.removeEventListener("pagehide", onBeforeUnload);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [pushSnapshot]);

  // Notes and Cards are TWO SEPARATE features (per user feedback):
  //   - Cards: the user's Novel Notes cards database (shared with Folio +
  //     /novel-notes.html — same data, same editor).
  //   - Notes: a private per-doc scratchpad (summary, key moments, to-dos,
  //     meta) scoped to (room, doc, user). Not shared with the room.
  // Only one of the two panels is visible at a time on the right side.
  const [sidePanel, setSidePanel] = useState<"none" | "cards" | "notes">("none");

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
        if (data.docs.length > 0) setActiveDocId(data.docs[0].id);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Failed to load room"))
      .finally(() => setLoading(false));
  }, [isLoaded, isSignedIn, roomIdNum, authedFetch, setLocation]);

  // ── Yjs provider lifecycle — re-create whenever the active doc changes ──
  useEffect(() => {
    if (!activeDocId || !userId || !details) return;

    // Before discarding the previous Y.Doc, flush an HTTP snapshot of the
    // editor's current content so nothing is lost when switching chapters.
    const prevEditor = editorRef.current;
    if (prevEditor && lastSnapshotHtmlRef.current !== prevEditor.innerHTML) {
      void pushSnapshot(prevEditor.innerHTML);
    }
    // Reset the snapshot dedupe cache so the next doc's saves fire fresh.
    lastSnapshotHtmlRef.current = "";

    providerRef.current?.destroy();
    ydocRef.current?.destroy();

    const ydoc = new Y.Doc();
    ydocRef.current = ydoc;

    const provider = new WebsocketProvider(buildWsUrl(), `${roomIdNum}-${activeDocId}`, ydoc, {
      params: { room: String(roomIdNum), doc: String(activeDocId), user: userId },
      connect: true,
    });
    providerRef.current = provider;

    // ── HTTP-only load fallback ────────────────────────────────────────────
    // If the WebSocket sync handshake can't complete (proxy not forwarding
    // upgrades, server not redeployed with the path-prefix fix, mobile
    // network blip on cold start, …) the user used to see an empty editor
    // forever. Now we ALSO fetch the latest snapshot via plain HTTP and
    // seed the Y.Text with it whenever the doc is still empty by the time
    // the response arrives. If WS happens to win the race and populates
    // ytext first, we leave it alone.
    let cancelled = false;
    authedFetch(`${basePath}/api/co-writing/rooms/${roomIdNum}/docs/${activeDocId}/snapshot`)
      .then(async (r) => {
        if (cancelled || !r.ok) return;
        const data = await r.json() as { html?: string };
        const html = (data.html ?? "").trim();
        if (!html) return;
        const ytext = ydoc.getText("body");
        // Only seed when the Y.Doc is still empty. If WS already synced
        // content, that content is authoritative — don't double-insert.
        if (ytext.toString().length === 0) {
          ydoc.transact(() => { ytext.insert(0, html); }, "http-snapshot-load");
          // Remember what we loaded so the auto-save's "html unchanged"
          // guard doesn't immediately push the same content back.
          lastSnapshotHtmlRef.current = html;
        }
      })
      .catch(() => { /* network error — WS path or next retry handles it */ });

    const myMember = details.members.find((m) => m.userId === userId);
    const myDisplay = myMember?.displayName ?? (user?.firstName ?? user?.username ?? "Writer");
    const myColor = myMember?.color ?? "#3b6ea5";
    provider.awareness.setLocalStateField("user", {
      userId, name: myDisplay, color: myColor,
    } satisfies AwarenessUser);

    const handleAwarenessChange = () => {
      const map = new Map<number, AwarenessState>();
      provider.awareness.getStates().forEach((state, clientID) => {
        if (clientID === provider.awareness.clientID) return;
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
      cancelled = true;
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

  // ── Bind Y.Text<HTML> to the contentEditable div ───────────────────────
  // Y.Text holds the editor's HTML as a single string. Local input → diff
  // against ytext and apply minimal delete/insert. Remote change → restore
  // innerHTML and try to preserve the caret by tracking the text-offset.
  useEffect(() => {
    const ydoc = ydocRef.current;
    const editor = editorRef.current;
    if (!ydoc || !editor) return;
    const ytext = ydoc.getText("body");

    let applyingRemote = false;

    const setEditorHtml = (html: string) => {
      // Preserve the caret position (as a plaintext offset) across the
      // wholesale innerHTML replacement.
      const focused = document.activeElement === editor;
      let savedOffset: number | null = null;
      if (focused) {
        const off = selectionToOffsets(editor);
        if (off) savedOffset = off.head;
      }
      applyingRemote = true;
      editor.innerHTML = html;
      applyingRemote = false;
      if (focused && savedOffset !== null) {
        const target = locateOffset(editor, savedOffset);
        if (target) {
          const sel = window.getSelection();
          const range = document.createRange();
          range.setStart(target.node, target.offset);
          range.collapse(true);
          sel?.removeAllRanges();
          sel?.addRange(range);
        }
      }
    };

    // Initial paint — render whatever the server already had (could be the
    // empty string for a brand-new doc).
    setEditorHtml(ytext.toString());

    const observer = () => {
      const incoming = ytext.toString();
      if (incoming === editor.innerHTML) return;
      setEditorHtml(incoming);
    };
    ytext.observe(observer);

    const onInput = () => {
      if (applyingRemote) return;
      const next = editor.innerHTML;
      const prev = ytext.toString();
      if (next === prev) {
        // Update the word count even when the HTML didn't change (e.g. on
        // initial paint or after the remote-update path), so the counter
        // stays accurate.
        setWordCount(countWords(editor.innerText ?? ""));
        return;
      }
      // Find common prefix + suffix to produce the smallest delete/insert.
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
      // Live counters + HTTP fallback save.
      setWordCount(countWords(editor.innerText ?? ""));
      scheduleSnapshot();
    };
    editor.addEventListener("input", onInput);
    // Initial word count once the editor first paints.
    setWordCount(countWords(editor.innerText ?? ""));

    // Cursor sync — broadcast our caret position in plaintext-offset terms.
    const onSel = () => {
      const provider = providerRef.current;
      if (!provider) return;
      const off = selectionToOffsets(editor);
      if (!off) return;
      provider.awareness.setLocalStateField("cursor", off);
    };
    document.addEventListener("selectionchange", onSel);

    // B / I / U pressed-state — recompute whenever the caret moves.
    const updateFormats = () => {
      try {
        setActiveFormats({
          bold: document.queryCommandState("bold"),
          italic: document.queryCommandState("italic"),
          underline: document.queryCommandState("underline"),
        });
      } catch { /* ignore in unsupported browsers */ }
    };
    document.addEventListener("selectionchange", updateFormats);

    return () => {
      ytext.unobserve(observer);
      editor.removeEventListener("input", onInput);
      document.removeEventListener("selectionchange", onSel);
      document.removeEventListener("selectionchange", updateFormats);
    };
  }, [activeDocId]);

  // ── Members panel data: merge persisted members with live awareness ─────
  const onlineUserIds = useMemo(() => {
    const set = new Set<string>();
    remoteStates.forEach((s) => { if (s.user?.userId) set.add(s.user.userId); });
    if (userId) set.add(userId);
    return set;
  }, [remoteStates, userId]);

  // ── Cursor overlay positioning (contentEditable variant) ───────────────
  // Walk the editor's actual DOM to find the caret position, then position
  // a thin colored caret div + an optional selection highlight.
  const [cursorRects, setCursorRects] = useState<Array<{
    clientID: number; name: string; color: string;
    caret: { left: number; top: number; height: number } | null;
    selection: { left: number; top: number; width: number; height: number } | null;
  }>>([]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    function recompute() {
      if (!editor) return;
      const rects: typeof cursorRects = [];
      const editorRect = editor.getBoundingClientRect();
      remoteStates.forEach((state, clientID) => {
        const cursor = state.cursor;
        const user = state.user;
        if (!cursor || !user) return;
        const caretPos = locateOffset(editor, cursor.head);
        if (!caretPos) return;
        const caretRange = document.createRange();
        try {
          caretRange.setStart(caretPos.node, caretPos.offset);
          caretRange.collapse(true);
        } catch { return; }
        const cRect = caretRange.getBoundingClientRect();
        const caret = {
          left: cRect.left - editorRect.left + editor.scrollLeft,
          top:  cRect.top  - editorRect.top  + editor.scrollTop,
          height: cRect.height || 20,
        };

        let selection: { left: number; top: number; width: number; height: number } | null = null;
        if (cursor.anchor !== cursor.head) {
          const anchorPos = locateOffset(editor, cursor.anchor);
          if (anchorPos) {
            const start = cursor.head < cursor.anchor ? caretPos : anchorPos;
            const end = cursor.head < cursor.anchor ? anchorPos : caretPos;
            const selRange = document.createRange();
            try {
              selRange.setStart(start.node, start.offset);
              selRange.setEnd(end.node, end.offset);
            } catch { return; }
            const selRect = selRange.getBoundingClientRect();
            if (Math.abs(selRect.top - cRect.top) < 4) {
              selection = {
                left: selRect.left - editorRect.left + editor.scrollLeft,
                top:  selRect.top  - editorRect.top  + editor.scrollTop,
                width: selRect.width,
                height: selRect.height || 20,
              };
            }
          }
        }
        rects.push({ clientID, name: user.name, color: user.color, caret, selection });
      });
      setCursorRects(rects);
    }
    recompute();
    const ro = new ResizeObserver(recompute);
    ro.observe(editor);
    editor.addEventListener("scroll", recompute);
    return () => {
      ro.disconnect();
      editor.removeEventListener("scroll", recompute);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remoteStates, activeDocId, writingStyle.fontSize, writingStyle.lineHeight]);

  // ── Doc title sync (server-side, last writer wins) ─────────────────────
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

  // ── WritingToolbar handlers ────────────────────────────────────────────
  const handleStyleChange = useCallback((partial: Partial<WritingStyle>) => {
    setWritingStyle((prev) => ({ ...prev, ...partial }));
  }, []);
  const handleFormat = useCallback((type: FormatType) => {
    // execCommand is deprecated but still works in all browsers and is the
    // simplest way to toggle B/I/U on a contentEditable selection. Yjs will
    // pick up the resulting innerHTML change via the `input` listener.
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();
    document.execCommand(type, false);
    try {
      setActiveFormats({
        bold: document.queryCommandState("bold"),
        italic: document.queryCommandState("italic"),
        underline: document.queryCommandState("underline"),
      });
    } catch { /* ignore */ }
    // execCommand mutates the DOM directly — fire an input event manually so
    // our onInput listener picks it up and syncs to Y.Text.
    editor.dispatchEvent(new Event("input", { bubbles: true }));
  }, []);

  // ── Typewriter mode — scroll the caret into the visual centre. ─────────
  useEffect(() => {
    if (!writingStyle.typewriterMode) return;
    const editor = editorRef.current;
    if (!editor) return;
    const scroller = editor.closest(".cw-editor-scroll") as HTMLElement | null;
    if (!scroller) return;
    const handler = () => {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;
      const r = sel.getRangeAt(0).cloneRange();
      r.collapse(true);
      const rect = r.getBoundingClientRect();
      if (rect.height === 0 && rect.top === 0) return;
      const scrollerRect = scroller.getBoundingClientRect();
      const desired = scrollerRect.top + scrollerRect.height / 2;
      const delta = rect.top - desired;
      if (Math.abs(delta) > 4) scroller.scrollTop += delta;
    };
    editor.addEventListener("keyup", handler);
    editor.addEventListener("click", handler);
    return () => {
      editor.removeEventListener("keyup", handler);
      editor.removeEventListener("click", handler);
    };
  }, [writingStyle.typewriterMode, activeDocId]);

  // ── Render ─────────────────────────────────────────────────────────────
  if (loading) return <div className="cw-room-root"><div className="cw-empty">Loading room…</div></div>;
  if (error)   return <div className="cw-room-root"><div className="cw-empty cw-error">{error} <button className="cw-btn cw-btn-ghost" style={{ marginLeft: 12 }} onClick={() => setLocation("/co-writing")}>Back</button></div></div>;
  if (!details) return null;

  const activeDoc = details.docs.find((d) => d.id === activeDocId) ?? null;

  const editorTextStyle: React.CSSProperties = {
    fontFamily: writingStyle.fontFamily,
    fontSize: writingStyle.fontSize,
    lineHeight: writingStyle.lineHeight,
  };

  // Class hooks so paragraph mode styles can target the editor's first-level
  // <p>/<div> children (set on input or via the contentEditable's natural
  // line-break behaviour).
  const pMode = writingStyle.paragraphMode;

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
        {/* Live word count of the active chapter. */}
        {activeDocId && (
          <span className="cw-wordcount" title="Words in this chapter">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="4" y1="6" x2="20" y2="6"/>
              <line x1="4" y1="12" x2="20" y2="12"/>
              <line x1="4" y1="18" x2="14" y2="18"/>
            </svg>
            <strong>{wordCount.toLocaleString()}</strong>
            <span className="cw-wordcount-unit">{wordCount === 1 ? "word" : "words"}</span>
          </span>
        )}
        {/* Two separate toggles — Notes and Cards are distinct features. */}
        <button
          className={`cw-notes-toggle${sidePanel === "notes" ? " active" : ""}`}
          onClick={() => setSidePanel((v) => (v === "notes" ? "none" : "notes"))}
          title="Your private notes for this chapter"
          disabled={!activeDocId}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="9" y1="13" x2="15" y2="13"/>
            <line x1="9" y1="17" x2="13" y2="17"/>
          </svg>
          <span>Notes</span>
        </button>
        <button
          className={`cw-notes-toggle${sidePanel === "cards" ? " active" : ""}`}
          onClick={() => setSidePanel((v) => (v === "cards" ? "none" : "cards"))}
          title="Your novel notes cards — characters, factions, locations, etc."
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="3" width="20" height="14" rx="2" />
            <line x1="8" y1="21" x2="16" y2="21" />
            <line x1="12" y1="17" x2="12" y2="21" />
          </svg>
          <span>Cards</span>
        </button>
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
            <>
              {/* Folio-style writing pill + font bar */}
              <div className="cw-toolbar-wrap">
                <WritingToolbar
                  style={writingStyle}
                  onChange={handleStyleChange}
                  onFormat={handleFormat}
                  activeFormats={activeFormats}
                />
              </div>
              <div className="cw-editor-scroll">
                <div className="cw-paper">
                  <input
                    ref={titleRef}
                    className="cw-doc-title-input"
                    value={activeDoc.name}
                    placeholder="Chapter title…"
                    onChange={(e) => handleTitleChange(e.target.value)}
                  />
                  <div style={{ position: "relative" }}>
                    <div
                      ref={editorRef}
                      className={`cw-editor-body cw-editor-body--pmode-${pMode}${writingStyle.typewriterMode ? " cw-editor-body--typewriter" : ""}`}
                      contentEditable
                      suppressContentEditableWarning
                      spellCheck
                      data-placeholder="Start writing together…"
                      style={editorTextStyle}
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
                                height: c.selection.height,
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
                                height: c.caret.height,
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
            </>
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

        {/* Cards panel — Folio-identical "Novel Notes Cards" surface.
            Reads/writes the user's nnData from /api/novel-notes, so every
            card created here also appears on the Novel Notes canvas and
            in Folio. Other writers in the room cannot see these cards. */}
        {sidePanel === "cards" && (
          <CoWritingCardsPanel
            onClose={() => setSidePanel("none")}
            authedFetch={authedFetch}
          />
        )}

        {/* Notes panel — per-user, per-doc private scratchpad. Distinct
            feature from Cards; stored in localStorage so each writer's
            chapter notes are theirs alone. */}
        {sidePanel === "notes" && activeDoc && userId && (
          <CoWritingNotesPanel
            roomId={roomIdNum}
            docId={activeDoc.id}
            docName={activeDoc.name || "Untitled"}
            userId={userId}
            onClose={() => setSidePanel("none")}
          />
        )}
      </div>
    </div>
  );
}
