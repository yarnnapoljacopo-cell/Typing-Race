import { useLocation } from "wouter";

export default function NovelNotes() {
  const [, navigate] = useLocation();

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100dvh", overflow: "hidden" }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "8px 14px", borderBottom: "1px solid var(--border)",
        background: "var(--surface)", flexShrink: 0,
      }}>
        <button
          onClick={() => navigate("/my-files")}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "5px 10px", borderRadius: 7, border: "1px solid var(--border)",
            background: "none", cursor: "pointer", fontSize: 13,
            color: "var(--text-secondary)", fontFamily: "inherit",
            transition: "background .12s",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-hover)")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Back to Folio
        </button>
        <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>Novel Notes</span>
      </div>
      <iframe
        src="/novel-notes.html"
        style={{ flex: 1, border: "none", width: "100%", display: "block" }}
        title="Novel Notes"
      />
    </div>
  );
}
