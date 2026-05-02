import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useLocation } from "wouter";
import "./MyFiles.css";

type StatusKey = "draft" | "progress" | "done" | "edit";

interface Doc {
  id: string;
  name: string;
  content: string;
  status: StatusKey;
  updatedAt: number;
}
interface Project {
  id: string;
  name: string;
  open: boolean;
  docs: Doc[];
}
interface FolioState {
  projects: Project[];
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

function loadState(): FolioState {
  try {
    const raw = localStorage.getItem("folio_v3");
    if (raw) return JSON.parse(raw) as FolioState;
  } catch {}
  return { projects: [] };
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
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></svg>
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

export default function MyFiles() {
  const [, setLocation] = useLocation();

  // ── State ───────────────────────────────────────────────
  const [state, setState] = useState<FolioState>(() => loadState());
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [activeDocId, setActiveDocId] = useState<string | null>(null);
  const [recentDocs, setRecentDocs] = useState<RecentEntry[]>(() => loadRecent());
  const [globalSearch, setGlobalSearch] = useState("");
  const [statsOpen, setStatsOpen] = useState<Record<string, boolean>>({});
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);
  const [statusMenuPos, setStatusMenuPos] = useState({ top: 0, left: 0 });

  const [focusMode, setFocusMode] = useState(false);
  const [typewriterMode, setTypewriterMode] = useState(false);
  const [autosaveShown, setAutosaveShown] = useState(false);

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

  // Editor live values (uncontrolled-ish for performance)
  const titleRef = useRef<HTMLTextAreaElement | null>(null);
  const contentRef = useRef<HTMLTextAreaElement | null>(null);
  const [editorWordCount, setEditorWordCount] = useState(0);

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
  const [sprintPhase, setSprintPhase] = useState<"idle" | "sprinting" | "done">("idle");
  const [sprintDuration, setSprintDuration] = useState(20);
  const [sprintCustomMin, setSprintCustomMin] = useState("");
  const [sprintText, setSprintText] = useState("");
  const [sprintTimeLeft, setSprintTimeLeft] = useState(0);
  const [sprintIncludeChapter, setSprintIncludeChapter] = useState(true);
  const [sprintStartWords, setSprintStartWords] = useState(0);
  const sprintTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Toast
  const [toastMsg, setToastMsg] = useState("");
  const [toastShow, setToastShow] = useState(false);

  // ── Persistence ─────────────────────────────────────────
  useEffect(() => {
    localStorage.setItem("folio_v3", JSON.stringify(state));
  }, [state]);
  useEffect(() => {
    localStorage.setItem("folio_recent", JSON.stringify(recentDocs));
  }, [recentDocs]);
  useEffect(() => {
    localStorage.setItem("folio_daily_goal", String(dailyGoal));
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

  // Save current editor draft into state (called by autosave & navigation)
  const prevWordsRef = useRef(0);
  const saveCurrentDoc = useCallback(() => {
    if (!activeProjectId || !activeDocId) return;
    const titleVal = titleRef.current?.value || "";
    const contentVal = contentRef.current?.value || "";
    const newWC = wc(titleVal + " " + contentVal);
    const oldWC = prevWordsRef.current;
    const gained = Math.max(0, newWC - oldWC);
    prevWordsRef.current = newWC;

    setState((prev) => {
      const next = {
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
      return next;
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

  // Autosave debounce
  const autosaveTimer = useRef<number | null>(null);
  const scheduleAutosave = useCallback(() => {
    if (autosaveTimer.current) window.clearTimeout(autosaveTimer.current);
    autosaveTimer.current = window.setTimeout(() => {
      saveCurrentDoc();
      setAutosaveShown(true);
      setTimeout(() => setAutosaveShown(false), 2000);
    }, 1500);
  }, [saveCurrentDoc]);

  const updateWordCount = useCallback(() => {
    const t = (titleRef.current?.value || "") + " " + (contentRef.current?.value || "");
    setEditorWordCount(wc(t));
  }, []);

  const autoResize = (el: HTMLTextAreaElement | null) => {
    if (!el) return;
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  };

  // ── Doc / Project actions ───────────────────────────────
  const openDoc = (projId: string, docId: string) => {
    if (activeDocId) saveCurrentDoc();
    const proj = state.projects.find((p) => p.id === projId);
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
    // Defer: set ref values + word count after render
    setTimeout(() => {
      if (titleRef.current) {
        titleRef.current.value = doc.name;
        autoResize(titleRef.current);
      }
      if (contentRef.current) contentRef.current.value = doc.content;
      prevWordsRef.current = wc(doc.name + " " + doc.content);
      updateWordCount();
      contentRef.current?.focus();
    }, 0);
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
    saveCurrentDoc();
    showToast("Saved");
  };

  // ── Find in doc ─────────────────────────────────────────
  const escRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const findInDoc = (q: string) => {
    setFindQuery(q);
    findMatchesRef.current = [];
    findCurrentRef.current = -1;
    if (!q || !contentRef.current) {
      setMatchCount("");
      return;
    }
    const re = new RegExp(escRe(q), "gi");
    const c = contentRef.current.value;
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
  const scrollToMatch = () => {
    const ta = contentRef.current;
    const idx = findMatchesRef.current[findCurrentRef.current];
    if (!ta || idx === undefined) return;
    ta.focus();
    ta.setSelectionRange(idx, idx + findQuery.length);
    const lines = ta.value.substring(0, idx).split("\n").length;
    ta.scrollTop = Math.max(0, (lines - 3) * 28);
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

  // ── Toolbar editor helpers ──────────────────────────────
  const wrapText = (before: string, after: string) => {
    const ta = contentRef.current;
    if (!ta) return;
    const s = ta.selectionStart, e = ta.selectionEnd;
    const sel = ta.value.slice(s, e) || "text";
    ta.setRangeText(before + sel + after, s, e, "select");
    ta.focus();
    scheduleAutosave();
    updateWordCount();
  };
  const insertAtCursor = (text: string) => {
    const ta = contentRef.current;
    if (!ta) return;
    const s = ta.selectionStart;
    ta.setRangeText(text, s, s, "end");
    ta.focus();
    scheduleAutosave();
    updateWordCount();
  };
  const insertAtLineStart = (prefix: string) => {
    const ta = contentRef.current;
    if (!ta) return;
    const s = ta.selectionStart;
    const lineStart = ta.value.lastIndexOf("\n", s - 1) + 1;
    ta.setRangeText(prefix, lineStart, lineStart, "end");
    ta.focus();
    scheduleAutosave();
  };
  const applyHeading = (val: string) => {
    const ta = contentRef.current;
    if (!ta) return;
    const s = ta.selectionStart;
    const lineStart = ta.value.lastIndexOf("\n", s - 1) + 1;
    const lineEnd = ta.value.indexOf("\n", s);
    const end = lineEnd === -1 ? ta.value.length : lineEnd;
    const line = ta.value.slice(lineStart, end).replace(/^#{1,3}\s*/, "");
    const prefix = val === "h1" ? "# " : val === "h2" ? "## " : val === "h3" ? "### " : "";
    ta.setRangeText(prefix + line, lineStart, end, "end");
    ta.focus();
    scheduleAutosave();
  };

  // ── Typewriter scroll ───────────────────────────────────
  const typewriterScroll = () => {
    if (!typewriterMode) return;
    const ta = contentRef.current;
    const body = document.getElementById("folio-editor-body");
    if (!ta || !body) return;
    const lh = parseInt(getComputedStyle(ta).lineHeight) || 28;
    const pos = ta.value.substr(0, ta.selectionStart).split("\n").length;
    body.scrollTop = Math.max(0, pos * lh - body.clientHeight / 2);
  };

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

  // ── Project modal handlers ──────────────────────────────
  const saveProjectModal = () => {
    const name = projectModal.name.trim();
    if (!name) return;
    if (projectModal.editingId) {
      setState((prev) => ({
        projects: prev.projects.map((p) => (p.id === projectModal.editingId ? { ...p, name } : p)),
      }));
      showToast("Project renamed");
    } else {
      setState((prev) => ({
        projects: [...prev.projects, { id: uid(), name, open: true, docs: [] }],
      }));
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
  const openCompile = () => {
    const projId = activeProjectId || state.projects[0]?.id || "";
    const proj = state.projects.find((p) => p.id === projId);
    setCompileModal({
      open: true,
      projectId: projId,
      format: "txt",
      checked: Object.fromEntries((proj?.docs || []).map((d) => [d.id, true])),
      order: (proj?.docs || []).map((d) => d.id),
    });
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
      out = docs.map((d) => `# ${d.name}\n\n${d.content || ""}`).join("\n\n---\n\n");
    } else {
      out = docs.map((d) => `${d.name.toUpperCase()}\n\n${d.content || ""}`).join("\n\n* * *\n\n");
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

  // ── Sprint (in-place) ───────────────────────────────────
  // Reset whenever the modal opens
  useEffect(() => {
    if (sprintModal) {
      setSprintPhase("idle");
      setSprintCustomMin("");
      setSprintText("");
      setSprintIncludeChapter(true);
    }
  }, [sprintModal]);

  // Countdown timer
  useEffect(() => {
    if (sprintPhase !== "sprinting") return;
    const id = setInterval(() => {
      setSprintTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(id);
          setSprintPhase("done");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [sprintPhase]);

  const sprintWordCount = wc(sprintText);
  const sprintWordsWritten = Math.max(0, sprintWordCount - sprintStartWords);

  const startSprintNow = () => {
    const mins = sprintCustomMin ? parseInt(sprintCustomMin, 10) : sprintDuration;
    if (!mins || mins < 1 || mins > 300) {
      showToast("Pick 1–300 minutes");
      return;
    }
    const initial = sprintIncludeChapter && activeDoc ? (contentRef.current?.value || "") : "";
    setSprintText(initial);
    setSprintStartWords(wc(initial));
    setSprintTimeLeft(mins * 60);
    setSprintPhase("sprinting");
    setTimeout(() => {
      const ta = sprintTextareaRef.current;
      if (!ta) return;
      ta.focus();
      // place cursor at end so user keeps writing where chapter left off
      const end = ta.value.length;
      ta.setSelectionRange(end, end);
      ta.scrollTop = ta.scrollHeight;
    }, 60);
  };

  const endSprintEarly = () => {
    if (!confirm("End the sprint early?")) return;
    setSprintPhase("done");
  };

  const saveSprintToChapter = () => {
    if (!activeDoc || !contentRef.current) {
      showToast("No chapter to save to");
      return;
    }
    contentRef.current.value = sprintText;
    saveCurrentDoc();
    updateWordCount();
    setSprintModal(false);
    showToast(`Saved · +${sprintWordsWritten.toLocaleString()} word${sprintWordsWritten === 1 ? "" : "s"}`);
  };

  const closeSprintModal = () => {
    if (sprintPhase === "sprinting") {
      if (!confirm("Close the sprint? Your in-progress writing will be lost.")) return;
    }
    setSprintModal(false);
  };

  const fmtTime = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  // ── Daily goal ──────────────────────────────────────────
  const dailyPct = dailyGoal ? Math.min(100, Math.round((dailyWords / dailyGoal) * 100)) : 0;

  // ── Sidebar render data ─────────────────────────────────
  const ql = globalSearch.toLowerCase();
  const visibleProjects = state.projects
    .map((proj) => {
      const visibleDocs = ql
        ? proj.docs.filter((d) => d.name.toLowerCase().includes(ql) || (d.content || "").toLowerCase().includes(ql))
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

  return (
    <div className={`folio-root${focusMode ? " focus-mode" : ""}${typewriterMode ? " typewriter-mode" : ""}`}>
      {/* Focus exit button (visible only in focus mode) */}
      <button className="btn btn-ghost focus-exit" onClick={() => setFocusMode(false)}>
        <Ico.Focus /> Exit Focus
      </button>

      {/* TOP BAR */}
      <div className="folio-topbar">
        <button className="topbar-logo" onClick={() => setLocation("/portal")} title="Back to Writing Sprint">
          <Ico.Logo /> Folio
        </button>
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
          />
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
                const projWC = proj.docs.reduce((s, d) => s + wc((d.name || "") + (d.content || "")), 0);
                const totalWC = projWC;
                const lastEdited = proj.docs.reduce((max, d) => Math.max(max, d.updatedAt || 0), 0);
                const statusCounts = { draft: 0, progress: 0, done: 0, edit: 0 };
                proj.docs.forEach((d) => statusCounts[(d.status || "draft") as StatusKey]++);
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

                    {statsOpen[proj.id] && (
                      <div className="proj-stats visible">
                        <div className="proj-stats-title">Project Overview</div>
                        <div className="proj-stat-row"><span>Documents</span><span>{proj.docs.length}</span></div>
                        <div className="proj-stat-row"><span>Total words</span><span>{totalWC.toLocaleString()}</span></div>
                        <div className="proj-stat-row"><span>Last edited</span><span>{lastStr}</span></div>
                        <div className="proj-stat-row"><span>Done</span><span>{statusCounts.done} / {proj.docs.length}</span></div>
                      </div>
                    )}

                    <div className={`folder-children${isOpen ? " open" : ""}`}>
                      {visibleDocs.map((doc) => {
                        const dwc = wc((doc.name || "") + (doc.content || ""));
                        const st = (doc.status || "draft") as StatusKey;
                        return (
                          <div
                            key={doc.id}
                            className={`doc-row${doc.id === activeDocId ? " active" : ""}`}
                            onClick={() => openDoc(proj.id, doc.id)}
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

        {/* MAIN */}
        <div className="folio-main">
          {!activeDoc ? (
            <div className="welcome-panel">
              <Ico.FolderBig />
              <h2>No document open</h2>
              <p>Create a project in the sidebar, then add chapters or scenes to start writing.</p>
            </div>
          ) : (
            <div className="editor-panel">
              <div className="editor-topbar">
                <div className="breadcrumb">
                  <span className="crumb-project">{activeProject?.name}</span>
                  <span className="sep">›</span>
                  <span className="crumb-doc">{activeDoc.name}</span>
                </div>
                <button
                  className="status-pill"
                  onClick={(e) => {
                    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                    setStatusMenuPos({ top: rect.bottom + 6, left: rect.left });
                    setStatusMenuOpen((v) => !v);
                  }}
                  style={{ background: statusInfo.color + "22", color: statusInfo.color }}
                >
                  <span className="status-dot-sm" style={{ color: statusInfo.color }} />
                  {statusInfo.label}
                </button>
                <div className="editor-topbar-spacer" />
                {autosaveShown && (
                  <div className="autosave-indicator show">
                    <Ico.Check /> Saved
                  </div>
                )}
                <span className="editor-word-count">
                  {editorWordCount.toLocaleString()} word{editorWordCount === 1 ? "" : "s"}
                </span>
                <button
                  className="btn btn-ghost"
                  onClick={() => setTypewriterMode((v) => !v)}
                  title="Typewriter mode"
                  style={{ fontSize: 11, padding: "0 8px", background: typewriterMode ? "var(--accent-light)" : undefined, color: typewriterMode ? "var(--accent)" : undefined }}
                >
                  ⌨ TW
                </button>
              </div>

              {/* Toolbar */}
              <div className="writing-toolbar">
                <select className="tb-select" defaultValue="p" onChange={(e) => { applyHeading(e.target.value); e.target.value = "p"; }} title="Paragraph style">
                  <option value="p">Paragraph</option>
                  <option value="h1">Heading 1</option>
                  <option value="h2">Heading 2</option>
                  <option value="h3">Heading 3</option>
                </select>
                <div className="tb-sep" />
                <button className="tb-btn" onClick={() => wrapText("**", "**")} title="Bold"><b>B</b></button>
                <button className="tb-btn" onClick={() => wrapText("_", "_")} title="Italic"><i>I</i></button>
                <button className="tb-btn" onClick={() => wrapText("__", "__")} title="Underline"><u>U</u></button>
                <button className="tb-btn" onClick={() => wrapText("~~", "~~")} title="Strikethrough"><s>S</s></button>
                <div className="tb-sep" />
                <button className="tb-btn" onClick={() => insertAtCursor("> ")} title="Block quote">❝</button>
                <button className="tb-btn" onClick={() => insertAtLineStart("- ")} title="Bullet list">•≡</button>
                <button className="tb-btn" onClick={() => insertAtLineStart("1. ")} title="Numbered list">1≡</button>
                <button className="tb-btn" onClick={() => insertAtLineStart("---\n")} title="Divider">—</button>
                <div className="tb-sep" />
                <button className="tb-btn" onClick={() => insertAtCursor("\n\n")} title="Paragraph break">¶</button>
                <button className="tb-btn" onClick={() => insertAtCursor("[ ] ")} title="Checkbox">☐</button>
                <button className="tb-btn" onClick={() => insertAtCursor("---\n\n")} title="Scene break">···</button>
                <div className="tb-sep" />
                <button
                  className={`tb-btn${typewriterMode ? " active" : ""}`}
                  onClick={() => setTypewriterMode((v) => !v)}
                  title="Typewriter mode"
                  style={{ fontSize: 11 }}
                >⌨</button>
                <button
                  className={`tb-btn${focusMode ? " active" : ""}`}
                  onClick={() => setFocusMode((v) => !v)}
                  title="Focus mode"
                >⛶</button>
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

              <div className="editor-body" id="folio-editor-body">
                <div className="sprint-trigger-row">
                  <button className="sprint-trigger-btn" onClick={() => setSprintModal(true)}>
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
                <textarea
                  className="editor-content"
                  ref={contentRef}
                  placeholder="Start writing…"
                  defaultValue={activeDoc.content}
                  onInput={() => {
                    updateWordCount();
                    scheduleAutosave();
                    typewriterScroll();
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

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
                        <span className="compile-doc-wc">{wc((doc.name || "") + (doc.content || ""))} w</span>
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

      {/* SPRINT MODAL */}
      <div
        className={`sprint-overlay${sprintModal ? " open" : ""}`}
        onClick={(e) => { if (e.target === e.currentTarget) closeSprintModal(); }}
      >
        <div className={`sprint-modal sprint-modal--${sprintPhase}`}>
          {sprintPhase === "idle" && (
            <div className="sprint-body">
              <div className="sprint-status-badge"><span className="sprint-status-dot" />READY</div>
              <div className="sprint-heading">Start a Sprint</div>
              <div className="sprint-sub" style={{ marginBottom: 20 }}>
                Pick a length, then write in the sprint area. Save back to your chapter when you're done.
              </div>

              {activeDoc && (
                <div style={{ background: "var(--bg)", borderRadius: 12, padding: "14px 16px", marginBottom: 16, border: "1px solid var(--border)" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 8 }}>
                    Active chapter
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginBottom: 2 }}>
                    {activeDoc.name || "Untitled"}
                  </div>
                  <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
                    {editorWordCount.toLocaleString()} word{editorWordCount === 1 ? "" : "s"}
                  </div>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, fontSize: 13, color: "var(--text-secondary)", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={sprintIncludeChapter}
                      onChange={(e) => setSprintIncludeChapter(e.target.checked)}
                    />
                    Continue from chapter text
                  </label>
                </div>
              )}

              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 8 }}>
                Duration
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, marginBottom: 12 }}>
                {[5, 10, 15, 20, 30, 45, 60].map((d) => {
                  const selected = sprintDuration === d && !sprintCustomMin;
                  return (
                    <button
                      key={d}
                      onClick={() => { setSprintDuration(d); setSprintCustomMin(""); }}
                      style={{
                        padding: "12px 0",
                        borderRadius: 10,
                        border: `1px solid ${selected ? "var(--text-primary)" : "var(--border)"}`,
                        background: selected ? "var(--text-primary)" : "var(--surface)",
                        color: selected ? "var(--surface)" : "var(--text-primary)",
                        fontFamily: "'DM Sans',sans-serif",
                        fontSize: 14,
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      {d}m
                    </button>
                  );
                })}
              </div>
              <input
                type="number"
                min={1}
                max={300}
                placeholder="Custom minutes"
                value={sprintCustomMin}
                onChange={(e) => setSprintCustomMin(e.target.value)}
                style={{
                  width: "100%", padding: "10px 12px", borderRadius: 10,
                  border: "1px solid var(--border)", background: "var(--bg)",
                  fontFamily: "'DM Sans',sans-serif", fontSize: 14, marginBottom: 16,
                }}
              />

              <button className="sprint-enter-btn" onClick={startSprintNow}>
                Start Sprint <Ico.Arrow />
              </button>
              <button
                onClick={closeSprintModal}
                style={{ width: "100%", marginTop: 10, padding: 10, border: "none", background: "none", fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: "var(--text-muted)", cursor: "pointer" }}
              >
                Cancel
              </button>
            </div>
          )}

          {sprintPhase === "sprinting" && (
            <div className="sprint-run">
              <div className="sprint-run-bar">
                <div className="sprint-run-bar-left">
                  <span className="sprint-timer">{fmtTime(sprintTimeLeft)}</span>
                  <span className="sprint-meta">
                    +{sprintWordsWritten.toLocaleString()} word{sprintWordsWritten === 1 ? "" : "s"} this sprint
                  </span>
                  {activeDoc && <span className="sprint-meta sprint-meta--dim">· {activeDoc.name}</span>}
                </div>
                <div className="sprint-run-bar-right">
                  <button className="sprint-secondary-btn" onClick={endSprintEarly}>End early</button>
                  <button className="sprint-secondary-btn" onClick={closeSprintModal}>Close</button>
                </div>
              </div>
              <textarea
                ref={sprintTextareaRef}
                className="sprint-textarea"
                value={sprintText}
                onChange={(e) => setSprintText(e.target.value)}
                placeholder="Just keep writing…"
                spellCheck
              />
              <div className="sprint-progress">
                <div
                  className="sprint-progress-fill"
                  style={{
                    width: `${100 - (sprintTimeLeft / Math.max(1, (sprintCustomMin ? parseInt(sprintCustomMin, 10) : sprintDuration) * 60)) * 100}%`,
                  }}
                />
              </div>
            </div>
          )}

          {sprintPhase === "done" && (
            <div className="sprint-body">
              <div className="sprint-status-badge"><span className="sprint-status-dot" />SPRINT COMPLETE</div>
              <div className="sprint-heading" style={{ textAlign: "center", fontSize: 44 }}>
                +{sprintWordsWritten.toLocaleString()}
              </div>
              <div className="sprint-sub" style={{ textAlign: "center", marginBottom: 20 }}>
                word{sprintWordsWritten === 1 ? "" : "s"} written · {sprintWordCount.toLocaleString()} total
              </div>

              {activeDoc ? (
                <button className="sprint-enter-btn" onClick={saveSprintToChapter}>
                  Save to "{activeDoc.name}" <Ico.Arrow />
                </button>
              ) : (
                <div style={{ fontSize: 13, color: "var(--text-muted)", textAlign: "center", padding: "12px 0" }}>
                  No active chapter to save to. Copy your text before closing.
                </div>
              )}
              <button
                onClick={() => { navigator.clipboard.writeText(sprintText).catch(() => {}); showToast("Copied to clipboard"); }}
                style={{ width: "100%", marginTop: 10, padding: 12, border: "1px solid var(--border)", background: "var(--surface)", borderRadius: 10, fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: "var(--text-secondary)", cursor: "pointer" }}
              >
                Copy text
              </button>
              <button
                onClick={closeSprintModal}
                style={{ width: "100%", marginTop: 8, padding: 10, border: "none", background: "none", fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: "var(--text-muted)", cursor: "pointer" }}
              >
                Close
              </button>
            </div>
          )}
        </div>
      </div>

      {/* TOAST */}
      <div className={`folio-toast${toastShow ? " show" : ""}`}>{toastMsg}</div>
    </div>
  );
}
