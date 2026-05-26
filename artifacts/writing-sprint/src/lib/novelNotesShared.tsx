/**
 * Shared Novel Notes data model + card editor.
 *
 * MyFiles.tsx and CoWritingRoom.tsx both want to render and edit the exact
 * same Novel Notes cards (so a card you make in Folio is the same card you
 * see in a co-writing room and on the Novel Notes canvas). Rather than
 * duplicate ~500 lines of card-editor JSX, the canonical implementation
 * lives here and both call sites import from it.
 *
 * Persistence model:
 * - `nnData` is a single document, keyed by user, of shape
 *     { [projectId]: { sections: {...}, cards: { [sectionId]: NNCard[] } } }
 * - Stored locally in IndexedDB ("folio_db" → "folio" → "novel_notes_v1")
 *   AND mirrored to the server at /api/novel-notes.
 * - The Novel Notes canvas (the static /novel-notes.html page) reads the
 *   same shape — that's why a card built here renders identically there.
 */

import { useEffect, useRef, useState, useCallback } from "react";

// ── Card model ────────────────────────────────────────────────────────────
export type NNEntry = Record<string, string | number | null | undefined>;
export interface NNCard {
  id: string;
  type: string;
  // char-card / char-card-full
  name?: string;
  role?: string;
  age?: string;
  gender?: string;
  nationality?: string;
  motivation?: string;
  appearance?: string;
  personality?: string;
  fear?: string;
  trait1?: string;
  trait2?: string;
  trait3?: string;
  bio?: string;
  img?: string | null;
  // rule-card
  title?: string;
  rules?: string[];
  // rel-card / timeline-card
  entries?: NNEntry[];
  // loc-card
  type_?: string;
  climate?: string;
  notable?: string;
  // note-card
  body?: string;
  // item-card
  rarity?: string;
  category?: string;
  ability?: string;
  lore?: string;
  // lore-card
  era?: string;
  tags?: string;
  // faction-card / faction-full
  alignment?: string;
  leader?: string;
  motto?: string;
  hq?: string;
  goal?: string;
  allies?: string;
  // table-card
  headers?: string[];
  cells?: string[][];
}

export type NnRawData = Record<string, { sections?: unknown; cards: Record<string, NNCard[]> }>;

export const NN_CARD_GRADIENTS: Record<string, string> = {
  "char-card":      "linear-gradient(135deg,#7c5cbf,#5e4a9e)",
  "char-card-full": "linear-gradient(135deg,#5e4a9e,#3d3070)",
  "loc-card":       "linear-gradient(135deg,#2e7d5e,#1e5c44)",
  "note-card":      "linear-gradient(135deg,#3b6ea5,#2d5a8e)",
  "timeline-card":  "linear-gradient(135deg,#5a6ea0,#3d4f7a)",
  "rel-card":       "linear-gradient(135deg,#9c5c5c,#7a3d3d)",
  "rule-card":      "linear-gradient(135deg,#4a7a6e,#2e5c52)",
  "item-card":      "linear-gradient(135deg,#7a5230,#5a3418)",
  "lore-card":      "linear-gradient(135deg,#4a6e7a,#2d4e5c)",
  "faction-card":   "linear-gradient(135deg,#6e4a7a,#4a2d5e)",
  "faction-full":   "linear-gradient(135deg,#4a2d5e,#2d1a40)",
};

export const NN_SECTIONS: { id: string; label: string }[] = [
  { id: "overview",   label: "Overview" },
  { id: "world",      label: "World Building" },
  { id: "characters", label: "Characters" },
  { id: "powers",     label: "Power System" },
  { id: "factions",   label: "Factions" },
  { id: "plot",       label: "Plot & Arcs" },
  { id: "locations",  label: "Locations" },
  { id: "items",      label: "Items & Lore" },
  { id: "notes",      label: "Notes" },
];

