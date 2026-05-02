import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/react";
import { useAuthedFetch } from "@/lib/authedFetch";
import { ArrowLeft, Users, Crown, LogOut, Send, Zap, Shield, UserMinus, ArrowRightLeft, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { getRankFromXp } from "@/lib/ranks";
import "./Guild.css";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
type AF = (url: string, opts?: RequestInit) => Promise<Response>;

interface Member {
  userId: string;
  writerName: string;
  role: string;
  xp: number;
  nameplate: string;
  joinedAt: string;
  online: boolean;
}
interface GuildData {
  guild: {
    id: number; name: string; tag: string; description: string;
    leaderId: string; createdAt: string;
  } | null;
  role?: string;
  members?: Member[];
}
interface Message {
  id: number; guildId: number; userId: string; writerName: string;
  content: string; type: string; sentAt: string;
}

async function fetchGuild(af: AF): Promise<GuildData> {
  const res = await af(`${basePath}/api/guilds/me`);
  if (!res.ok) throw new Error("Failed");
  return res.json();
}

async function fetchMessages(af: AF, guildId: number): Promise<Message[]> {
  const res = await af(`${basePath}/api/guilds/${guildId}/messages`);
  if (!res.ok) throw new Error("Failed");
  return res.json();
}

function MemberRow({ m, isLeader, viewerIsLeader, viewerId, onKick, onTransfer }: {
  m: Member; isLeader: boolean; viewerIsLeader: boolean; viewerId: string | null;
  onKick: (id: string) => void; onTransfer: (id: string) => void;
}) {
  const rank = getRankFromXp(m.xp);
  return (
    <div className="g-member">
      <div className="g-member-dot" data-online={m.online ? "1" : "0"} />
      <div className="g-member-name">
        {isLeader && <Crown size={14} className="g-leader-icon" />}
        <span>{m.writerName}</span>
        <span className="g-member-rank">{rank.emoji} {rank.title}</span>
      </div>
      <div className="g-member-actions">
        {viewerIsLeader && m.userId !== viewerId && (
          <>
            <button className="g-icon-btn" title="Transfer leadership" onClick={() => onTransfer(m.userId)}>
              <ArrowRightLeft size={14} />
            </button>
            <button className="g-icon-btn g-icon-btn-danger" title="Kick" onClick={() => onKick(m.userId)}>
              <UserMinus size={14} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function NoGuildView({ af, onCreated }: { af: AF; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [tag, setTag] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await af(`${basePath}/api/guilds`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, tag, description }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to create guild");
      onCreated();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="g-card g-create-card">
      <CardContent className="p-6">
        <div className="g-create-header">
          <Shield size={28} />
          <div>
            <h2 className="g-h2">Form a Guild</h2>
            <p className="g-sub">Rally up to 20 writers under one banner. Run sprints together, chat, and rise on the rankings.</p>
          </div>
        </div>
        <form onSubmit={submit} className="g-form">
          <label className="g-label">
            <span>Guild name</span>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="The Inkbound" maxLength={40} required />
          </label>
          <label className="g-label">
            <span>Tag <em className="g-hint">(2–6 letters)</em></span>
            <Input value={tag} onChange={(e) => setTag(e.target.value.toUpperCase())} placeholder="INK" maxLength={6} required />
          </label>
          <label className="g-label">
            <span>Description <em className="g-hint">(optional)</em></span>
            <textarea
              className="g-textarea"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What does your guild stand for?"
              maxLength={1000}
              rows={3}
            />
          </label>
          {error && <div className="g-error">{error}</div>}
          <Button type="submit" disabled={submitting || !name.trim() || !tag.trim()}>
            {submitting ? "Creating..." : "Create Guild"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function InvitesPanel({ af, onAccept }: { af: AF; onAccept: () => void }) {
  const qc = useQueryClient();
  const { data, refetch } = useQuery({
    queryKey: ["guildInvites"],
    queryFn: async () => {
      const r = await af(`${basePath}/api/guilds/me/invites`);
      if (!r.ok) return [];
      return r.json() as Promise<Array<{ id: number; guildName: string; guildTag: string; invitedByName: string; expiresAt: string }>>;
    },
    refetchInterval: 30_000,
  });

  const act = async (inviteId: number, action: "accept" | "decline") => {
    const r = await af(`${basePath}/api/guilds/invites/${inviteId}/${action}`, { method: "POST" });
    if (r.ok) {
      await refetch();
      qc.invalidateQueries({ queryKey: ["guild"] });
      qc.invalidateQueries({ queryKey: ["guildBell"] });
      if (action === "accept") onAccept();
    }
  };

  if (!data || data.length === 0) return null;
  return (
    <Card className="g-card g-invites-card">
      <CardContent className="p-4">
        <h3 className="g-h3"><Users size={16} /> Pending invites</h3>
        <div className="g-invite-list">
          {data.map((inv) => (
            <div key={inv.id} className="g-invite-row">
              <div>
                <strong>{inv.guildName}</strong> <span className="g-tag-pill">[{inv.guildTag}]</span>
                <div className="g-invite-meta">From {inv.invitedByName}</div>
              </div>
              <div className="g-invite-actions">
                <Button size="sm" onClick={() => act(inv.id, "accept")}>Accept</Button>
                <Button size="sm" variant="outline" onClick={() => act(inv.id, "decline")}>Decline</Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function GuildView({ af, data, refetchGuild }: { af: AF; data: GuildData; refetchGuild: () => void }) {
  const qc = useQueryClient();
  const [, setLocation] = useLocation();
  const { userId } = useAuth();
  const guild = data.guild!;
  const isLeader = data.role === "leader";

  const [chatInput, setChatInput] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [showSprintModal, setShowSprintModal] = useState(false);
  const [sprintDuration, setSprintDuration] = useState(15);
  const [sprintDelay, setSprintDelay] = useState(1);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  const messagesQuery = useQuery({
    queryKey: ["guildMessages", guild.id],
    queryFn: () => fetchMessages(af, guild.id),
    refetchInterval: 5_000,
  });

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messagesQuery.data?.length]);

  const sendChat = async () => {
    const text = chatInput.trim();
    if (!text) return;
    setChatInput("");
    await af(`${basePath}/api/guilds/${guild.id}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: text }),
    });
    messagesQuery.refetch();
  };

  const invite = async () => {
    setInviteError(null);
    const r = await af(`${basePath}/api/guilds/${guild.id}/invite`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ writerName: inviteName.trim() }),
    });
    const body = await r.json().catch(() => ({}));
    if (!r.ok) { setInviteError((body as { error?: string }).error ?? "Failed"); return; }
    setInviteName("");
  };

  const kick = async (targetId: string) => {
    setActionError(null);
    if (!confirm("Remove this member from the guild?")) return;
    const r = await af(`${basePath}/api/guilds/${guild.id}/kick`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetId }),
    });
    if (!r.ok) {
      const b = await r.json().catch(() => ({}));
      setActionError((b as { error?: string }).error ?? "Failed");
    } else {
      refetchGuild(); messagesQuery.refetch();
    }
  };

  const transfer = async (newLeaderId: string) => {
    setActionError(null);
    if (!confirm("Transfer leadership to this member?")) return;
    const r = await af(`${basePath}/api/guilds/${guild.id}/transfer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newLeaderId }),
    });
    if (!r.ok) {
      const b = await r.json().catch(() => ({}));
      setActionError((b as { error?: string }).error ?? "Failed");
    } else {
      refetchGuild(); messagesQuery.refetch();
    }
  };

  const leave = async () => {
    if (!confirm("Leave the guild?")) return;
    const r = await af(`${basePath}/api/guilds/${guild.id}/leave`, { method: "POST" });
    if (!r.ok) {
      const b = await r.json().catch(() => ({}));
      setActionError((b as { error?: string }).error ?? "Failed");
    } else {
      qc.invalidateQueries({ queryKey: ["guild"] });
      refetchGuild();
    }
  };

  const disband = async () => {
    if (!confirm("Disband the guild? This cannot be undone.")) return;
    const r = await af(`${basePath}/api/guilds/${guild.id}`, { method: "DELETE" });
    if (!r.ok) {
      const b = await r.json().catch(() => ({}));
      setActionError((b as { error?: string }).error ?? "Failed");
    } else {
      qc.invalidateQueries({ queryKey: ["guild"] });
      refetchGuild();
    }
  };

  const startSprint = async () => {
    const r = await af(`${basePath}/api/guilds/${guild.id}/sprint`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        durationMinutes: sprintDuration,
        countdownDelayMinutes: sprintDelay,
        mode: "regular",
      }),
    });
    const body = await r.json().catch(() => ({}));
    if (!r.ok) { alert((body as { error?: string }).error ?? "Failed to start sprint"); return; }
    const code = (body as { roomCode?: string }).roomCode;
    setShowSprintModal(false);
    messagesQuery.refetch();
    if (code) setLocation(`/room?code=${code}&name=${encodeURIComponent("")}`);
  };

  const members = data.members ?? [];
  const onlineCount = members.filter((m) => m.online).length;

  return (
    <div className="g-grid">
      {/* Sidebar: members */}
      <Card className="g-card g-members-card">
        <CardContent className="p-4">
          <div className="g-members-head">
            <h3 className="g-h3"><Users size={16} /> Members</h3>
            <span className="g-online-pill">{onlineCount} / {members.length} online</span>
          </div>
          <div className="g-member-list">
            {members
              .slice()
              .sort((a, b) => (a.role === "leader" ? -1 : b.role === "leader" ? 1 : b.xp - a.xp))
              .map((m) => (
                <MemberRow
                  key={m.userId}
                  m={m}
                  isLeader={m.role === "leader"}
                  viewerIsLeader={isLeader}
                  viewerId={userId ?? null}
                  onKick={kick}
                  onTransfer={transfer}
                />
              ))}
          </div>

          {isLeader && (
            <div className="g-invite-form">
              <label className="g-label-sm">Invite a writer</label>
              <div className="g-invite-row-form">
                <Input
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  placeholder="Writer name"
                />
                <Button size="sm" onClick={invite} disabled={!inviteName.trim()}>Invite</Button>
              </div>
              {inviteError && <div className="g-error-sm">{inviteError}</div>}
            </div>
          )}

          <div className="g-bottom-actions">
            {!isLeader && (
              <Button size="sm" variant="outline" onClick={leave}>
                <LogOut size={14} /> Leave guild
              </Button>
            )}
            {isLeader && (
              <Button size="sm" variant="destructive" onClick={disband}>
                <Trash2 size={14} /> Disband
              </Button>
            )}
          </div>
          {actionError && <div className="g-error-sm">{actionError}</div>}
        </CardContent>
      </Card>

      {/* Main: header + sprint button + chat */}
      <div className="g-main">
        <Card className="g-card">
          <CardContent className="p-5">
            <div className="g-header">
              <div>
                <div className="g-title-row">
                  <h1 className="g-h1">{guild.name}</h1>
                  <span className="g-tag-big">[{guild.tag}]</span>
                </div>
                {guild.description && <p className="g-desc">{guild.description}</p>}
              </div>
              {isLeader && (
                <Button onClick={() => setShowSprintModal(true)}>
                  <Zap size={16} /> Start Guild Sprint
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="g-card g-chat-card">
          <CardContent className="p-0">
            <div className="g-chat-head">Guild Chat</div>
            <div className="g-chat-scroll" ref={chatScrollRef}>
              {(messagesQuery.data ?? []).map((msg) => {
                if (msg.type === "system") {
                  return <div key={msg.id} className="g-msg-system">{msg.content}</div>;
                }
                if (msg.type === "sprint") {
                  let parsed: { roomCode?: string; durationMinutes?: number; startsInMinutes?: number } = {};
                  try { parsed = JSON.parse(msg.content); } catch { /* ignore */ }
                  return (
                    <div key={msg.id} className="g-msg-sprint">
                      <Zap size={14} />
                      <strong>{msg.writerName}</strong> started a {parsed.durationMinutes ?? "?"}-minute guild sprint{parsed.startsInMinutes ? ` (starts in ${parsed.startsInMinutes}m)` : ""}.
                      {parsed.roomCode && (
                        <Button
                          size="sm"
                          onClick={() => setLocation(`/room?code=${parsed.roomCode}`)}
                        >
                          Join
                        </Button>
                      )}
                    </div>
                  );
                }
                return (
                  <div key={msg.id} className="g-msg">
                    <span className="g-msg-name">{msg.writerName}</span>
                    <span className="g-msg-text">{msg.content}</span>
                  </div>
                );
              })}
            </div>
            <form
              className="g-chat-input"
              onSubmit={(e) => { e.preventDefault(); sendChat(); }}
            >
              <Input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Message your guild..."
                maxLength={1000}
              />
              <Button type="submit" disabled={!chatInput.trim()}>
                <Send size={14} />
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      {showSprintModal && (
        <div className="g-modal-backdrop" onClick={() => setShowSprintModal(false)}>
          <div className="g-modal" onClick={(e) => e.stopPropagation()}>
            <button className="g-modal-close" onClick={() => setShowSprintModal(false)}><X size={16} /></button>
            <h3 className="g-h2">Start a guild sprint</h3>
            <label className="g-label">
              <span>Duration (minutes)</span>
              <Input
                type="number" min={1} max={120}
                value={sprintDuration}
                onChange={(e) => setSprintDuration(Math.max(1, parseInt(e.target.value || "1", 10)))}
              />
            </label>
            <label className="g-label">
              <span>Countdown delay (minutes)</span>
              <Input
                type="number" min={0} max={30}
                value={sprintDelay}
                onChange={(e) => setSprintDelay(Math.max(0, parseInt(e.target.value || "0", 10)))}
              />
            </label>
            <Button onClick={startSprint}>Start sprint</Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Guild() {
  const [, setLocation] = useLocation();
  const af = useAuthedFetch();
  const { isSignedIn } = useAuth();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["guild"],
    queryFn: () => fetchGuild(af),
    enabled: !!isSignedIn,
  });

  return (
    <div className="g-page">
      <div className="g-topbar">
        <Button variant="ghost" size="sm" onClick={() => setLocation("/portal")}>
          <ArrowLeft size={16} /> Back
        </Button>
        <h1 className="g-page-title">Guilds</h1>
      </div>

      <InvitesPanel af={af} onAccept={() => refetch()} />

      {isLoading ? (
        <div className="g-loading">Loading guild...</div>
      ) : data?.guild ? (
        <GuildView af={af} data={data} refetchGuild={refetch} />
      ) : (
        <NoGuildView af={af} onCreated={() => refetch()} />
      )}
    </div>
  );
}
