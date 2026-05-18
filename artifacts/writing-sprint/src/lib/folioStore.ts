type StatusKey = "draft" | "progress" | "done" | "edit";

export interface FolioDoc {
  id: string;
  name: string;
  content: string;
  status: StatusKey;
  updatedAt: number;
}

export interface FolioProject {
  id: string;
  name: string;
  open: boolean;
  docs: FolioDoc[];
}

export interface FolioState {
  projects: FolioProject[];
  notes?: Record<string, string>;
}

type FetchFn = (url: string, opts?: RequestInit) => Promise<Response>;
type Listener = () => void;

const DB_NAME = "folio_db";
const DB_VERSION = 1;
const STORE_NAME = "folio";
const SYNC_DEBOUNCE_MS = 3000;
const BASE = (typeof import.meta !== "undefined" && import.meta.env?.BASE_URL) || "/";

function openIDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const d = req.result;
      if (!d.objectStoreNames.contains(STORE_NAME)) d.createObjectStore(STORE_NAME);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGet<T>(key: string): Promise<T | undefined> {
  try {
    const d = await openIDB();
    return await new Promise<T | undefined>((resolve, reject) => {
      const tx = d.transaction(STORE_NAME, "readonly");
      const r = tx.objectStore(STORE_NAME).get(key);
      r.onsuccess = () => resolve(r.result as T | undefined);
      r.onerror = () => reject(r.error);
      tx.oncomplete = () => d.close();
    });
  } catch {
    return undefined;
  }
}

async function idbSet(key: string, value: unknown): Promise<void> {
  try {
    const d = await openIDB();
    await new Promise<void>((resolve, reject) => {
      const tx = d.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).put(value, key);
      tx.oncomplete = () => { d.close(); resolve(); };
      tx.onerror = () => { d.close(); reject(tx.error); };
    });
  } catch { /* best-effort */ }
}

function migrateFromLocalStorage(): FolioState | null {
  try {
    const raw = localStorage.getItem("folio_v3");
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { projects?: FolioProject[] };

    const notes: Record<string, string> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (
        key &&
        key.startsWith("folio_stickynote_") &&
        !key.endsWith("_pos") &&
        !key.endsWith("_size")
      ) {
        const noteKey = key.slice("folio_stickynote_".length);
        const val = localStorage.getItem(key);
        if (val) notes[noteKey] = val;
      }
    }

    return { projects: parsed.projects ?? [], notes };
  } catch {
    return null;
  }
}

function clearLocalStorageFolioData(): void {
  const toRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (
      key &&
      (key === "folio_v3" ||
        key === "folio_recent" ||
        (key.startsWith("folio_stickynote_") &&
          !key.endsWith("_pos") &&
          !key.endsWith("_size")))
    ) {
      toRemove.push(key);
    }
  }
  toRemove.forEach((k) => localStorage.removeItem(k));
}

class FolioStore {
  private _state: FolioState = { projects: [] };
  private _listeners = new Set<Listener>();
  private _fetchFn: FetchFn | null = null;
  private _initialized = false;
  private _initializing = false;
  private _syncTimer: ReturnType<typeof setTimeout> | null = null;
  private _online =
    typeof navigator !== "undefined" ? navigator.onLine : true;
  private _syncing = false;
  private _lastSyncError: string | null = null;
  private _initPromise: Promise<void> | null = null;

  constructor() {
    if (typeof window !== "undefined") {
      window.addEventListener("online", () => {
        this._online = true;
        this.pushToServer();
        this.notify();
      });
      window.addEventListener("offline", () => {
        this._online = false;
        this.notify();
      });
    }
  }

  getState(): FolioState {
    return this._state;
  }
  get isOnline(): boolean {
    return this._online;
  }
  get isSyncing(): boolean {
    return this._syncing;
  }
  get isInitialized(): boolean {
    return this._initialized;
  }
  get lastSyncError(): string | null {
    return this._lastSyncError;
  }

  configure(fetchFn: FetchFn): void {
    const hadFetch = !!this._fetchFn;
    this._fetchFn = fetchFn;
    if (!hadFetch) {
      if (this._initialized) {
        this.syncAfterConfigure();
      } else if (this._initPromise) {
        this._initPromise.then(() => this.syncAfterConfigure());
      }
    }
  }

  private async syncAfterConfigure(): Promise<void> {
    try {
      const serverState = await this.pullFromServer();
      if (serverState && serverState.projects.length > 0) {
        const local = this._state.projects.length > 0 ? this._state : null;
        const merged = this.merge(local, serverState);
        this._state = merged;
        this.notify();
        await this.persistLocal();
      }
      if (this._state.projects.length > 0) {
        await this.pushToServer();
      }
    } catch (err) {
      console.warn("[folio] syncAfterConfigure failed", err);
    }
  }

  subscribe(listener: Listener): () => void {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  }

  private notify(): void {
    this._listeners.forEach((l) => {
      try {
        l();
      } catch { /* ignore */ }
    });
  }

