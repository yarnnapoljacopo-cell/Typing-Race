import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useLocation } from "wouter";
import SprintPopup from "./SprintPopup";
import StickyNote from "./StickyNote";
import { useFolio } from "@/lib/useFolio";
import { useAuthedFetch } from "@/lib/authedFetch";
import { folioStore } from "@/lib/folioStore";
import type { FolioDoc as Doc, FolioProject as Project, FolioState, ChapterNotesData } from "@/lib/folioStore";
import "./MyFiles.css";

type StatusKey = "draft" | "progress" | "done" | "edit";

// ── Novel Notes card types ────────────────────────────────────────────────────
// The `entries` field is polymorphic — timeline cards store `{date,text}` rows,
// relationship cards store `{name,type,strength}` rows. We type it loosely so
// the editor can read/write the shape each type expects without coercion.
type NNEntry = Record<string, string | number | null | undefined>;
interface NNCard {
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

const NN_CARD_GRADIENTS: Record<string, string> = {
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

// Convert a file (from <input type="file">) to a data URL so we can persist
// images in the same field NN uses — a base64 data URL on the card's `img`
// property. Same approach the Novel Notes triggerCharImg helper takes.
function fileToDataUrl(file: File): Promise<string | null> {
  return new Promise((resolve) => {
    const r = new FileReader();
    r.onload = () => resolve(typeof r.result === "string" ? r.result : null);
    r.onerror = () => resolve(null);
    r.readAsDataURL(file);
  });
}

// Minimalist outline icons used in card header controls — same Feather-style
// stroke as the rest of MyFiles so they sit in the design language. Kept
// here (not in Ico) so the SVGs travel with the card-stage code that uses them.
const StageIco = {
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

// ── Card stage: renders the exact Novel Notes card ───────────────────────────
// Same DOM structure and same CSS classes as NN's cardHTML() — so the card
// rendered here is visually identical to the one on the NN canvas. All inputs
// auto-save through `onChange(draft)` (debounced by the caller).
function NNCardStage({
  card, onChange, onClose, onDelete,
}: {
  card: NNCard;
  onChange: (patch: Partial<NNCard>) => void;
  onClose: () => void;
  onDelete?: () => void;
}) {
  // Tiny local helpers — match NN's row-mutation helpers (updateTimelineEntry,
  // addRuleItem, etc.) so the on-disk shape is identical.
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
  // Same close-button HTML NN uses, but routed through React.
  const closeBtn = (
    <button className="card-close" onClick={onClose} title="Close"><StageIco.Close /></button>
  );

  // ── CHARACTER (portrait card — matches NN's char-card / char-card-full) ──
  if (card.type === "char-card" || card.type === "char-card-full") {
    const baseCol = card.type === "char-card" ? "#7c5cbf" : "#5e4a9e";
    // The portrait region is one flex container holding the image/gradient as
    // its background, the top controls, a flexible spacer (preserves the
    // hero-image area), and the role / name / traits inputs at the bottom.
    // Growing the inputs grows the container, so they always stay inside the
    // gradient — no more name spilling onto a white background.
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
        {/* Detail strip beneath the portrait for full editing — same fields
            NN's expanded char modal exposes. Kept inside the same stage so
            users see the card AND its writable details without a second modal. */}
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

  // ── NOTE — clean writing card (matches NN's note-card-inner) ──
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

  // ── TABLE — point user at NN (grid editor too heavy to re-implement) ──
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

  // Fallback — type we haven't templated yet.
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

// ── Editor wrapper: keeps draft state + debounced auto-save ──────────────────
function NNCardEditor({
  initialCard, onSave, onCancel, onDelete,
}: {
  initialCard: NNCard;
  mode?: "create" | "edit";       // unused — kept for caller compat
  sectionLabel?: string;          // unused — kept for caller compat
  onSave: (card: NNCard) => void;
  onCancel: () => void;
  onDelete?: () => void;
}) {
  const [draft, setDraft] = useState<NNCard>(() => structuredClone(initialCard));
  // Debounced save: every change schedules a save 350ms later, and any further
  // change resets the timer. Mirrors how NN's saveNN() is called on every
  // input — eventually consistent without blocking the user.
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestRef = useRef(draft);
  latestRef.current = draft;
  useEffect(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => onSave(latestRef.current), 350);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [draft, onSave]);
  // Flush any pending save on unmount so closing immediately doesn't drop the
  // last keystrokes.
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

const NN_SECTIONS: { id: string; label: string }[] = [
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

// Card type catalog — mirrors CARD_TYPES in public/novel-notes.html so cards
// created from Folio look and behave exactly the same as cards created from
// the Novel Notes canvas. `defaultSection` is where new cards land unless the
// user picks a different section.
const NN_CARD_TYPES: {
  type: string; label: string; color: string; defaultSection: string;
}[] = [
  { type: "char-card",      label: "Character",       color: "#7c5cbf", defaultSection: "characters" },
  { type: "char-card-full", label: "Character (Full)", color: "#5e4a9e", defaultSection: "characters" },
  { type: "loc-card",       label: "Location",        color: "#2e7d5e", defaultSection: "locations" },
  { type: "note-card",      label: "Note",            color: "#3b6ea5", defaultSection: "notes"      },
  { type: "timeline-card",  label: "Timeline",        color: "#5a6ea0", defaultSection: "plot"       },
  { type: "rel-card",       label: "Relationship",    color: "#9c5c5c", defaultSection: "characters" },
  { type: "rule-card",      label: "World Rule",      color: "#4a7a6e", defaultSection: "world"      },
  { type: "item-card",      label: "Item / Artifact", color: "#7a5230", defaultSection: "items"      },
  { type: "lore-card",      label: "Lore Entry",      color: "#4a6e7a", defaultSection: "items"      },
  { type: "faction-card",   label: "Faction",         color: "#6e4a7a", defaultSection: "factions"   },
  { type: "faction-full",   label: "Faction (Full)",  color: "#4a2d5e", defaultSection: "factions"   },
  { type: "table-card",     label: "Table",           color: "#4a5568", defaultSection: "overview"   },
];

// Build a fresh card with the same shape as Novel Notes' makeCard().
// Keeping the field set identical is what lets the same card render in either
// surface — NovelNotes' canvas reads `name`/`title`/`role`/etc., so we must
// populate them with the same defaults.
function buildNNCard(type: string, name?: string): NNCard {
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
    // Some cards key off `name`, others off `title`; mirror the field that
    // makeCard chose so the picker and detail modal both display it.
    if ("name" in card) card.name = trimmed;
    else if ("title" in card) card.title = trimmed;
    else card.name = trimmed;
  }
  return card;
}

function idbFolioGet<T>(key: string): Promise<T | undefined> {
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

function idbFolioSet(key: string, value: unknown): Promise<void> {
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

type NNProject = { id: string; name: string; _nn?: Record<string, unknown> };

async function syncNNProject(id: string, name: string): Promise<void> {
  const existing = await idbFolioGet<NNProject[]>("nn_projects_v1") ?? [];
  const idx = existing.findIndex((p) => p.id === id);
  if (idx >= 0) {
    existing[idx] = { ...existing[idx], name };
  } else {
    existing.push({ id, name });
  }
  await idbFolioSet("nn_projects_v1", existing);
}

async function readNNProjects(): Promise<{ id: string; name: string }[]> {
  const direct = await idbFolioGet<{ id: string; name: string }[]>("nn_projects_v1");
  if (direct && direct.length) return direct;
  // Fall back to old location for users who haven't migrated yet
  const stored = await idbFolioGet<{ state?: { projects?: { id: string; name: string }[] } }>("folio_state");
  return (stored?.state?.projects ?? []).filter((p: { id: string; name: string } & { _nn?: unknown }) => p._nn);
}

interface RecentEntry {
  projectId: string;
  docId: string;
}

const STATUS: Record<StatusKey, { label: string; color: string }> = {
  draft: { label: "Draft", color: "var(--status-draft)" },
  progress: { label: "In Progress", color: "var(--status-progress)" },
  done: { label: "Done", color: "var(--status-done)" },
  edit: { label: "Needs Edit", color: "var(--status-edit)" },
};

const uid = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const wc = (t: string) =>
  t.trim() ? t.trim().split(/\s+/).length : 0;
const todayStr = () => new Date().toISOString().slice(0, 10);

const emptyChapterNotes = (): ChapterNotesData => ({
  summary: "", keyMoments: "", tags: [], notes: "", todos: [],
  pov: "", timeline: "", location: "", characters: "", themes: "",
});
const chNotesHaveContent = (n?: ChapterNotesData): boolean =>
  !!n && !!(n.summary || n.keyMoments || n.tags.length || n.notes || n.todos.length || n.pov || n.timeline || n.location || n.characters || n.themes);

// Apply per-paragraph inline styles for a given spacing mode.
function applyModeToPMyFiles(p: HTMLElement, mode: string): void {
  if (mode === "double") {
    p.style.lineHeight = "1.7";
    p.style.marginBottom = "28px";
    p.style.marginTop = "0";
  } else {
    p.style.lineHeight = "1.4";
    p.style.marginBottom = "0";
    p.style.marginTop = "0";
  }
}

function loadRecent(): RecentEntry[] {
  try {
    return JSON.parse(localStorage.getItem("folio_recent") || "[]");
  } catch {
    return [];
  }
}

// SVG icon shortcuts
const Ico = {
  Plus: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
  ),
  Chevron: () => (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
  ),
  Folder: () => (
    <svg className="folder-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" /></svg>
  ),
  FolderBig: () => (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" /></svg>
  ),
  Search: (props: { size?: number }) => (
    <svg width={props.size ?? 13} height={props.size ?? 13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
  ),
  Stats: () => (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></svg>
  ),
  Edit: () => (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
  ),
  Trash: () => (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /></svg>
  ),
  Close: () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
  ),
  Logo: () => (
    <span className="folio-logo-mark" aria-hidden="true">
      <span className="folio-logo-shine" />
      <svg width="20" height="20" viewBox="0 0 32 32" fill="none" style={{ position: "relative", zIndex: 2 }}>
        <defs>
          <linearGradient id="folio-bg" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#a78bfa" />
            <stop offset="50%" stopColor="#7c93d0" />
            <stop offset="100%" stopColor="#3b6ea5" />
          </linearGradient>
          <linearGradient id="folio-stroke" x1="9" y1="8" x2="23" y2="25" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="100%" stopColor="#dde7ff" />
          </linearGradient>
        </defs>
        <rect x="0" y="0" width="32" height="32" rx="9" fill="url(#folio-bg)" />
        <path d="M9 8h11.5A2.5 2.5 0 0 1 23 10.5v13.7a.8.8 0 0 1-1.18.7L17 22.4l-4.82 2.5a.8.8 0 0 1-1.18-.7V10A2 2 0 0 1 13 8" stroke="url(#folio-stroke)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" fill="rgba(255,255,255,0.10)" />
        <path d="M13 13h6M13 16h4" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" opacity="0.9" />
        <circle className="folio-logo-spark" cx="24.5" cy="7.5" r="1.6" fill="#fde68a" />
      </svg>
    </span>
  ),
  Focus: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3" /><path d="M21 8V5a2 2 0 0 0-2-2h-3" /><path d="M3 16v3a2 2 0 0 0 2 2h3" /><path d="M16 21h3a2 2 0 0 0 2-2v-3" /></svg>
  ),
  Download: () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
  ),
  Clock: () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
  ),
  Check: () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
  ),
  Recent: () => (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="12 8 12 12 14 14" /><path d="M3.05 11a9 9 0 1 0 .5-3" /></svg>
  ),

  // ── Toolbar / writing icons (Feather-style, monoline) ──
  Bold: () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/><path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/></svg>
  ),
  Italic: () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="4" x2="10" y2="4"/><line x1="14" y1="20" x2="5" y2="20"/><line x1="15" y1="4" x2="9" y2="20"/></svg>
  ),
  Underline: () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 3v7a6 6 0 0 0 12 0V3"/><line x1="4" y1="21" x2="20" y2="21"/></svg>
  ),
  Strike: () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 4H9a3 3 0 0 0-2.83 4"/><path d="M14 12a4 4 0 0 1 0 8H6"/><line x1="4" y1="12" x2="20" y2="12"/></svg>
  ),
  Quote: () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z"/><path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z"/></svg>
  ),
  ListBul: () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
  ),
  ListNum: () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="10" y1="6" x2="21" y2="6"/><line x1="10" y1="12" x2="21" y2="12"/><line x1="10" y1="18" x2="21" y2="18"/><path d="M4 6h1v4"/><path d="M4 10h2"/><path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"/></svg>
  ),
  Hr: () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"/></svg>
  ),
  Pilcrow: () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 4v16"/><path d="M17 4v16"/><path d="M19 4H9.5a4.5 4.5 0 0 0 0 9H13"/></svg>
  ),
  Checkbox: () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="3"/><polyline points="9 12 11 14 16 9"/></svg>
  ),
  Scene: () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></svg>
  ),
  Undo: () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-15-6.7L3 13"/></svg>
  ),
  Redo: () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 7v6h-6"/><path d="M3 17a9 9 0 0 1 15-6.7L21 13"/></svg>
  ),
  Link: () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
  ),
  ClearFmt: () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6V4H9L3 10l6 6h11v-2"/><line x1="12" y1="20" x2="20" y2="20"/><line x1="18" y1="14" x2="22" y2="18"/><line x1="22" y1="14" x2="18" y2="18"/></svg>
  ),
  TypeSize: () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg>
  ),
  Typewriter: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01M8 12h.01M12 12h.01M16 12h.01M7 16h10"/></svg>
  ),
  StickyNote: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 3v6h6"/><path d="M20 9v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8z"/></svg>
  ),
  Drag: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="16" y2="6" /><line x1="8" y1="12" x2="16" y2="12" /><line x1="8" y1="18" x2="16" y2="18" /></svg>
  ),
  Arrow: () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
  ),
  ChevL: () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
  ),
  ChevR: () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
  ),
};

function FolioLogoMenu({ onBack }: { onBack: () => void }) {
  return (
    <button className="topbar-logo" onClick={onBack} title="Back to home">
      <Ico.Logo /> Folio
    </button>
  );
}

