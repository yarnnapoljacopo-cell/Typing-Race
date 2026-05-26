import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@clerk/react";
import { useAuthedFetch } from "@/lib/authedFetch";
import "./CoWriting.css";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

interface RoomSummary {
  id: number;
  name: string;
  inviteCode: string;
  ownerUserId: string;
  isOwner: boolean;
  memberCount: number;
  createdAt: string;
  updatedAt: string;
}

export default function CoWriting() {
  const [, setLocation] = useLocation();
  const { isLoaded, isSignedIn } = useAuth();
  const authedFetch = useAuthedFetch();
  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal state — we keep two separate dialogs (create / join) because the
  // flows are short and switching between them mid-action is confusing.
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createBusy, setCreateBusy] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [joinOpen, setJoinOpen] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [joinBusy, setJoinBusy] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joinPreview, setJoinPreview] = useState<{ id: number; name: string; memberCount: number; alreadyMember: boolean } | null>(null);

  const fetchRooms = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await authedFetch(`${basePath}/api/co-writing/rooms`);
      if (!res.ok) throw new Error("Failed to load rooms");
      const data = await res.json() as { rooms: RoomSummary[] };
      setRooms(data.rooms);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load rooms");
    } finally {
      setLoading(false);
    }
  }, [authedFetch]);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) { setLocation("/portal"); return; }
    fetchRooms();
  }, [isLoaded, isSignedIn, fetchRooms, setLocation]);

  const createRoom = async () => {
    const name = createName.trim();
    if (!name) return;
    setCreateBusy(true);
    setCreateError(null);
    try {
      const res = await authedFetch(`${basePath}/api/co-writing/rooms`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      // Read the response body whether or not it's JSON so we can surface
      // useful error messages (e.g. "Cannot POST /api/co-writing/rooms" when
      // the server hasn't been restarted yet).
      const text = await res.text();
      let data: { ok?: boolean; room?: { id: number }; error?: string } | null = null;
      try { data = JSON.parse(text); } catch { /* non-JSON body */ }

      if (!res.ok) {
        throw new Error(
          data?.error
            ?? (res.status === 404
              ? "The /api/co-writing endpoint isn't available — restart the api-server so it picks up the new routes + tables."
              : `Create failed (HTTP ${res.status})`)
            + (text && !data?.error && text.length < 200 ? ` — ${text}` : ""),
        );
      }
      if (!data?.ok || !data.room) throw new Error("Server returned an unexpected response.");

      setCreateOpen(false); setCreateName(""); setCreateError(null);
      setLocation(`/co-writing/${data.room.id}`);
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : "Failed to create room");
    } finally {
      setCreateBusy(false);
    }
  };

  // Debounced lookup as the user types an invite code — gives them a preview
  // (room name, member count, whether they're already in) before committing.
  useEffect(() => {
    const code = joinCode.trim().toUpperCase();
    if (!joinOpen || code.length < 4) { setJoinPreview(null); return; }
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const res = await authedFetch(`${basePath}/api/co-writing/rooms/by-code/${encodeURIComponent(code)}`);
        if (cancelled) return;
        if (!res.ok) { setJoinPreview(null); return; }
        const data = await res.json() as { room: { id: number; name: string; memberCount: number; alreadyMember: boolean } };
        setJoinPreview(data.room);
      } catch { /* ignore */ }
    }, 300);
    return () => { cancelled = true; clearTimeout(t); };
  }, [joinCode, joinOpen, authedFetch]);

  const joinRoom = async () => {
    const code = joinCode.trim().toUpperCase();
    if (!code) return;
    setJoinBusy(true);
    setJoinError(null);
    try {
      const res = await authedFetch(`${basePath}/api/co-writing/rooms/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const text = await res.text();
      let data: { ok?: boolean; room?: { id: number }; error?: string } | null = null;
      try { data = JSON.parse(text); } catch { /* non-JSON body */ }
      if (!res.ok) {
        throw new Error(
          data?.error
            ?? (res.status === 404 ? "No room found with that invite code." : `Join failed (HTTP ${res.status})`),
        );
      }
      if (!data?.ok || !data.room) throw new Error("Server returned an unexpected response.");
      setJoinOpen(false); setJoinCode(""); setJoinPreview(null); setJoinError(null);
      setLocation(`/co-writing/${data.room.id}`);
    } catch (e) {
      setJoinError(e instanceof Error ? e.message : "Failed to join");
    } finally {
      setJoinBusy(false);
    }
  };

  return (
    <div className="cw-list-root">
      <div className="cw-list-topbar">
        <button className="cw-back-btn" onClick={() => setLocation("/my-files")} title="Back to Folio">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <div className="cw-list-title">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
          Co-writing
        </div>
        <div className="cw-list-actions">
          <button className="cw-btn cw-btn-ghost" onClick={() => setJoinOpen(true)}>Join with code</button>
          <button className="cw-btn cw-btn-primary" onClick={() => setCreateOpen(true)}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            New room
          </button>
        </div>
      </div>

      <div className="cw-list-body">
        {loading && <div className="cw-empty">Loading rooms…</div>}
        {error && !loading && <div className="cw-empty cw-error">{error}</div>}
        {!loading && !error && rooms.length === 0 && (
          <div className="cw-empty cw-empty--hero">
            <div className="cw-empty-art">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
            </div>
            <h2>Write together, live.</h2>
            <p>Create a room and invite collaborators with a code, or join one someone shared with you. Everyone sees each other's cursors in real time.</p>
            <div className="cw-empty-cta">
              <button className="cw-btn cw-btn-primary" onClick={() => setCreateOpen(true)}>Create your first room</button>
              <button className="cw-btn cw-btn-ghost" onClick={() => setJoinOpen(true)}>I have an invite code</button>
            </div>
          </div>
        )}
        {!loading && rooms.length > 0 && (
          <div className="cw-room-grid">
            {rooms.map((r) => (
              <button key={r.id} className="cw-room-card" onClick={() => setLocation(`/co-writing/${r.id}`)}>
                <div className="cw-room-card-top">
                  <span className="cw-room-card-name">{r.name}</span>
                  {r.isOwner && <span className="cw-room-card-badge">Owner</span>}
                </div>
                <div className="cw-room-card-meta">
                  <span>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
                    {r.memberCount} {r.memberCount === 1 ? "member" : "members"}
                  </span>
                  <span>Code: <code>{r.inviteCode}</code></span>
                </div>
                <div className="cw-room-card-foot">Updated {timeAgo(r.updatedAt)}</div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Create room modal */}
      {createOpen && (
        <div className="cw-modal-overlay" onClick={() => { setCreateOpen(false); setCreateError(null); }}>
          <div className="cw-modal" onClick={(e) => e.stopPropagation()}>
            <div className="cw-modal-title">New co-writing room</div>
            <input
              className="cw-input"
              type="text"
              placeholder="Room name (e.g. The Midnight Draft)"
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !createBusy) createRoom(); if (e.key === "Escape") { setCreateOpen(false); setCreateError(null); } }}
              maxLength={120}
              autoFocus
            />
            {createError && <div className="cw-error-banner">{createError}</div>}
            <div className="cw-modal-actions">
              <button className="cw-btn cw-btn-ghost" onClick={() => { setCreateOpen(false); setCreateError(null); }} disabled={createBusy}>Cancel</button>
              <button className="cw-btn cw-btn-primary" onClick={createRoom} disabled={createBusy || !createName.trim()}>
                {createBusy ? "Creating…" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Join room modal */}
      {joinOpen && (
        <div className="cw-modal-overlay" onClick={() => { setJoinOpen(false); setJoinError(null); }}>
          <div className="cw-modal" onClick={(e) => e.stopPropagation()}>
            <div className="cw-modal-title">Join with an invite code</div>
            <input
              className="cw-input cw-input-code"
              type="text"
              placeholder="ABC123"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12))}
              onKeyDown={(e) => { if (e.key === "Enter" && !joinBusy) joinRoom(); if (e.key === "Escape") { setJoinOpen(false); setJoinError(null); } }}
              autoFocus
            />
            {joinPreview && (
              <div className="cw-join-preview">
                <strong>{joinPreview.name}</strong>
                <span>{joinPreview.memberCount} {joinPreview.memberCount === 1 ? "member" : "members"}</span>
                {joinPreview.alreadyMember && <span className="cw-join-preview-tag">Already a member</span>}
              </div>
            )}
            {joinError && <div className="cw-error-banner">{joinError}</div>}
            <div className="cw-modal-actions">
              <button className="cw-btn cw-btn-ghost" onClick={() => { setJoinOpen(false); setJoinError(null); }} disabled={joinBusy}>Cancel</button>
              <button className="cw-btn cw-btn-primary" onClick={joinRoom} disabled={joinBusy || !joinCode.trim()}>
                {joinBusy ? "Joining…" : joinPreview?.alreadyMember ? "Open room" : "Join"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const s = Math.floor(ms / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hr ago`;
  const d = Math.floor(h / 24);
  return `${d} day${d === 1 ? "" : "s"} ago`;
}
