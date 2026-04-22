const KEY = "guest_name";

export function getGuestName(): string | null {
  try { return localStorage.getItem(KEY); } catch { return null; }
}

export function setGuestName(name: string): void {
  try { localStorage.setItem(KEY, name); } catch { /* ignore */ }
}

export function clearGuestName(): void {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}
