/**
 * Per-user, per-doc Notes side-panel for the Co-Writing room.
 *
 * This is the OTHER half of the Folio writing surface (the first half being
 * the Cards panel) — a personal scratchpad attached to the current document.
 *
 * Same structure as MyFiles.tsx's chapter-notes sidebar (summary, key moments,
 * tags, freeform notes, to-dos, meta), but the data is scoped to
 * (roomId, docId, userId) so every writer keeps their own private notes
 * about a shared chapter — not synced with the room.
 *
 * Storage: localStorage. Notes are intentionally private and small, so we
 * don't need a new server endpoint for this MVP. We can promote to a server-
 * persisted store later without changing the UI.
 */

import { useEffect, useState, useCallback, useRef } from "react";

const TAGS = ["Needs Edit", "First Draft", "Polished", "Cut?", "Foreshadowing", "POV Shift"] as const;

interface TodoItem { id: string; text: string; done: boolean; }
interface NotesData {
  summary: string;
  keyMoments: string;
  tags: string[];
  notes: string;
  todos: TodoItem[];
  pov: string;
  timeline: string;
  location: string;
  characters: string;
  themes: string;
}

const empty = (): NotesData => ({
  summary: "", keyMoments: "", tags: [], notes: "", todos: [],
  pov: "", timeline: "", location: "", characters: "", themes: "",
});

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

function lsKey(roomId: number, docId: number, userId: string): string {
  return `cowriting:notes:v1:${roomId}:${docId}:${userId}`;
}

function loadNotes(roomId: number, docId: number, userId: string): NotesData {
  try {
    const raw = localStorage.getItem(lsKey(roomId, docId, userId));
    if (!raw) return empty();
    const parsed = JSON.parse(raw) as Partial<NotesData>;
    return { ...empty(), ...parsed };
  } catch {
    return empty();
  }
}

function saveNotes(roomId: number, docId: number, userId: string, data: NotesData): void {
  try {
    localStorage.setItem(lsKey(roomId, docId, userId), JSON.stringify(data));
  } catch { /* ignore quota errors */ }
}

interface CoWritingNotesPanelProps {
  roomId: number;
  docId: number;
  docName: string;
  userId: string;
  onClose: () => void;
}

