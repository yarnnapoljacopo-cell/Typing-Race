import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useLocation } from "wouter";
import SprintPopup from "./SprintPopup";
import StickyNote from "./StickyNote";
import { useFolio } from "@/lib/useFolio";
import type { FolioDoc as Doc, FolioProject as Project, FolioState } from "@/lib/folioStore";
import "./MyFiles.css";

type StatusKey = "draft" | "progress" | "done" | "edit";

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
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        className="topbar-logo"
        onClick={() => setOpen((v) => !v)}
        title="Folio menu"
        style={{ gap: 6 }}
      >
        <Ico.Logo /> Folio
        <svg
          width="10" height="10" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
          style={{ opacity: 0.5, transform: open ? "rotate(180deg)" : "none", transition: "transform .15s" }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)", left: 0,
          background: "var(--surface)", border: "1px solid var(--border)",
          borderRadius: 10, boxShadow: "0 8px 28px rgba(0,0,0,.13)",
          padding: "6px", minWidth: 180, zIndex: 200,
          animation: "folioMenuIn .13s ease",
        }}>
          <button
            onClick={() => { setOpen(false); onBack(); }}
            style={{
              display: "flex", alignItems: "center", gap: 9, width: "100%",
              padding: "8px 10px", borderRadius: 7, border: "none", background: "none",
              cursor: "pointer", fontSize: 13, color: "var(--text-secondary)",
              fontFamily: "inherit", textAlign: "left", transition: "background .12s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-hover)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Writing Sprint
          </button>

        </div>
      )}
    </div>
  );
}

