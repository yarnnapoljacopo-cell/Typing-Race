// Per-(guild,user) connection refcount so multi-tab / quick reconnects
// don't flicker presence to "offline" while another socket is still open.
const connCounts = new Map<number, Map<string, number>>();

function key(guildId: number): Map<string, number> {
  let m = connCounts.get(guildId);
  if (!m) {
    m = new Map();
    connCounts.set(guildId, m);
  }
  return m;
}

export function markOnline(guildId: number, userId: string): void {
  const m = key(guildId);
  m.set(userId, (m.get(userId) ?? 0) + 1);
}

export function markOffline(guildId: number, userId: string): void {
  const m = connCounts.get(guildId);
  if (!m) return;
  const next = (m.get(userId) ?? 0) - 1;
  if (next <= 0) {
    m.delete(userId);
    if (m.size === 0) connCounts.delete(guildId);
  } else {
    m.set(userId, next);
  }
}

export function getOnlineMembers(guildId: number): string[] {
  const m = connCounts.get(guildId);
  return m ? Array.from(m.keys()) : [];
}
