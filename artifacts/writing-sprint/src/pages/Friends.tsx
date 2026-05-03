import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/react";
import { useAuthedFetch } from "@/lib/authedFetch";
import { ArrowLeft, UserPlus, UserCheck, UserX, Search, ExternalLink, Loader2, Users } from "lucide-react";
import { getRankFromXp } from "@/lib/ranks";
import "./Friends.css";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

interface FriendEntry {
  id: number;
  writerName: string;
  xp: number;
}

interface FriendsData {
  friends: FriendEntry[];
  pendingReceived: FriendEntry[];
  pendingSent: FriendEntry[];
}

interface SearchResult {
  clerkUserId: string;
  writerName: string;
  xp: number;
}

type AF = (url: string, opts?: RequestInit) => Promise<Response>;

async function fetchFriends(af: AF): Promise<FriendsData> {
  const res = await af(`${basePath}/api/friends`);
  if (!res.ok) throw new Error("Failed to load friends");
  return res.json();
}

async function searchUsers(q: string, af: AF): Promise<SearchResult[]> {
  const res = await af(`${basePath}/api/users/search?q=${encodeURIComponent(q)}`);
  if (!res.ok) throw new Error("Search failed");
  return res.json();
}

// Stable color choice from writer name so each user always renders with the
// same gradient avatar across views.
const AV_CLASSES = [
  "fp-av-orange", "fp-av-blue", "fp-av-red", "fp-av-purple",
  "fp-av-green", "fp-av-pink", "fp-av-teal", "fp-av-amber",
];
function avatarClass(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return AV_CLASSES[h % AV_CLASSES.length];
}
function initialsOf(name: string): string {
  const cleaned = name.trim();
  if (!cleaned) return "?";
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return cleaned.slice(0, 2).toUpperCase();
}

function Avatar({ name }: { name: string }) {
  return <div className={`fp-avatar ${avatarClass(name)}`}>{initialsOf(name)}</div>;
}

function TitleBadge({ xp }: { xp: number }) {
  const rank = getRankFromXp(xp);
  return (
    <span className="fp-title-badge">
      <span aria-hidden>{rank.emoji}</span> {rank.title}
    </span>
  );
}

