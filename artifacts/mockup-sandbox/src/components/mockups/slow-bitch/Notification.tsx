import { useState, useEffect } from "react";

function RaceTrack() {
  const cars = [
    { name: "Virginia", words: 312, color: "#4f7cac", isYou: false },
    { name: "You", words: 187, color: "#a78bfa", isYou: true },
    { name: "Edgar", words: 241, color: "#6b8e6b", isYou: false },
  ];
  const max = Math.max(...cars.map((c) => c.words));
  return (
    <div className="bg-white border-b border-gray-100 px-5 py-4">
      <div className="space-y-2.5">
        {[...cars].sort((a, b) => b.words - a.words).map((car) => (
          <div key={car.name} className="flex items-center gap-3">
            <span
              className="text-xs w-16 text-right shrink-0"
              style={{ color: car.isYou ? "#7c3aed" : "#6b7280", fontWeight: car.isYou ? 600 : 400 }}
            >
              {car.name}
            </span>
            <div className="flex-1 h-5 bg-gray-100 rounded-full overflow-hidden relative">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${(car.words / max) * 100}%`,
                  backgroundColor: car.color,
                  opacity: 0.7,
                }}
              />
              <span
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-gray-500"
              >
                {car.words}w
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ToastNotification({ visible }: { visible: boolean }) {
  return (
    <div
      style={{
        position: "absolute",
        bottom: 80,
        left: "50%",
        transform: `translateX(-50%) translateY(${visible ? 0 : 12}px)`,
        opacity: visible ? 1 : 0,
        transition: "opacity 0.35s ease, transform 0.35s ease",
        pointerEvents: "none",
        zIndex: 50,
      }}
    >
      <div
        style={{
          background: "rgba(30,30,36,0.92)",
          backdropFilter: "blur(8px)",
          borderRadius: 999,
          padding: "7px 16px",
          display: "flex",
          alignItems: "center",
          gap: 8,
          boxShadow: "0 4px 18px rgba(0,0,0,0.22)",
          whiteSpace: "nowrap",
        }}
      >
        <span style={{ fontSize: 15 }}>🐢</span>
        <span style={{ color: "#fff", fontSize: 13, fontWeight: 500, letterSpacing: "0.01em" }}>
          Slow Bitch.
        </span>
      </div>
    </div>
  );
}

export function Notification() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Show after 600ms, hide after 3.5s, repeat every 5s
    const cycle = () => {
      setTimeout(() => setVisible(true), 600);
      setTimeout(() => setVisible(false), 4000);
    };
    cycle();
    const id = setInterval(cycle, 5400);
    return () => clearInterval(id);
  }, []);

  return (
    <div
      style={{
        width: 860,
        height: 480,
        background: "#f9f8f6",
        fontFamily: "system-ui, sans-serif",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        position: "relative",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 20px",
          borderBottom: "1px solid #e5e7eb",
          background: "#fff",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 13, color: "#6b7280" }}>Room</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#1f2937", letterSpacing: 1 }}>SPRINT-7842</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ background: "#fef3c7", color: "#92400e", fontSize: 11, fontWeight: 600, padding: "2px 10px", borderRadius: 999 }}>
            ⏱ 22:14
          </span>
        </div>
      </div>

      {/* Race track */}
      <RaceTrack />

      {/* Writing area */}
      <div style={{ flex: 1, padding: "16px 20px", position: "relative" }}>
        <textarea
          readOnly
          value={"The fog came in off the water before dawn, curling around the pilings and spilling across the dock in long grey tongues. She had been waiting in the car for forty minutes, watching it come, thinking about the way her mother used to describe fog as the sea breathing. She'd never liked that image. The sea wasn't alive, wasn't anything with lungs—but she understood why someone would want it to be. It made the disappearances easier to explain."}
          style={{
            width: "100%",
            height: "100%",
            resize: "none",
            border: "none",
            background: "transparent",
            fontSize: 15,
            lineHeight: 1.75,
            color: "#1f2937",
            fontFamily: "Georgia, serif",
            outline: "none",
          }}
        />
        {/* word count strip */}
        <div
          style={{
            position: "absolute",
            bottom: 12,
            right: 20,
            fontSize: 12,
            color: "#9ca3af",
          }}
        >
          187 words
        </div>
      </div>

      {/* The notification */}
      <ToastNotification visible={visible} />
    </div>
  );
}