export default function MyFiles() {
  const [, setLocation] = useLocation();
  const { state, setState, isOnline, isSyncing, conflicts, resolveConflict } = useFolio();
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [activeDocId, setActiveDocId] = useState<string | null>(null);
  const [recentDocs, setRecentDocs] = useState<RecentEntry[]>(() => loadRecent());
  const [globalSearch, setGlobalSearch] = useState("");
  const [statsOpen, setStatsOpen] = useState<Record<string, boolean>>({});
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);
  const [statusMenuPos, setStatusMenuPos] = useState({ top: 0, left: 0 });

  const authedFetch = useAuthedFetch();
  const [focusMode, setFocusMode] = useState(false);
  const [novelNotesOpen, setNovelNotesOpen] = useState(false);
  const [chNotesOpen, setChNotesOpen] = useState(false);
  const [cardsOpen, setCardsOpen] = useState(false);
  const [nnRawData, setNnRawData] = useState<Record<string, { cards: Record<string, NNCard[]> }> | null>(null);
  const [nnProjects, setNnProjects] = useState<{ id: string; name: string }[]>([]);
  const [nnSelPid, setNnSelPid] = useState<string | null>(null);
  const [nnLoading, setNnLoading] = useState(false);
  const [chNotesTab, setChNotesTab] = useState<"notes" | "todo" | "meta">("notes");
  const [chNotesDraft, setChNotesDraft] = useState<ChapterNotesData>(emptyChapterNotes);
  const [chNotesSaved, setChNotesSaved] = useState(false);
  const [chNotesTodoInput, setChNotesTodoInput] = useState("");

  // ── Folio Cards editor state ──────────────────────────────────────────────
  // `editorTarget` is null when the editor modal is closed. Two open modes:
  //   - { kind:'create' }: a fresh card; saved → appended to the section
  //   - { kind:'edit' }: an existing card from a known section; saved → replaced
  type EditorTarget =
    | { kind: "create"; sectionId: string; card: NNCard }
    | { kind: "edit";   sectionId: string; card: NNCard };
  const [editorTarget, setEditorTarget] = useState<EditorTarget | null>(null);
  // Type-picker popover (shown when user clicks "+ New" before the editor opens)
  const [typePickerOpen, setTypePickerOpen] = useState(false);

  // Pill-visibility tracking — when the user scrolls past the horizontal pill,
  // we render a compact vertical version on the left side of the editor. Uses
  // IntersectionObserver against the scrollable editor-body so it's accurate
  // whether the document grows by writing or by font/window resize.
  const pillRef = useRef<HTMLDivElement | null>(null);
  const [pillHidden, setPillHidden] = useState(false);
  // The IntersectionObserver setup lives in a later useEffect (after
  // `activeDoc` has been declared), since we re-bind whenever the active
  // chapter changes.

  // Apply a mutation to the per-section card list. The callback receives the
  // current cards array (always fresh from IDB) and returns its replacement.
  // This handles add, replace, and remove uniformly while preserving the
  // `__projects` blob and any other sections we don't touch.
  const mutateNNCards = useCallback(
    async (pid: string, sectionId: string, fn: (cards: NNCard[]) => NNCard[]) => {
      const current = (await idbFolioGet<Record<string, unknown>>("novel_notes_v1")) ?? {};
      const merged: Record<string, unknown> = { ...current };
      const proj = (merged[pid] as { sections?: Record<string, unknown>; cards?: Record<string, NNCard[]> } | undefined)
        ?? { sections: {}, cards: {} };
      const cardsMap: Record<string, NNCard[]> = { ...(proj.cards ?? {}) };
      cardsMap[sectionId] = fn(cardsMap[sectionId] ? [...cardsMap[sectionId]] : []);
      merged[pid] = { sections: proj.sections ?? {}, cards: cardsMap };

      await idbFolioSet("novel_notes_v1", merged);
      // Fire-and-forget mirror to server so NN sees the change on next load
      // and the change survives across devices.
      authedFetch("/api/novel-notes", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nnData: merged }),
      }).catch(() => {});
      setNnRawData(merged as Record<string, { cards: Record<string, NNCard[]> }>);
    },
    [authedFetch],
  );

  // Auto-save handler — upserts by id so it doesn't matter whether the editor
  // was opened in 'create' or 'edit' mode. First save inserts, subsequent
  // saves on the same id replace. Crucially this does NOT close the editor;
  // the user closes explicitly via the × on the card or the backdrop.
  const handleEditorSave = useCallback(
    async (saved: NNCard) => {
      if (!nnSelPid || !editorTarget) return;
      await mutateNNCards(nnSelPid, editorTarget.sectionId, (cards) => {
        const idx = cards.findIndex((c) => c.id === saved.id);
        if (idx === -1) return [...cards, saved];
        const next = cards.slice();
        next[idx] = saved;
        return next;
      });
    },
    [nnSelPid, editorTarget, mutateNNCards],
  );

  const handleEditorDelete = useCallback(async () => {
    if (!nnSelPid || !editorTarget) return;
    await mutateNNCards(nnSelPid, editorTarget.sectionId, (cards) =>
      cards.filter((c) => c.id !== editorTarget.card.id),
    );
    setEditorTarget(null);
  }, [nnSelPid, editorTarget, mutateNNCards]);

  // Type picker → open editor pre-filled with the makeCard() defaults for the
  // chosen type, placed into that type's natural section.
  const openCreatorForType = useCallback((type: string) => {
    const def = NN_CARD_TYPES.find((t) => t.type === type);
    const sectionId = def?.defaultSection ?? "overview";
    setEditorTarget({ kind: "create", sectionId, card: buildNNCard(type) });
    setTypePickerOpen(false);
  }, []);

  useEffect(() => {
    const close = () => setNovelNotesOpen(false);
    function onMessage(e: MessageEvent) {
      if (e.data?.type === "nn:back") close();
    }
    window.addEventListener("nn:back", close);
    window.addEventListener("message", onMessage);
    return () => {
      window.removeEventListener("nn:back", close);
      window.removeEventListener("message", onMessage);
    };
  }, []);
  // Esc exits focus mode — keeps the keyboard-only path consistent with the
  // exit chip in the top-right corner.
  useEffect(() => {
    if (!focusMode) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setFocusMode(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [focusMode]);
  // Reset chapter notes draft whenever the active doc changes
  useEffect(() => {
    if (!activeDocId) return;
    const saved = state.chapterNotes?.[activeDocId];
    setChNotesDraft(saved ? { ...emptyChapterNotes(), ...saved } : emptyChapterNotes());
    setChNotesSaved(false);
    setChNotesTodoInput("");
  // We intentionally only re-run on doc switch, not every state update
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDocId]);

  // Fetch Novel Notes data when the cards sidebar opens.
  // Reads from IndexedDB first (always current), falls back to server API.
  useEffect(() => {
    if (!cardsOpen) return;
    setNnLoading(true);
    Promise.all([
      idbFolioGet<Record<string, { cards: Record<string, NNCard[]> }>>("novel_notes_v1"),
      readNNProjects(),
      authedFetch("/api/novel-notes").then((r) => (r.ok ? r.json() : null)).catch(() => null),
    ]).then(([idbData, projects, apiRes]) => {
      const rawData = (idbData && Object.keys(idbData).length > 0)
        ? idbData
        : (apiRes?.nnData ?? {});
      setNnRawData(rawData);
      setNnProjects(projects);
      const match = projects.find((p: { id: string; name: string }) =>
        p.name.toLowerCase() === activeProject?.name?.toLowerCase()
      );
      const firstPid = Object.keys(rawData)[0] ?? null;
      setNnSelPid(match?.id ?? firstPid);
    }).finally(() => setNnLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardsOpen]);

  const [typewriterMode, setTypewriterMode] = useState(false);
  const [paragraphMode, setParagraphMode] = useState<"none" | "indent" | "double">("none");
  const [fontSize, setFontSize] = useState(() => parseInt(localStorage.getItem("folio_font_size") || "16", 10));
  const [saveStatus, setSaveStatus] = useState<"saved" | "unsaved" | "saving">("saved");

  // Daily goal
  const [dailyGoal, setDailyGoal] = useState<number>(() =>
    parseInt(localStorage.getItem("folio_daily_goal") || "500", 10),
  );
  const [dailyDate, setDailyDate] = useState<string>(
    () => localStorage.getItem("folio_daily_date") || todayStr(),
  );
  const [dailyWords, setDailyWords] = useState<number>(() => {
    const saved = parseInt(localStorage.getItem("folio_daily_words") || "0", 10);
    const stored = localStorage.getItem("folio_daily_date") || "";
    return stored !== todayStr() ? 0 : saved;
  });

  // Editor live values (uncontrolled-ish for performance).
  // Title stays a textarea (auto-grow). Content is now a contentEditable
  // <div> so bold/italic/underline render visually instead of leaving
  // raw markdown like **text** in the document.
  const titleRef = useRef<HTMLTextAreaElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  // Snapshot of the last-typed HTML + title. Updated on every scheduleAutosave
  // call so saveCurrentDoc can use it when the DOM refs are null (post-unmount).
  const editorSnapshotRef = useRef<{ html: string; title: string }>({ html: "", title: "" });
  // Pending content to load once the editor div is mounted. Set by openDoc,
  // consumed by the useEffect below — avoids the setTimeout(0) race where
  // the editor isn't in the DOM yet when the timer fires.
  const pendingLoadRef = useRef<{ content: string; title: string } | null>(null);
  // Incremented on every openDoc call so the load useEffect fires even when
  // activeDocId doesn't change (e.g. returning to the same chapter).
  const [openDocSeq, setOpenDocSeq] = useState(0);
  const [editorWordCount, setEditorWordCount] = useState(0);

  // Grammar check state
  const [ltEnabled, setLtEnabled] = useState<boolean>(() => {
    const stored = localStorage.getItem("folio_grammar_enabled");
    return stored === null ? true : stored === "true";
  });

  type LtStatus = "idle" | "checking" | number;
  interface LtMatch {
    message: string;
    offset: number;
    length: number;
    replacements: { value: string }[];
    rule: { issueType?: string };
    context: { text: string; offset: number; length: number };
  }
  const [ltStatus, setLtStatus] = useState<LtStatus>("idle");
  const [ltMatches, setLtMatches] = useState<LtMatch[]>([]);
  const [ltTooltip, setLtTooltip] = useState<{ match: LtMatch; x: number; y: number } | null>(null);
  const ltTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ltLastTextRef = useRef<string>("");
  const ltRequestIdRef = useRef(0);
  const ltTooltipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const applyingMarksRef = useRef(false);

  // Plain text from the editor (used for word count, find, sprint seed, save).
  const editorText = useCallback(
    (): string => contentRef.current?.innerText ?? "",
    [],
  );

  // We tag rich-text content saved by this editor with an explicit sentinel
  // so we never accidentally re-interpret legacy plain text (which might
  // contain stray "<" characters) as HTML on load.
  const RICH_PREFIX = "<!--folio:rich-->";

  // Defensive sanitizer for stored rich content: strip <script>/<style>
  // blocks and on* event-handler attributes that could re-introduce XSS
  // if a malicious paste ever made it into a saved doc before sanitation
  // was tightened. We still also sanitize on paste below.
  const sanitizeStoredHtml = (html: string): string => {
    return html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, "")
      .replace(/\son[a-z]+\s*=\s*'[^']*'/gi, "")
      .replace(/javascript:/gi, "");
  };

  // Decode any stored doc.content (rich or legacy plain) to plain text.
  // Used by everything that needs human-readable text rather than HTML:
  // word counts, project search, compile/export, sprint seed text. Keeps
  // these flows correct after the contentEditable migration so users
  // never see "<!--folio:rich-->" or raw <b>/<i>/<p> tags in exports
  // or inflated word counts from HTML markup.
  const docPlainText = useCallback((raw: string | undefined): string => {
    if (!raw) return "";
    if (!raw.startsWith(RICH_PREFIX)) return raw;
    const html = sanitizeStoredHtml(raw.slice(RICH_PREFIX.length));
    const tmp = document.createElement("div");
    tmp.innerHTML = html;
    // Preserve paragraph/line breaks roughly: convert block-level closers
    // and <br> to newlines so word counting and exports behave sensibly.
    return (tmp.innerText || tmp.textContent || "").replace(/\u00a0/g, " ");
  }, []);

  const loadEditorContent = useCallback((raw: string) => {
    const div = contentRef.current;
    if (!div) return;
    try { document.execCommand("defaultParagraphSeparator", false, "p"); } catch { /* ignore */ }
    if (!raw) {
      div.innerHTML = "<p><br></p>";
    } else if (raw.startsWith(RICH_PREFIX)) {
      const html = sanitizeStoredHtml(raw.slice(RICH_PREFIX.length));
      // Convert legacy <br>-based content to <p> elements; leave <p>-based as-is
      div.innerHTML = html.includes("<p")
        ? html
        : html.split(/<br\s*\/?>/gi).map(s => `<p>${s || "<br>"}</p>`).join("");
    } else {
      // Legacy plain text: wrap lines in <p> elements
      div.innerHTML = raw.split(/\n/g).map(s => `<p>${s || "<br>"}</p>`).join("");
    }
  }, []);

  // Find bar
  const [findOpen, setFindOpen] = useState(false);
  const [findQuery, setFindQuery] = useState("");
  const findInputRef = useRef<HTMLInputElement | null>(null);
  const findMatchesRef = useRef<number[]>([]);
  const findCurrentRef = useRef(-1);
  const [matchCount, setMatchCount] = useState("");

  // Modals
  const [projectModal, setProjectModal] = useState<{ open: boolean; editingId: string | null; name: string }>({ open: false, editingId: null, name: "" });
  const [docModal, setDocModal] = useState<{ open: boolean; projectId: string | null; editingId: string | null; name: string; status: StatusKey }>({ open: false, projectId: null, editingId: null, name: "", status: "draft" });
  const [confirmModal, setConfirmModal] = useState<{ open: boolean; title: string; text: string; action: null | (() => void) }>({ open: false, title: "", text: "", action: null });
  const [dailyGoalModal, setDailyGoalModal] = useState<{ open: boolean; value: string }>({ open: false, value: "" });
  const [compileModal, setCompileModal] = useState<{ open: boolean; projectId: string; format: "txt" | "md"; checked: Record<string, boolean>; order: string[] }>({ open: false, projectId: "", format: "txt", checked: {}, order: [] });
  const [sprintModal, setSprintModal] = useState(false);
  const [stickyOpen, setStickyOpen] = useState(false);
  // Per-project in-folder search query. Empty string means panel is closed.
  const [projSearch, setProjSearch] = useState<Record<string, string>>({});
  const [projSearchOpen, setProjSearchOpen] = useState<Record<string, boolean>>({});

  // Home / app-picker screen — three reasons we DON'T show it:
  //   1) coming back from Novel Notes "Back to Folio" (sessionStorage flag)
  //   2) the user was in a chapter last time and just refreshed — we restore
  //      them straight back into that chapter (localStorage `folio_last_doc`)
  // Otherwise the home picker is the landing screen.
  const [homeView, setHomeView] = useState(() => {
    const skip = sessionStorage.getItem("mf_skip_home");
    if (skip) { sessionStorage.removeItem("mf_skip_home"); return false; }
    try {
      const last = localStorage.getItem("folio_last_doc");
      if (last) {
        const parsed = JSON.parse(last) as { projectId?: string; docId?: string };
        if (parsed.projectId && parsed.docId) return false;
      }
    } catch { /* ignore corrupt JSON */ }
    return true;
  });

  // Re-open the user's last chapter once project data has loaded. We can't do
  // this in the initial render because state.projects starts empty and is
  // populated asynchronously by useFolio() (from IndexedDB / server). This
  // effect waits for projects to arrive, then calls openDoc once to restore
  // the editor. Guarded so it only runs at most once per mount.
  const restoredLastDocRef = useRef(false);
  useEffect(() => {
    if (restoredLastDocRef.current) return;
    if (homeView) return; // user is on the picker, nothing to restore
    if (activeDocId) { restoredLastDocRef.current = true; return; }
    if (!state.projects.length) return; // wait for data
    try {
      const last = localStorage.getItem("folio_last_doc");
      if (!last) { restoredLastDocRef.current = true; return; }
      const parsed = JSON.parse(last) as { projectId?: string; docId?: string };
      const proj = state.projects.find((p) => p.id === parsed.projectId);
      const doc = proj?.docs.find((d) => d.id === parsed.docId);
      if (proj && doc) {
        openDoc(proj.id, doc.id);
      } else {
        // The saved chapter no longer exists — fall back to the home picker
        // rather than leaving the editor stuck on a blank state.
        setHomeView(true);
      }
    } catch { /* ignore */ }
    restoredLastDocRef.current = true;
  // openDoc is a closure over latest state; safe to omit from deps.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.projects, homeView, activeDocId]);

  // Persist the active chapter so a refresh keeps the user where they were.
  // Cleared when they go back to the home picker (handled in the back handler).
  useEffect(() => {
    if (activeProjectId && activeDocId) {
      try {
        localStorage.setItem("folio_last_doc", JSON.stringify({ projectId: activeProjectId, docId: activeDocId }));
      } catch { /* ignore quota errors */ }
    }
  }, [activeProjectId, activeDocId]);

  // Drag-and-drop chapter reordering
  const dragDocRef = useRef<{ docId: string; projectId: string } | null>(null);
  const [dragOverDocId, setDragOverDocId] = useState<string | null>(null);

  // Toast
  const [toastMsg, setToastMsg] = useState("");
  const [toastShow, setToastShow] = useState(false);

  // ── Persistence ─────────────────────────────────────────
  useEffect(() => {
    localStorage.setItem("folio_recent", JSON.stringify(recentDocs));
  }, [recentDocs]);
  useEffect(() => {
    localStorage.setItem("daily_goal", String(dailyGoal));
  }, [dailyGoal]);
  useEffect(() => {
    localStorage.setItem("folio_daily_words", String(dailyWords));
    localStorage.setItem("folio_daily_date", dailyDate);
  }, [dailyWords, dailyDate]);

  // Reset daily count at midnight (on mount only; cheap)
  useEffect(() => {
    if (dailyDate !== todayStr()) {
      setDailyDate(todayStr());
      setDailyWords(0);
    }
  }, [dailyDate]);

  // ── Helpers ─────────────────────────────────────────────
  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    setToastShow(true);
    setTimeout(() => setToastShow(false), 2200);
  }, []);

  const activeDoc = useMemo(() => {
    if (!activeProjectId || !activeDocId) return null;
    const proj = state.projects.find((p) => p.id === activeProjectId);
    return proj?.docs.find((d) => d.id === activeDocId) || null;
  }, [state, activeProjectId, activeDocId]);

  const activeProject = useMemo(() => {
    if (!activeProjectId) return null;
    return state.projects.find((p) => p.id === activeProjectId) || null;
  }, [state, activeProjectId]);

  // Track when the horizontal controls pill scrolls out of view inside the
  // editor body — that's the signal to swap in the vertical companion.
  useEffect(() => {
    if (!activeDoc) { setPillHidden(false); return; }
    // The pill is rendered the same tick the editor mounts; give React one
    // microtask to attach the ref before we start observing.
    let cancelled = false;
    const start = () => {
      if (cancelled) return;
      const node = pillRef.current;
      const scroller = document.getElementById("folio-editor-body");
      if (!node || !scroller) {
        // Retry on the next frame in case the editor is still mounting.
        requestAnimationFrame(start);
        return;
      }
      const io = new IntersectionObserver(
        (entries) => {
          const e = entries[0];
          setPillHidden(!e.isIntersecting || e.intersectionRatio < 0.2);
        },
        { root: scroller, threshold: [0, 0.2, 1] },
      );
      io.observe(node);
      cleanup = () => io.disconnect();
    };
    let cleanup: (() => void) | null = null;
    start();
    return () => { cancelled = true; cleanup?.(); };
  }, [activeDoc]);

  // Save current editor draft into state (called by autosave & navigation)
  const prevWordsRef = useRef(0);
  const saveCurrentDoc = useCallback(() => {
    if (!activeProjectId || !activeDocId) return;

    // Prefer live DOM; fall back to editorSnapshotRef when DOM refs are null
    // (e.g. called from unmount cleanup or visibilitychange after unmount).
    const titleVal = titleRef.current?.value
      ?? editorSnapshotRef.current.title
      ?? "";

    const stripMarks = (el: HTMLElement): string => {
      // Both LanguageTool (.lt-mark) and global-search (mark.search-flash)
      // wrap text nodes for visual purposes — never persist them on save.
      el.querySelectorAll(".lt-mark, mark.search-flash").forEach((mark) => {
        const p = mark.parentNode!;
        while (mark.firstChild) p.insertBefore(mark.firstChild, mark);
        p.removeChild(mark);
      });
      return el.innerHTML;
    };

    const html = (() => {
      const div = contentRef.current;
      const snap = editorSnapshotRef.current.html;
      if (div) {
        const liveHtml = stripMarks(div.cloneNode(true) as HTMLElement);
        // If the live DOM is empty or just the auto-focus placeholder but
        // the snapshot has real content, the editor remounted without its
        // content yet (e.g. back-to-home then return). Use the snapshot so
        // we don't overwrite the user's work with a blank paragraph.
        if ((!liveHtml || liveHtml === "<p><br></p>") && snap) {
          const tmp = document.createElement("div");
          tmp.innerHTML = snap;
          return stripMarks(tmp);
        }
        return liveHtml;
      }
      // DOM is gone — use the snapshot captured before unmount.
      if (!snap) return null; // No snapshot → nothing new to save; bail out.
      const tmp = document.createElement("div");
      tmp.innerHTML = snap;
      return stripMarks(tmp);
    })();

    // Guard: never overwrite persisted content with an empty string.
    if (html === null) return;

    const contentVal = html ? RICH_PREFIX + html : "";
    const contentPlain = contentRef.current?.innerText || "";
    const newWC = wc(titleVal + " " + contentPlain);
    const oldWC = prevWordsRef.current;
    const gained = Math.max(0, newWC - oldWC);
    prevWordsRef.current = newWC;

    setState((prev) => {
      const existingDoc = prev.projects
        .find((p) => p.id === activeProjectId)
        ?.docs.find((d) => d.id === activeDocId);
      // Never overwrite real content with an empty or default-empty value.
      // The freshly-mounted editor starts as "" and auto-focus injects
      // "<p><br></p>" before loadEditorContent runs — both must be blocked.
      const RICH_EMPTY = RICH_PREFIX + "<p><br></p>";
      const isEffectivelyEmpty = !contentVal || contentVal === RICH_EMPTY;
      const existingHasContent = !!existingDoc?.content && existingDoc.content !== RICH_EMPTY;
      if (isEffectivelyEmpty && existingHasContent) return prev;
      return {
        projects: prev.projects.map((p) =>
          p.id !== activeProjectId
            ? p
            : {
                ...p,
                docs: p.docs.map((d) =>
                  d.id !== activeDocId
                    ? d
                    : {
                        ...d,
                        name: titleVal.trim() || d.name,
                        content: contentVal,
                        updatedAt: Date.now(),
                      },
                ),
              },
        ),
      };
    });
    if (gained > 0) {
      setDailyWords((w) => {
        const newTotal = w + gained;
        if (dailyGoal && w < dailyGoal && newTotal >= dailyGoal) {
          showToast("Daily goal reached! 🎉");
        }
        return newTotal;
      });
    }
  }, [activeProjectId, activeDocId, dailyGoal, showToast]);

  const saveChapterNotes = useCallback(() => {
    if (!activeDocId) return;
    setState((prev) => ({
      ...prev,
      chapterNotes: { ...(prev.chapterNotes ?? {}), [activeDocId]: chNotesDraft },
    }));
    setChNotesSaved(true);
    setTimeout(() => setChNotesSaved(false), 2000);
  }, [activeDocId, chNotesDraft, setState]);

  // Always-current refs so effects with stable deps always call fresh code.
  const saveCurrentDocRef = useRef<() => void>(() => {});
  const saveChapterNotesRef = useRef<() => void>(() => {});
  const chNotesAutosaveTimer = useRef<number | null>(null);

  // Autosave debounce
  const autosaveTimer = useRef<number | null>(null);
  const scheduleAutosave = useCallback(() => {
    setSaveStatus("unsaved");
    // Keep a synchronous snapshot so unmount / visibility saves work even
    // after contentRef and titleRef are nullified by React on unmount.
    if (contentRef.current) editorSnapshotRef.current.html = contentRef.current.innerHTML;
    if (titleRef.current) editorSnapshotRef.current.title = titleRef.current.value;
    if (autosaveTimer.current) window.clearTimeout(autosaveTimer.current);
    autosaveTimer.current = window.setTimeout(() => {
      setSaveStatus("saving");
      saveCurrentDoc();
      setSaveStatus("saved");
    }, 800);
  }, [saveCurrentDoc]);

  // Keep refs pointing at the latest versions so effects with stable deps
  // (unmount cleanup, visibilitychange) always call fresh code.
  useEffect(() => {
    saveCurrentDocRef.current = saveCurrentDoc;
  }, [saveCurrentDoc]);

  useEffect(() => {
    saveChapterNotesRef.current = saveChapterNotes;
  }, [saveChapterNotes]);

  // Load content after openDoc sets activeDocId. Using useEffect guarantees
  // contentRef.current exists because effects run after React commits the DOM.
  // The old setTimeout(0) approach fired before the editor div was mounted.
  useEffect(() => {
    const pending = pendingLoadRef.current;
    if (!pending) return;
    pendingLoadRef.current = null;

    const div = contentRef.current;
    if (!div) return; // editor not yet in DOM (shouldn't happen, but bail safely)

    if (titleRef.current) {
      titleRef.current.value = pending.title;
      autoResize(titleRef.current);
    }
    loadEditorContent(pending.content);
    prevWordsRef.current = wc(pending.title + " " + (div.innerText || docPlainText(pending.content)));
    updateWordCount();
    div.focus();
    setLtStatus("idle");
    setLtMatches([]);
    setLtTooltip(null);
    clearMarks();
    ltLastTextRef.current = "";
    editorSnapshotRef.current = { html: "", title: pending.title };

    // If we arrived here via a global-search result, wrap every occurrence
    // of the query in <mark class="search-flash"> so the user can see
    // exactly where the hits are, then scroll the first one into view.
    // Marks are cleared automatically after a few seconds.
    const flashQuery = pendingSearchHighlightRef.current;
    if (flashQuery) {
      pendingSearchHighlightRef.current = null;
      const marks = wrapSearchMatches(div, flashQuery);
      if (marks.length > 0) {
        marks[0].scrollIntoView({ block: "center", behavior: "smooth" });
      }
      if (searchFlashTimerRef.current) clearTimeout(searchFlashTimerRef.current);
      searchFlashTimerRef.current = setTimeout(() => clearSearchFlash(), 6000);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDocId, activeProjectId, openDocSeq]);

  // Auto-save chapter notes 800ms after the user stops editing them.
  // Also flushes synchronously on all emergency-save paths below.
  useEffect(() => {
    if (chNotesAutosaveTimer.current) window.clearTimeout(chNotesAutosaveTimer.current);
    chNotesAutosaveTimer.current = window.setTimeout(() => {
      saveChapterNotesRef.current();
    }, 800);
    return () => {
      if (chNotesAutosaveTimer.current) window.clearTimeout(chNotesAutosaveTimer.current);
    };
  }, [chNotesDraft, activeDocId]);

  const updateWordCount = useCallback(() => {
    const t = (titleRef.current?.value || "") + " " + (contentRef.current?.innerText || "");
    setEditorWordCount(wc(t));
  }, []);

  // Remove all lt-mark spans from the contentEditable, restoring plain text nodes.
  const clearMarks = useCallback(() => {
    const div = contentRef.current;
    if (!div) return;
    div.querySelectorAll(".lt-mark").forEach((mark) => {
      const p = mark.parentNode;
      if (!p) return;
      while (mark.firstChild) p.insertBefore(mark.firstChild, mark);
      p.removeChild(mark);
    });
    div.normalize();
  }, []);

  // Wrap each match's text in a <mark> span for inline highlighting.
  const applyMarks = useCallback((matches: LtMatch[]) => {
    const div = contentRef.current;
    if (!div) return;
    applyingMarksRef.current = true;
    clearMarks();

    // Walk text nodes accumulating absolute character positions.
    // Skips text already inside .lt-mark nodes (safe for re-entry).
    const findPos = (targetOffset: number): { node: Text; offset: number } | null => {
      const walker = document.createTreeWalker(div, NodeFilter.SHOW_TEXT);
      let accumulated = 0;
      let node: Text | null;
      while ((node = walker.nextNode() as Text | null)) {
        if ((node.parentElement as HTMLElement)?.classList.contains("lt-mark")) continue;
        const len = (node.textContent ?? "").length;
        if (accumulated + len > targetOffset) {
          return { node, offset: targetOffset - accumulated };
        }
        accumulated += len;
      }
      return null;
    };

    // Process in reverse offset order so later insertions don't shift earlier positions.
    const sorted = [...matches].sort((a, b) => b.offset - a.offset);
    for (const m of sorted) {
      if (!ltLastTextRef.current.substring(m.offset, m.offset + m.length).trim()) continue;
      const startPos = findPos(m.offset);
      const endPos   = findPos(m.offset + m.length);
      if (!startPos || !endPos) continue;
      const mark = document.createElement("mark");
      mark.className = `lt-mark ${m.rule.issueType === "misspelling" ? "lt-spell" : "lt-gram"}`;
      mark.dataset.ltOffset = String(m.offset);
      mark.dataset.ltLength = String(m.length);
      try {
        const range = document.createRange();
        range.setStart(startPos.node, startPos.offset);
        range.setEnd(endPos.node, endPos.offset);
        range.surroundContents(mark);
      } catch { /* range crosses element boundary — skip */ }
    }
    applyingMarksRef.current = false;
  }, [clearMarks]);

  useEffect(() => {
    localStorage.setItem("folio_grammar_enabled", String(ltEnabled));
    if (!ltEnabled) {
      if (ltTimerRef.current) clearTimeout(ltTimerRef.current);
      setLtStatus("idle");
      setLtMatches([]);
      setLtTooltip(null);
      clearMarks();
      ltLastTextRef.current = "";
    }
  }, [ltEnabled, clearMarks]);

  const scheduleGrammarCheck = useCallback(() => {
    if (!ltEnabled) return;
    if (ltTimerRef.current) clearTimeout(ltTimerRef.current);
    ltTimerRef.current = setTimeout(async () => {
      const text = contentRef.current?.innerText ?? "";
      if (text === ltLastTextRef.current) return;
      ltLastTextRef.current = text;
      if (!text.trim() || text.length < 15) { setLtStatus("idle"); setLtMatches([]); clearMarks(); return; }
      setLtStatus("checking");
      const reqId = ++ltRequestIdRef.current;
      try {
        const res = await fetch("https://api.languagetool.org/v2/check", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ text, language: "en-US" }).toString(),
        });
        if (ltRequestIdRef.current !== reqId) return;
        if (!res.ok) { setLtStatus("idle"); return; }
        const data = await res.json();
        if (ltRequestIdRef.current !== reqId) return;
        const matches = data.matches ?? [];
        setLtMatches(matches);
        setLtStatus(matches.length);
        applyMarks(matches);
      } catch {
        if (ltRequestIdRef.current === reqId) setLtStatus("idle");
      }
    }, 1600);
  }, [ltEnabled, clearMarks, applyMarks]);

  // Replace the marked text with the chosen suggestion, then re-check.
  const applyFixMark = useCallback((offset: number, length: number, replacement: string) => {
    const div = contentRef.current;
    if (!div) return;
    const mark = div.querySelector(`.lt-mark[data-lt-offset="${offset}"][data-lt-length="${length}"]`);
    if (mark?.parentNode) {
      mark.parentNode.replaceChild(document.createTextNode(replacement), mark);
      div.normalize();
    }
    scheduleAutosave();
    updateWordCount();
    ltLastTextRef.current = "";
    scheduleGrammarCheck();
  }, [scheduleGrammarCheck, scheduleAutosave, updateWordCount]);

  // Remove a single mark without fixing — leaves original text intact.
  const ignoreMark = useCallback((offset: number, length: number) => {
    const div = contentRef.current;
    if (!div) return;
    const mark = div.querySelector(`.lt-mark[data-lt-offset="${offset}"][data-lt-length="${length}"]`);
    if (mark?.parentNode) {
      while (mark.firstChild) mark.parentNode.insertBefore(mark.firstChild, mark);
      mark.parentNode.removeChild(mark);
      div.normalize();
    }
    setLtMatches((prev) => prev.filter((m) => !(m.offset === offset && m.length === length)));
    setLtStatus((prev) => (typeof prev === "number" ? Math.max(0, prev - 1) : prev));
  }, []);

  const autoResize = (el: HTMLTextAreaElement | null) => {
    if (!el) return;
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  };

  // ── Doc / Project actions ───────────────────────────────
  const openDoc = (projId: string, docId: string) => {
    // Cancel pending debounced saves BEFORE flushing — otherwise timers fire
    // after the DOM switches to the new doc and corrupt the old chapter.
    if (autosaveTimer.current) {
      window.clearTimeout(autosaveTimer.current);
      autosaveTimer.current = null;
    }
    if (chNotesAutosaveTimer.current) {
      window.clearTimeout(chNotesAutosaveTimer.current);
      chNotesAutosaveTimer.current = null;
    }
    if (activeDocId) saveCurrentDoc();
    saveChapterNotesRef.current();
    // Read from the live store after saving — the React `state` closure is
    // from the previous render and won't reflect content just flushed from
    // the snapshot (e.g. after back-to-home-and-return).
    const freshState = folioStore.getState();
    const proj = freshState.projects.find((p) => p.id === projId);
    const doc = proj?.docs.find((d) => d.id === docId);
    if (!proj || !doc) return;
    setActiveProjectId(projId);
    setActiveDocId(docId);
    setState((prev) => ({
      projects: prev.projects.map((p) => (p.id === projId ? { ...p, open: true } : p)),
    }));
    setRecentDocs((prev) => {
      const filtered = prev.filter((r) => r.docId !== docId);
      return [{ projectId: projId, docId }, ...filtered].slice(0, 6);
    });
    // Store what to load — the useEffect below picks this up after React
    // has committed the render and the editor div is guaranteed to exist.
    pendingLoadRef.current = { content: doc.content, title: doc.name };
    setOpenDocSeq((n) => n + 1); // ensures useEffect fires even for same docId
    setFindOpen(false);
  };

  const toggleFolder = (projId: string) => {
    setState((prev) => ({
      projects: prev.projects.map((p) => (p.id === projId ? { ...p, open: !p.open } : p)),
    }));
  };

  const setDocStatus = (status: StatusKey) => {
    if (!activeProjectId || !activeDocId) return;
    setState((prev) => ({
      projects: prev.projects.map((p) =>
        p.id !== activeProjectId
          ? p
          : { ...p, docs: p.docs.map((d) => (d.id !== activeDocId ? d : { ...d, status, updatedAt: Date.now() })) },
      ),
    }));
    setStatusMenuOpen(false);
  };

  // Manual save
  const manualSave = () => {
    if (autosaveTimer.current) {
      window.clearTimeout(autosaveTimer.current);
      autosaveTimer.current = null;
    }
    saveCurrentDoc();
    setSaveStatus("saved");
    showToast("Saved");
  };

  // ── Find in doc ─────────────────────────────────────────
  // We match against the editor's *textContent* (concatenation of every text
  // node) so the offsets line up exactly with the TreeWalker we use to
  // build a Range during navigation. innerText would inject layout
  // newlines that don't correspond to any actual text node, throwing off
  // the index math.
  const escRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // Track the query length used for the current match set, so navigation
  // doesn't depend on stale React state from setFindQuery.
  const findQueryLenRef = useRef(0);
  const findInDoc = (q: string) => {
    setFindQuery(q);
    findMatchesRef.current = [];
    findCurrentRef.current = -1;
    findQueryLenRef.current = q.length;
    if (!q || !contentRef.current) {
      setMatchCount("");
      return;
    }
    const re = new RegExp(escRe(q), "gi");
    const c = contentRef.current.textContent ?? "";
    let m: RegExpExecArray | null;
    while ((m = re.exec(c)) !== null) findMatchesRef.current.push(m.index);
    if (!findMatchesRef.current.length) {
      setMatchCount("No matches");
      return;
    }
    findCurrentRef.current = 0;
    setMatchCount(`1 of ${findMatchesRef.current.length}`);
    scrollToMatch();
  };
  const selectPlainTextRange = (root: HTMLElement, start: number, length: number) => {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let acc = 0;
    let startNode: Node | null = null, endNode: Node | null = null;
    let startOff = 0, endOff = 0;
    let n: Node | null = walker.nextNode();
    while (n) {
      const len = (n.nodeValue ?? "").length;
      if (!startNode && acc + len > start) {
        startNode = n;
        startOff = start - acc;
      }
      if (startNode && acc + len >= start + length) {
        endNode = n;
        endOff = (start + length) - acc;
        break;
      }
      acc += len;
      n = walker.nextNode();
    }
    if (!startNode || !endNode) return null;
    const r = document.createRange();
    r.setStart(startNode, startOff);
    r.setEnd(endNode, endOff);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(r);
    return r;
  };
  const scrollToMatch = () => {
    const div = contentRef.current;
    const idx = findMatchesRef.current[findCurrentRef.current];
    if (!div || idx === undefined) return;
    div.focus();
    // Use the ref so the very first findInDoc → scrollToMatch call has the
    // correct length even before React has flushed setFindQuery.
    const r = selectPlainTextRange(div, idx, findQueryLenRef.current);
    const target = r?.startContainer.parentElement ?? div;
    target.scrollIntoView({ block: "center", behavior: "smooth" });
  };
  const navMatch = (dir: number) => {
    if (!findMatchesRef.current.length) return;
    const len = findMatchesRef.current.length;
    findCurrentRef.current = (findCurrentRef.current + dir + len) % len;
    setMatchCount(`${findCurrentRef.current + 1} of ${len}`);
    scrollToMatch();
  };
  const closeFindBar = () => {
    setFindOpen(false);
    setFindQuery("");
    setMatchCount("");
    findMatchesRef.current = [];
    findCurrentRef.current = -1;
  };

  // ── Search-flash highlight (used by global search results) ──────────────
  // Wraps every plain-text occurrence of `query` inside `root` with a
  // <mark class="search-flash"> element. The CSS animates the mark with a
  // pulsing yellow background. Returns the wrappers so the caller can scroll
  // the first one into view or clear them on a timeout. Critically, these
  // marks live ONLY in the live DOM — stripMarks() above filters them out
  // before saving so they never end up on disk.
  const wrapSearchMatches = useCallback((root: HTMLElement, query: string) => {
    const wrappers: HTMLElement[] = [];
    if (!query) return wrappers;
    const re = new RegExp(escRe(query), "gi");
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes: Text[] = [];
    let n: Node | null = walker.nextNode();
    while (n) {
      // Skip if already inside a mark (don't double-wrap)
      const p = (n as Text).parentElement;
      if (!p?.closest(".lt-mark, mark.search-flash")) nodes.push(n as Text);
      n = walker.nextNode();
    }
    for (const tn of nodes) {
      const text = tn.nodeValue ?? "";
      if (!text) continue;
      re.lastIndex = 0;
      const hits: { s: number; e: number }[] = [];
      let m: RegExpExecArray | null;
      while ((m = re.exec(text)) !== null) {
        hits.push({ s: m.index, e: m.index + m[0].length });
        if (m[0].length === 0) re.lastIndex++;
      }
      if (!hits.length) continue;
      const parent = tn.parentNode;
      if (!parent) continue;
      const frag = document.createDocumentFragment();
      let cursor = 0;
      for (const { s, e } of hits) {
        if (s > cursor) frag.appendChild(document.createTextNode(text.slice(cursor, s)));
        const mark = document.createElement("mark");
        mark.className = "search-flash";
        mark.textContent = text.slice(s, e);
        frag.appendChild(mark);
        wrappers.push(mark);
        cursor = e;
      }
      if (cursor < text.length) frag.appendChild(document.createTextNode(text.slice(cursor)));
      parent.replaceChild(frag, tn);
    }
    return wrappers;
  }, []);

  const clearSearchFlash = useCallback(() => {
    const div = contentRef.current;
    if (!div) return;
    div.querySelectorAll("mark.search-flash").forEach((mark) => {
      const p = mark.parentNode;
      if (!p) return;
      while (mark.firstChild) p.insertBefore(mark.firstChild, mark);
      p.removeChild(mark);
    });
    div.normalize();
  }, []);

  // When a global-search result is clicked we queue the query here; the
  // editor-load effect picks it up after the new doc's content mounts and
  // runs wrapSearchMatches + scrolls the first hit into view.
  const pendingSearchHighlightRef = useRef<string | null>(null);
  const searchFlashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Toolbar editor helpers ──────────────────────────────
  // The folio editor is a contentEditable div. We use the well-supported
  // execCommand API for rich-text formatting so users see real
  // bold/italic/underline instead of literal markdown characters.
  // Force styleWithCSS=false so bold/italic emit semantic <b>/<i>/<u>
  // tags rather than <span style="..."> wrappers (cleaner storage and
  // simpler to detect/parse).
  let _styleWithCssApplied = false;
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  const exec = (cmd: string, val?: string) => {
    if (!_styleWithCssApplied) {
      try { /* eslint-disable-next-line @typescript-eslint/no-deprecated */
        document.execCommand("styleWithCSS", false, "false");
      } catch { /* ignore */ }
      _styleWithCssApplied = true;
    }
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    return document.execCommand(cmd, false, val);
  };

  // Toolbar buttons take focus on mousedown, which can collapse the editor's
  // selection before our click handler runs. We continuously snapshot the
  // last in-editor selection via a global selectionchange listener so that,
  // however the toolbar button is invoked (real mouse, keyboard, scripted
  // click), runFormat() always has the user's most recent editor selection
  // to restore before calling execCommand.
  const savedRangeRef = useRef<Range | null>(null);
  // Live readout of which inline formats apply at the current cursor, so the
  // toolbar buttons can light up (B / I / U / S) and the paragraph dropdown
  // can reflect the current block.
  type ActiveFormats = { bold: boolean; italic: boolean; underline: boolean; strike: boolean; block: string };
  const [activeFormats, setActiveFormats] = useState<ActiveFormats>({
    bold: false, italic: false, underline: false, strike: false, block: "p",
  });
  useEffect(() => {
    const onSelectionChange = () => {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;
      const r = sel.getRangeAt(0);
      const div = contentRef.current;
      if (!div) return;
      if (!div.contains(r.startContainer) || !div.contains(r.endContainer)) return;
      savedRangeRef.current = r.cloneRange();
      // Read live format state from the browser. queryCommandState/Value are
      // legacy but still the cheapest way to mirror the active inline marks
      // back into the toolbar without re-implementing the parser.
      try {
        /* eslint-disable @typescript-eslint/no-deprecated */
        const block = (document.queryCommandValue("formatBlock") || "p").toString().toLowerCase();
        setActiveFormats({
          bold: document.queryCommandState("bold"),
          italic: document.queryCommandState("italic"),
          underline: document.queryCommandState("underline"),
          strike: document.queryCommandState("strikeThrough"),
          // queryCommandValue returns things like "h1", "h2", "p", or
          // sometimes "" for the default — normalize to a known set so the
          // <select> binding works cleanly.
          block: /^h[123]$/.test(block) ? block : "p",
        });
        /* eslint-enable @typescript-eslint/no-deprecated */
      } catch { /* ignore */ }
    };
    document.addEventListener("selectionchange", onSelectionChange);
    return () => document.removeEventListener("selectionchange", onSelectionChange);
  }, []);
  const restoreSelection = () => {
    const div = contentRef.current;
    const saved = savedRangeRef.current;
    if (!div) return;
    div.focus();
    if (!saved) return;
    const sel = window.getSelection();
    if (!sel) return;
    sel.removeAllRanges();
    sel.addRange(saved);
  };
  const runFormat = (cmd: string, val?: string) => {
    restoreSelection();
    exec(cmd, val);
    scheduleAutosave();
    updateWordCount();
  };
  const wrapText = (before: string, _after: string) => {
    // Map legacy markdown wrappers to real rich-text commands.
    if (before === "**") runFormat("bold");
    else if (before === "_") runFormat("italic");
    else if (before === "__") runFormat("underline");
    else if (before === "~~") runFormat("strikeThrough");
  };
  const insertAtCursor = (text: string) => {
    restoreSelection();
    if (text === "> ") {
      exec("formatBlock", "blockquote");
    } else if (text === "[ ] ") {
      // Plain text checkbox — keep as a literal character so it survives export.
      exec("insertText", "☐ ");
    } else if (text === "---\n" || text === "---\n\n") {
      exec("insertHorizontalRule");
    } else {
      // Newlines / paragraph breaks: insert real paragraph separators.
      exec("insertHTML", text.replace(/\n/g, "<br>"));
    }
    scheduleAutosave();
    updateWordCount();
  };
  const insertAtLineStart = (prefix: string) => {
    restoreSelection();
    if (prefix === "- ") exec("insertUnorderedList");
    else if (prefix === "1. ") exec("insertOrderedList");
    else if (prefix === "---\n") exec("insertHorizontalRule");
    scheduleAutosave();
  };
  const applyHeading = (val: string) => {
    restoreSelection();
    const tag = val === "h1" ? "h1" : val === "h2" ? "h2" : val === "h3" ? "h3" : "p";
    // Firefox requires the angle-bracket form for formatBlock; Chrome
    // accepts both. The bracket form is the cross-browser safe path and was
    // the missing piece making the dropdown look like a no-op for some users.
    exec("formatBlock", `<${tag}>`);
    // Update the active-format readout immediately so the dropdown reflects
    // the change without waiting for the next selectionchange tick.
    setActiveFormats((af) => ({ ...af, block: tag }));
    scheduleAutosave();
  };

  // ── Typewriter scroll ───────────────────────────────────
  // Use the live caret position via Selection/Range so this works for the
  // rich contentEditable editor (it has no selectionStart).
  const typewriterScroll = () => {
    if (!typewriterMode) return;
    const div = contentRef.current;
    const body = document.getElementById("folio-editor-body");
    if (!div || !body) return;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0).cloneRange();
    range.collapse(true);
    let rect = range.getBoundingClientRect();
    if (rect.top === 0 && rect.bottom === 0) {
      // Empty range (caret at start of empty line) — fall back to caret's parent.
      const node = sel.anchorNode as HTMLElement | null;
      const parent = node?.nodeType === 1 ? (node as HTMLElement) : node?.parentElement;
      if (!parent) return;
      rect = parent.getBoundingClientRect();
    }
    const bodyRect = body.getBoundingClientRect();
    body.scrollTop += (rect.top - bodyRect.top) - body.clientHeight / 2;
  };

  // ── Paragraph-mode Enter handler ────────────────────────
  const handleEditorFocus = useCallback(() => {
    const div = contentRef.current;
    if (!div) return;
    if (!div.querySelector("p")) {
      div.innerHTML = "<p><br></p>";
      const sel = window.getSelection();
      if (sel) {
        const r = document.createRange();
        r.setStart(div.firstChild!, 0);
        r.collapse(true);
        sel.removeAllRanges();
        sel.addRange(r);
      }
    }
  }, []);

  const insertParagraphAtCursor = useCallback(() => {
    const div = contentRef.current;
    const sel = window.getSelection();
    if (!div || !sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    range.deleteContents();

    let currentP: HTMLElement | null = null;
    let node: Node | null = range.startContainer;
    while (node && node !== div) {
      if ((node as Element).nodeName === "P") { currentP = node as HTMLElement; break; }
      node = node.parentNode;
    }

    const newP = document.createElement("p");
    // Stamp current mode as inline styles so this paragraph keeps its spacing
    // even if the user switches modes later without a selection.
    applyModeToPMyFiles(newP, paragraphMode);

    if (currentP) {
      applyModeToPMyFiles(currentP, paragraphMode);
      const splitRange = document.createRange();
      splitRange.setStart(range.startContainer, range.startOffset);
      splitRange.setEnd(currentP, currentP.childNodes.length);
      newP.appendChild(splitRange.extractContents());
      currentP.after(newP);
      if (!currentP.textContent && !currentP.querySelector("br")) {
        currentP.appendChild(document.createElement("br"));
      }
    } else {
      div.appendChild(newP);
    }

    if (!newP.textContent && !newP.querySelector("br")) {
      newP.appendChild(document.createElement("br"));
    }

    const r = document.createRange();
    const fc = newP.firstChild;
    r.setStart(fc instanceof Text ? fc : newP, 0);
    r.collapse(true);
    sel.removeAllRanges();
    sel.addRange(r);
  }, [paragraphMode]);

  const handleEditorKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    if (e.shiftKey) {
      // Soft line break — stays inside the current paragraph, no double spacing
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      document.execCommand("insertLineBreak");
    } else if (paragraphMode === "indent") {
      insertParagraphAtCursor();
      const indentSel = window.getSelection();
      if (indentSel && indentSel.rangeCount > 0) {
        const r = indentSel.getRangeAt(0);
        const indent = document.createTextNode("\u00a0\u00a0\u00a0\u00a0");
        r.insertNode(indent);
        r.setStartAfter(indent);
        r.collapse(true);
        indentSel.removeAllRanges();
        indentSel.addRange(r);
      }
    } else {
      insertParagraphAtCursor();
    }
    updateWordCount();
    scheduleAutosave();
    typewriterScroll();
  }, [paragraphMode, insertParagraphAtCursor, updateWordCount, scheduleAutosave, typewriterScroll]);

  // ── Status menu close on outside click ──────────────────
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (!t.closest(".status-menu") && !t.closest(".status-pill")) {
        setStatusMenuOpen(false);
      }
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  // Flush pending autosaves immediately on page unload so no work is lost.
  useEffect(() => {
    const onUnload = () => {
      if (autosaveTimer.current) {
        window.clearTimeout(autosaveTimer.current);
        autosaveTimer.current = null;
      }
      if (chNotesAutosaveTimer.current) {
        window.clearTimeout(chNotesAutosaveTimer.current);
        chNotesAutosaveTimer.current = null;
      }
      saveCurrentDoc();
      saveChapterNotesRef.current();
    };
    window.addEventListener("beforeunload", onUnload);
    return () => window.removeEventListener("beforeunload", onUnload);
  }, [saveCurrentDoc]);

  // Save when the tab is hidden (user switches tabs, minimises, etc.).
  // Prevents losing in-flight autosave work if the browser discards the tab.
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        if (autosaveTimer.current) {
          window.clearTimeout(autosaveTimer.current);
          autosaveTimer.current = null;
        }
        if (chNotesAutosaveTimer.current) {
          window.clearTimeout(chNotesAutosaveTimer.current);
          chNotesAutosaveTimer.current = null;
        }
        saveCurrentDocRef.current();
        saveChapterNotesRef.current();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  // Save on component unmount (SPA navigation via sidebar / back button).
  // beforeunload does NOT fire for in-app route changes, so this is the
  // only safety net when the user navigates away inside the app.
  useEffect(() => {
    return () => {
      if (autosaveTimer.current) {
        window.clearTimeout(autosaveTimer.current);
        autosaveTimer.current = null;
      }
      if (chNotesAutosaveTimer.current) {
        window.clearTimeout(chNotesAutosaveTimer.current);
        chNotesAutosaveTimer.current = null;
      }
      saveCurrentDocRef.current();
      saveChapterNotesRef.current();
    };
  }, []);

  // ── Project modal handlers ──────────────────────────────
  const saveProjectModal = () => {
    const name = projectModal.name.trim();
    if (!name) return;
    if (projectModal.editingId) {
      setState((prev) => ({
        projects: prev.projects.map((p) => (p.id === projectModal.editingId ? { ...p, name } : p)),
      }));
      syncNNProject(projectModal.editingId, name);
      showToast("Project renamed");
    } else {
      const newId = uid();
      setState((prev) => ({
        projects: [...prev.projects, { id: newId, name, open: true, docs: [] }],
      }));
      syncNNProject(newId, name);
      showToast("Project created");
    }
    setProjectModal({ open: false, editingId: null, name: "" });
  };

  const saveDocModal = () => {
    const name = docModal.name.trim();
    if (!name || !docModal.projectId) return;
    if (docModal.editingId) {
      const editingId = docModal.editingId;
      setState((prev) => ({
        projects: prev.projects.map((p) =>
          p.id !== docModal.projectId ? p : { ...p, docs: p.docs.map((d) => (d.id !== editingId ? d : { ...d, name })) },
        ),
      }));
      if (titleRef.current && activeDocId === editingId) {
        titleRef.current.value = name;
        autoResize(titleRef.current);
      }
      showToast("Renamed");
      setDocModal({ open: false, projectId: null, editingId: null, name: "", status: "draft" });
    } else {
      const nd: Doc = { id: uid(), name, content: "", status: docModal.status, updatedAt: Date.now() };
      const projId = docModal.projectId;
      setState((prev) => ({
        projects: prev.projects.map((p) => (p.id !== projId ? p : { ...p, docs: [...p.docs, nd] })),
      }));
      setDocModal({ open: false, projectId: null, editingId: null, name: "", status: "draft" });
      // open after state update
      setTimeout(() => openDoc(projId, nd.id), 0);
    }
  };

  // ── Delete confirmations ────────────────────────────────
  const promptDeleteProject = (id: string) => {
    const p = state.projects.find((x) => x.id === id);
    setConfirmModal({
      open: true,
      title: "Delete Project?",
      text: `"${p?.name}" and all its documents will be permanently deleted.`,
      action: () => {
        if (activeProjectId === id) {
          setActiveProjectId(null);
          setActiveDocId(null);
        }
        setState((prev) => ({ projects: prev.projects.filter((p) => p.id !== id) }));
        showToast("Project deleted");
      },
    });
  };
  const promptDeleteDoc = (projId: string, docId: string) => {
    const proj = state.projects.find((p) => p.id === projId);
    const doc = proj?.docs.find((d) => d.id === docId);
    setConfirmModal({
      open: true,
      title: "Delete Document?",
      text: `"${doc?.name}" will be permanently deleted.`,
      action: () => {
        if (activeDocId === docId) {
          setActiveDocId(null);
          setActiveProjectId(null);
        }
        setState((prev) => ({
          projects: prev.projects.map((p) => (p.id !== projId ? p : { ...p, docs: p.docs.filter((d) => d.id !== docId) })),
        }));
        showToast("Deleted");
      },
    });
  };

  // ── Compile / export ────────────────────────────────────
  const openCompileFor = (projId: string) => {
    const proj = state.projects.find((p) => p.id === projId);
    if (!proj) return;
    setCompileModal({
      open: true,
      projectId: projId,
      format: "txt",
      checked: Object.fromEntries(proj.docs.map((d) => [d.id, true])),
      order: proj.docs.map((d) => d.id),
    });
  };
  const openCompile = () => {
    const projId = activeProjectId || state.projects[0]?.id || "";
    openCompileFor(projId);
  };
  const updateCompileProject = (projId: string) => {
    const proj = state.projects.find((p) => p.id === projId);
    setCompileModal((c) => ({
      ...c,
      projectId: projId,
      checked: Object.fromEntries((proj?.docs || []).map((d) => [d.id, true])),
      order: (proj?.docs || []).map((d) => d.id),
    }));
  };
  const runCompile = () => {
    const proj = state.projects.find((p) => p.id === compileModal.projectId);
    if (!proj) return;
    const docs = compileModal.order
      .filter((id) => compileModal.checked[id])
      .map((id) => proj.docs.find((d) => d.id === id))
      .filter(Boolean) as Doc[];
    let out = "";
    if (compileModal.format === "md") {
      out = docs.map((d) => `# ${d.name}\n\n${docPlainText(d.content)}`).join("\n\n---\n\n");
    } else {
      out = docs.map((d) => `${d.name.toUpperCase()}\n\n${docPlainText(d.content)}`).join("\n\n* * *\n\n");
    }
    const blob = new Blob([out], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${proj.name.replace(/\s+/g, "_")}.${compileModal.format === "md" ? "md" : "txt"}`;
    a.click();
    URL.revokeObjectURL(a.href);
    setCompileModal((c) => ({ ...c, open: false }));
    showToast("Downloaded!");
  };

  // Drag-reorder compile list
  const dragSrc = useRef<string | null>(null);
  const onCompileDragStart = (id: string) => { dragSrc.current = id; };
  const onCompileDragOver = (e: React.DragEvent, overId: string) => {
    e.preventDefault();
    if (!dragSrc.current || dragSrc.current === overId) return;
    setCompileModal((c) => {
      const order = [...c.order];
      const from = order.indexOf(dragSrc.current!);
      const to = order.indexOf(overId);
      if (from === -1 || to === -1) return c;
      order.splice(from, 1);
      order.splice(to, 0, dragSrc.current!);
      return { ...c, order };
    });
  };

  // ── Sprint (native popup) ───────────────────────────────
  const closeSprintModal = () => setSprintModal(false);
  const openSprintModal = () => setSprintModal(true);

  // ── Daily goal ──────────────────────────────────────────
  const dailyPct = dailyGoal ? Math.min(100, Math.round((dailyWords / dailyGoal) * 100)) : 0;

  // ── Sidebar render data ─────────────────────────────────
  const ql = globalSearch.toLowerCase().trim();

  // ── Global-search results (across every project + chapter) ──────────────
  // Each hit carries enough context for the dropdown: project name, chapter
  // name, total match count, and a snippet centred on the first match with
  // the query highlighted via <mark>. Clicking a hit opens the chapter and
  // queues an in-editor highlight (pendingSearchHighlightRef).
  const globalSearchHits = useMemo(() => {
    if (!ql) return [] as Array<{
      projectId: string; projectName: string;
      docId: string; docName: string;
      total: number; snippet: string; matchStart: number;
    }>;
    const out: Array<{
      projectId: string; projectName: string;
      docId: string; docName: string;
      total: number; snippet: string; matchStart: number;
    }> = [];
    const re = new RegExp(ql.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&"), "g");
    for (const p of state.projects) {
      for (const d of p.docs) {
        const content = docPlainText(d.content);
        const lower = content.toLowerCase();
        const idx = lower.indexOf(ql);
        const nameHit = d.name.toLowerCase().includes(ql);
        if (idx === -1 && !nameHit) continue;
        re.lastIndex = 0;
        const total = (lower.match(re) || []).length;
        let snippet = "";
        if (idx !== -1) {
          const start = Math.max(0, idx - 40);
          const end = Math.min(content.length, idx + ql.length + 60);
          snippet = (start > 0 ? "…" : "") + content.slice(start, end) + (end < content.length ? "…" : "");
        }
        out.push({
          projectId: p.id, projectName: p.name,
          docId: d.id, docName: d.name,
          total, snippet, matchStart: idx,
        });
      }
    }
    return out;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ql, state.projects]);
  const [globalSearchFocused, setGlobalSearchFocused] = useState(false);
  const globalSearchResultsOpen = globalSearchFocused && !!ql;

  const openSearchHit = useCallback(
    (projectId: string, docId: string) => {
      pendingSearchHighlightRef.current = ql;
      setGlobalSearchFocused(false);
      openDoc(projectId, docId);
    },
    // openDoc is stable enough for this purpose (it's a closure over latest state)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ql],
  );

  const visibleProjects = state.projects
    .map((proj) => {
      const visibleDocs = ql
        ? proj.docs.filter((d) => d.name.toLowerCase().includes(ql) || docPlainText(d.content).toLowerCase().includes(ql))
        : proj.docs;
      const projMatch = ql && proj.name.toLowerCase().includes(ql);
      if (ql && !projMatch && !visibleDocs.length) return null;
      const isOpen = proj.open || (!!ql && visibleDocs.length > 0);
      return { proj, visibleDocs, isOpen };
    })
    .filter(Boolean) as Array<{ proj: Project; visibleDocs: Doc[]; isOpen: boolean }>;

  const recentVisible = !ql
    ? recentDocs
        .slice(0, 3)
        .map((r) => {
          const proj = state.projects.find((p) => p.id === r.projectId);
          const doc = proj?.docs.find((d) => d.id === r.docId);
          return proj && doc ? { r, proj, doc } : null;
        })
        .filter(Boolean) as Array<{ r: RecentEntry; proj: Project; doc: Doc }>
    : [];

  // Status pill
  const currentStatus = activeDoc?.status || "draft";
  const statusInfo = STATUS[currentStatus];

  if (homeView) {
    const totalWords = state.projects.reduce((sum, p) => sum + p.docs.reduce((s, d) => s + wc(docPlainText(d.content)), 0), 0);
    const totalChapters = state.projects.reduce((sum, p) => sum + p.docs.length, 0);

    return (
      <div className="mf-home">
        {/* Background orbs */}
        <div className="mf-orb mf-orb--blue" />
        <div className="mf-orb mf-orb--purple" />
        <div className="mf-orb mf-orb--gold" />

        <div className="mf-home-inner">

          {/* Hero with logo on top */}
          <div className="mf-home-hero">
            <div className="mf-home-brand">
              <div className="mf-brand-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
                </svg>
              </div>
              <span className="mf-home-brand-name">Writing Sprint</span>
            </div>
            <h1 className="mf-home-heading">Your creative space.</h1>
            <p className="mf-home-sub">Write. Build worlds. Race.</p>
            {totalWords > 0 && (
              <div className="mf-home-stats">
                <span>{state.projects.length} project{state.projects.length !== 1 ? "s" : ""}</span>
                <span className="mf-stat-dot" />
                <span>{totalChapters} chapter{totalChapters !== 1 ? "s" : ""}</span>
                <span className="mf-stat-dot" />
                <span>{totalWords.toLocaleString()} words</span>
              </div>
            )}
          </div>

          {/* App cards — full-color gradient */}
          <div className="mf-home-cards">
            <button className="mf-card mf-card--blue" onClick={() => {
              setHomeView(false);
              // Re-open the previously active chapter so loadEditorContent runs.
              // Without this, the editor mounts empty and content is never loaded.
              if (activeProjectId && activeDocId) {
                setTimeout(() => openDoc(activeProjectId, activeDocId), 50);
              }
            }}>
              <div className="mf-card-shine" />
              <div className="mf-card-icon-wrap">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.9)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
              </div>
              <div className="mf-card-chip">Writing Editor</div>
              <div className="mf-card-name">Folio</div>
              <div className="mf-card-blurb">Projects, chapters &amp; word counts</div>
              <div className="mf-card-foot">
                {state.projects.length > 0
                  ? <span>{state.projects.length} project{state.projects.length !== 1 ? "s" : ""} · {totalChapters} chapter{totalChapters !== 1 ? "s" : ""}</span>
                  : <span>Start your first project</span>}
                <span className="mf-card-arr">→</span>
              </div>
            </button>

            <button className="mf-card mf-card--purple" onClick={() => setLocation("/novel-notes")}>
              <div className="mf-card-shine" />
              <div className="mf-card-icon-wrap">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.9)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
                  <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
                  <line x1="9" y1="8" x2="15" y2="8"/><line x1="9" y1="12" x2="13" y2="12"/>
                </svg>
              </div>
              <div className="mf-card-chip">World Building</div>
              <div className="mf-card-name">Novel Notes</div>
              <div className="mf-card-blurb">Characters, lore &amp; world cards</div>
              <div className="mf-card-foot">
                <span>Build your universe</span>
                <span className="mf-card-arr">→</span>
              </div>
            </button>

            <button className="mf-card mf-card--green" onClick={() => setLocation("/co-writing")}>
              <div className="mf-card-shine" />
              <div className="mf-card-icon-wrap">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.9)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                </svg>
              </div>
              <div className="mf-card-chip">Collaboration</div>
              <div className="mf-card-name">Co-writing</div>
              <div className="mf-card-blurb">Write together in real time</div>
              <div className="mf-card-foot">
                <span>Invite collaborators</span>
                <span className="mf-card-arr">→</span>
              </div>
            </button>

            <button className="mf-card mf-card--gold" onClick={() => setLocation("/portal")}>
              <div className="mf-card-shine" />
              <div className="mf-card-icon-wrap">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.9)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                </svg>
              </div>
              <div className="mf-card-chip">Live Racing</div>
              <div className="mf-card-name">Writing Sprint</div>
              <div className="mf-card-blurb">Race other writers in real time</div>
              <div className="mf-card-foot">
                <span>Find a room</span>
                <span className="mf-card-arr">→</span>
              </div>
            </button>
          </div>

          {/* Projects */}
          {state.projects.length > 0 && (
            <div className="mf-section">
              <div className="mf-section-hd">
                <span className="mf-section-label">Your Projects</span>
                <button className="mf-section-btn" onClick={() => { setHomeView(false); setTimeout(() => setProjectModal({ open: true, editingId: null, name: "" }), 100); }}>
                  + New
                </button>
              </div>
              <div className="mf-proj-grid">
                {state.projects.map((proj) => {
                  const lastEdited = proj.docs.reduce((max, d) => Math.max(max, d.updatedAt || 0), 0);
                  const lastStr = lastEdited ? new Date(lastEdited).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : null;
                  const projWc = proj.docs.reduce((s, d) => s + wc(docPlainText(d.content)), 0);
                  const mostRecent = [...proj.docs].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))[0];
                  const initial = (proj.name[0] || "?").toUpperCase();
                  return (
                    <button key={proj.id} className="mf-proj-tile"
                      onClick={() => { setHomeView(false); if (mostRecent) setTimeout(() => openDoc(proj.id, mostRecent.id), 50); }}>
                      <div className="mf-proj-initial">{initial}</div>
                      <div className="mf-proj-info">
                        <span className="mf-proj-name">{proj.name}</span>
                        <span className="mf-proj-meta">
                          {proj.docs.length} chapter{proj.docs.length !== 1 ? "s" : ""}
                          {projWc > 0 ? ` · ${projWc.toLocaleString()} words` : ""}
                          {lastStr ? ` · ${lastStr}` : ""}
                        </span>
                      </div>
                      <span className="mf-proj-go">→</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Recent */}
          {recentVisible.length > 0 && (
            <div className="mf-section">
              <div className="mf-section-hd">
                <span className="mf-section-label">Recently Opened</span>
              </div>
              <div className="mf-recent-grid">
                {recentVisible.map(({ r, proj, doc }) => (
                  <button key={r.docId} className="mf-recent-tile"
                    onClick={() => { setHomeView(false); setTimeout(() => openDoc(r.projectId, r.docId), 50); }}>
                    <span className="mf-recent-dot" style={{ background: STATUS[(doc.status || "draft") as StatusKey].color }} />
                    <span className="mf-recent-name">{doc.name}</span>
                    <span className="mf-recent-proj">{proj.name}</span>
                    <span className="mf-recent-go">→</span>
                  </button>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>
    );
  }

  return (
    <div className={`folio-root${focusMode ? " focus-mode" : ""}${typewriterMode ? " typewriter-mode" : ""}`}>
      {/* Focus exit chip (visible only in focus mode). Fades in on hover so it
          doesn't intrude on the writing surface; click to drop back into the
          full editor chrome. Keyboard: Esc also exits via the listener below. */}
      {focusMode && (
        <button className="focus-exit-chip" onClick={() => setFocusMode(false)} title="Exit focus (Esc)">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 14h6v6"/><path d="M20 10h-6V4"/><path d="m14 10 7-7"/><path d="m3 21 7-7"/>
          </svg>
          <span>Exit focus</span>
        </button>
      )}

      {/* TOP BAR */}
      <div className="folio-topbar">
        <FolioLogoMenu onBack={() => {
          // Flush any pending autosave before leaving the editor
          if (autosaveTimer.current) { window.clearTimeout(autosaveTimer.current); autosaveTimer.current = null; }
          saveCurrentDoc();
          // Clear the "last doc" marker — explicitly going home means the next
          // refresh should land on the picker, not back in the editor.
          try { localStorage.removeItem("folio_last_doc"); } catch { /* ignore */ }
          setHomeView(true);
        }} />
        <div className="topbar-spacer" />

        {dailyGoal > 0 && (
          <div
            className="daily-goal-wrap"
            title="Click to set daily word goal"
            onClick={() => setDailyGoalModal({ open: true, value: String(dailyGoal) })}
          >
            <span className="daily-goal-label">
              Daily: {dailyWords.toLocaleString()} / {dailyGoal.toLocaleString()}
            </span>
            <div className="daily-goal-bar-outer">
              <div className="daily-goal-bar-inner" style={{ width: dailyPct + "%" }} />
            </div>
            <span className="daily-goal-pct">{dailyPct}%</span>
          </div>
        )}
        {dailyGoal === 0 && (
          <button
            className="btn btn-ghost"
            onClick={() => setDailyGoalModal({ open: true, value: "500" })}
            style={{ fontSize: 11 }}
          >
            Set goal
          </button>
        )}

        <div className="topbar-search">
          <span className="search-icon"><Ico.Search /></span>
          <input
            type="text"
            placeholder="Search projects…"
            value={globalSearch}
            onChange={(e) => setGlobalSearch(e.target.value)}
            onFocus={() => setGlobalSearchFocused(true)}
            // Delay blur so click on a result registers before the dropdown closes
            onBlur={() => setTimeout(() => setGlobalSearchFocused(false), 150)}
            onKeyDown={(e) => {
              if (e.key === "Escape") { setGlobalSearch(""); setGlobalSearchFocused(false); }
              else if (e.key === "Enter" && globalSearchHits.length > 0) {
                const first = globalSearchHits[0];
                openSearchHit(first.projectId, first.docId);
              }
            }}
          />
          {globalSearch && (
            <button
              className="search-clear"
              onMouseDown={(e) => { e.preventDefault(); setGlobalSearch(""); }}
              title="Clear"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          )}

          {/* Results dropdown — chapter rows with project crumb + highlighted snippet */}
          {globalSearchResultsOpen && (
            <div className="topbar-search-results" onMouseDown={(e) => e.preventDefault()}>
              {globalSearchHits.length === 0 ? (
                <div className="topbar-search-empty">No matches.</div>
              ) : (
                <>
                  <div className="topbar-search-summary">
                    {globalSearchHits.reduce((s, h) => s + h.total, 0)} match{globalSearchHits.reduce((s, h) => s + h.total, 0) === 1 ? "" : "es"} in {globalSearchHits.length} chapter{globalSearchHits.length === 1 ? "" : "s"}
                  </div>
                  {globalSearchHits.slice(0, 30).map((hit) => {
                    // Render snippet with the query wrapped in <mark>
                    const lower = hit.snippet.toLowerCase();
                    const i = lower.indexOf(ql);
                    const snippetEls = i === -1
                      ? hit.snippet
                      : (<>
                          {hit.snippet.slice(0, i)}
                          <mark>{hit.snippet.slice(i, i + ql.length)}</mark>
                          {hit.snippet.slice(i + ql.length)}
                        </>);
                    return (
                      <button
                        key={`${hit.projectId}-${hit.docId}`}
                        className="topbar-search-hit"
                        onClick={() => openSearchHit(hit.projectId, hit.docId)}
                      >
                        <div className="topbar-search-hit-crumb">
                          <span className="topbar-search-hit-proj">{hit.projectName}</span>
                          <span className="topbar-search-hit-sep">›</span>
                          <span className="topbar-search-hit-doc">{hit.docName}</span>
                          {hit.total > 1 && <span className="topbar-search-hit-count">{hit.total}</span>}
                        </div>
                        {hit.snippet && (
                          <div className="topbar-search-hit-snippet">{snippetEls}</div>
                        )}
                      </button>
                    );
                  })}
                  {globalSearchHits.length > 30 && (
                    <div className="topbar-search-empty">…and {globalSearchHits.length - 30} more. Refine your query.</div>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {activeDoc && (
          <>
            <button className="btn btn-icon" onClick={() => setFocusMode(true)} title="Focus mode">
              <Ico.Focus />
            </button>
            <button className="btn btn-ghost" onClick={openCompile}>
              <Ico.Download /> Export
            </button>
            <button
              className="btn btn-ghost"
              onClick={() => {
                setFindOpen((v) => !v);
                if (!findOpen) setTimeout(() => findInputRef.current?.focus(), 50);
              }}
            >
              <Ico.Search /> Find
            </button>
            <button className="btn btn-primary" onClick={manualSave}>Save</button>
          </>
        )}
      </div>

      <div className="app-body">
        {/* SIDEBAR */}
        <aside className="folio-sidebar">
          <div className="sidebar-header">
            <span className="sidebar-header-label">Projects</span>
            <div className="sidebar-header-actions">
              <button
                className="sidebar-add-btn"
                onClick={() => setProjectModal({ open: true, editingId: null, name: "" })}
                title="New Project"
              >
                <Ico.Plus />
              </button>
            </div>
          </div>

          <button className="sidebar-novel-notes-btn" onClick={() => setNovelNotesOpen(true)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
            </svg>
            Novel Notes
            <svg className="sidebar-novel-notes-btn-arr" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </button>

          <div className="sidebar-tree">
            {recentVisible.length > 0 && (
              <>
                <div className="sidebar-section-label"><Ico.Recent /> Recent</div>
                {recentVisible.map(({ r, proj, doc }) => (
                  <div key={r.docId} className="recent-row" onClick={() => openDoc(r.projectId, r.docId)}>
                    <div className="status-menu-dot" style={{ background: STATUS[doc.status || "draft"].color, flexShrink: 0 }} />
                    <span className="recent-name">{doc.name}</span>
                    <span className="recent-proj">{proj.name.slice(0, 10)}</span>
                  </div>
                ))}
                <div style={{ height: 6 }} />
              </>
            )}

            {state.projects.length === 0 ? (
              <div style={{ padding: "14px 12px", fontSize: 12.5, color: "var(--text-muted)", lineHeight: 1.6 }}>
                No projects yet.<br />Click + to create one.
              </div>
            ) : (
              visibleProjects.map(({ proj, visibleDocs, isOpen }) => {
                const projDocs = proj.docs ?? [];
                const projWC = projDocs.reduce((s, d) => s + wc((d.name || "") + " " + docPlainText(d.content)), 0);
                const totalWC = projWC;
                const lastEdited = projDocs.reduce((max, d) => Math.max(max, d.updatedAt || 0), 0);
                const statusCounts = { draft: 0, progress: 0, done: 0, edit: 0 };
                projDocs.forEach((d) => statusCounts[(d.status || "draft") as StatusKey]++);
                const lastStr = lastEdited
                  ? new Date(lastEdited).toLocaleDateString("en-GB", { day: "numeric", month: "short" })
                  : "—";
                return (
                  <div key={proj.id} className="folder-item">
                    <div className={`folder-row${isOpen ? " open" : ""}`} onClick={() => toggleFolder(proj.id)}>
                      <span className="folder-chevron"><Ico.Chevron /></span>
                      <Ico.Folder />
                      <span className="folder-name">{proj.name}</span>
                      <span className="folder-wc">{projWC > 0 ? projWC.toLocaleString() : ""}</span>
                      <div className="folder-actions" onClick={(e) => e.stopPropagation()}>
                        <button
                          className="row-icon-btn"
                          title="Search in project"
                          onClick={() => {
                            setProjSearchOpen((s) => ({ ...s, [proj.id]: !s[proj.id] }));
                            setState((prev) => ({
                              projects: prev.projects.map((p) => (p.id === proj.id ? { ...p, open: true } : p)),
                            }));
                          }}
                        >
                          <Ico.Search size={11} />
                        </button>
                        <button
                          className="row-icon-btn"
                          title="Export project"
                          onClick={() => openCompileFor(proj.id)}
                        >
                          <Ico.Download />
                        </button>
                        <button
                          className="row-icon-btn"
                          title="Stats"
                          onClick={() => setStatsOpen((s) => ({ ...s, [proj.id]: !s[proj.id] }))}
                        >
                          <Ico.Stats />
                        </button>
                        <button
                          className="row-icon-btn"
                          title="Add doc"
                          onClick={() => {
                            setState((prev) => ({
                              projects: prev.projects.map((p) => (p.id === proj.id ? { ...p, open: true } : p)),
                            }));
                            setDocModal({ open: true, projectId: proj.id, editingId: null, name: "", status: "draft" });
                          }}
                        >
                          <Ico.Plus />
                        </button>
                        <button
                          className="row-icon-btn"
                          title="Rename"
                          onClick={() => setProjectModal({ open: true, editingId: proj.id, name: proj.name })}
                        >
                          <Ico.Edit />
                        </button>
                        <button className="row-icon-btn danger" title="Delete" onClick={() => promptDeleteProject(proj.id)}>
                          <Ico.Trash />
                        </button>
                      </div>
                    </div>

                    {projSearchOpen[proj.id] && (() => {
                      const q = (projSearch[proj.id] || "").toLowerCase().trim();
                      const matches = q
                        ? proj.docs
                            .map((d) => {
                              const content = docPlainText(d.content);
                              const lower = content.toLowerCase();
                              const idx = lower.indexOf(q);
                              const nameHit = d.name.toLowerCase().includes(q);
                              if (idx === -1 && !nameHit) return null;
                              const total = (lower.match(new RegExp(q.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&"), "g")) || []).length;
                              let snippet = "";
                              if (idx !== -1) {
                                const start = Math.max(0, idx - 28);
                                const end = Math.min(content.length, idx + q.length + 28);
                                snippet = (start > 0 ? "…" : "") + content.slice(start, end) + (end < content.length ? "…" : "");
                              }
                              return { doc: d, snippet, total, nameHit };
                            })
                            .filter(Boolean) as Array<{ doc: Doc; snippet: string; total: number; nameHit: boolean }>
                        : [];
                      const totalMatches = matches.reduce((s, m) => s + m.total, 0);
                      return (
                        <div className="proj-search visible">
                          <div className="proj-search-row">
                            <span className="proj-search-icon"><Ico.Search size={12} /></span>
                            <input
                              className="proj-search-input"
                              type="text"
                              placeholder={`Search ${proj.name}…`}
                              value={projSearch[proj.id] || ""}
                              onChange={(e) => setProjSearch((s) => ({ ...s, [proj.id]: e.target.value }))}
                              autoFocus
                            />
                            <span className="proj-search-meta">{projWC.toLocaleString()} words</span>
                          </div>
                          {q && (
                            <div className="proj-search-results">
                              {matches.length === 0 ? (
                                <div className="proj-search-empty">No matches in this project.</div>
                              ) : (
                                <>
                                  <div className="proj-search-summary">
                                    {totalMatches} match{totalMatches === 1 ? "" : "es"} in {matches.length} chapter{matches.length === 1 ? "" : "s"}
                                  </div>
                                  {matches.map((m) => (
                                    <div
                                      key={m.doc.id}
                                      className="proj-search-hit"
                                      onClick={() => openDoc(proj.id, m.doc.id)}
                                    >
                                      <div className="proj-search-hit-name">
                                        {m.doc.name}
                                        {m.total > 0 && <span className="proj-search-hit-count">{m.total}</span>}
                                      </div>
                                      {m.snippet && (
                                        <div className="proj-search-hit-snippet">
                                          {(() => {
                                            const lower = m.snippet.toLowerCase();
                                            const i = lower.indexOf(q);
                                            if (i === -1) return m.snippet;
                                            return (
                                              <>
                                                {m.snippet.slice(0, i)}
                                                <mark>{m.snippet.slice(i, i + q.length)}</mark>
                                                {m.snippet.slice(i + q.length)}
                                              </>
                                            );
                                          })()}
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {statsOpen[proj.id] && (
                      <div className="proj-stats visible">
                        <div className="proj-stats-title">Project Overview</div>
                        <div className="proj-stat-row"><span>Documents</span><span>{proj.docs.length}</span></div>
                        <div className="proj-stat-row proj-stat-total"><span>Total words</span><span>{totalWC.toLocaleString()}</span></div>
                        <div className="proj-stat-row"><span>Last edited</span><span>{lastStr}</span></div>
                        <div className="proj-stat-row"><span>Done</span><span>{statusCounts.done} / {proj.docs.length}</span></div>
                      </div>
                    )}

                    <div className={`folder-children${isOpen ? " open" : ""}`}>
                      {visibleDocs.map((doc) => {
                        const dwc = wc((doc.name || "") + " " + docPlainText(doc.content));
                        const st = (doc.status || "draft") as StatusKey;
                        return (
                          <div
                            key={doc.id}
                            draggable
                            className={`doc-row${doc.id === activeDocId ? " active" : ""}${dragOverDocId === doc.id ? " drag-over" : ""}`}
                            onClick={() => openDoc(proj.id, doc.id)}
                            onDragStart={(e) => {
                              dragDocRef.current = { docId: doc.id, projectId: proj.id };
                              e.dataTransfer.effectAllowed = "move";
                            }}
                            onDragOver={(e) => { e.preventDefault(); setDragOverDocId(doc.id); }}
                            onDragLeave={() => setDragOverDocId(null)}
                            onDrop={(e) => {
                              e.preventDefault();
                              const src = dragDocRef.current;
                              if (src && src.docId !== doc.id && src.projectId === proj.id) {
                                setState((prev) => ({
                                  projects: prev.projects.map((p) => {
                                    if (p.id !== proj.id) return p;
                                    const docs = [...p.docs];
                                    const fromIdx = docs.findIndex((d) => d.id === src.docId);
                                    const toIdx = docs.findIndex((d) => d.id === doc.id);
                                    if (fromIdx === -1 || toIdx === -1) return p;
                                    const [moved] = docs.splice(fromIdx, 1);
                                    docs.splice(toIdx, 0, moved);
                                    return { ...p, docs };
                                  }),
                                }));
                              }
                              dragDocRef.current = null;
                              setDragOverDocId(null);
                            }}
                            onDragEnd={() => { dragDocRef.current = null; setDragOverDocId(null); }}
                          >
                            <div className="doc-status-dot" style={{ background: STATUS[st].color }} />
                            <span className="doc-name">{doc.name}</span>
                            <span className="doc-wc">{dwc || ""}</span>
                            <div className="doc-actions" onClick={(e) => e.stopPropagation()}>
                              <button
                                className="row-icon-btn"
                                title="Rename"
                                onClick={() => setDocModal({ open: true, projectId: proj.id, editingId: doc.id, name: doc.name, status: doc.status })}
                              >
                                <Ico.Edit />
                              </button>
                              <button className="row-icon-btn danger" title="Delete" onClick={() => promptDeleteDoc(proj.id, doc.id)}>
                                <Ico.Trash />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                      {!ql && (
                        <div
                          className="add-doc-row"
                          onClick={() => setDocModal({ open: true, projectId: proj.id, editingId: null, name: "", status: "draft" })}
                        >
                          <Ico.Plus /> Add document
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </aside>

        {/* NOVEL NOTES OVERLAY */}
        {novelNotesOpen && (
          <div className="nn-overlay">
            <iframe
              src={`${import.meta.env.BASE_URL}novel-notes.html?src=folio`}
              className="nn-overlay-frame"
              title="Novel Notes"
            />
          </div>
        )}

        {/* MAIN */}
        <div className="folio-main">
          {!activeDoc ? (
            <div className="welcome-panel">
              <div className="welcome-panel-icon"><Ico.FolderBig /></div>
              <h2>Your writing space</h2>
              <p>Select a chapter from the sidebar to start writing, or create a new project to begin a fresh story.</p>
              <div className="welcome-panel-hint">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Click <kbd>+</kbd> next to Projects to add one
              </div>
            </div>
          ) : (
            <div className={`editor-panel${chNotesOpen ? " notes-open" : ""}${cardsOpen ? " cards-open" : ""}`}>
              <div className="editor-col">
              {/* Vertical companion pill — appears when the horizontal one
                  scrolls out of view as the user writes. Keeps the same
                  controls within reach without dominating the writing surface. */}
              {pillHidden && (
                <div
                  className={`editor-controls-pill editor-controls-pill--vertical${focusMode ? " editor-controls-pill--right" : ""}`}
                  aria-label="Editor controls"
                >
                  <div className="ecp-seg ecp-seg--vertical">
                    {(["none", "indent", "double"] as const).map((mode) => (
                      <button
                        key={mode}
                        className={`ecp-seg-btn ecp-seg-btn--vertical${paragraphMode === mode ? " active" : ""}`}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setParagraphMode(mode);
                        }}
                        title={mode === "none" ? "Normal spacing" : mode === "indent" ? "Indent paragraphs" : "Double spacing"}
                      >
                        {mode === "none" ? "N" : mode === "indent" ? "I" : "D"}
                      </button>
                    ))}
                  </div>
                  <div className="ecp-sep ecp-sep--vertical" />
                  <button className={`ecp-icon-btn${typewriterMode ? " active" : ""}`} onClick={() => setTypewriterMode((v) => !v)} title="Typewriter mode">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01M8 12h.01M12 12h.01M16 12h.01M7 16h10"/></svg>
                  </button>
                  <button className={`ecp-icon-btn${focusMode ? " active" : ""}`} onClick={() => setFocusMode((v) => !v)} title="Focus mode">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/></svg>
                  </button>
                  <button
                    className={`ecp-icon-btn${ltEnabled ? " active" : ""}`}
                    onClick={() => setLtEnabled((v) => !v)}
                    title={ltEnabled ? "Grammar check on — click to disable" : "Grammar check off — click to enable"}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
                  </button>
                  <div className="ecp-sep ecp-sep--vertical" />
                  <button className={`ecp-icon-btn${chNotesOpen ? " active" : ""}`} onClick={() => setChNotesOpen((v) => !v)} title="Chapter Notes">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
                    {activeDocId && chNotesHaveContent(state.chapterNotes?.[activeDocId]) && <span className="ecp-vert-dot" />}
                  </button>
                  <button className={`ecp-icon-btn${cardsOpen ? " active" : ""}`} onClick={() => { setCardsOpen((v) => !v); if (chNotesOpen) setChNotesOpen(false); }} title="Novel Notes Cards">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
                  </button>
                </div>
              )}
              {/* ── Editor topbar — chapter chip · status · session info · actions ── */}
              <div className="editor-topbar">
                <button
                  className="crumb-chip"
                  onClick={(e) => {
                    // Same status menu as before, anchored from the chip.
                    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                    setStatusMenuPos({ top: rect.bottom + 6, left: rect.left });
                    setStatusMenuOpen((v) => !v);
                  }}
                  title="Change status"
                >
                  <span className="crumb-chip-dot" style={{ background: statusInfo.color }} />
                  <span className="crumb-chip-project">{activeProject?.name}</span>
                  <span className="crumb-chip-sep">›</span>
                  <span className="crumb-chip-doc">{activeDoc.name}</span>
                  <span className="crumb-chip-status" style={{ color: statusInfo.color, background: statusInfo.color + "1c" }}>
                    {statusInfo.label}
                  </span>
                </button>

                <div className="editor-topbar-spacer" />

                {/* Live save indicator */}
                <div className={`autosave-indicator autosave-indicator--${saveStatus}`}>
                  {saveStatus === "unsaved" && <><span className="autosave-dot" /> Unsaved</>}
                  {saveStatus === "saving" && <><span className="autosave-dot autosave-dot--saving" /> Saving</>}
                  {saveStatus === "saved" && <><Ico.Check /> Saved</>}
                </div>

                {/* Session stats — word count + reading time + today's progress.
                    Today's badge mirrors the daily goal bar in the top bar
                    so writers know at-a-glance how far into their goal they are. */}
                <div className="session-stats" title="Total words · estimated reading time">
                  <span className="session-stat session-stat--words">
                    <strong>{editorWordCount.toLocaleString()}</strong>
                    <span className="session-stat-unit">words</span>
                  </span>
                  <span className="session-stat-divider" />
                  <span className="session-stat" title="Estimated reading time at ~230 wpm">
                    <Ico.Clock />
                    <span>{editorWordCount < 30 ? "<1 min" : `${Math.max(1, Math.round(editorWordCount / 230))} min`}</span>
                  </span>
                </div>
                {dailyGoal > 0 && (
                  <span className={`today-badge${dailyPct >= 100 ? " today-badge--done" : ""}`} title={`${dailyWords}/${dailyGoal} words today`}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v4"/><path d="m6.4 6.4 2.83 2.83"/><path d="M2 12h4"/><path d="m6.4 17.6 2.83-2.83"/><path d="M12 18v4"/><path d="m14.77 14.77 2.83 2.83"/><path d="M18 12h4"/><path d="m14.77 9.23 2.83-2.83"/></svg>
                    <span><strong>{dailyWords.toLocaleString()}</strong>/{dailyGoal.toLocaleString()}</span>
                  </span>
                )}

                <div className="editor-topbar-spacer-sm" />

                {/* Quick actions */}
                <button
                  className={`topbar-icon-btn${typewriterMode ? " active" : ""}`}
                  onClick={() => setTypewriterMode((v) => !v)}
                  title="Typewriter mode — keeps the active line centered"
                >
                  <Ico.Typewriter />
                </button>
                <button
                  className={`topbar-icon-btn${stickyOpen ? " active" : ""}`}
                  onClick={() => setStickyOpen((v) => !v)}
                  title="Sticky note (outline, ideas)"
                >
                  <Ico.StickyNote />
                </button>
              </div>

              {/* ── Writing toolbar — grouped tile pills, SVG icons throughout ── */}
              <div
                className="writing-toolbar"
                // preventDefault on mousedown for the buttons so they don't
                // steal focus from the editor. The runFormat helpers also
                // restore the latest in-editor Range (tracked via a global
                // selectionchange listener) before calling execCommand, so
                // formatting still applies even if the focus did shift.
                onMouseDown={(e) => {
                  // Stop buttons from stealing focus from the editor (so
                  // execCommand still applies to the user's selection). DON'T
                  // preventDefault on SELECT — it blocks the dropdown from
                  // opening, which is what made font-size silently fail.
                  const t = e.target as HTMLElement;
                  if (t.tagName === "BUTTON" || t.closest("button")) e.preventDefault();
                }}
              >
                {/* Heading style — controlled select reflects the active block,
                    so the dropdown always shows the right value when the user
                    moves the cursor between paragraphs/headings. */}
                <div className="tb-group">
                  <select
                    className="tb-select"
                    value={activeFormats.block}
                    onChange={(e) => applyHeading(e.target.value)}
                    title="Paragraph style"
                  >
                    <option value="p">Paragraph</option>
                    <option value="h1">Heading 1</option>
                    <option value="h2">Heading 2</option>
                    <option value="h3">Heading 3</option>
                  </select>
                </div>

                {/* Inline formatting — buttons light up when the cursor is
                    inside text with the corresponding mark. */}
                <div className="tb-group">
                  <button className={`tb-btn${activeFormats.bold ? " active" : ""}`}      onMouseDown={(e) => { e.preventDefault(); wrapText("**", "**"); }} title="Bold (⌘B)"><Ico.Bold /></button>
                  <button className={`tb-btn${activeFormats.italic ? " active" : ""}`}    onMouseDown={(e) => { e.preventDefault(); wrapText("_", "_"); }}   title="Italic (⌘I)"><Ico.Italic /></button>
                  <button className={`tb-btn${activeFormats.underline ? " active" : ""}`} onMouseDown={(e) => { e.preventDefault(); wrapText("__", "__"); }} title="Underline (⌘U)"><Ico.Underline /></button>
                  <button className={`tb-btn${activeFormats.strike ? " active" : ""}`}    onMouseDown={(e) => { e.preventDefault(); wrapText("~~", "~~"); }} title="Strikethrough"><Ico.Strike /></button>
                </div>

                {/* Block formatting */}
                <div className="tb-group">
                  <button className="tb-btn" onMouseDown={(e) => { e.preventDefault(); insertAtCursor("> "); }} title="Block quote"><Ico.Quote /></button>
                  <button className="tb-btn" onMouseDown={(e) => { e.preventDefault(); insertAtLineStart("- "); }} title="Bullet list"><Ico.ListBul /></button>
                  <button className="tb-btn" onMouseDown={(e) => { e.preventDefault(); insertAtLineStart("1. "); }} title="Numbered list"><Ico.ListNum /></button>
                  <button className="tb-btn" onMouseDown={(e) => { e.preventDefault(); insertAtLineStart("---\n"); }} title="Horizontal rule"><Ico.Hr /></button>
                </div>

                {/* Inserts */}
                <div className="tb-group">
                  <button className="tb-btn" onMouseDown={(e) => { e.preventDefault(); insertAtCursor("\n\n"); }} title="Paragraph break"><Ico.Pilcrow /></button>
                  <button className="tb-btn" onMouseDown={(e) => { e.preventDefault(); insertAtCursor("[ ] "); }} title="Checkbox"><Ico.Checkbox /></button>
                  <button className="tb-btn" onMouseDown={(e) => { e.preventDefault(); insertAtCursor("---\n\n"); }} title="Scene break"><Ico.Scene /></button>
                  <button
                    className="tb-btn"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      restoreSelection();
                      const sel = window.getSelection();
                      if (sel && !sel.isCollapsed) {
                        const href = window.prompt("Link URL:", "https://");
                        if (href && href !== "https://") runFormat("createLink", href);
                      }
                    }}
                    title="Link"
                  >
                    <Ico.Link />
                  </button>
                </div>

                {/* History + tidy-up */}
                <div className="tb-group">
                  <button className="tb-btn" onMouseDown={(e) => { e.preventDefault(); runFormat("undo"); }} title="Undo (⌘Z)"><Ico.Undo /></button>
                  <button className="tb-btn" onMouseDown={(e) => { e.preventDefault(); runFormat("redo"); }} title="Redo (⌘⇧Z)"><Ico.Redo /></button>
                  <button className="tb-btn" onMouseDown={(e) => { e.preventDefault(); runFormat("removeFormat"); }} title="Clear formatting"><Ico.ClearFmt /></button>
                </div>

                {/* Font size — always updates the editor-wide default (so
                    you can see the change immediately), and additionally
                    wraps any current selection in an inline-styled span. */}
                <div className="tb-group tb-group--last">
                  <span className="tb-group-icon" title="Font size"><Ico.TypeSize /></span>
                  <select
                    className="tb-select tb-select--compact"
                    value={fontSize}
                    onChange={(e) => {
                      const size = parseInt(e.target.value, 10);
                      if (Number.isNaN(size)) return;

                      // 1) Always update the default editor font size — this
                      // is what makes the change visible even when nothing
                      // is selected. Previously this was the else-branch,
                      // which meant a stale savedRange would silently fail.
                      setFontSize(size);
                      localStorage.setItem("folio_font_size", size.toString());

                      // 2) If text was selected (saved range from selectionchange),
                      // additionally wrap it in a span with the explicit size.
                      const saved = savedRangeRef.current;
                      const div = contentRef.current;
                      if (saved && !saved.collapsed && div) {
                        div.focus();
                        const sel = window.getSelection();
                        if (sel) { sel.removeAllRanges(); sel.addRange(saved); }
                        // eslint-disable-next-line @typescript-eslint/no-deprecated
                        document.execCommand("fontSize", false, "7");
                        div.querySelectorAll("font[size='7']").forEach((el) => {
                          const span = document.createElement("span");
                          span.style.fontSize = `${size}px`;
                          while (el.firstChild) span.appendChild(el.firstChild);
                          el.replaceWith(span);
                        });
                        scheduleAutosave();
                        updateWordCount();
                      }
                    }}
                    title="Font size"
                  >
                    {[12, 14, 15, 16, 18, 20, 22, 24].map((s) => (
                      <option key={s} value={s}>{s}px</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Find bar */}
              {findOpen && (
                <div className="search-bar open">
                  <span style={{ color: "var(--accent)", display: "flex" }}><Ico.Search /></span>
                  <input
                    ref={findInputRef}
                    type="text"
                    placeholder="Find in document…"
                    value={findQuery}
                    onChange={(e) => findInDoc(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") { navMatch(e.shiftKey ? -1 : 1); e.preventDefault(); }
                      if (e.key === "Escape") closeFindBar();
                    }}
                  />
                  <span className="match-count">{matchCount}</span>
                  <div style={{ display: "flex", gap: 2 }}>
                    <button className="icon-btn" onClick={() => navMatch(-1)}><Ico.ChevL /></button>
                    <button className="icon-btn" onClick={() => navMatch(1)}><Ico.ChevR /></button>
                  </div>
                  <button className="icon-btn" onClick={closeFindBar}><Ico.Close /></button>
                </div>
              )}

              {/* Conflict resolution banner */}
              {conflicts.length > 0 && (() => {
                const conflict = conflicts[0];
                const idx = 0;
                const total = conflicts.length;
                return (
                  <div className="conflict-banner">
                    <div className="conflict-banner-icon">⚠</div>
                    <div className="conflict-banner-body">
                      <span className="conflict-banner-title">
                        &ldquo;{conflict.docName}&rdquo; was edited offline and on the server.
                        {total > 1 && <span className="conflict-banner-count"> ({idx + 1} of {total})</span>}
                      </span>
                      <div className="conflict-banner-actions">
                        <button
                          className="conflict-btn conflict-btn--local"
                          onClick={() => resolveConflict(conflict.docId, "local")}
                        >
                          Keep my version
                        </button>
                        <button
                          className="conflict-btn conflict-btn--remote"
                          onClick={() => resolveConflict(conflict.docId, "remote")}
                        >
                          Keep server version
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })()}

              <div className="editor-body" id="folio-editor-body">

              {/* Floating controls pill */}
              <div className="editor-controls-pill" ref={pillRef}>
                <div className="ecp-seg">
                  {(["none", "indent", "double"] as const).map((mode) => (
                    <button
                      key={mode}
                      className={`ecp-seg-btn${paragraphMode === mode ? " active" : ""}`}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        const div = contentRef.current;
                        const saved = savedRangeRef.current;
                        if (saved && !saved.collapsed && div && div.contains(saved.commonAncestorContainer)) {
                          div.querySelectorAll("p, div:not([id]):not([class])").forEach((p) => {
                            if (saved.intersectsNode(p)) {
                              const el = p as HTMLElement;
                              if (mode === "double") { el.style.lineHeight = "1.7"; el.style.marginBottom = "28px"; el.style.marginTop = "0"; el.style.textIndent = ""; }
                              else if (mode === "indent") { el.style.lineHeight = "1.7"; el.style.marginBottom = "0"; el.style.marginTop = "0"; el.style.textIndent = "2em"; }
                              else { el.style.lineHeight = "1.4"; el.style.marginBottom = "0"; el.style.marginTop = "0"; el.style.textIndent = ""; }
                            }
                          });
                          scheduleAutosave();
                        } else { setParagraphMode(mode); }
                      }}
                      title={mode === "none" ? "Normal spacing" : mode === "indent" ? "Indent paragraphs" : "Double spacing"}
                    >
                      {mode === "none" ? "Normal" : mode === "indent" ? "Indent" : "Double"}
                    </button>
                  ))}
                </div>
                <div className="ecp-sep" />
                <button className={`ecp-icon-btn${typewriterMode ? " active" : ""}`} onClick={() => setTypewriterMode((v) => !v)} title="Typewriter mode">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01M8 12h.01M12 12h.01M16 12h.01M7 16h10"/></svg>
                </button>
                <button className={`ecp-icon-btn${focusMode ? " active" : ""}`} onClick={() => setFocusMode((v) => !v)} title="Focus mode">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/></svg>
                </button>
                <button
                  className={`ecp-seg-btn${ltEnabled ? " active" : ""}`}
                  onClick={() => setLtEnabled((v) => !v)}
                  title={ltEnabled ? "Grammar check on — click to disable" : "Grammar check off — click to enable"}
                  style={{ fontSize: 11 }}
                >
                  {ltEnabled ? "✓ Grammar" : "Grammar off"}
                </button>
                {ltEnabled && ltStatus !== "idle" && ltStatus !== "checking" && (
                  <span className={`ecp-badge ${ltStatus === 0 ? "ecp-badge--ok" : "ecp-badge--warn"}`}>
                    {ltStatus === 0 ? "✓ Clean" : `${ltStatus} issue${ltStatus === 1 ? "" : "s"}`}
                  </span>
                )}
                <div className="ecp-sep" />
                <button className={`ecp-tab${chNotesOpen ? " active" : ""}`} onClick={() => setChNotesOpen((v) => !v)} title="Chapter Notes">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
                  Notes
                  {activeDocId && chNotesHaveContent(state.chapterNotes?.[activeDocId]) && <span className="cn-dot" style={{ position: "relative", top: 0, right: 0, width: 5, height: 5 }} />}
                </button>
                <button className={`ecp-tab${cardsOpen ? " active" : ""}`} onClick={() => { setCardsOpen((v) => !v); if (chNotesOpen) setChNotesOpen(false); }} title="Novel Notes Cards">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
                  Cards
                </button>
              </div>

              <div className="editor-paper">
                <div className="sprint-trigger-row">
                  <button className="sprint-trigger-btn" onClick={openSprintModal}>
                    <Ico.Clock /> Start Sprint
                  </button>
                </div>
                <textarea
                  className="editor-title-input"
                  ref={titleRef}
                  placeholder="Chapter title…"
                  rows={1}
                  defaultValue={activeDoc.name}
                  onInput={(e) => {
                    autoResize(e.currentTarget);
                    updateWordCount();
                    scheduleAutosave();
                  }}
                />
                <div
                  className="editor-content"
                  ref={contentRef}
                  contentEditable
                  suppressContentEditableWarning
                  data-placeholder="Start writing…"
                  style={{ fontSize: `${fontSize}px` }}
                  onFocus={handleEditorFocus}
                  onKeyDown={handleEditorKeyDown}
                  onMouseOver={(e) => {
                    const mark = (e.target as HTMLElement).closest(".lt-mark") as HTMLElement | null;
                    if (!mark) return;
                    if (ltTooltipTimerRef.current) clearTimeout(ltTooltipTimerRef.current);
                    const offset = parseInt(mark.dataset.ltOffset ?? "0");
                    const length = parseInt(mark.dataset.ltLength ?? "0");
                    const m = ltMatches.find((x) => x.offset === offset && x.length === length);
                    if (!m) return;
                    const rect = mark.getBoundingClientRect();
                    setLtTooltip({ match: m, x: rect.left, y: rect.bottom + 6 });
                  }}
                  onMouseLeave={() => {
                    ltTooltipTimerRef.current = setTimeout(() => setLtTooltip(null), 200);
                  }}
                  // Initial content is loaded imperatively in openDoc() via
                  // loadEditorContent so we can choose between innerHTML
                  // (rich) and textContent (legacy plain) safely.
                  onPaste={(e) => {
                    // Strip pasted HTML — accept only plain text. This is
                    // the primary XSS guard for the contentEditable editor.
                    e.preventDefault();
                    const text = e.clipboardData.getData("text/plain");
                    // eslint-disable-next-line @typescript-eslint/no-deprecated
                    document.execCommand("insertText", false, text);
                  }}
                  onInput={() => {
                    updateWordCount();
                    scheduleAutosave();
                    typewriterScroll();
                    scheduleGrammarCheck();
                  }}
                />
              </div>{/* /editor-paper */}
              </div>
              </div>{/* /editor-col */}

              {/* ── Chapter Notes Sidebar ── */}
              {chNotesOpen && activeDoc && (
                <div className="cn-sidebar">
                  <div className="cn-header">
                    <span className="cn-header-title">{activeDoc.name}</span>
                    <button className="cn-close" onClick={() => setChNotesOpen(false)} title="Close">
                      <Ico.Close />
                    </button>
                  </div>

                  {/* Quick chapter switcher */}
                  {activeProject && activeProject.docs.length > 1 && (
                    <div className="cn-switcher">
                      {activeProject.docs.map((d) => (
                        <button
                          key={d.id}
                          className={`cn-switch-pill${d.id === activeDocId ? " active" : ""}`}
                          onClick={() => openDoc(activeProject.id, d.id)}
                        >
                          {d.name}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Tabs */}
                  <div className="cn-tabs">
                    {(["notes", "todo", "meta"] as const).map((t) => (
                      <button
                        key={t}
                        className={`cn-tab${chNotesTab === t ? " active" : ""}`}
                        onClick={() => setChNotesTab(t)}
                      >
                        {t === "notes" ? "Notes" : t === "todo" ? "To-do" : "Meta"}
                      </button>
                    ))}
                  </div>

                  {/* Tab content */}
                  <div className="cn-body">
                    {chNotesTab === "notes" && (
                      <>
                        <div className="cn-field">
                          <label className="cn-label">Chapter summary</label>
                          <textarea
                            className="cn-textarea cn-summary"
                            placeholder="One-line summary…"
                            value={chNotesDraft.summary}
                            onChange={(e) => setChNotesDraft((d) => ({ ...d, summary: e.target.value }))}
                            rows={2}
                          />
                        </div>
                        <div className="cn-field">
                          <label className="cn-label">Key moments</label>
                          <textarea
                            className="cn-textarea"
                            placeholder="Major beats, turning points…"
                            value={chNotesDraft.keyMoments}
                            onChange={(e) => setChNotesDraft((d) => ({ ...d, keyMoments: e.target.value }))}
                            rows={3}
                          />
                        </div>
                        <div className="cn-field">
                          <label className="cn-label">Status tags</label>
                          <div className="cn-tags">
                            {(["Needs Edit", "First Draft", "Polished", "Cut?", "Foreshadowing", "POV Shift"] as const).map((tag) => (
                              <button
                                key={tag}
                                className={`cn-tag${chNotesDraft.tags.includes(tag) ? " active" : ""}`}
                                onClick={() =>
                                  setChNotesDraft((d) => ({
                                    ...d,
                                    tags: d.tags.includes(tag)
                                      ? d.tags.filter((t) => t !== tag)
                                      : [...d.tags, tag],
                                  }))
                                }
                              >
                                {tag}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="cn-field">
                          <label className="cn-label">
                            Notes
                            <span className="cn-charcount">{chNotesDraft.notes.length}/2000</span>
                          </label>
                          <textarea
                            className="cn-textarea cn-notes-ta"
                            placeholder="Freeform notes, ideas, questions…"
                            value={chNotesDraft.notes}
                            onChange={(e) => setChNotesDraft((d) => ({ ...d, notes: e.target.value.slice(0, 2000) }))}
                            rows={5}
                          />
                        </div>
                      </>
                    )}

                    {chNotesTab === "todo" && (
                      <>
                        <div className="cn-todo-list">
                          {chNotesDraft.todos.length === 0 && (
                            <p className="cn-empty">No tasks yet. Add one below.</p>
                          )}
                          {chNotesDraft.todos.map((item) => (
                            <div key={item.id} className="cn-todo-item">
                              <input
                                type="checkbox"
                                checked={item.done}
                                onChange={() =>
                                  setChNotesDraft((d) => ({
                                    ...d,
                                    todos: d.todos.map((t) =>
                                      t.id === item.id ? { ...t, done: !t.done } : t
                                    ),
                                  }))
                                }
                              />
                              <span className={item.done ? "cn-todo-text done" : "cn-todo-text"}>
                                {item.text}
                              </span>
                              <button
                                className="cn-todo-del"
                                onClick={() =>
                                  setChNotesDraft((d) => ({
                                    ...d,
                                    todos: d.todos.filter((t) => t.id !== item.id),
                                  }))
                                }
                                title="Remove"
                              >×</button>
                            </div>
                          ))}
                        </div>
                        <div className="cn-todo-add">
                          <input
                            className="cn-todo-input"
                            type="text"
                            placeholder="Add a task…"
                            value={chNotesTodoInput}
                            onChange={(e) => setChNotesTodoInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && chNotesTodoInput.trim()) {
                                setChNotesDraft((d) => ({
                                  ...d,
                                  todos: [...d.todos, { id: uid(), text: chNotesTodoInput.trim(), done: false }],
                                }));
                                setChNotesTodoInput("");
                                e.preventDefault();
                              }
                            }}
                          />
                          <button
                            className="cn-todo-addbtn"
                            onClick={() => {
                              if (!chNotesTodoInput.trim()) return;
                              setChNotesDraft((d) => ({
                                ...d,
                                todos: [...d.todos, { id: uid(), text: chNotesTodoInput.trim(), done: false }],
                              }));
                              setChNotesTodoInput("");
                            }}
                            title="Add task"
                          >+</button>
                        </div>
                      </>
                    )}

                    {chNotesTab === "meta" && (
                      <>
                        <div className="cn-field">
                          <label className="cn-label">POV character</label>
                          <input
                            className="cn-input"
                            type="text"
                            placeholder="Who narrates this chapter?"
                            value={chNotesDraft.pov}
                            onChange={(e) => setChNotesDraft((d) => ({ ...d, pov: e.target.value }))}
                          />
                        </div>
                        <div className="cn-field">
                          <label className="cn-label">Timeline / Time of day</label>
                          <input
                            className="cn-input"
                            type="text"
                            placeholder="e.g. Day 3, midday"
                            value={chNotesDraft.timeline}
                            onChange={(e) => setChNotesDraft((d) => ({ ...d, timeline: e.target.value }))}
                          />
                        </div>
                        <div className="cn-field">
                          <label className="cn-label">Location</label>
                          <input
                            className="cn-input"
                            type="text"
                            placeholder="Where does this take place?"
                            value={chNotesDraft.location}
                            onChange={(e) => setChNotesDraft((d) => ({ ...d, location: e.target.value }))}
                          />
                        </div>
                        <div className="cn-field">
                          <label className="cn-label">Characters present</label>
                          <textarea
                            className="cn-textarea"
                            placeholder="List of characters in this chapter…"
                            value={chNotesDraft.characters}
                            onChange={(e) => setChNotesDraft((d) => ({ ...d, characters: e.target.value }))}
                            rows={3}
                          />
                        </div>
                        <div className="cn-field">
                          <label className="cn-label">Themes / Motifs</label>
                          <textarea
                            className="cn-textarea"
                            placeholder="Themes, symbols, motifs…"
                            value={chNotesDraft.themes}
                            onChange={(e) => setChNotesDraft((d) => ({ ...d, themes: e.target.value }))}
                            rows={3}
                          />
                        </div>
                      </>
                    )}
                  </div>

                  {/* Footer */}
                  <div className="cn-footer">
                    <button
                      className="cn-save-btn"
                      onClick={saveChapterNotes}
                    >
                      {chNotesSaved ? "Saved ✓" : "Save notes"}
                    </button>
                  </div>
                </div>
              )}

              {/* ── Novel Notes Cards Sidebar ── */}
              {cardsOpen && (
                <div className="nncards-sidebar">
                  <div className="cn-header">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, color: "var(--accent)" }}>
                      <rect x="2" y="3" width="20" height="14" rx="2" />
                      <line x1="8" y1="21" x2="16" y2="21" />
                      <line x1="12" y1="17" x2="12" y2="21" />
                    </svg>
                    <span className="cn-header-title">Novel Notes Cards</span>
                    <button
                      className="nncards-new-btn"
                      onClick={() => setTypePickerOpen((v) => !v)}
                      title={typePickerOpen ? "Cancel" : "Add a new card"}
                      disabled={!nnSelPid}
                    >
                      {typePickerOpen ? "×" : "+ New"}
                    </button>
                    <button className="cn-close" onClick={() => setCardsOpen(false)} title="Close"><Ico.Close /></button>
                  </div>

                  {/* Project selector */}
                  {nnProjects.length > 1 && (
                    <div className="nncards-proj-row">
                      <select
                        className="nncards-proj-select"
                        value={nnSelPid ?? ""}
                        onChange={(e) => setNnSelPid(e.target.value)}
                      >
                        {nnProjects.map((p) => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Type picker — same grid as the NN toolbar. Picking a type
                       opens the full editor pre-filled with that type's NN
                       defaults (see openCreatorForType / NNCardEditor). */}
                  {typePickerOpen && nnSelPid && (
                    <div className="nncards-typepicker">
                      <div className="nncards-typepicker-title">Pick a card type</div>
                      <div className="nncards-typepicker-grid">
                        {NN_CARD_TYPES.map((t) => (
                          <button
                            key={t.type}
                            className="nncards-typepicker-btn"
                            onClick={() => openCreatorForType(t.type)}
                          >
                            <span className="nncards-typepicker-dot" style={{ background: t.color }} />
                            <span className="nncards-typepicker-label">{t.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="cn-body">
                    {nnLoading && <p className="cn-empty">Loading cards…</p>}
                    {!nnLoading && !nnSelPid && <p className="cn-empty">No Novel Notes data found.</p>}
                    {!nnLoading && nnSelPid && (() => {
                      const projData = nnRawData?.[nnSelPid];
                      const cardsMap = projData?.cards ?? {};
                      const sectionsWithCards = NN_SECTIONS.filter((s) => (cardsMap[s.id]?.length ?? 0) > 0);
                      if (sectionsWithCards.length === 0) {
                        return (
                          <p className="cn-empty">
                            No cards in this project yet.<br/>
                            Click <strong>+ New</strong> above to add one.
                          </p>
                        );
                      }
                      return sectionsWithCards.map((section) => (
                        <div key={section.id} className="nncards-group">
                          <div className="nncards-group-label">{section.label}</div>
                          {cardsMap[section.id].map((card) => {
                            const displayName = card.name ?? card.title ?? "Untitled";
                            const typeLabel = card.type === "char-card" || card.type === "char-card-full" ? "Character"
                              : card.type === "rule-card" ? "World Rule"
                              : card.type === "rel-card" ? "Relationship"
                              : card.type ?? "Card";
                            return (
                              <button
                                key={card.id}
                                className="nncards-item"
                                onClick={() => setEditorTarget({ kind: "edit", sectionId: section.id, card })}
                                title="Click to edit"
                              >
                                <span className="nncards-item-name">{displayName}</span>
                                <span className="nncards-item-type">{typeLabel}</span>
                              </button>
                            );
                          })}
                        </div>
                      ));
                    })()}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Novel Notes Card Editor (renders the actual NN card) ── */}
      {editorTarget && (
        <NNCardEditor
          // Mount-key on the card id so React unmounts/remounts when the user
          // switches between cards (otherwise the draft state would persist
          // across distinct cards).
          key={editorTarget.card.id}
          initialCard={editorTarget.card}
          onSave={handleEditorSave}
          onCancel={() => setEditorTarget(null)}
          onDelete={handleEditorDelete}
        />
      )}

      {/* STATUS MENU */}
      <div className={`status-menu${statusMenuOpen ? " open" : ""}`} style={{ top: statusMenuPos.top, left: statusMenuPos.left }}>
        {(Object.keys(STATUS) as StatusKey[]).map((k) => (
          <div key={k} className="status-menu-item" onClick={() => setDocStatus(k)}>
            <div className="status-menu-dot" style={{ background: STATUS[k].color }} />
            {STATUS[k].label}
          </div>
        ))}
      </div>

      {/* PROJECT MODAL */}
      <div className={`folio-modal-overlay${projectModal.open ? " open" : ""}`}>
        <div className="folio-modal">
          <div className="modal-header">
            <span className="modal-title">{projectModal.editingId ? "Rename Project" : "New Project"}</span>
            <button className="modal-close" onClick={() => setProjectModal({ open: false, editingId: null, name: "" })}><Ico.Close /></button>
          </div>
          <div className="modal-body">
            <div className="field">
              <label>Project Name</label>
              <input
                type="text"
                placeholder="e.g. The Midnight Draft"
                maxLength={80}
                value={projectModal.name}
                autoFocus
                onChange={(e) => setProjectModal((m) => ({ ...m, name: e.target.value }))}
                onKeyDown={(e) => e.key === "Enter" && saveProjectModal()}
              />
            </div>
          </div>
          <div className="modal-footer">
            <button className="btn btn-ghost" onClick={() => setProjectModal({ open: false, editingId: null, name: "" })}>Cancel</button>
            <button className="btn btn-primary" onClick={saveProjectModal}>{projectModal.editingId ? "Save" : "Create"}</button>
          </div>
        </div>
      </div>

      {/* DOC MODAL */}
      <div className={`folio-modal-overlay${docModal.open ? " open" : ""}`}>
        <div className="folio-modal">
          <div className="modal-header">
            <span className="modal-title">{docModal.editingId ? "Rename Document" : "New Document"}</span>
            <button className="modal-close" onClick={() => setDocModal((m) => ({ ...m, open: false }))}><Ico.Close /></button>
          </div>
          <div className="modal-body">
            <div className="field">
              <label>Document Name</label>
              <input
                type="text"
                placeholder="e.g. Chapter One"
                maxLength={80}
                value={docModal.name}
                autoFocus
                onChange={(e) => setDocModal((m) => ({ ...m, name: e.target.value }))}
                onKeyDown={(e) => e.key === "Enter" && saveDocModal()}
              />
            </div>
            {!docModal.editingId && (
              <div className="field">
                <label>Status</label>
                <div className="status-options">
                  {(Object.keys(STATUS) as StatusKey[]).map((k) => (
                    <button
                      key={k}
                      className={`status-opt${docModal.status === k ? " active" : ""}`}
                      style={{ color: STATUS[k].color }}
                      onClick={() => setDocModal((m) => ({ ...m, status: k }))}
                    >
                      <span className="status-menu-dot" style={{ background: STATUS[k].color }} />
                      {STATUS[k].label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="modal-footer">
            <button className="btn btn-ghost" onClick={() => setDocModal((m) => ({ ...m, open: false }))}>Cancel</button>
            <button className="btn btn-primary" onClick={saveDocModal}>{docModal.editingId ? "Save" : "Create"}</button>
          </div>
        </div>
      </div>

      {/* COMPILE MODAL */}
      <div className={`folio-modal-overlay${compileModal.open ? " open" : ""}`}>
        <div className="folio-modal" style={{ width: 500 }}>
          <div className="modal-header">
            <span className="modal-title">Export Project</span>
            <button className="modal-close" onClick={() => setCompileModal((c) => ({ ...c, open: false }))}><Ico.Close /></button>
          </div>
          <div className="modal-body">
            <div className="field">
              <label>Project</label>
              <select value={compileModal.projectId} onChange={(e) => updateCompileProject(e.target.value)}>
                {state.projects.map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}
              </select>
            </div>
            <div className="field">
              <label>Include chapters (drag to reorder)</label>
              <div className="compile-doc-list">
                {(() => {
                  const proj = state.projects.find((p) => p.id === compileModal.projectId);
                  if (!proj) return null;
                  return compileModal.order.map((id) => {
                    const doc = proj.docs.find((d) => d.id === id);
                    if (!doc) return null;
                    return (
                      <div
                        key={id}
                        className="compile-doc-item"
                        draggable
                        onDragStart={() => onCompileDragStart(id)}
                        onDragOver={(e) => onCompileDragOver(e, id)}
                      >
                        <div className="drag-handle"><Ico.Drag /></div>
                        <input
                          type="checkbox"
                          checked={!!compileModal.checked[id]}
                          onChange={(e) => setCompileModal((c) => ({ ...c, checked: { ...c.checked, [id]: e.target.checked } }))}
                        />
                        <span className="compile-doc-name">{doc.name}</span>
                        <span className="compile-doc-wc">{wc((doc.name || "") + " " + docPlainText(doc.content))} w</span>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
            <div className="field">
              <label>Format</label>
              <div style={{ display: "flex", gap: 8 }}>
                <button className={`sprint-option${compileModal.format === "txt" ? " active" : ""}`} onClick={() => setCompileModal((c) => ({ ...c, format: "txt" }))}>Plain text</button>
                <button className={`sprint-option${compileModal.format === "md" ? " active" : ""}`} onClick={() => setCompileModal((c) => ({ ...c, format: "md" }))}>Markdown</button>
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button className="btn btn-ghost" onClick={() => setCompileModal((c) => ({ ...c, open: false }))}>Cancel</button>
            <button className="btn btn-primary" onClick={runCompile}><Ico.Download /> Download</button>
          </div>
        </div>
      </div>

      {/* DAILY GOAL MODAL */}
      <div className={`folio-modal-overlay${dailyGoalModal.open ? " open" : ""}`}>
        <div className="folio-modal" style={{ width: 340 }}>
          <div className="modal-header">
            <span className="modal-title">Daily Word Goal</span>
            <button className="modal-close" onClick={() => setDailyGoalModal({ open: false, value: "" })}><Ico.Close /></button>
          </div>
          <div className="modal-body">
            <div className="field">
              <label>Words per day</label>
              <input
                className="goal-big-input"
                type="number"
                min={0}
                max={99999}
                placeholder="500"
                value={dailyGoalModal.value}
                onChange={(e) => setDailyGoalModal((m) => ({ ...m, value: e.target.value }))}
                autoFocus
              />
            </div>
            <p style={{ fontSize: 12.5, color: "var(--text-muted)", lineHeight: 1.6 }}>
              Set to 0 to hide the progress bar. Progress resets at midnight.
            </p>
          </div>
          <div className="modal-footer">
            <button className="btn btn-ghost" onClick={() => setDailyGoalModal({ open: false, value: "" })}>Cancel</button>
            <button
              className="btn btn-primary"
              onClick={() => {
                setDailyGoal(parseInt(dailyGoalModal.value, 10) || 0);
                setDailyGoalModal({ open: false, value: "" });
                showToast("Goal updated");
              }}
            >Save</button>
          </div>
        </div>
      </div>

      {/* CONFIRM */}
      <div className={`confirm-overlay${confirmModal.open ? " open" : ""}`}>
        <div className="confirm-box">
          <h3>{confirmModal.title}</h3>
          <p>{confirmModal.text}</p>
          <div className="confirm-actions">
            <button className="btn btn-ghost" onClick={() => setConfirmModal({ open: false, title: "", text: "", action: null })}>Cancel</button>
            <button
              className="btn btn-danger"
              onClick={() => {
                confirmModal.action?.();
                setConfirmModal({ open: false, title: "", text: "", action: null });
              }}
            >Delete</button>
          </div>
        </div>
      </div>

      {/* STICKY NOTE — draggable, resizable, per-chapter */}
      <StickyNote
        open={stickyOpen}
        onClose={() => setStickyOpen(false)}
        noteKey={activeDocId ?? "global"}
        title={activeDoc ? `Notes · ${activeDoc.name}` : "Notes"}
      />

      {/* SPRINT POPUP — small lobby that navigates to /room on submit */}
      <SprintPopup
        open={sprintModal}
        onClose={closeSprintModal}
        chapterTitle={activeDoc?.name ?? null}
        chapterContent={activeDoc ? (editorText() || docPlainText(activeDoc.content)) : ""}
      />

      {/* TOAST */}
      <div className={`folio-toast${toastShow ? " show" : ""}`}>{toastMsg}</div>

      {/* GRAMMAR TOOLTIP — fixed-position popover shown on lt-mark hover */}
      {ltTooltip && (
        <div
          className="lt-tooltip"
          style={{ left: Math.min(ltTooltip.x, window.innerWidth - 310), top: ltTooltip.y }}
          onMouseEnter={() => { if (ltTooltipTimerRef.current) clearTimeout(ltTooltipTimerRef.current); }}
          onMouseLeave={() => { ltTooltipTimerRef.current = setTimeout(() => setLtTooltip(null), 100); }}
        >
          <div className="lt-tooltip-msg">{ltTooltip.match.message}</div>
          <div className="lt-tooltip-actions">
            {ltTooltip.match.replacements.slice(0, 3).map((r, i) => (
              <button
                key={i}
                className="lt-tooltip-fix"
                onClick={() => {
                  applyFixMark(ltTooltip.match.offset, ltTooltip.match.length, r.value);
                  setLtTooltip(null);
                }}
              >
                {r.value}
              </button>
            ))}
            <button
              className="lt-tooltip-ignore"
              onClick={() => {
                ignoreMark(ltTooltip.match.offset, ltTooltip.match.length);
                setLtTooltip(null);
              }}
            >
              Ignore
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