export function CoWritingNotesPanel({ roomId, docId, docName, userId, onClose }: CoWritingNotesPanelProps) {
  const [tab, setTab] = useState<"notes" | "todo" | "meta">("notes");
  const [draft, setDraft] = useState<NotesData>(() => loadNotes(roomId, docId, userId));
  const [todoInput, setTodoInput] = useState("");
  const [saved, setSaved] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reload from storage whenever the doc or user changes.
  useEffect(() => {
    setDraft(loadNotes(roomId, docId, userId));
    setTodoInput("");
    setSaved(false);
  }, [roomId, docId, userId]);

  // Auto-save every change with a tiny debounce so we don't thrash storage.
  useEffect(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveNotes(roomId, docId, userId, draft);
      setSaved(true);
      const t = setTimeout(() => setSaved(false), 1200);
      return () => clearTimeout(t);
    }, 400);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [draft, roomId, docId, userId]);

  // Flush on unmount so closing the panel mid-keystroke doesn't drop edits.
  useEffect(() => () => {
    saveNotes(roomId, docId, userId, draft);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addTodo = useCallback(() => {
    const text = todoInput.trim();
    if (!text) return;
    setDraft((d) => ({ ...d, todos: [...d.todos, { id: uid(), text, done: false }] }));
    setTodoInput("");
  }, [todoInput]);

  return (
    <aside className="cn-sidebar cw-notes-sidebar">
      <div className="cn-header">
        <span className="cn-header-title" title={docName}>{docName}</span>
        <span className="cn-private-badge" title="Notes here are private to you — not shared with the room">Private</span>
        <button className="cn-close" onClick={onClose} title="Close">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      <div className="cn-tabs">
        {(["notes", "todo", "meta"] as const).map((t) => (
          <button
            key={t}
            className={`cn-tab${tab === t ? " active" : ""}`}
            onClick={() => setTab(t)}
          >
            {t === "notes" ? "Notes" : t === "todo" ? "To-do" : "Meta"}
          </button>
        ))}
      </div>

      <div className="cn-body">
        {tab === "notes" && (
          <>
            <div className="cn-field">
              <label className="cn-label">Chapter summary</label>
              <textarea
                className="cn-textarea cn-summary"
                placeholder="One-line summary…"
                value={draft.summary}
                onChange={(e) => setDraft((d) => ({ ...d, summary: e.target.value }))}
                rows={2}
              />
            </div>
            <div className="cn-field">
              <label className="cn-label">Key moments</label>
              <textarea
                className="cn-textarea"
                placeholder="Major beats, turning points…"
                value={draft.keyMoments}
                onChange={(e) => setDraft((d) => ({ ...d, keyMoments: e.target.value }))}
                rows={3}
              />
            </div>
            <div className="cn-field">
              <label className="cn-label">Status tags</label>
              <div className="cn-tags">
                {TAGS.map((tag) => (
                  <button
                    key={tag}
                    className={`cn-tag${draft.tags.includes(tag) ? " active" : ""}`}
                    onClick={() => setDraft((d) => ({
                      ...d,
                      tags: d.tags.includes(tag) ? d.tags.filter((t) => t !== tag) : [...d.tags, tag],
                    }))}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
            <div className="cn-field">
              <label className="cn-label">
                Notes
                <span className="cn-charcount">{draft.notes.length}/2000</span>
              </label>
              <textarea
                className="cn-textarea cn-notes-ta"
                placeholder="Freeform notes, ideas, questions…"
                value={draft.notes}
                onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value.slice(0, 2000) }))}
                rows={5}
              />
            </div>
          </>
        )}

        {tab === "todo" && (
          <>
            <div className="cn-todo-list">
              {draft.todos.length === 0 && (
                <p className="cn-empty">No tasks yet. Add one below.</p>
              )}
              {draft.todos.map((item) => (
                <div key={item.id} className="cn-todo-item">
                  <input
                    type="checkbox"
                    checked={item.done}
                    onChange={() =>
                      setDraft((d) => ({
                        ...d,
                        todos: d.todos.map((t) => t.id === item.id ? { ...t, done: !t.done } : t),
                      }))
                    }
                  />
                  <span className={item.done ? "cn-todo-text done" : "cn-todo-text"}>{item.text}</span>
                  <button
                    className="cn-todo-del"
                    onClick={() => setDraft((d) => ({ ...d, todos: d.todos.filter((t) => t.id !== item.id) }))}
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
                value={todoInput}
                onChange={(e) => setTodoInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { addTodo(); e.preventDefault(); } }}
              />
              <button className="cn-todo-addbtn" onClick={addTodo} title="Add task">+</button>
            </div>
          </>
        )}

        {tab === "meta" && (
          <>
            <div className="cn-field">
              <label className="cn-label">POV character</label>
              <input
                className="cn-input"
                type="text"
                placeholder="Who narrates this chapter?"
                value={draft.pov}
                onChange={(e) => setDraft((d) => ({ ...d, pov: e.target.value }))}
              />
            </div>
            <div className="cn-field">
              <label className="cn-label">Timeline / Time of day</label>
              <input
                className="cn-input"
                type="text"
                placeholder="e.g. Day 3, midday"
                value={draft.timeline}
                onChange={(e) => setDraft((d) => ({ ...d, timeline: e.target.value }))}
              />
            </div>
            <div className="cn-field">
              <label className="cn-label">Location</label>
              <input
                className="cn-input"
                type="text"
                placeholder="Where does this take place?"
                value={draft.location}
                onChange={(e) => setDraft((d) => ({ ...d, location: e.target.value }))}
              />
            </div>
            <div className="cn-field">
              <label className="cn-label">Characters present</label>
              <textarea
                className="cn-textarea"
                placeholder="List of characters in this chapter…"
                value={draft.characters}
                onChange={(e) => setDraft((d) => ({ ...d, characters: e.target.value }))}
                rows={3}
              />
            </div>
            <div className="cn-field">
              <label className="cn-label">Themes / Motifs</label>
              <textarea
                className="cn-textarea"
                placeholder="Themes, symbols, motifs…"
                value={draft.themes}
                onChange={(e) => setDraft((d) => ({ ...d, themes: e.target.value }))}
                rows={3}
              />
            </div>
          </>
        )}
      </div>

      <div className="cn-footer">
        <span className="cn-save-hint">{saved ? "Saved ✓" : "Autosaved"}</span>
      </div>
    </aside>
  );
}
