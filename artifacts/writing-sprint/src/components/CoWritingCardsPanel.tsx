/**
 * Novel Notes Cards side-panel for the Co-Writing room.
 *
 * Same UI + behaviour as the Folio "Novel Notes Cards" sidebar in MyFiles.tsx:
 *   - Grouped list of the user's cards, by section (Characters, Factions, …)
 *   - "+ New" → type picker → opens the full NNCardEditor
 *   - Project selector when the user has multiple NN projects
 *
 * Data flow is identical to the Folio panel: read nnData from IndexedDB
 * (always current) with a server fallback, write changes back to BOTH stores
 * so the data stays in sync across surfaces (Folio + Co-writing + the static
 * /novel-notes.html canvas all see the same cards).
 *
 * The data is PRIVATE per user — every writer in a room sees ONLY their own
 * cards. The API endpoint /api/novel-notes is scoped by Clerk userId.
 */

import { useEffect, useState, useCallback } from "react";
import {
  type NNCard, type NnRawData,
  NN_SECTIONS, NN_CARD_TYPES,
  idbFolioGet, readNNProjects, mutateNNCards, buildNNCard,
  NNCardEditor,
} from "@/lib/novelNotesShared";

interface CoWritingCardsPanelProps {
  onClose: () => void;
  authedFetch: (url: string, init?: RequestInit) => Promise<Response>;
}

type EditorTarget =
  | { kind: "create"; sectionId: string; card: NNCard }
  | { kind: "edit";   sectionId: string; card: NNCard };

export function CoWritingCardsPanel({ onClose, authedFetch }: CoWritingCardsPanelProps) {
  const [nnRawData, setNnRawData] = useState<NnRawData | null>(null);
  const [nnProjects, setNnProjects] = useState<{ id: string; name: string }[]>([]);
  const [nnSelPid, setNnSelPid] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [typePickerOpen, setTypePickerOpen] = useState(false);
  const [editorTarget, setEditorTarget] = useState<EditorTarget | null>(null);

  // Load nnData on mount — IndexedDB first (always current with Folio edits),
  // server fallback if IDB is empty.
  useEffect(() => {
    setLoading(true);
    Promise.all([
      idbFolioGet<NnRawData>("novel_notes_v1"),
      readNNProjects(),
      authedFetch("/api/novel-notes").then((r) => (r.ok ? r.json() : null)).catch(() => null),
    ]).then(([idbData, projects, apiRes]) => {
      const rawData = (idbData && Object.keys(idbData).length > 0)
        ? idbData
        : (apiRes?.nnData ?? {});
      setNnRawData(rawData);
      setNnProjects(projects);
      const firstPid = Object.keys(rawData)[0] ?? null;
      setNnSelPid(firstPid);
    }).finally(() => setLoading(false));
  }, [authedFetch]);

  // ── Editor handlers — mirror MyFiles.tsx behaviour ─────────────────────
  const handleEditorSave = useCallback(
    async (saved: NNCard) => {
      if (!nnSelPid || !editorTarget) return;
      const next = await mutateNNCards(nnSelPid, editorTarget.sectionId, (cards) => {
        const idx = cards.findIndex((c) => c.id === saved.id);
        if (idx === -1) return [...cards, saved];
        const out = cards.slice();
        out[idx] = saved;
        return out;
      }, authedFetch);
      setNnRawData(next);
    },
    [nnSelPid, editorTarget, authedFetch],
  );

  const handleEditorDelete = useCallback(async () => {
    if (!nnSelPid || !editorTarget) return;
    const next = await mutateNNCards(nnSelPid, editorTarget.sectionId, (cards) =>
      cards.filter((c) => c.id !== editorTarget.card.id),
    authedFetch);
    setNnRawData(next);
    setEditorTarget(null);
  }, [nnSelPid, editorTarget, authedFetch]);

  const openCreatorForType = useCallback((type: string) => {
    const def = NN_CARD_TYPES.find((t) => t.type === type);
    const sectionId = def?.defaultSection ?? "overview";
    setEditorTarget({ kind: "create", sectionId, card: buildNNCard(type) });
    setTypePickerOpen(false);
  }, []);

  return (
    <>
      <aside className="nncards-sidebar">
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
          <button className="cn-close" onClick={onClose} title="Close">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Project selector — visible when the user has more than one project */}
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

        {/* Type picker — same grid as the NN toolbar; picking a type opens
            the editor pre-filled with that type's NN defaults. */}
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
          {loading && <p className="cn-empty">Loading cards…</p>}
          {!loading && !nnSelPid && <p className="cn-empty">No Novel Notes data found.<br/>Click <strong>+ New</strong> above to start one.</p>}
          {!loading && nnSelPid && (() => {
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
      </aside>

      {/* Card editor — overlay above the whole room when a card is open */}
      {editorTarget && (
        <NNCardEditor
          key={editorTarget.card.id}
          initialCard={editorTarget.card}
          onSave={handleEditorSave}
          onCancel={() => setEditorTarget(null)}
          onDelete={handleEditorDelete}
        />
      )}
    </>
  );
}