export const NN_CARD_TYPES: {
  type: string; label: string; color: string; defaultSection: string;
}[] = [
  { type: "char-card",      label: "Character",        color: "#7c5cbf", defaultSection: "characters" },
  { type: "char-card-full", label: "Character (Full)", color: "#5e4a9e", defaultSection: "characters" },
  { type: "loc-card",       label: "Location",         color: "#2e7d5e", defaultSection: "locations" },
  { type: "note-card",      label: "Note",             color: "#3b6ea5", defaultSection: "notes"      },
  { type: "timeline-card",  label: "Timeline",         color: "#5a6ea0", defaultSection: "plot"       },
  { type: "rel-card",       label: "Relationship",     color: "#9c5c5c", defaultSection: "characters" },
  { type: "rule-card",      label: "World Rule",       color: "#4a7a6e", defaultSection: "world"      },
  { type: "item-card",      label: "Item / Artifact",  color: "#7a5230", defaultSection: "items"      },
  { type: "lore-card",      label: "Lore Entry",       color: "#4a6e7a", defaultSection: "items"      },
  { type: "faction-card",   label: "Faction",          color: "#6e4a7a", defaultSection: "factions"   },
  { type: "faction-full",   label: "Faction (Full)",   color: "#4a2d5e", defaultSection: "factions"   },
  { type: "table-card",     label: "Table",            color: "#4a5568", defaultSection: "overview"   },
];

// ── Helpers ───────────────────────────────────────────────────────────────
export function fileToDataUrl(file: File): Promise<string | null> {
  return new Promise((resolve) => {
    const r = new FileReader();
    r.onload = () => resolve(typeof r.result === "string" ? r.result : null);
    r.onerror = () => resolve(null);
    r.readAsDataURL(file);
  });
}

export function idbFolioGet<T>(key: string): Promise<T | undefined> {
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open("folio_db", 1);
      req.onsuccess = () => {
        const db = req.result;
        try {
          const tx = db.transaction("folio", "readonly");
          const r = tx.objectStore("folio").get(key);
          r.onsuccess = () => { resolve(r.result as T | undefined); db.close(); };
          r.onerror = () => { resolve(undefined); db.close(); };
        } catch { resolve(undefined); db.close(); }
      };
      req.onerror = () => resolve(undefined);
    } catch { resolve(undefined); }
  });
}

export function idbFolioSet(key: string, value: unknown): Promise<void> {
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open("folio_db", 1);
      req.onsuccess = () => {
        const db = req.result;
        try {
          const tx = db.transaction("folio", "readwrite");
          tx.objectStore("folio").put(value, key);
          tx.oncomplete = () => { db.close(); resolve(); };
          tx.onerror = () => { db.close(); resolve(); };
        } catch { db.close(); resolve(); }
      };
      req.onerror = () => resolve();
    } catch { resolve(); }
  });
}

export async function readNNProjects(): Promise<{ id: string; name: string }[]> {
  const direct = await idbFolioGet<{ id: string; name: string }[]>("nn_projects_v1");
  if (direct && direct.length) return direct;
  const stored = await idbFolioGet<{ state?: { projects?: { id: string; name: string }[] } }>("folio_state");
  return (stored?.state?.projects ?? []).filter((p: { id: string; name: string } & { _nn?: unknown }) => p._nn);
}

