const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export function Navbar() {
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
        padding: "0 24px",
        background: "rgba(245,242,236,0.82)",
        backdropFilter: "blur(18px)",
        WebkitBackdropFilter: "blur(18px)",
        borderBottom: "1px solid rgba(107,143,212,0.12)",
        boxShadow: "0 1px 12px rgba(107,143,212,0.07)",
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
            color: "#1a1a2e",
            letterSpacing: "-0.01em",
            whiteSpace: "nowrap",
          }}
        >
          Writing Sprint
        </span>
      </div>
    </nav>
  );
}
