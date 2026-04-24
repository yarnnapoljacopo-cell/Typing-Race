import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, UserPlus, UserCheck, UserX, Search, ExternalLink, Loader2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { getRankFromXp } from "@/lib/ranks";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

const borderColorMap: Record<number, string> = {
  0: "#71717a", 1: "#94a3b8", 2: "#f97316",
  3: "#8b5cf6", 4: "#dc2626", 5: "#facc15", 6: "#22d3ee", 7: "#e879f9",
};

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

async function fetchFriends(): Promise<FriendsData> {
  const res = await fetch(`${basePath}/api/friends`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to load friends");
  return res.json();
}

async function searchUsers(q: string): Promise<SearchResult[]> {
  const res = await fetch(`${basePath}/api/users/search?q=${encodeURIComponent(q)}`, { credentials: "include" });
  if (!res.ok) throw new Error("Search failed");
  return res.json();
}

function RankPip({ xp }: { xp: number }) {
  const rank = getRankFromXp(xp);
  const color = borderColorMap[rank.index];
  return (
    <span
      className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full"
      style={{ background: `${color}18`, color, border: `1px solid ${color}40` }}
    >
      {rank.emoji} {rank.title}
    </span>
  );
}

export default function Friends() {
  const [, setLocation] = useLocation();
  const qc = useQueryClient();

  const [searchQ, setSearchQ] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const { data, isLoading } = useQuery<FriendsData>({
    queryKey: ["friends"],
    queryFn: fetchFriends,
  });

  const handleSearch = async () => {
    const q = searchQ.trim();
    if (!q) return;
    setSearching(true);
    setSearchError(null);
    setSearchResults(null);
    try {
      const results = await searchUsers(q);
      setSearchResults(results);
    } catch {
      setSearchError("Search failed. Try again.");
    } finally {
      setSearching(false);
    }
  };

  const requestMutation = useMutation({
    mutationFn: async (writerName: string) => {
      const res = await fetch(`${basePath}/api/friends/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ writerName }),
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
      const res = await fetch(`${basePath}/api/friends/${id}/accept`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to accept");
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["friends"] }),
  });

  const removeMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`${basePath}/api/friends/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
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
    <div className="min-h-screen bg-background flex flex-col items-center py-12 px-4">
      <div className="w-full max-w-lg space-y-8">

        <Button variant="ghost" size="sm" onClick={() => setLocation("/portal")} className="gap-2 text-muted-foreground -ml-2">
          <ArrowLeft className="w-4 h-4" /> Back
        </Button>

        <div className="space-y-1">
          <h1 className="text-2xl font-serif font-bold text-foreground flex items-center gap-2">
            <Users className="w-6 h-6 text-primary" /> Friends
          </h1>
          <p className="text-sm text-muted-foreground">Find writers and follow their progress.</p>
        </div>

        {/* Search */}
        <div className="space-y-3">
          <div className="flex gap-2">
            <Input
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="Search by writer name…"
              className="flex-1"
            />
            <Button onClick={handleSearch} disabled={searching || !searchQ.trim()} size="icon" variant="outline">
              {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            </Button>
          </div>

          {searchError && <p className="text-sm text-destructive">{searchError}</p>}

          {searchResults !== null && (
            <Card>
              <CardContent className="p-3 space-y-2">
                {searchResults.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-2">No writers found.</p>
                ) : (
                  searchResults.map((r) => {
                    const alreadyConnected = friendWriterNames.has(r.writerName);
                    return (
                      <div key={r.clerkUserId} className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <button
                            onClick={() => setLocation(`/profile/${encodeURIComponent(r.writerName)}`)}
                            className="font-medium text-sm text-foreground hover:text-primary transition-colors truncate"
                          >
                            {r.writerName}
                          </button>
                          <RankPip xp={r.xp} />
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            onClick={() => setLocation(`/profile/${encodeURIComponent(r.writerName)}`)}
                            className="text-muted-foreground hover:text-primary transition-colors"
                            title="View profile"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </button>
                          {!alreadyConnected && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs gap-1"
                              onClick={() => requestMutation.mutate(r.writerName)}
                              disabled={requestMutation.isPending}
                            >
                              <UserPlus className="w-3.5 h-3.5" /> Add
                            </Button>
                          )}
                          {alreadyConnected && (
                            <span className="text-xs text-muted-foreground">Connected</span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>
          )}
          {requestMutation.isError && (
            <p className="text-sm text-destructive">{(requestMutation.error as Error).message}</p>
          )}
        </div>

        {/* Pending received */}
        {(data?.pendingReceived.length ?? 0) > 0 && (
          <div className="space-y-2">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Friend Requests</h2>
            <div className="space-y-2">
              {data!.pendingReceived.map((f) => (
                <Card key={f.id}>
                  <CardContent className="p-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <button
                        onClick={() => setLocation(`/profile/${encodeURIComponent(f.writerName)}`)}
                        className="font-medium text-sm text-foreground hover:text-primary transition-colors truncate"
                      >
                        {f.writerName}
                      </button>
                      <RankPip xp={f.xp} />
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                      <Button
                        size="sm"
                        className="h-7 text-xs gap-1"
                        onClick={() => acceptMutation.mutate(f.id)}
                        disabled={acceptMutation.isPending}
                      >
                        <UserCheck className="w-3.5 h-3.5" /> Accept
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs gap-1"
                        onClick={() => removeMutation.mutate(f.id)}
                        disabled={removeMutation.isPending}
                      >
                        <UserX className="w-3.5 h-3.5" /> Decline
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Friends list */}
        <div className="space-y-2">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            My Friends {data ? `(${data.friends.length})` : ""}
          </h2>

          {isLoading && (
            <div className="text-center text-muted-foreground py-8 text-sm">Loading…</div>
          )}

          {!isLoading && data?.friends.length === 0 && (
            <div className="text-center text-muted-foreground py-8 text-sm">
              No friends yet. Search for a writer above to get started.
            </div>
          )}

          {data?.friends.map((f) => (
            <Card key={f.id}>
              <CardContent className="p-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <button
                    onClick={() => setLocation(`/profile/${encodeURIComponent(f.writerName)}`)}
                    className="font-medium text-sm text-foreground hover:text-primary transition-colors truncate"
                  >
                    {f.writerName}
                  </button>
                  <RankPip xp={f.xp} />
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => setLocation(`/profile/${encodeURIComponent(f.writerName)}`)}
                    className="text-muted-foreground hover:text-primary transition-colors"
                    title="View profile"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs gap-1 text-muted-foreground hover:text-destructive"
                    onClick={() => removeMutation.mutate(f.id)}
                    disabled={removeMutation.isPending}
                  >
                    <UserX className="w-3.5 h-3.5" /> Remove
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Sent requests */}
        {(data?.pendingSent.length ?? 0) > 0 && (
          <div className="space-y-2">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Sent Requests</h2>
            <div className="space-y-2">
              {data!.pendingSent.map((f) => (
                <Card key={f.id}>
                  <CardContent className="p-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-medium text-sm text-foreground truncate">{f.writerName}</span>
                      <RankPip xp={f.xp} />
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs gap-1 shrink-0"
                      onClick={() => removeMutation.mutate(f.id)}
                      disabled={removeMutation.isPending}
                    >
                      <UserX className="w-3.5 h-3.5" /> Cancel
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
