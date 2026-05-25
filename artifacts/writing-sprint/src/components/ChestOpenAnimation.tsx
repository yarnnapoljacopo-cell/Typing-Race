import { useEffect, useMemo } from "react";
import { ChestIcon } from "@/components/ChestIcon";

// Per-chest colour + glow used to tint the cinematic. Keeping these here (vs
// importing the existing CHEST_META from ChestAwardModal) keeps this
// component standalone — usable wherever a chest opens.
const CHEST_COLORS: Record<string, { color: string; glow: string; accent: string }> = {
  mortal:   { color: "#B8844C", glow: "rgba(212,168,112,0.55)", accent: "#F5D7A0" },
  iron:     { color: "#7A8A9A", glow: "rgba(160,180,200,0.55)", accent: "#D6E2EE" },
  crystal:  { color: "#4090C8", glow: "rgba(96,176,240,0.65)",  accent: "#A8D4FF" },
  inferno:  { color: "#C04010", glow: "rgba(255,96,32,0.65)",   accent: "#FFB070" },
  immortal: { color: "#D4A820", glow: "rgba(255,210,80,0.7)",   accent: "#FFF0A0" },
};

interface Particle {
  tx: number; ty: number; size: number; delay: number; duration: number; gold: boolean;
}
interface Sparkle {
  tx: number; ty: number; size: number; delay: number; duration: number; rotate: number;
}

interface ChestOpenAnimationProps {
  chestType: string;
  /** Fires once the cinematic finishes — caller can then reveal the loot. */
  onComplete?: () => void;
  /** Total duration in ms. Default 2400. */
  durationMs?: number;
  /** Optional className for the outer wrapper. */
  className?: string;
}

/**
 * Cinematic chest-open sequence. Plays for `durationMs` then fires
 * `onComplete` once. The animation timeline:
 *
 *   0   – 700ms  : aura swells, chest wobbles + lifts
 *   650 – 1050ms : white core flash + expanding shockwave ring
 *   700 – 1500ms : vertical light beam shoots up
 *   750 – 2400ms : 24 coloured particles + 12 gold sparkles fly outward
 *   ~1500ms      : chest "bursts" (scales up + fades)
 *
 * All visuals are CSS-only — no canvas, no GSAP, no extra deps. Particles are
 * randomised once via useMemo so they're deterministic per mount.
 */