export default function MyFiles() {
  const [, setLocation] = useLocation();
  const { state, setState, isOnline, isSyncing } = useFolio();
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [activeDocId, setActiveDocId] = useState<string | null>(null);
  const [recentDocs, setRecentDocs] = useState<RecentEntry[]>(() => loadRecent());
  const [globalSearch, setGlobalSearch] = useState("");
  const [statsOpen, setStatsOpen] = useState<Record<string, boolean>>({});
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);
  const [statusMenuPos, setStatusMenuPos] = useState({ top: 0, left: 0 });

  const [focusMode, setFocusMode] = useState(false);
  const [novelNotesOpen, setNovelNotesOpen] = useState(false);

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
  const [typewriterMode, setTypewriterMode] = useState(false);
  const [paragraphMode, setParagraphMode] = useState<"none" | "indent" | "double">("none");
  const [fontSize, setFontSize] = useState(() => parseInt(localStorage.getItem("folio_font_size") || "16", 10));
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

  // Editor live values (uncontrolled-ish for performance).
  // Title stays a textarea (auto-grow). Content is now a contentEditable
  // <div> so bold/italic/underline render visually instead of leaving
  // raw markdown like **text** in the document.
  const titleRef = useRef<HTMLTextAreaElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const [editorWordCount, setEditorWordCount] = useState(0);

  // Grammar check state
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

  // Save current editor draft into state (called by autosave & navigation)
  const prevWordsRef = useRef(0);
  const saveCurrentDoc = useCallback(() => {
    if (!activeProjectId || !activeDocId) return;
    const titleVal = titleRef.current?.value || "";
    // Persist HTML so formatting survives reload; word count uses plain text.
    // Tag with a sentinel so loadEditorContent can distinguish rich content
    // from legacy plain text without using a brittle heuristic.
    // Clone and strip lt-mark spans so grammar highlights are never persisted.
    const html = (() => {
      const div = contentRef.current;
      if (!div) return "";
      const clone = div.cloneNode(true) as HTMLElement;
      clone.querySelectorAll(".lt-mark").forEach((mark) => {
        const p = mark.parentNode!;
        while (mark.firstChild) p.insertBefore(mark.firstChild, mark);
        p.removeChild(mark);
      });
      return clone.innerHTML;
    })();
    const contentVal = html ? RICH_PREFIX + html : "";
    const contentPlain = contentRef.current?.innerText || "";
    const newWC = wc(titleVal + " " + contentPlain);
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

  const scheduleGrammarCheck = useCallback(() => {
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
  }, [clearMarks, applyMarks]);

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
      loadEditorContent(doc.content);
      prevWordsRef.current = wc(doc.name + " " + (contentRef.current?.innerText || docPlainText(doc.content)));
      updateWordCount();
      contentRef.current?.focus();
      // Reset grammar status for the new doc
      setLtStatus("idle");
      setLtMatches([]);
      setLtTooltip(null);
      clearMarks();
      ltLastTextRef.current = "";
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
  useEffect(() => {
    const onSelectionChange = () => {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;
      const r = sel.getRangeAt(0);
      const div = contentRef.current;
      if (!div) return;
      if (div.contains(r.startContainer) && div.contains(r.endContainer)) {
        savedRangeRef.current = r.cloneRange();
      }
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
    exec("formatBlock", tag);
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
  const ql = globalSearch.toLowerCase();
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

  return (
    <div className={`folio-root${focusMode ? " focus-mode" : ""}${typewriterMode ? " typewriter-mode" : ""}`}>
      {/* Focus exit button (visible only in focus mode) */}
      {focusMode && (
        <button className="btn btn-ghost focus-exit" onClick={() => setFocusMode(false)}>
          <Ico.Focus /> Exit Focus
        </button>
      )}

      {/* TOP BAR */}
      <div className="folio-topbar">
        <FolioLogoMenu onBack={() => setLocation("/portal")} />
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

          <button className="sidebar-novel-notes-btn" onClick={() => setNovelNotesOpen(true)}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
            </svg>
            Novel Notes
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
                <button
                  className={`sticky-note-toggle${stickyOpen ? " active" : ""}`}
                  onClick={() => setStickyOpen((v) => !v)}
                  title="Sticky note (outline, ideas)"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 3v6h6" /><path d="M20 9v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8z" />
                  </svg>
                  Notes
                </button>
              </div>

              {/* Toolbar */}
              <div
                className="writing-toolbar"
                // preventDefault on mousedown for the buttons so they don't
                // steal focus from the editor. The runFormat helpers also
                // restore the latest in-editor Range (tracked via a global
                // selectionchange listener) before calling execCommand, so
                // formatting still applies even if the focus did shift.
                onMouseDown={(e) => {
                  const t = e.target as HTMLElement;
                  if (t.tagName === "BUTTON" || t.closest("button")) e.preventDefault();
                }}
              >
                {/*
                  Toolbar buttons use onMouseDown + preventDefault (the
                  canonical contentEditable pattern). This prevents the
                  button from taking focus, so the editor's selection
                  stays intact and execCommand applies to the user's
                  selected text. Plain onClick would fire after focus has
                  already shifted to the button (collapsing the
                  selection), so bold/italic etc. would silently no-op.
                */}
                <select className="tb-select" defaultValue="p" onChange={(e) => { applyHeading(e.target.value); e.target.value = "p"; }} title="Paragraph style">
                  <option value="p">Paragraph</option>
                  <option value="h1">Heading 1</option>
                  <option value="h2">Heading 2</option>
                  <option value="h3">Heading 3</option>
                </select>
                <div className="tb-sep" />
                <button className="tb-btn" onMouseDown={(e) => { e.preventDefault(); wrapText("**", "**"); }} title="Bold"><b>B</b></button>
                <button className="tb-btn" onMouseDown={(e) => { e.preventDefault(); wrapText("_", "_"); }} title="Italic"><i>I</i></button>
                <button className="tb-btn" onMouseDown={(e) => { e.preventDefault(); wrapText("__", "__"); }} title="Underline"><u>U</u></button>
                <button className="tb-btn" onMouseDown={(e) => { e.preventDefault(); wrapText("~~", "~~"); }} title="Strikethrough"><s>S</s></button>
                <div className="tb-sep" />
                <button className="tb-btn" onMouseDown={(e) => { e.preventDefault(); insertAtCursor("> "); }} title="Block quote">❝</button>
                <button className="tb-btn" onMouseDown={(e) => { e.preventDefault(); insertAtLineStart("- "); }} title="Bullet list">•≡</button>
                <button className="tb-btn" onMouseDown={(e) => { e.preventDefault(); insertAtLineStart("1. "); }} title="Numbered list">1≡</button>
                <button className="tb-btn" onMouseDown={(e) => { e.preventDefault(); insertAtLineStart("---\n"); }} title="Divider">—</button>
                <div className="tb-sep" />
                <button className="tb-btn" onMouseDown={(e) => { e.preventDefault(); insertAtCursor("\n\n"); }} title="Paragraph break">¶</button>
                <button className="tb-btn" onMouseDown={(e) => { e.preventDefault(); insertAtCursor("[ ] "); }} title="Checkbox">☐</button>
                <button className="tb-btn" onMouseDown={(e) => { e.preventDefault(); insertAtCursor("---\n\n"); }} title="Scene break">···</button>
                <div className="tb-sep" />
                <select
                  className="tb-select"
                  value={fontSize}
                  onMouseDown={() => {
                    const saved = savedRangeRef.current;
                    if (saved) savedRangeRef.current = saved.cloneRange();
                  }}
                  onChange={(e) => {
                    const size = parseInt(e.target.value, 10);
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
                      localStorage.setItem("folio_font_size", size.toString());
                    } else {
                      setFontSize(size);
                      localStorage.setItem("folio_font_size", size.toString());
                    }
                  }}
                  title="Font size"
                >
                  {[12, 14, 15, 16, 18, 20, 22, 24].map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <div className="tb-sep" />
                <span style={{ fontSize: 10, fontWeight: 700, color: "var(--muted)", letterSpacing: "0.05em", textTransform: "uppercase", marginRight: 2 }}>¶</span>
                {(["none", "indent", "double"] as const).map((mode) => (
                  <button
                    key={mode}
                    className={`tb-btn${paragraphMode === mode ? " active" : ""}`}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      const div = contentRef.current;
                      const saved = savedRangeRef.current;
                      if (saved && !saved.collapsed && div && div.contains(saved.commonAncestorContainer)) {
                        div.querySelectorAll("p, div:not([id]):not([class])").forEach((p) => {
                          if (saved.intersectsNode(p)) {
                            const el = p as HTMLElement;
                            if (mode === "double") {
                              el.style.lineHeight = "1.7";
                              el.style.marginBottom = "28px";
                              el.style.marginTop = "0";
                              el.style.textIndent = "";
                            } else if (mode === "indent") {
                              el.style.lineHeight = "1.7";
                              el.style.marginBottom = "0";
                              el.style.marginTop = "0";
                              el.style.textIndent = "2em";
                            } else {
                              el.style.lineHeight = "1.4";
                              el.style.marginBottom = "0";
                              el.style.marginTop = "0";
                              el.style.textIndent = "";
                            }
                          }
                        });
                        scheduleAutosave();
                      } else {
                        setParagraphMode(mode);
                      }
                    }}
                    title={mode === "none" ? "Single line break" : mode === "indent" ? "Indent new paragraph" : "Double line break"}
                    style={{ textTransform: "capitalize", fontSize: 10, padding: "0 6px", marginLeft: 4, marginRight: 4 }}
                  >
                    {mode === "none" ? "None" : mode === "indent" ? "Indent" : "Double"}
                  </button>
                ))}
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
                <div className="tb-sep" />
                {ltStatus === "checking" && (
                  <span className="lt-badge lt-checking">checking…</span>
                )}
                {ltStatus !== "idle" && ltStatus !== "checking" && (
                  <span
                    className={`lt-badge ${ltStatus === 0 ? "lt-ok" : "lt-warn"}`}
                    title={ltStatus === 0 ? "No issues found" : `${ltStatus} issue${ltStatus === 1 ? "" : "s"} — hover the underlined text`}
                  >
                    {ltStatus === 0 ? "✓ grammar" : `${ltStatus} issue${ltStatus === 1 ? "" : "s"}`}
                  </span>
                )}
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
