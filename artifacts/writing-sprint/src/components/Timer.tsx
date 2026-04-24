import { memo } from "react";
import { Clock, Timer as TimerIcon } from "lucide-react";

const CARD = {
  background: "rgba(255,255,255,0.88)",
  backdropFilter: "blur(16px)",
  WebkitBackdropFilter: "blur(16px)",
  border: "1px solid rgba(255,255,255,0.9)",
  borderRadius: 16,
  boxShadow: "0 4px 20px rgba(107,143,212,0.08)",
};

interface TimerProps {
  timeLeft: number | null;
  countdownTimeLeft?: number | null;
  status: "waiting" | "countdown" | "running" | "finished";
}

export const Timer = memo(function Timer({ timeLeft, countdownTimeLeft, status }: TimerProps) {
  if (status === "waiting") {
    return (
      <div style={{ ...CARD, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px 16px", textAlign: "center" }}>
        <div style={{ marginBottom: 12 }}>
          <Clock style={{ width: 32, height: 32, color: "#6B8FD4", filter: "drop-shadow(0 2px 8px rgba(107,143,212,0.3))" }} />
        </div>
        <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: "1.1rem", fontWeight: 700, color: "#1a1a2e", marginBottom: 6 }}>
          Waiting to Start
        </h2>
        <p style={{ fontSize: "0.78rem", color: "#7a7a92", lineHeight: 1.5, maxWidth: 200 }}>
          The creator will start the sprint when everyone is ready. Stretch your fingers!
        </p>
      </div>
    );
  }

  if (status === "countdown") {
    const totalSecs = countdownTimeLeft ?? 0;
    const minutes = Math.floor(totalSecs / 60);
    const seconds = totalSecs % 60;
    const isImminent = totalSecs <= 30;

    const card = isImminent
      ? { ...CARD, background: "rgba(254,243,199,0.92)", border: "1px solid rgba(217,119,6,0.25)" }
      : CARD;

    return (
      <div style={{ ...card, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px 16px" }}>
        <TimerIcon style={{ width: 24, height: 24, marginBottom: 8, color: isImminent ? "#d97706" : "#6B8FD4" }} />
        <div style={{ fontSize: "3rem", fontFamily: "monospace", fontWeight: 700, letterSpacing: "-0.04em", color: isImminent ? "#92400e" : "#1a1a2e", tabularNums: true }}>
          {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
        </div>
        <p style={{ fontSize: "0.72rem", marginTop: 8, textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 600, color: isImminent ? "#d97706" : "#7a7a92" }}>
          {isImminent ? "Sprint starting soon!" : "Until sprint starts"}
        </p>
      </div>
    );
  }

  if (status === "finished") {
    return (
      <div style={{ ...CARD, background: "rgba(107,143,212,0.1)", border: "1px solid rgba(107,143,212,0.2)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 16, color: "#6B8FD4", textAlign: "center" }}>
        <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: "1.1rem", fontWeight: 700, color: "#1a1a2e", marginBottom: 4 }}>Sprint Finished!</h2>
        <p style={{ fontSize: "0.82rem", color: "#7a7a92" }}>Pens down. Great work everyone.</p>
      </div>
    );
  }

  const totalSeconds = timeLeft || 0;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const isLowTime = totalSeconds > 0 && totalSeconds <= 60;

  const runCard = isLowTime
    ? { ...CARD, background: "rgba(254,226,226,0.92)", border: "1px solid rgba(220,38,38,0.2)" }
    : CARD;

  return (
    <div style={{ ...runCard, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px 16px" }}>
      <div style={{ fontSize: "3.5rem", fontFamily: "monospace", fontWeight: 700, letterSpacing: "-0.04em", color: isLowTime ? "#dc2626" : "#1a1a2e" }}>
        {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
      </div>
      <p style={{ fontSize: "0.72rem", marginTop: 8, textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 600, color: isLowTime ? "#dc2626" : "#7a7a92" }}>
        {isLowTime ? "Final minute!" : "Remaining"}
      </p>
    </div>
  );
});