export function ChestOpenAnimation({
  chestType,
  onComplete,
  durationMs = 2400,
  className = "",
}: ChestOpenAnimationProps) {
  const normalized = chestType.replace("_chest", "");
  const palette = CHEST_COLORS[normalized] ?? CHEST_COLORS.mortal;

  // Particles fanning outward in a full circle, with some jitter so the
  // pattern doesn't look mechanical. Gold flag promotes ~25% to the accent
  // colour for a treasure-y mix.
  const particles = useMemo<Particle[]>(() => {
    const n = 24;
    return Array.from({ length: n }, (_, i) => {
      const angle = (i / n) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
      const dist = 110 + Math.random() * 80;
      return {
        tx: Math.cos(angle) * dist,
        ty: Math.sin(angle) * dist,
        size: 4 + Math.random() * 6,
        delay: 0.7 + Math.random() * 0.45,
        duration: 1.1 + Math.random() * 0.6,
        gold: Math.random() < 0.28,
      };
    });
  }, []);

  // Upward star-shaped sparkles — they read as "treasure dust" rising out
  // of the chest. Drift upward + sideways with random rotation.
  const sparkles = useMemo<Sparkle[]>(() => {
    return Array.from({ length: 14 }, () => ({
      tx: -60 + Math.random() * 120,
      ty: -140 - Math.random() * 60,
      size: 6 + Math.random() * 7,
      delay: 0.85 + Math.random() * 0.55,
      duration: 1.5 + Math.random() * 0.5,
      rotate: Math.random() * 360,
    }));
  }, []);

  useEffect(() => {
    if (!onComplete) return;
    const t = setTimeout(onComplete, durationMs);
    return () => clearTimeout(t);
  }, [onComplete, durationMs]);

  return (
    <div className={`chest-open-stage ${className}`} role="img" aria-label="Opening chest">
      {/* Background aura — swells, peaks at the burst, then fades */}
      <div
        className="cos-aura"
        style={{ background: `radial-gradient(circle, ${palette.color}cc 0%, ${palette.color}33 30%, transparent 65%)` }}
      />
      {/* Expanding shockwave ring at the burst moment */}
      <div className="cos-shockwave" style={{ borderColor: palette.accent }} />
      <div className="cos-shockwave cos-shockwave--late" style={{ borderColor: palette.color }} />
      {/* Tall vertical light beam shooting up from the chest */}
      <div
        className="cos-beam"
        style={{
          background: `linear-gradient(to top, ${palette.accent} 0%, ${palette.color}cc 35%, transparent 100%)`,
        }}
      />
      {/* Bright white core flash */}
      <div className="cos-flash" />
      {/* The chest — wobbles, lifts, bursts */}
      <div
        className="cos-chest"
        style={{ filter: `drop-shadow(0 0 30px ${palette.glow})` }}
      >
        <ChestIcon type={chestType} className="w-full h-full" />
      </div>

      {/* Coloured particles fanning outward */}
      {particles.map((p, i) => (
        <div
          key={`p${i}`}
          className="cos-particle"
          style={{
            background: p.gold ? palette.accent : palette.color,
            width: `${p.size}px`,
            height: `${p.size}px`,
            boxShadow: `0 0 ${p.size * 2}px ${p.gold ? palette.accent : palette.color}`,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            ["--tx" as string]: `${p.tx}px`,
            ["--ty" as string]: `${p.ty}px`,
          } as React.CSSProperties}
        />
      ))}

      {/* Star sparkles drifting upward */}
      {sparkles.map((s, i) => (
        <div
          key={`s${i}`}
          className="cos-sparkle"
          style={{
            width: `${s.size}px`,
            height: `${s.size}px`,
            animationDelay: `${s.delay}s`,
            animationDuration: `${s.duration}s`,
            ["--tx" as string]: `${s.tx}px`,
            ["--ty" as string]: `${s.ty}px`,
            ["--rot" as string]: `${s.rotate}deg`,
          } as React.CSSProperties}
        />
      ))}

      {/* All keyframes / layout live alongside the component so it's
          drop-in usable anywhere without a global stylesheet edit. */}
      <style>{`
        .chest-open-stage {
          position: relative;
          width: 240px;
          height: 240px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto;
          /* Pre-create stacking context for the absolutely-positioned bits */
          isolation: isolate;
        }
        .cos-aura {
          position: absolute;
          inset: -50px;
          border-radius: 50%;
          opacity: 0;
          pointer-events: none;
          filter: blur(8px);
          animation: cosAura 2.4s ease-out forwards;
        }
        .cos-shockwave {
          position: absolute;
          left: 50%; top: 50%;
          width: 80px; height: 80px;
          border-radius: 50%;
          border: 3px solid;
          opacity: 0;
          transform: translate(-50%, -50%);
          pointer-events: none;
          animation: cosShockwave 1.2s ease-out 0.65s forwards;
        }
        .cos-shockwave--late {
          animation-delay: 0.85s;
          animation-duration: 1.4s;
          opacity: 0.6;
        }
        .cos-beam {
          position: absolute;
          left: 50%; top: 50%;
          width: 14px; height: 260px;
          transform-origin: bottom center;
          transform: translate(-50%, -85%) scaleY(0);
          border-radius: 14px;
          opacity: 0;
          filter: blur(2px);
          pointer-events: none;
          animation: cosBeam 1.8s ease-out 0.7s forwards;
        }
        .cos-flash {
          position: absolute;
          left: 50%; top: 50%;
          width: 120px; height: 120px;
          margin: -60px 0 0 -60px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(255,255,255,0.98) 0%, rgba(255,255,255,0.55) 35%, transparent 70%);
          opacity: 0;
          transform: scale(0);
          pointer-events: none;
          animation: cosFlash 1s ease-out 0.65s forwards;
        }
        .cos-chest {
          position: relative;
          width: 152px; height: 152px;
          z-index: 2;
          animation: cosChest 2.4s ease-in-out forwards;
        }
        .cos-particle {
          position: absolute;
          left: 50%; top: 50%;
          border-radius: 50%;
          opacity: 0;
          transform: translate(-50%, -50%);
          pointer-events: none;
          animation: cosParticle 1.4s cubic-bezier(0.16, 0.84, 0.42, 1.0) forwards;
        }
        .cos-sparkle {
          position: absolute;
          left: 50%; top: 50%;
          opacity: 0;
          background: linear-gradient(135deg, #ffffff 0%, #fde047 100%);
          clip-path: polygon(50% 0%, 58% 38%, 100% 50%, 58% 62%, 50% 100%, 42% 62%, 0% 50%, 42% 38%);
          transform: translate(-50%, -50%);
          filter: drop-shadow(0 0 8px rgba(253, 224, 71, 0.85));
          pointer-events: none;
          animation: cosSparkle 1.6s cubic-bezier(0.2, 0.7, 0.4, 1) forwards;
        }

        @keyframes cosAura {
          0%   { opacity: 0;   transform: scale(0.35); }
          30%  { opacity: 0.55; transform: scale(0.85); }
          55%  { opacity: 1;    transform: scale(1.35); }
          75%  { opacity: 0.6;  transform: scale(1.8);  }
          100% { opacity: 0;    transform: scale(2.2);  }
        }
        @keyframes cosShockwave {
          0%   { opacity: 1;   transform: translate(-50%, -50%) scale(0.35); border-width: 5px; }
          70%  { opacity: 0.5; transform: translate(-50%, -50%) scale(3.6);  border-width: 2px; }
          100% { opacity: 0;   transform: translate(-50%, -50%) scale(5);    border-width: 1px; }
        }
        @keyframes cosBeam {
          0%   { opacity: 0;    transform: translate(-50%, -85%) scaleY(0);   }
          15%  { opacity: 0.95; transform: translate(-50%, -85%) scaleY(0.55);}
          45%  { opacity: 1;    transform: translate(-50%, -85%) scaleY(1.0); }
          75%  { opacity: 0.65; transform: translate(-50%, -85%) scaleY(1.1); }
          100% { opacity: 0;    transform: translate(-50%, -85%) scaleY(1.2); }
        }
        @keyframes cosFlash {
          0%   { opacity: 0; transform: scale(0); }
          15%  { opacity: 1; transform: scale(0.45); }
          45%  { opacity: 0.9; transform: scale(2.4); }
          100% { opacity: 0; transform: scale(3.6); }
        }
        /* Chest behaviour: builds tension by wobbling and rising, then
           bursts at ~70% with a final scale-up and a quick fade-out so the
           reveal can show the loot. */
        @keyframes cosChest {
          0%   { transform: rotate(0deg) translateY(0)   scale(1);    filter: brightness(1); }
          10%  { transform: rotate(-3deg) translateY(-2px) scale(1.02); }
          22%  { transform: rotate(3deg)  translateY(-4px) scale(1.05); }
          34%  { transform: rotate(-5deg) translateY(-6px) scale(1.08); }
          46%  { transform: rotate(5deg)  translateY(-9px) scale(1.10); }
          58%  { transform: rotate(-7deg) translateY(-14px) scale(1.16); filter: brightness(1.4); }
          66%  { transform: rotate(0deg)  translateY(-22px) scale(1.32); filter: brightness(2.6); opacity: 1; }
          72%  { transform: rotate(0deg)  translateY(-22px) scale(1.55); filter: brightness(3.5); opacity: 0.85; }
          80%  { transform: rotate(0deg)  translateY(-20px) scale(0.55); opacity: 0; }
          100% { transform: scale(0); opacity: 0; }
        }
        @keyframes cosParticle {
          0%   { opacity: 0;
                 transform: translate(-50%, -50%) scale(0); }
          15%  { opacity: 1;
                 transform: translate(calc(-50% + var(--tx) * 0.25), calc(-50% + var(--ty) * 0.25)) scale(1.3); }
          60%  { opacity: 1;
                 transform: translate(calc(-50% + var(--tx) * 0.7),  calc(-50% + var(--ty) * 0.7))  scale(1); }
          100% { opacity: 0;
                 transform: translate(calc(-50% + var(--tx)),         calc(-50% + var(--ty)))         scale(0.25); }
        }
        @keyframes cosSparkle {
          0%   { opacity: 0;
                 transform: translate(-50%, -50%) scale(0) rotate(var(--rot, 0deg)); }
          25%  { opacity: 1;
                 transform: translate(calc(-50% + var(--tx) * 0.3), calc(-50% + var(--ty) * 0.3)) scale(1.4) rotate(calc(var(--rot, 0deg) + 90deg)); }
          70%  { opacity: 1;
                 transform: translate(calc(-50% + var(--tx) * 0.8), calc(-50% + var(--ty) * 0.8)) scale(0.85) rotate(calc(var(--rot, 0deg) + 270deg)); }
          100% { opacity: 0;
                 transform: translate(calc(-50% + var(--tx)),       calc(-50% + var(--ty)))       scale(0.2)  rotate(calc(var(--rot, 0deg) + 360deg)); }
        }
        @media (prefers-reduced-motion: reduce) {
          .cos-chest, .cos-aura, .cos-flash, .cos-beam, .cos-shockwave, .cos-particle, .cos-sparkle {
            animation-duration: 0.4s !important;
          }
        }
      `}</style>
    </div>
  );
}