export function buildNNCard(type: string, name?: string): NNCard {
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const base: Record<string, unknown> = { id, type, x: 40, y: 40, w: null, h: null };
  const map: Record<string, Record<string, unknown>> = {
    "char-card":      { name: "Character", role: "", age: "", trait1: "", trait2: "", bio: "", img: null },
    "char-card-full": { name: "Character", role: "", age: "", gender: "", nationality: "", motivation: "", appearance: "", personality: "", fear: "", trait1: "", trait2: "", trait3: "", bio: "", img: null },
    "loc-card":       { name: "Location", type_: "", climate: "", notable: "" },
    "note-card":      { title: "Note", body: "" },
    "timeline-card":  { title: "Timeline", entries: [] },
    "rel-card":       { name: "Character", entries: [] },
    "rule-card":      { title: "World Rules", rules: [] },
    "item-card":      { name: "Item", rarity: "Common", category: "", ability: "", lore: "" },
    "lore-card":      { title: "Lore Entry", era: "", body: "", tags: "" },
    "faction-card":   { name: "Faction", type_: "", alignment: "Neutral", leader: "", motto: "" },
    "faction-full":   { name: "Faction", motto: "", type_: "", alignment: "Neutral", leader: "", hq: "", goal: "", lore: "" },
    "table-card":     { title: "Table", headers: [], cells: [] },
  };
  const card = Object.assign(base, map[type] || {}) as unknown as NNCard;
  const trimmed = name?.trim();
  if (trimmed) {
    if ("name" in card) card.name = trimmed;
    else if ("title" in card) card.title = trimmed;
    else card.name = trimmed;
  }
  return card;
}

/**
 * Read-modify-write the full nnData blob in IndexedDB AND mirror it to the
 * server. Returns the updated blob so callers can re-render with it.
 *
 * `authedFetch` is injected (rather than imported) so this module stays UI-
 * framework-agnostic; the React component that owns the panel hands in its
 * own fetch wrapper.
 */
export async function mutateNNCards(
  pid: string,
  sectionId: string,
  fn: (cards: NNCard[]) => NNCard[],
  authedFetch: (url: string, init?: RequestInit) => Promise<Response>,
): Promise<NnRawData> {
  const current = (await idbFolioGet<Record<string, unknown>>("novel_notes_v1")) ?? {};
  const merged: Record<string, unknown> = { ...current };
  const proj = (merged[pid] as { sections?: Record<string, unknown>; cards?: Record<string, NNCard[]> } | undefined)
    ?? { sections: {}, cards: {} };
  const cardsMap: Record<string, NNCard[]> = { ...(proj.cards ?? {}) };
  cardsMap[sectionId] = fn(cardsMap[sectionId] ? [...cardsMap[sectionId]] : []);
  merged[pid] = { sections: proj.sections ?? {}, cards: cardsMap };

  await idbFolioSet("novel_notes_v1", merged);
  authedFetch("/api/novel-notes", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nnData: merged }),
  }).catch(() => {});
  return merged as NnRawData;
}

// ── Card-stage icons ──────────────────────────────────────────────────────
export const StageIco = {
  Camera: () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  ),
  Trash: () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  ),
  Close: () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  ),
};

