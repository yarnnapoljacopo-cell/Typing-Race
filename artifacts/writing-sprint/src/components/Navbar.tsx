import { Moon, Sun } from "lucide-react";
import { useDarkMode } from "@/lib/darkModeContext";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export function Navbar() {
  const { isDark, toggleDarkMode } = useDarkMode();

  return (
    <nav
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        height: 60,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 24px",
        background: "var(--navbar-bg)",
        backdropFilter: "blur(18px)",
        WebkitBackdropFilter: "blur(18px)",
        borderBottom: "1px solid var(--navbar-border)",
        boxShadow: isDark
          ? "0 1px 12px rgba(0,0,0,0.3)"
          : "0 1px 12px rgba(107,143,212,0.07)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          flexShrink: 0,
        }}
      >
        <img
          src={`${basePath}/logo-icon.png`}
          alt="Writing Sprint logo"
          style={{
            height: 40,
            width: 40,
            borderRadius: 10,
            objectFit: "contain",
            display: "block",
            flexShrink: 0,
          }}
        />
        <span
          style={{
            fontFamily: "'Playfair Display', Georgia, serif",
            fontWeight: 700,
            fontSize: "1.15rem",
            color: isDark ? "rgba(255,255,255,0.92)" : "#1a1a2e",
            letterSpacing: "-0.01em",
            whiteSpace: "nowrap",
          }}
        >
          Writing Sprint
        </span>
      </div>

      <button
        onClick={toggleDarkMode}
        title={isDark ? "Switch to light mode" : "Switch to dark mode"}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 36,
          height: 36,
          borderRadius: 10,
          border: isDark
            ? "1px solid rgba(255,255,255,0.12)"
            : "1px solid rgba(107,143,212,0.18)",
          background: isDark
            ? "rgba(255,255,255,0.07)"
            : "rgba(107,143,212,0.07)",
          cursor: "pointer",
          color: isDark ? "rgba(255,255,255,0.75)" : "#6B8FD4",
          transition: "all 0.2s",
          flexShrink: 0,
        }}
      >
        {isDark ? <Sun size={16} /> : <Moon size={16} />}
      </button>
    </nav>
  );
}
