import { useEffect, useRef } from "react";
import { useSkin } from "@/lib/skinContext";

function EternalStars() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    const stars: Array<{ x: number; y: number; r: number; a: number; speed: number; drift: number }> = [];

    function resize() {
      if (!canvas) return;
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener("resize", resize);

    for (let i = 0; i < 120; i++) {
      stars.push({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        r: Math.random() * 1.5 + 0.3,
        a: Math.random(),
        speed: Math.random() * 0.3 + 0.05,
        drift: (Math.random() - 0.5) * 0.2,
      });
    }

    function draw() {
      if (!canvas || !ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const s of stars) {
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(160,200,255,${s.a * 0.7})`;
        ctx.fill();
        s.y -= s.speed;
        s.x += s.drift;
        s.a = 0.3 + 0.7 * Math.abs(Math.sin(Date.now() / 2000 + s.x));
        if (s.y < -5) { s.y = canvas.height + 5; s.x = Math.random() * canvas.width; }
        if (s.x < 0) s.x = canvas.width;
        if (s.x > canvas.width) s.x = 0;
      }
      animId = requestAnimationFrame(draw);
    }
    draw();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0"
      style={{ opacity: 0.6 }}
    />
  );
}

function FinalInkCanvas({ typingSpeed }: { typingSpeed: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const speedRef = useRef(typingSpeed);
  speedRef.current = typingSpeed;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let animId: number;

    interface Drop { x: number; y: number; len: number; speed: number; opacity: number; width: number }
    const drops: Drop[] = [];

    function resize() {
      if (!canvas) return;
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener("resize", resize);

    function spawnDrop() {
      if (!canvas) return;
      const intensity = Math.min(speedRef.current / 60, 1);
      drops.push({
        x: Math.random() * canvas.width,
        y: -20,
        len: 40 + Math.random() * 80 * intensity,
        speed: 1.5 + Math.random() * 3 * intensity,
        opacity: 0.4 + intensity * 0.5,
        width: 1 + intensity * 1.5,
      });
    }

    let spawnTimer = 0;
    function draw(ts: number) {
      if (!canvas || !ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const intensity = Math.min(speedRef.current / 60, 1);
      if (ts - spawnTimer > Math.max(20, 200 - intensity * 180)) {
        spawnDrop();
        spawnTimer = ts;
      }
      for (let i = drops.length - 1; i >= 0; i--) {
        const d = drops[i];
        const grd = ctx.createLinearGradient(d.x, d.y, d.x, d.y + d.len);
        grd.addColorStop(0, `rgba(218,165,32,0)`);
        grd.addColorStop(0.5, `rgba(218,165,32,${d.opacity})`);
        grd.addColorStop(1, `rgba(218,165,32,0)`);
        ctx.beginPath();
        ctx.moveTo(d.x, d.y);
        ctx.lineTo(d.x, d.y + d.len);
        ctx.strokeStyle = grd;
        ctx.lineWidth = d.width;
        ctx.stroke();
        d.y += d.speed;
        if (d.y > canvas.height + d.len) drops.splice(i, 1);
      }
      animId = requestAnimationFrame(draw);
    }
    animId = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0"
    />
  );
}

export function SkinOverlay({ typingSpeed = 0 }: { typingSpeed?: number }) {
  const { activeSkin } = useSkin();
  if (activeSkin === "eternal") return <EternalStars />;
  if (activeSkin === "final") return <FinalInkCanvas typingSpeed={typingSpeed} />;
  return null;
}