  setState(updater: FolioState | ((prev: FolioState) => FolioState)): void {
    const next = typeof updater === "function" ? updater(this._state) : updater;
    this._state = { ...this._state, ...next };
    this.notify();
    this.persistLocal();
    this.schedulePush();
  }

  getNote(key: string): string {
    return this._state.notes?.[key] ?? "";
  }

  setNote(key: string, content: string): void {
    this._state = {
      ...this._state,
      notes: { ...(this._state.notes ?? {}), [key]: content },
    };
    this.notify();
    this.persistLocal();
    this.schedulePush();
  }

  private async persistLocal(): Promise<void> {
    await idbSet("folio_state", {
      state: this._state,
      updatedAt: Date.now(),
    });
  }

  private async persistLocalDirect(state: FolioState): Promise<void> {
    await idbSet("folio_state", {
      state,
      updatedAt: Date.now(),
    });
  }

  private schedulePush(): void {
    if (this._syncTimer) clearTimeout(this._syncTimer);
    this._syncTimer = setTimeout(() => this.pushToServer(), SYNC_DEBOUNCE_MS);
  }

  async pushToServer(): Promise<void> {
    if (!this._fetchFn || !this._online) return;
    this._syncing = true;
    this._lastSyncError = null;
    this.notify();
    try {
      const res = await this._fetchFn(`${BASE}api/folio`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ state: this._state }),
      });
      if (!res.ok) {
        this._lastSyncError = `Sync failed (${res.status})`;
        console.warn("[folio] pushToServer failed", res.status);
      }
    } catch (err) {
      this._lastSyncError = "Sync failed (network)";
      console.warn("[folio] pushToServer network error", err);
    }
    this._syncing = false;
    this.notify();
  }

  private async pullFromServer(): Promise<FolioState | null> {
    if (!this._fetchFn || !this._online) return null;
    try {
      const res = await this._fetchFn(`${BASE}api/folio`);
      if (!res.ok) return null;
      const data = await res.json();
      if (data.state && Array.isArray(data.state.projects)) {
        return data.state as FolioState;
      }
    } catch (err) {
      console.warn("[folio] pullFromServer error", err);
    }
    return null;
  }

  async init(): Promise<void> {
    if (this._initPromise) return this._initPromise;
    this._initPromise = this._doInit();
    return this._initPromise;
  }

  private static normalizeState(state: FolioState): FolioState {
    return {
      ...state,
      projects: (state.projects ?? []).map((p) => ({
        ...p,
        docs: p.docs ?? [],
      })),
    };
  }

  private async _doInit(): Promise<void> {
    if (this._initialized) return;
    this._initializing = true;

    let localState: FolioState | null = null;

    try {
      const stored = await idbGet<{ state: FolioState; updatedAt: number }>(
        "folio_state",
      );
      if (stored?.state) localState = FolioStore.normalizeState(stored.state);
    } catch { /* ignore */ }

    if (!localState) {
      const migrated = migrateFromLocalStorage();
      if (migrated) {
        localState = FolioStore.normalizeState(migrated);
        await this.persistLocalDirect(localState);
        clearLocalStorageFolioData();
      }
    }

    if (localState) {
      this._state = localState;
      this.notify();
      await this.persistLocal();
    }

    if (this._fetchFn && this._online) {
      try {
        const serverState = await this.pullFromServer();
        if (serverState && serverState.projects.length > 0) {
          const merged = this.merge(localState, serverState);
          this._state = merged;
          this.notify();
          await this.persistLocal();
        }
        if (this._state.projects.length > 0) {
          await this.pushToServer();
        }
      } catch (err) {
        console.warn("[folio] server sync during init failed", err);
      }
    }

    this._initialized = true;
    this._initializing = false;
    this.notify();
  }

  private merge(
    local: FolioState | null,
    server: FolioState,
  ): FolioState {
    if (!local || local.projects.length === 0) return server;
    if (server.projects.length === 0) return local;

    const projectMap = new Map<string, FolioProject>();

    for (const p of server.projects) {
      projectMap.set(p.id, { ...p, docs: [...(p.docs ?? [])] });
    }

    for (const lp of local.projects) {
      const existing = projectMap.get(lp.id);
      if (!existing) {
        projectMap.set(lp.id, { ...lp, docs: [...(lp.docs ?? [])] });
      } else {
        const docMap = new Map<string, FolioDoc>();
        for (const d of existing.docs) docMap.set(d.id, d);
        for (const ld of (lp.docs ?? [])) {
          const ed = docMap.get(ld.id);
          if (!ed || ld.updatedAt > ed.updatedAt) {
            docMap.set(ld.id, ld);
          }
        }
        existing.docs = Array.from(docMap.values());
        existing.open = lp.open;
        projectMap.set(lp.id, existing);
      }
    }

    const mergedNotes = {
      ...(server.notes ?? {}),
      ...(local.notes ?? {}),
    };

    return { projects: Array.from(projectMap.values()), notes: mergedNotes };
  }
}

export const folioStore = new FolioStore();

folioStore.init();
