import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/react";
import { useAuthedFetch } from "@/lib/authedFetch";
import { ArrowLeft, Users, LogOut, Send, Zap, Shield, UserMinus, ArrowRightLeft, Trash2, MessageCircle, BarChart3, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { getRankFromXp } from "@/lib/ranks";
import { GuildCrest, GUILD_CRESTS } from "@/components/GuildCrests";
import SprintPopup from "./SprintPopup";
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
    crest?: string;
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

function initialsOf(name: string): string {
  const parts = name.trim().split(/[\s_-]+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Tier of member by XP, used for the role badge styling. Leader is always
// rendered as Guildmaster regardless of XP.
function memberTier(xp: number): { label: string; cls: string } {
  if (xp >= 5000) return { label: "Veteran",  cls: "gp-role-veteran" };
  if (xp >= 1000) return { label: "Scribe",   cls: "gp-role-scribe" };
  return { label: "Initiate", cls: "gp-role-initiate" };
}

function MemberRow({ m, isLeader, viewerIsLeader, viewerId, onKick, onTransfer }: {
  m: Member; isLeader: boolean; viewerIsLeader: boolean; viewerId: string | null;
  onKick: (id: string) => void; onTransfer: (id: string) => void;
}) {
  const rank = getRankFromXp(m.xp);
  const tier = isLeader
    ? { label: "Guildmaster", cls: "gp-role-guildmaster" }
    : memberTier(m.xp);
  return (
    <div className="gp-member-row">
      <div className="gp-avatar">
        {initialsOf(m.writerName)}
        <span className={`gp-status ${m.online ? "s-online" : "s-offline"}`} />
      </div>
      <div className="gp-m-info">
        <div className="gp-m-name">
          <span>{m.writerName}</span>
          <span className={`gp-role-badge ${tier.cls}`}>{tier.label}</span>
        </div>
        <div className="gp-m-rank">{rank.title}</div>
      </div>
      {viewerIsLeader && m.userId !== viewerId && (
        <div className="gp-m-actions">
          <button className="gp-icon-btn" title="Transfer leadership" onClick={() => onTransfer(m.userId)}>
            <ArrowRightLeft size={14} />
          </button>
          <button className="gp-icon-btn gp-icon-btn-danger" title="Remove member" onClick={() => onKick(m.userId)}>
            <UserMinus size={14} />
          </button>
        </div>
      )}
    </div>
  );
}

// Format an ISO timestamp as HH:MM (24h, locale-aware).
function fmtTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch { return ""; }
}

// Bucket label for chat date dividers ("Today", "Yesterday", or a date).
function dateBucket(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return "Today";
  const y = new Date(now); y.setDate(now.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return "Yesterday";
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

function NoGuildView({ af, onCreated }: { af: AF; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [tag, setTag] = useState("");
  const [description, setDescription] = useState("");
  const [crest, setCrest] = useState<string>("swords");
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
        body: JSON.stringify({ name, tag, description, crest }),
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
          <div className="g-label">
            <span>Crest <em className="g-hint">— pick a symbol for your banner</em></span>
            <div className="g-crest-grid" role="radiogroup" aria-label="Guild crest">
              {GUILD_CRESTS.map((c) => {
                const selected = crest === c.id;
                return (
                  <button
                    type="button"
                    key={c.id}
                    role="radio"
                    aria-checked={selected}
                    title={c.label}
                    onClick={() => setCrest(c.id)}
                    className={`g-crest-tile ${selected ? "is-selected" : ""}`}
                  >
                    <span className="g-crest-tile-diamond">
                      <span className="g-crest-tile-inner">
                        <GuildCrest id={c.id} size={26} />
                      </span>
                    </span>
                    <span className="g-crest-tile-label">{c.label}</span>
                    {selected && <span className="g-crest-tile-check"><Check size={10} strokeWidth={3} /></span>}
                  </button>
                );
              })}
            </div>
          </div>
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

function GuildView({ af, data, refetchGuild, onBack }: { af: AF; data: GuildData; refetchGuild: () => void; onBack: () => void }) {
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

  const closeSprintModal = () => {
    setShowSprintModal(false);
    // Refresh chat so the announcement message appears for the leader too.
    messagesQuery.refetch();
  };

  const members = data.members ?? [];
  const onlineCount = members.filter((m) => m.online).length;
  const sortedMembers = members
    .slice()
    .sort((a, b) => (a.role === "leader" ? -1 : b.role === "leader" ? 1 : b.xp - a.xp));

  const messages = messagesQuery.data ?? [];
  const sprintCount = messages.filter((m) => m.type === "sprint").length;

  // Group consecutive messages by date bucket so we can render dividers.
  const groupedMessages: Array<{ bucket: string; items: Message[] }> = [];
  for (const m of messages) {
    const bucket = dateBucket(m.sentAt);
    const last = groupedMessages[groupedMessages.length - 1];
    if (last && last.bucket === bucket) last.items.push(m);
    else groupedMessages.push({ bucket, items: [m] });
  }

  return (
    <div className="gp">
      <div className="gp-header">
        <button type="button" className="gp-back" onClick={onBack}>
          <ArrowLeft size={12} /> Guilds
        </button>
        <div className="gp-title-row">
          <div className="gp-name-block">
            <div className="gp-crest"><div className="gp-crest-inner"><GuildCrest id={guild.crest ?? "swords"} size={26} /></div></div>
            <div style={{ minWidth: 0 }}>
              <h1 className="gp-name" title={guild.name}>{guild.name}</h1>
              <span className="gp-tag">[{guild.tag}]</span>
              {guild.description && <p className="gp-desc">{guild.description}</p>}
            </div>
          </div>
          {isLeader && (
            <button type="button" className="gp-sprint-btn" onClick={() => setShowSprintModal(true)}>
              <Zap size={14} /> Start Guild Sprint
            </button>
          )}
        </div>
      </div>

      <div className="gp-body">
        {/* Sidebar */}
        <div className="gp-sidebar">
          <div className="gp-panel">
            <div className="gp-stats">
              <div className="gp-stat-card">
                <div className="gp-stat-value">{members.length}</div>
                <div className="gp-stat-label">Members</div>
              </div>
              <div className="gp-stat-card">
                <div className="gp-stat-value">{onlineCount}</div>
                <div className="gp-stat-label">Online</div>
              </div>
              <div className="gp-stat-card">
                <div className="gp-stat-value">{sprintCount}</div>
                <div className="gp-stat-label">Sprints</div>
              </div>
            </div>
          </div>

          <div className="gp-panel">
            <div className="gp-panel-header">
              <div className="gp-panel-title"><Users size={12} /> Members</div>
              <span className="gp-online-badge">{onlineCount} / {members.length} online</span>
            </div>
            <div className="gp-member-list">
              {sortedMembers.map((m) => (
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
              <>
                <div className="gp-divider" />
                <div className="gp-invite-section">
                  <div className="gp-invite-label">Invite a writer</div>
                  <form
                    className="gp-invite-row"
                    onSubmit={(e) => { e.preventDefault(); if (inviteName.trim()) invite(); }}
                  >
                    <input
                      className="gp-invite-input"
                      type="text"
                      value={inviteName}
                      onChange={(e) => setInviteName(e.target.value)}
                      placeholder="Writer name…"
                    />
                    <button type="submit" className="gp-invite-btn" disabled={!inviteName.trim()}>Invite</button>
                  </form>
                  {inviteError && <div className="g-error-sm" style={{ padding: 0, marginTop: 6 }}>{inviteError}</div>}
                </div>
              </>
            )}

            <div className="gp-divider" />
            <div className="gp-bottom-section">
              {isLeader ? (
                <button type="button" className="gp-danger-btn" onClick={disband}>
                  <Trash2 size={12} /> Disband guild
                </button>
              ) : (
                <button type="button" className="gp-danger-btn" onClick={leave}>
                  <LogOut size={12} /> Leave guild
                </button>
              )}
            </div>
            {actionError && <div className="g-error-sm">{actionError}</div>}
          </div>
        </div>

        {/* Main column */}
        <div className="gp-main-col">
          <div className="gp-panel gp-chat-panel">
            <div className="gp-panel-header">
              <div className="gp-panel-title"><MessageCircle size={12} /> Guild Chat</div>
              <span className="gp-online-badge" style={{ background: "#FBF1DC", color: "#8B6914", borderColor: "rgba(212,160,23,0.4)" }}>
                <BarChart3 size={11} style={{ verticalAlign: "-1px", marginRight: 3 }} />
                {messages.length} messages
              </span>
            </div>
            <div className="gp-chat-messages" ref={chatScrollRef}>
              {messages.length === 0 ? (
                <div className="gp-chat-empty">No messages yet. Be the first to greet your guild.</div>
              ) : (
                groupedMessages.map((group, gi) => (
                  <div key={gi} style={{ display: "contents" }}>
                    <div className="gp-chat-date-div"><span className="gp-chat-date-text">{group.bucket}</span></div>
                    {group.items.map((msg) => {
                      if (msg.type === "system") {
                        return <div key={msg.id} className="gp-msg-system">{msg.content}</div>;
                      }
                      if (msg.type === "sprint") {
                        let parsed: { roomCode?: string; durationMinutes?: number; startsInMinutes?: number } = {};
                        try { parsed = JSON.parse(msg.content); } catch { /* ignore */ }
                        return (
                          <div key={msg.id} className="gp-msg-sprint">
                            <Zap size={14} />
                            <span>
                              <strong>{msg.writerName}</strong> started a {parsed.durationMinutes ?? "?"}-minute guild sprint
                              {parsed.startsInMinutes ? ` (starts in ${parsed.startsInMinutes}m)` : ""}.
                            </span>
                            {parsed.roomCode && (
                              <button
                                type="button"
                                className="gp-join-btn"
                                onClick={() => setLocation(`/room?code=${parsed.roomCode}`)}
                              >
                                Join
                              </button>
                            )}
                          </div>
                        );
                      }
                      return (
                        <div key={msg.id} className="gp-chat-msg">
                          <div className="gp-msg-av">{initialsOf(msg.writerName)}</div>
                          <div className="gp-msg-body">
                            <div className="gp-msg-meta">
                              <span className="gp-msg-author">{msg.writerName}</span>
                              <span className="gp-msg-time">{fmtTime(msg.sentAt)}</span>
                            </div>
                            <div className="gp-msg-bubble">{msg.content}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))
              )}
            </div>
            <form
              className="gp-chat-input-row"
              onSubmit={(e) => { e.preventDefault(); sendChat(); }}
            >
              <input
                className="gp-chat-input"
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Message your guild…"
                maxLength={1000}
              />
              <button type="submit" className="gp-send-btn" disabled={!chatInput.trim()} aria-label="Send">
                <Send size={15} />
              </button>
            </form>
          </div>
        </div>
      </div>

      <SprintPopup
        open={showSprintModal}
        onClose={closeSprintModal}
        chapterTitle={null}
        guildId={guild.id}
      />
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

  // When the user is in a guild we render the themed Guildhall shell, which
  // owns its own header (with the back link). Otherwise we keep the legacy
  // light page wrapper for the create / invites / loading states.
  if (!isLoading && data?.guild) {
    return (
      <div className="g-page" style={{ padding: "24px 16px 80px" }}>
        <InvitesPanel af={af} onAccept={() => refetch()} />
        <GuildView af={af} data={data} refetchGuild={refetch} onBack={() => setLocation("/portal")} />
      </div>
    );
  }

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
      ) : (
        <NoGuildView af={af} onCreated={() => refetch()} />
      )}
    </div>
  );
}
