import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@clerk/react";
import { Link } from "wouter";
import { Bell } from "lucide-react";
import { useAuthedFetch } from "@/lib/authedFetch";
import "./GuildBell.css";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

interface InviteSummary { id: number; guildName: string; guildTag: string }

export function GuildBell() {
  const { isSignedIn } = useAuth();
  const af = useAuthedFetch();

  const { data: invites } = useQuery({
    queryKey: ["guildBell"],
    queryFn: async (): Promise<InviteSummary[]> => {
      const r = await af(`${basePath}/api/guilds/me/invites`);
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!isSignedIn,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const { data: activeSprint } = useQuery({
    queryKey: ["guildBellSprint"],
    queryFn: async () => {
      const r = await af(`${basePath}/api/guilds/me/active-sprint`);
      if (!r.ok) return { sprint: null };
      return r.json() as Promise<{ sprint: { roomCode?: string; durationMinutes?: number; startedBy?: string } | null }>;
    },
    enabled: !!isSignedIn,
    refetchInterval: 30_000,
    staleTime: 20_000,
  });

  if (!isSignedIn) return null;

  const inviteCount = invites?.length ?? 0;
  const sprint = activeSprint?.sprint ?? null;
  const totalCount = inviteCount + (sprint ? 1 : 0);

  return (
    <Link href="/guild" className="gb-bell" title={
      sprint ? `Guild sprint started by ${sprint.startedBy}` :
      inviteCount > 0 ? `${inviteCount} pending guild invite${inviteCount === 1 ? "" : "s"}` :
      "Guild"
    }>
      <Bell size={16} />
      {totalCount > 0 && <span className="gb-badge">{totalCount}</span>}
    </Link>
  );
}
