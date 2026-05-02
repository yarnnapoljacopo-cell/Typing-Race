import { useEffect, useRef, useState } from "react";

interface Pos { x: number; y: number }
interface Size { w: number; h: number }

interface Props {
  open: boolean;
  onClose: () => void;
  noteKey: string; // unique key per chapter (or "global")
  title?: string;
}

const POS_KEY = "folio_stickynote_pos";
const SIZE_KEY = "folio_stickynote_size";
const NOTE_PREFIX = "folio_stickynote_";

function loadPos(): Pos {
  try {
    const raw = localStorage.getItem(POS_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return { x: Math.max(40, window.innerWidth - 360), y: 100 };
}
function loadSize(): Size {
  try {
    const raw = localStorage.getItem(SIZE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return { w: 320, h: 360 };
}

export default function StickyNote({ open, onClose, noteKey, title = "Notes" }: Props) {
  const [pos, setPos] = useState<Pos>(loadPos);
  const [size, setSize] = useState<Size>(loadSize);
  const [content, setContent] = useState<string>("");
  const dragRef = useRef<{ dx: number; dy: number } | null>(null);
  const resizeRef = useRef<{ sx: number; sy: number; sw: number; sh: number } | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Load note content when key changes
  useEffect(() => {
    try {
      setContent(localStorage.getItem(NOTE_PREFIX + noteKey) || "");
    } catch { setContent(""); }
  }, [noteKey]);

  // Persist content (debounced)
  useEffect(() => {
    const t = window.setTimeout(() => {
      try { localStorage.setItem(NOTE_PREFIX + noteKey, content); } catch { /* ignore */ }
    }, 250);
    return () => window.clearTimeout(t);
  }, [content, noteKey]);

  // Persist position/size
  useEffect(() => { try { localStorage.setItem(POS_KEY, JSON.stringify(pos)); } catch { /* ignore */ } }, [pos]);
  useEffect(() => { try { localStorage.setItem(SIZE_KEY, JSON.stringify(size)); } catch { /* ignore */ } }, [size]);

  // Drag handlers
  useEffect(() => {
    function onMove(e: MouseEvent) {
      if (dragRef.current) {
        const nx = Math.max(0, Math.min(window.innerWidth - 80, e.clientX - dragRef.current.dx));
        const ny = Math.max(0, Math.min(window.innerHeight - 40, e.clientY - dragRef.current.dy));
        setPos({ x: nx, y: ny });
      } else if (resizeRef.current) {
        const nw = Math.max(220, Math.min(window.innerWidth - pos.x - 8, resizeRef.current.sw + (e.clientX - resizeRef.current.sx)));
        const nh = Math.max(160, Math.min(window.innerHeight - pos.y - 8, resizeRef.current.sh + (e.clientY - resizeRef.current.sy)));
        setSize({ w: nw, h: nh });
      }
    }
    function onUp() { dragRef.current = null; resizeRef.current = null; }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [pos.x, pos.y]);

  if (!open) return null;

  return (
    <div
      ref={panelRef}
      className="sticky-note"
      style={{ left: pos.x, top: pos.y, width: size.w, height: size.h }}
    >
      <div
        className="sticky-note-header"
        onMouseDown={(e) => {
          dragRef.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y };
        }}
      >
        <span className="sticky-note-title">{title}</span>
        <button className="sticky-note-close" onClick={onClose} title="Close">×</button>
      </div>
      <textarea
        className="sticky-note-textarea"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Outline, ideas, reminders..."
      />
      <div
        className="sticky-note-resize"
        onMouseDown={(e) => {
          e.preventDefault();
          resizeRef.current = { sx: e.clientX, sy: e.clientY, sw: size.w, sh: size.h };
        }}
        title="Drag to resize"
      />
    </div>
  );
}