export default function Friends() {
  const [, setLocation] = useLocation();
  const { isLoaded } = useAuth();
  const authedFetch = useAuthedFetch();
  const qc = useQueryClient();

  const [searchQ, setSearchQ] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const { data, isLoading } = useQuery<FriendsData>({
    queryKey: ["friends"],
    queryFn: () => fetchFriends(authedFetch),
    enabled: isLoaded,
  });

  const handleSearch = async () => {
    const q = searchQ.trim();
    if (!q) return;
    setSearching(true);
    setSearchError(null);
    setSearchResults(null);
    try {
      const results = await searchUsers(q, authedFetch);
      setSearchResults(results);
    } catch {
      setSearchError("Search failed. Try again.");
    } finally {
      setSearching(false);
    }
  };

  const requestMutation = useMutation({
    mutationFn: async (target: { addresseeId: string; writerName: string }) => {
      const res = await authedFetch(`${basePath}/api/friends/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Send the unique clerk id so duplicate writer names can't cause the
        // wrong account to receive the request.
        body: JSON.stringify({ addresseeId: target.addresseeId, writerName: target.writerName }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to send request");
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["friends"] });
      setSearchResults(null);
      setSearchQ("");
    },
  });

  const acceptMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await authedFetch(`${basePath}/api/friends/${id}/accept`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to accept");
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["friends"] }),
  });

  const removeMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await authedFetch(`${basePath}/api/friends/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to remove");
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["friends"] }),
  });

  const friendWriterNames = new Set([
    ...(data?.friends.map((f) => f.writerName) ?? []),
    ...(data?.pendingSent.map((f) => f.writerName) ?? []),
    ...(data?.pendingReceived.map((f) => f.writerName) ?? []),
  ]);

  return (
    <div className="fp">
      <button className="fp-back" onClick={() => setLocation("/portal")}>
        <ArrowLeft /> Back
      </button>

      <div className="fp-heading">
        <div className="fp-icon-wrap"><Users size={20} strokeWidth={2} /></div>
        <h1 className="fp-title">Friends</h1>
      </div>
      <p className="fp-sub">Find writers and follow their progress.</p>

      {/* Search */}
      <div className="fp-search-row">
        <input
          className="fp-search-input"
          type="text"
          value={searchQ}
          onChange={(e) => setSearchQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          placeholder="Search by writer name…"
        />
        <button
          className="fp-search-btn"
          onClick={handleSearch}
          disabled={searching || !searchQ.trim()}
          aria-label="Search"
        >
          {searching ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} strokeWidth={2.5} />}
        </button>
      </div>

      {searchError && <p className="fp-search-error">{searchError}</p>}

      {searchResults !== null && (
        <div className="fp-results">
          {searchResults.length === 0 ? (
            <p className="fp-results-empty">No writers found.</p>
          ) : (
            searchResults.map((r) => {
              const alreadyConnected = friendWriterNames.has(r.writerName);
              return (
                <div key={r.clerkUserId} className="fp-result-row">
                  <Avatar name={r.writerName} />
                  <div className="fp-info">
                    <button className="fp-name" onClick={() => setLocation(`/profile/${encodeURIComponent(r.writerName)}`)}>
                      {r.writerName}
                    </button>
                    <TitleBadge xp={r.xp} />
                  </div>
                  <button
                    className="fp-btn"
                    onClick={() => setLocation(`/profile/${encodeURIComponent(r.writerName)}`)}
                    title="View profile"
                    aria-label="View profile"
                  >
                    <ExternalLink />
                  </button>
                  {!alreadyConnected ? (
                    <button
                      className="fp-btn fp-btn-add"
                      onClick={() => requestMutation.mutate({ addresseeId: r.clerkUserId, writerName: r.writerName })}
                      disabled={requestMutation.isPending}
                    >
                      <UserPlus /> Add
                    </button>
                  ) : (
                    <span className="fp-connected">Connected</span>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
      {requestMutation.isError && (
        <p className="fp-search-error">{(requestMutation.error as Error).message}</p>
      )}

      {/* Friend Requests (received) */}
      {(data?.pendingReceived.length ?? 0) > 0 && (
        <>
          <div className="fp-sec-header">
            <span className="fp-sec-label">Friend Requests</span>
            <span className="fp-sec-count">{data!.pendingReceived.length}</span>
            <div className="fp-sec-line" />
          </div>
          <div className="fp-list">
            {data!.pendingReceived.map((f) => (
              <div key={f.id} className="fp-card">
                <Avatar name={f.writerName} />
                <div className="fp-info">
                  <button className="fp-name" onClick={() => setLocation(`/profile/${encodeURIComponent(f.writerName)}`)}>
                    {f.writerName}
                  </button>
                  <TitleBadge xp={f.xp} />
                </div>
                <button
                  className="fp-btn fp-btn-accept"
                  onClick={() => acceptMutation.mutate(f.id)}
                  disabled={acceptMutation.isPending}
                >
                  <UserCheck /> Accept
                </button>
                <button
                  className="fp-btn fp-btn-decline"
                  onClick={() => removeMutation.mutate(f.id)}
                  disabled={removeMutation.isPending}
                >
                  <UserX /> Decline
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      {/* My Friends */}
      <div className="fp-sec-header">
        <span className="fp-sec-label">My Friends</span>
        <span className="fp-sec-count">{data?.friends.length ?? 0}</span>
        <div className="fp-sec-line" />
      </div>

      {isLoading && <div className="fp-loading">Loading…</div>}

      {!isLoading && (data?.friends.length ?? 0) === 0 && (
        <div className="fp-empty">
          <div className="fp-empty-icon"><Users size={22} strokeWidth={1.8} /></div>
          <div className="fp-empty-text">
            No friends yet.<br />Search for a writer above to get started.
          </div>
        </div>
      )}

      {(data?.friends.length ?? 0) > 0 && (
        <div className="fp-list">
          {data!.friends.map((f) => (
            <div key={f.id} className="fp-card">
              <Avatar name={f.writerName} />
              <div className="fp-info">
                <button className="fp-name" onClick={() => setLocation(`/profile/${encodeURIComponent(f.writerName)}`)}>
                  {f.writerName}
                </button>
                <TitleBadge xp={f.xp} />
              </div>
              <button
                className="fp-btn"
                onClick={() => setLocation(`/profile/${encodeURIComponent(f.writerName)}`)}
                title="View profile"
                aria-label="View profile"
              >
                <ExternalLink />
              </button>
              <button
                className="fp-btn fp-btn-cancel"
                onClick={() => removeMutation.mutate(f.id)}
                disabled={removeMutation.isPending}
              >
                <UserX /> Remove
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Sent Requests */}
      {(data?.pendingSent.length ?? 0) > 0 && (
        <>
          <div className="fp-sec-header">
            <span className="fp-sec-label">Sent Requests</span>
            <span className="fp-sec-count">{data!.pendingSent.length}</span>
            <div className="fp-sec-line" />
          </div>
          <div className="fp-list">
            {data!.pendingSent.map((f) => (
              <div key={f.id} className="fp-card">
                <Avatar name={f.writerName} />
                <div className="fp-info">
                  <div className="fp-name" style={{ cursor: "default" }}>{f.writerName}</div>
                  <TitleBadge xp={f.xp} />
                </div>
                <span className="fp-pending-dot" title="Awaiting response" />
                <button
                  className="fp-btn fp-btn-cancel"
                  onClick={() => removeMutation.mutate(f.id)}
                  disabled={removeMutation.isPending}
                >
                  <UserX /> Cancel
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