// ── Card editor stage ─────────────────────────────────────────────────────
// Renders the exact Novel Notes card surface — same DOM classes as the static
// /novel-notes.html canvas so the CSS in MyFiles.css applies one-to-one.
export function NNCardStage({
  card, onChange, onClose, onDelete,
}: {
  card: NNCard;
  onChange: (patch: Partial<NNCard>) => void;
  onClose: () => void;
  onDelete?: () => void;
}) {
  const entries = (card.entries ?? []) as NNEntry[];
  const setEntries = (next: NNEntry[]) => onChange({ entries: next });
  const updateEntry = (i: number, key: string, val: string | number) => {
    const next = entries.slice();
    next[i] = { ...next[i], [key]: val };
    setEntries(next);
  };
  const removeEntry = (i: number) => setEntries(entries.filter((_, j) => j !== i));

  const rules = (card.rules ?? []) as string[];
  const setRules = (next: string[]) => onChange({ rules: next });
  const updateRule = (i: number, val: string) => {
    const next = rules.slice(); next[i] = val; setRules(next);
  };
  const removeRule = (i: number) => setRules(rules.filter((_, j) => j !== i));

  const pickImage = async () => {
    const inp = document.createElement("input");
    inp.type = "file"; inp.accept = "image/*";
    inp.onchange = async () => {
      const f = inp.files?.[0]; if (!f) return;
      const url = await fileToDataUrl(f);
      if (url) onChange({ img: url });
    };
    inp.click();
  };

  const grad = NN_CARD_GRADIENTS[card.type] ?? "linear-gradient(135deg,#5a6ea0,#3d4f7a)";
  const closeBtn = (
    <button className="card-close" onClick={onClose} title="Close"><StageIco.Close /></button>
  );

  // ── CHARACTER ──
  if (card.type === "char-card" || card.type === "char-card-full") {
    const baseCol = card.type === "char-card" ? "#7c5cbf" : "#5e4a9e";
    return (
      <div className={`card ${card.type} nn-stage-char`}>
        <div
          className="char-portrait"
          style={card.img ? undefined : { background: `linear-gradient(150deg,${baseCol}ee,${baseCol}99)` }}
        >
          {card.img && (
            <>
              <img className="char-portrait-img" src={card.img} alt="" />
              <div className="char-portrait-shade" />
            </>
          )}
          <div className="char-collapsed-top">
            <span className="char-type-badge">Character</span>
            <div className="char-collapsed-controls">
              <button className="char-collapsed-btn" onClick={pickImage} title={card.img ? "Change photo" : "Add photo"}><StageIco.Camera /></button>
              {onDelete && <button className="char-collapsed-btn" onClick={onDelete} title="Delete"><StageIco.Trash /></button>}
              <button className="char-collapsed-btn" onClick={onClose} title="Close"><StageIco.Close /></button>
            </div>
          </div>
          <div className="char-portrait-spacer" aria-hidden="true" />
          <div className="char-collapsed-bottom">
            <input
              className="char-collapsed-role-input"
              value={card.role ?? ""}
              placeholder="ROLE / ARCHETYPE"
              onChange={(e) => onChange({ role: e.target.value })}
            />
            <input
              className="char-collapsed-name-input"
              value={card.name ?? ""}
              placeholder="Character"
              onChange={(e) => onChange({ name: e.target.value })}
            />
            <div className="char-collapsed-traits-row">
              <input className="char-collapsed-trait-input" value={card.trait1 ?? ""} placeholder="Trait 1" onChange={(e) => onChange({ trait1: e.target.value })} />
              <input className="char-collapsed-trait-input" value={card.trait2 ?? ""} placeholder="Trait 2" onChange={(e) => onChange({ trait2: e.target.value })} />
              {card.type === "char-card-full" && (
                <input className="char-collapsed-trait-input" value={card.trait3 ?? ""} placeholder="Trait 3" onChange={(e) => onChange({ trait3: e.target.value })} />
              )}
            </div>
          </div>
        </div>
        <div className="char-stage-details">
          {card.type === "char-card-full" ? (
            <div className="char-full-body">
              <div className="char-full-grid">
                <div className="char-full-field"><label>Gender</label><input value={card.gender ?? ""} onChange={(e) => onChange({ gender: e.target.value })} /></div>
                <div className="char-full-field"><label>Origin</label><input value={card.nationality ?? ""} onChange={(e) => onChange({ nationality: e.target.value })} /></div>
                <div className="char-full-field"><label>Age</label><input value={card.age ?? ""} onChange={(e) => onChange({ age: e.target.value })} /></div>
                <div className="char-full-field"><label>Motivation</label><input value={card.motivation ?? ""} onChange={(e) => onChange({ motivation: e.target.value })} /></div>
              </div>
              <div className="char-full-divider" />
              <div className="char-full-field"><label>Appearance</label><textarea rows={2} value={card.appearance ?? ""} onChange={(e) => onChange({ appearance: e.target.value })} /></div>
              <div className="char-full-field"><label>Personality</label><textarea rows={2} value={card.personality ?? ""} onChange={(e) => onChange({ personality: e.target.value })} /></div>
              <div className="char-full-field"><label>Fear / Flaw</label><textarea rows={1} value={card.fear ?? ""} onChange={(e) => onChange({ fear: e.target.value })} /></div>
              <div className="char-full-divider" />
              <div className="char-full-field"><label>Backstory / Arc</label><textarea rows={4} value={card.bio ?? ""} onChange={(e) => onChange({ bio: e.target.value })} /></div>
            </div>
          ) : (
            <div className="char-fields">
              <div className="char-field"><label>Age</label><input value={card.age ?? ""} onChange={(e) => onChange({ age: e.target.value })} /></div>
              <div className="char-field"><label>Bio</label><textarea rows={3} value={card.bio ?? ""} onChange={(e) => onChange({ bio: e.target.value })} /></div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── NOTE ──
  if (card.type === "note-card") {
    return (
      <div className="card note-card">
        <div className="note-card-inner">
          <div className="note-card-top">
            <input
              className="note-title-input"
              value={card.title ?? ""}
              placeholder="Untitled note"
              onChange={(e) => onChange({ title: e.target.value })}
            />
            {onDelete && <button className="card-close card-close--del" onClick={onDelete} title="Delete"><StageIco.Trash /></button>}
            {closeBtn}
          </div>
          <div className="note-divider" />
          <textarea
            className="note-textarea"
            value={card.body ?? ""}
            placeholder="Write anything…"
            onChange={(e) => onChange({ body: e.target.value })}
          />
        </div>
      </div>
    );
  }

  // ── LOCATION ──
  if (card.type === "loc-card") {
    return (
      <div className="card loc-card">
        <div className="card-header" style={{ background: grad }}>
          <input className="card-title-input" value={card.name ?? ""} placeholder="Location name" onChange={(e) => onChange({ name: e.target.value })} />
          {onDelete && <button className="card-close card-close--del" onClick={onDelete} title="Delete"><StageIco.Trash /></button>}
          {closeBtn}
        </div>
        {card.img
          ? <img src={card.img} className="loc-img-thumb" onClick={pickImage} title="Click to change image" alt="" />
          : (
            <div className="loc-img" onClick={pickImage}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
              <span className="loc-img-label">Add map or image</span>
            </div>
          )}
        <div className="card-body">
          <div className="char-fields">
            <div className="char-field"><label>Type</label><input value={card.type_ ?? ""} placeholder="City, Forest, Dungeon…" onChange={(e) => onChange({ type_: e.target.value })} /></div>
            <div className="char-field"><label>Region / Climate</label><input value={card.climate ?? ""} placeholder="Tropical, Arctic…" onChange={(e) => onChange({ climate: e.target.value })} /></div>
            <div className="char-field"><label>Description</label><textarea rows={3} placeholder="What makes this place special…" value={card.notable ?? ""} onChange={(e) => onChange({ notable: e.target.value })} /></div>
          </div>
        </div>
      </div>
    );
  }

  // ── TIMELINE ──
  if (card.type === "timeline-card") {
    return (
      <div className="card timeline-card">
        <div className="card-header" style={{ background: grad }}>
          <input className="card-title-input" value={card.title ?? ""} placeholder="Timeline" onChange={(e) => onChange({ title: e.target.value })} />
          {onDelete && <button className="card-close card-close--del" onClick={onDelete} title="Delete"><StageIco.Trash /></button>}
          {closeBtn}
        </div>
        <div className="card-body">
          {entries.map((e, i) => {
            const isLast = i === entries.length - 1;
            return (
              <div className="timeline-entry" key={i}>
                <div className="tl-dot-col">
                  <div className="timeline-dot" />
                  {!isLast && <div className="tl-line" />}
                </div>
                <div className="timeline-entry-content">
                  <input className="tl-date" value={(e.date ?? "") as string} placeholder="Date…" onChange={(ev) => updateEntry(i, "date", ev.target.value)} />
                  <input className="tl-text" value={(e.text ?? "") as string} placeholder="What happened…" onChange={(ev) => updateEntry(i, "text", ev.target.value)} />
                </div>
                <button className="nn-stage-row-del" onClick={() => removeEntry(i)} title="Remove">×</button>
              </div>
            );
          })}
          <button className="add-row-btn" onClick={() => setEntries([...entries, { date: "", text: "" }])}>+ Add event</button>
        </div>
      </div>
    );
  }

  // ── RELATIONSHIP ──
  if (card.type === "rel-card") {
    return (
      <div className="card rel-card">
        <div className="card-header" style={{ background: grad }}>
          <input className="card-title-input" value={card.name ?? ""} placeholder="Character" onChange={(e) => onChange({ name: e.target.value })} />
          {onDelete && <button className="card-close card-close--del" onClick={onDelete} title="Delete"><StageIco.Trash /></button>}
          {closeBtn}
        </div>
        <div className="card-body">
          {entries.map((e, i) => (
            <div className="rel-entry" key={i}>
              <div className="rel-avatar">{((e.name as string) || "?").charAt(0).toUpperCase()}</div>
              <div className="rel-info">
                <input style={{ background: "none", border: "none", borderBottom: "1px dashed var(--border)", outline: "none", fontSize: 12, fontWeight: 500, width: "100%", fontFamily: "'DM Sans',sans-serif" }} value={(e.name ?? "") as string} placeholder="Name" onChange={(ev) => updateEntry(i, "name", ev.target.value)} />
                <input style={{ background: "none", border: "none", outline: "none", fontSize: 10, color: "var(--text-muted)", width: "100%", fontFamily: "'DM Sans',sans-serif" }} value={(e.type ?? "") as string} placeholder="Ally, Rival…" onChange={(ev) => updateEntry(i, "type", ev.target.value)} />
              </div>
              <div className="rel-strength">
                {[1, 2, 3, 4, 5].map((n) => (
                  <span
                    key={n}
                    className={`rel-heart${n <= ((e.strength as number) || 0) ? " filled" : ""}`}
                    onClick={() => updateEntry(i, "strength", n)}
                  >♥</span>
                ))}
              </div>
              <button className="nn-stage-row-del" onClick={() => removeEntry(i)} title="Remove">×</button>
            </div>
          ))}
          <button className="add-row-btn" onClick={() => setEntries([...entries, { name: "", type: "", strength: 0 }])}>+ Add relationship</button>
        </div>
      </div>
    );
  }

  // ── WORLD RULE ──
  if (card.type === "rule-card") {
    return (
      <div className="card rule-card">
        <div className="card-header" style={{ background: grad }}>
          <input className="card-title-input" value={card.title ?? ""} placeholder="World Rules" onChange={(e) => onChange({ title: e.target.value })} />
          {onDelete && <button className="card-close card-close--del" onClick={onDelete} title="Delete"><StageIco.Trash /></button>}
          {closeBtn}
        </div>
        <div className="card-body">
          {rules.map((r, i) => (
            <div className="rule-item" key={i}>
              <div className="rule-num">{i + 1}</div>
              <textarea className="rule-text" rows={1} placeholder="Rule…" value={r} onChange={(e) => updateRule(i, e.target.value)} />
              <button className="nn-stage-row-del" onClick={() => removeRule(i)} title="Remove">×</button>
            </div>
          ))}
          <button className="add-row-btn" onClick={() => setRules([...rules, ""])}>+ Add rule</button>
        </div>
      </div>
    );
  }

  // ── ITEM / ARTIFACT ──
  if (card.type === "item-card") {
    return (
      <div className="card item-card">
        <div className="card-header" style={{ background: grad }}>
          <input className="card-title-input" value={card.name ?? ""} placeholder="Item name" onChange={(e) => onChange({ name: e.target.value })} />
          {onDelete && <button className="card-close card-close--del" onClick={onDelete} title="Delete"><StageIco.Trash /></button>}
          {closeBtn}
        </div>
        <div className="card-body">
          <div className="char-fields">
            <div className="char-field"><label>Rarity</label><input value={card.rarity ?? ""} placeholder="Common, Legendary…" onChange={(e) => onChange({ rarity: e.target.value })} /></div>
            <div className="char-field"><label>Category</label><input value={card.category ?? ""} placeholder="Weapon, Tome, Relic…" onChange={(e) => onChange({ category: e.target.value })} /></div>
            <div className="char-field"><label>Ability / Effect</label><textarea rows={2} placeholder="What it does…" value={card.ability ?? ""} onChange={(e) => onChange({ ability: e.target.value })} /></div>
            <div className="char-field"><label>Lore</label><textarea rows={2} placeholder="History & legend…" value={card.lore ?? ""} onChange={(e) => onChange({ lore: e.target.value })} /></div>
          </div>
        </div>
      </div>
    );
  }

  // ── LORE ENTRY ──
  if (card.type === "lore-card") {
    return (
      <div className="card lore-card">
        <div className="card-header" style={{ background: grad }}>
          <input className="card-title-input" value={card.title ?? ""} placeholder="Lore entry" onChange={(e) => onChange({ title: e.target.value })} />
          {onDelete && <button className="card-close card-close--del" onClick={onDelete} title="Delete"><StageIco.Trash /></button>}
          {closeBtn}
        </div>
        <div className="card-body">
          <div className="char-field" style={{ padding: "0 0 6px" }}>
            <label>Era / Period</label>
            <input value={card.era ?? ""} placeholder="Ancient Times, Year 342…" onChange={(e) => onChange({ era: e.target.value })} />
          </div>
          <textarea className="note-textarea" style={{ minHeight: 90, padding: "4px 0" }} placeholder="Write the lore…" value={card.body ?? ""} onChange={(e) => onChange({ body: e.target.value })} />
        </div>
      </div>
    );
  }

  // ── FACTION (compact) ──
  if (card.type === "faction-card") {
    return (
      <div className="card faction-card">
        <div className="card-header" style={{ background: grad }}>
          <input className="card-title-input" value={card.name ?? ""} placeholder="Faction name" onChange={(e) => onChange({ name: e.target.value })} />
          {onDelete && <button className="card-close card-close--del" onClick={onDelete} title="Delete"><StageIco.Trash /></button>}
          {closeBtn}
        </div>
        <div style={{ padding: "6px 13px 2px", fontFamily: "'Crimson Pro',serif", fontSize: 13, fontStyle: "italic", color: "var(--text-muted)", borderBottom: "1px solid var(--border)" }}>
          <input style={{ width: "100%", background: "none", border: "none", outline: "none", fontFamily: "'Crimson Pro',serif", fontSize: 13, fontStyle: "italic", color: "var(--text-muted)" }} value={card.motto ?? ""} placeholder="Their motto…" onChange={(e) => onChange({ motto: e.target.value })} />
        </div>
        <div className="card-body">
          <div className="char-fields">
            <div className="char-field"><label>Type</label><input value={card.type_ ?? ""} placeholder="Guild, Empire, Cult…" onChange={(e) => onChange({ type_: e.target.value })} /></div>
            <div className="char-field"><label>Leader</label><input value={card.leader ?? ""} placeholder="Who leads them…" onChange={(e) => onChange({ leader: e.target.value })} /></div>
            <div className="char-field"><label>Alignment</label><input value={card.alignment ?? ""} placeholder="Lawful Good, Chaotic…" onChange={(e) => onChange({ alignment: e.target.value })} /></div>
            <div className="char-field"><label>Goal</label><textarea rows={2} placeholder="What they want…" value={card.goal ?? ""} onChange={(e) => onChange({ goal: e.target.value })} /></div>
          </div>
        </div>
      </div>
    );
  }

  // ── FACTION (Full) ──
  if (card.type === "faction-full") {
    return (
      <div className="card faction-full">
        <div className="card-header" style={{ background: grad }}>
          <input className="card-title-input" value={card.name ?? ""} placeholder="Faction name" onChange={(e) => onChange({ name: e.target.value })} />
          {onDelete && <button className="card-close card-close--del" onClick={onDelete} title="Delete"><StageIco.Trash /></button>}
          {closeBtn}
        </div>
        <div style={{ padding: "6px 13px 2px", borderBottom: "1px solid var(--border)" }}>
          <input style={{ width: "100%", background: "none", border: "none", outline: "none", fontFamily: "'Crimson Pro',serif", fontSize: 13, fontStyle: "italic", color: "var(--text-muted)" }} value={card.motto ?? ""} placeholder="Motto…" onChange={(e) => onChange({ motto: e.target.value })} />
        </div>
        <div className="card-body">
          <div className="char-full-body">
            <div className="char-full-grid">
              <div className="char-full-field"><label>Type</label><input value={card.type_ ?? ""} onChange={(e) => onChange({ type_: e.target.value })} /></div>
              <div className="char-full-field"><label>Alignment</label><input value={card.alignment ?? ""} onChange={(e) => onChange({ alignment: e.target.value })} /></div>
              <div className="char-full-field"><label>Leader</label><input value={card.leader ?? ""} onChange={(e) => onChange({ leader: e.target.value })} /></div>
              <div className="char-full-field"><label>HQ</label><input value={card.hq ?? ""} onChange={(e) => onChange({ hq: e.target.value })} /></div>
            </div>
            <div className="char-full-divider" />
            <div className="char-full-field"><label>Goal</label><textarea rows={2} value={card.goal ?? ""} onChange={(e) => onChange({ goal: e.target.value })} /></div>
            <div className="char-full-field"><label>Allies / Enemies</label><input value={card.allies ?? ""} placeholder="Allies, enemies…" onChange={(e) => onChange({ allies: e.target.value })} /></div>
            <div className="char-full-field"><label>Lore</label><textarea rows={3} placeholder="History, secrets…" value={card.lore ?? ""} onChange={(e) => onChange({ lore: e.target.value })} /></div>
          </div>
        </div>
      </div>
    );
  }

  if (card.type === "table-card") {
    return (
      <div className="card table-card">
        <div className="card-header" style={{ background: grad }}>
          <input className="card-title-input" value={card.title ?? ""} placeholder="Table title" onChange={(e) => onChange({ title: e.target.value })} />
          {onDelete && <button className="card-close card-close--del" onClick={onDelete} title="Delete"><StageIco.Trash /></button>}
          {closeBtn}
        </div>
        <div className="card-body" style={{ fontSize: 12, color: "var(--text-muted)" }}>
          Open this card in Novel Notes to edit the table grid.
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-header" style={{ background: grad }}>
        <span className="card-title-input">Card</span>
        {closeBtn}
      </div>
      <div className="card-body" />
    </div>
  );
}

/**
 * Editor wrapper — keeps a draft + debounce-saves to the caller every 350ms.
 * Mirrors the saveNN() behaviour in /novel-notes.html: eventually consistent
 * without blocking the user.
 */
export function NNCardEditor({
  initialCard, onSave, onCancel, onDelete,
}: {
  initialCard: NNCard;
  onSave: (card: NNCard) => void;
  onCancel: () => void;
  onDelete?: () => void;
}) {
  const [draft, setDraft] = useState<NNCard>(() => structuredClone(initialCard));
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestRef = useRef(draft);
  latestRef.current = draft;
  useEffect(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => onSave(latestRef.current), 350);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [draft, onSave]);
  // Flush on unmount so closing immediately doesn't drop the last keystrokes.
  useEffect(() => () => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      onSave(latestRef.current);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleChange = useCallback(
    (patch: Partial<NNCard>) => setDraft((d) => ({ ...d, ...patch })),
    [],
  );

  return (
    <div className="nn-stage-overlay" onClick={onCancel}>
      <div className="nn-stage-wrap" onClick={(e) => e.stopPropagation()}>
        <NNCardStage
          card={draft}
          onChange={handleChange}
          onClose={onCancel}
          onDelete={onDelete}
        />
      </div>
    </div>
  );
}
