import { useState, useEffect } from "react";
import { SignInButton, SignUpButton } from "@clerk/react";
import { ArrowRight, Zap, Users, BookOpen, UserRound, WifiOff, Lock, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useGuest } from "@/lib/guestContext";
import { useLocation } from "wouter";

const RELEASES_URL = "https://api.github.com/repos/yarnnapoljacopo-cell/Typing-Race/releases/latest";
const RELEASES_PAGE = "https://github.com/yarnnapoljacopo-cell/Typing-Race/releases/latest";

const styles = `
.ws-landing {
  --cream: #F5F2EC;
  --ink: #1a1a2e;
  --blue: #3B5FDB;
  --blue-light: #dce6f7;
  --blue-soft: #6B8FD4;
  --muted: #7a7a92;
  background: var(--cream);
  font-family: "DM Sans", sans-serif;
  min-height: 100vh;
  display: flex; align-items: center; justify-content: center;
  position: relative; overflow: hidden;
  color: var(--ink);
}
.ws-landing .bg-grid {
  position: absolute; inset: 0; z-index: 0; pointer-events: none;
  background-image:
    linear-gradient(rgba(107,143,212,0.05) 1px, transparent 1px),
    linear-gradient(90deg, rgba(107,143,212,0.05) 1px, transparent 1px);
  background-size: 52px 52px;
}
.ws-landing .bg-orb {
  position: absolute; border-radius: 50%;
  filter: blur(100px); -webkit-filter: blur(100px);
  pointer-events: none; z-index: 0;
}
.ws-landing .orb1 { width: 580px; height: 580px; background: radial-gradient(circle, rgba(107,143,212,0.18) 0%, rgba(107,143,212,0) 70%); top: -160px; right: -140px; }
.ws-landing .orb2 { width: 420px; height: 420px; background: radial-gradient(circle, rgba(232,168,56,0.10) 0%, rgba(232,168,56,0) 70%); bottom: -100px; left: -100px; }
.ws-landing .orb3 { width: 300px; height: 300px; background: radial-gradient(circle, rgba(107,143,212,0.10) 0%, rgba(107,143,212,0) 70%); top: 40%; left: 5%; }
.ws-landing .bg-ring {
  position: absolute; border-radius: 50%;
  top: 50%; left: 50%; transform: translate(-50%,-50%);
  z-index: 0; pointer-events: none; background: transparent;
}
.ws-landing .ring1 { width: 780px; height: 780px; border: 1.5px solid rgba(107,143,212,0.08); }
.ws-landing .ring2 { width: 560px; height: 560px; border: 1px solid rgba(107,143,212,0.05); }

.ws-landing .page {
  position: relative; z-index: 1;
  width: 100%; max-width: 500px;
  padding: 48px 24px 60px;
  animation: ws-fadeUp 0.7s cubic-bezier(.22,1,.36,1) both;
}
@keyframes ws-fadeUp {
  from { opacity: 0; transform: translateY(28px); }
  to   { opacity: 1; transform: translateY(0); }
}

.ws-landing .logo-wrap { display: flex; justify-content: center; margin-bottom: 28px; }
.ws-landing .logo-img {
  width: 88px; height: 88px; border-radius: 24px; display: block;
  box-shadow: 0 0 0 1px rgba(255,255,255,0.08), 0 16px 48px rgba(0,0,0,0.12);
  animation: ws-logoFloat 5s ease-in-out infinite;
  object-fit: cover;
}
@keyframes ws-logoFloat {
  0%,100% { transform: translateY(0); }
  50% { transform: translateY(-7px); }
}

.ws-landing .headline { text-align: center; margin-bottom: 10px; }
.ws-landing .headline h1 {
  font-family: "Playfair Display", Georgia, serif;
  font-size: 3.4rem; font-weight: 900;
  color: var(--ink); letter-spacing: -0.025em; line-height: 1.02;
}
.ws-landing .tagline { text-align: center; margin-bottom: 36px; }
.ws-landing .tagline p {
  font-size: 1rem; color: var(--muted);
  font-weight: 300; font-style: italic;
  letter-spacing: 0.02em; line-height: 1.6;
}

.ws-landing .feature-grid {
  display: grid; grid-template-columns: repeat(3, 1fr);
  gap: 10px; margin-bottom: 32px;
}
.ws-landing .feature-card {
  background: white;
  border: 1px solid rgba(107,143,212,0.12);
  border-radius: 18px; padding: 18px 14px 20px;
  box-shadow: 0 2px 12px rgba(107,143,212,0.07);
  transition: all 0.22s cubic-bezier(.22,1,.36,1);
  position: relative; overflow: hidden;
}
.ws-landing .feature-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 32px rgba(107,143,212,0.13);
  border-color: rgba(107,143,212,0.22);
}
.ws-landing .feature-icon {
  width: 40px; height: 40px; border-radius: 11px;
  background: linear-gradient(135deg, #eef3fd, #dce6f7);
  display: flex; align-items: center; justify-content: center;
  margin-bottom: 14px;
  box-shadow: 0 1px 4px rgba(107,143,212,0.15);
  color: var(--blue);
}
.ws-landing .feature-title {
  font-size: 0.9rem; font-weight: 700; color: var(--ink);
  margin-bottom: 6px; letter-spacing: -0.01em;
}
.ws-landing .feature-desc {
  font-size: 0.75rem; color: var(--muted); line-height: 1.55; font-weight: 400;
}

.ws-landing .section-label {
  text-align: center;
  font-size: 0.68rem; font-weight: 700; letter-spacing: 0.14em;
  color: var(--muted); text-transform: uppercase;
  margin-bottom: 12px;
  display: flex; align-items: center; gap: 10px;
}
.ws-landing .section-label::before, .ws-landing .section-label::after {
  content: ''; flex: 1; height: 1px;
  background: linear-gradient(90deg, transparent, rgba(107,143,212,0.2), transparent);
}

.ws-landing .download-grid {
  display: grid; grid-template-columns: 1fr 1fr;
  gap: 10px; margin-bottom: 28px;
}
.ws-landing .download-card {
  background: white;
  border: 1px solid rgba(107,143,212,0.12);
  border-radius: 14px; padding: 13px 16px;
  box-shadow: 0 2px 12px rgba(107,143,212,0.06);
  cursor: pointer; transition: all 0.22s cubic-bezier(.22,1,.36,1);
  display: flex; flex-direction: row; align-items: center;
  gap: 12px; text-decoration: none;
  font-family: inherit; color: inherit;
}
.ws-landing .download-card:disabled { cursor: wait; opacity: 0.7; }
.ws-landing .download-card:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(107,143,212,0.13);
  border-color: rgba(107,143,212,0.24);
}
.ws-landing .download-os-name {
  font-size: 0.88rem; font-weight: 700; color: var(--ink);
  letter-spacing: -0.01em; line-height: 1.2;
}
.ws-landing .download-os-sub {
  font-size: 0.68rem; color: var(--muted); letter-spacing: 0.02em;
  margin-top: 1px;
}

.ws-landing .cta-primary {
  width: 100%;
  background: #3B5FDB;
  border: none; border-radius: 14px; padding: 17px;
  color: white; font-family: "DM Sans", sans-serif;
  font-size: 1rem; font-weight: 700; letter-spacing: 0.01em;
  cursor: pointer; margin-bottom: 10px;
  display: flex; align-items: center; justify-content: center; gap: 10px;
  box-shadow: 0 4px 20px rgba(59,95,219,0.30);
  transition: all 0.22s cubic-bezier(.22,1,.36,1);
}
.ws-landing .cta-primary:hover {
  background: #3252c8;
  transform: translateY(-2px);
  box-shadow: 0 10px 32px rgba(59,95,219,0.40);
}
.ws-landing .cta-primary:active { transform: translateY(0); background: #2d49b5; }
.ws-landing .cta-primary:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }

.ws-landing .cta-secondary {
  width: 100%;
  background: white;
  border: 1.5px solid rgba(107,143,212,0.22);
  border-radius: 14px; padding: 16px;
  color: var(--ink); font-family: "DM Sans", sans-serif;
  font-size: 1rem; font-weight: 600; letter-spacing: 0.01em;
  cursor: pointer; margin-bottom: 20px;
  box-shadow: 0 2px 8px rgba(107,143,212,0.07);
  transition: all 0.22s cubic-bezier(.22,1,.36,1);
}
.ws-landing .cta-secondary:hover {
  transform: translateY(-2px);
  border-color: rgba(59,95,219,0.35);
  box-shadow: 0 8px 24px rgba(107,143,212,0.13);
  color: var(--blue);
}

.ws-landing .or-divider {
  display: flex; align-items: center; gap: 14px;
  margin-bottom: 20px;
}
.ws-landing .or-line { flex: 1; height: 1px; background: rgba(107,143,212,0.15); }
.ws-landing .or-text { font-size: 0.78rem; color: var(--muted); font-weight: 500; }

.ws-landing .guest-link {
  display: flex; align-items: center; justify-content: center; gap: 8px;
  color: var(--blue-soft); font-size: 0.88rem; font-weight: 600;
  cursor: pointer; transition: all 0.18s; background: none; border: none;
  font-family: "DM Sans", sans-serif; width: 100%;
  padding: 6px;
}
.ws-landing .guest-link:hover { color: var(--blue); }

.ws-landing .footer-note {
  text-align: center; margin-top: 28px;
  font-size: 0.75rem; color: rgba(120,120,145,0.7);
  letter-spacing: 0.02em;
}
.ws-landing .footer-note span { display: inline-flex; align-items: center; gap: 5px; }

.ws-landing .guest-form { margin-top: -10px; margin-bottom: 20px; }
.ws-landing .guest-form-title {
  text-align: center; font-size: 0.88rem; font-weight: 600;
  color: var(--ink); margin-bottom: 8px;
}
.ws-landing .guest-error {
  font-size: 0.75rem; color: #c0392b; text-align: center; margin-top: 6px;
}
.ws-landing .guest-cancel {
  display: block; margin: 8px auto 0; background: none; border: none;
  color: var(--muted); font-size: 0.75rem; cursor: pointer; padding: 4px;
  font-family: inherit;
}
.ws-landing .guest-cancel:hover { color: var(--ink); }

.ws-landing .offline-card {
  display: flex; align-items: center; gap: 12px;
  width: 100%;
  background: white;
  border: 2px dashed rgba(107,143,212,0.22);
  border-radius: 14px; padding: 14px 16px;
  cursor: pointer; font-family: inherit; color: inherit;
  transition: all 0.22s cubic-bezier(.22,1,.36,1);
  margin-top: 14px;
}
.ws-landing .offline-card:hover {
  border-color: rgba(59,95,219,0.35);
  background: #fafbff;
}
.ws-landing .offline-icon {
  width: 36px; height: 36px; border-radius: 10px;
  background: #f0f4ff;
  display: flex; align-items: center; justify-content: center;
  color: var(--blue-soft);
}
.ws-landing .offline-text { flex: 1; text-align: left; }
.ws-landing .offline-title {
  font-size: 0.88rem; font-weight: 700; color: var(--ink); line-height: 1.2;
}
.ws-landing .offline-sub {
  font-size: 0.7rem; color: var(--muted); margin-top: 2px;
}
`;

function AppleIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 32 32" fill="#1a1a2e" style={{ flexShrink: 0 }}>
      <path d="M22.6 16.8c0-3.4 2.8-5 2.9-5.1-1.6-2.3-4-2.6-4.9-2.6-2.1-.2-4 1.2-5.1 1.2-1 0-2.7-1.2-4.4-1.2-2.2 0-4.3 1.3-5.4 3.3-2.3 4-.6 9.9 1.6 13.2 1.1 1.6 2.4 3.3 4.1 3.2 1.6-.1 2.2-1 4.2-1 2 0 2.5 1 4.3 1 1.8 0 2.9-1.6 4-3.2 1.3-1.8 1.8-3.6 1.8-3.7-.1 0-3.1-1.1-3.1-4.1zM19.4 7.2c.9-1.1 1.5-2.6 1.3-4.1-1.3.1-2.8.9-3.7 2-.8 1-1.5 2.5-1.3 4 1.4.1 2.8-.7 3.7-1.9z"/>
    </svg>
  );
}

function WindowsIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 32 32" fill="#1a1a2e" style={{ flexShrink: 0 }}>
      <rect x="0" y="0" width="14" height="14" rx="1.5"/>
      <rect x="17" y="0" width="14" height="14" rx="1.5"/>
      <rect x="0" y="17" width="14" height="14" rx="1.5"/>
      <rect x="17" y="17" width="14" height="14" rx="1.5"/>
    </svg>
  );
}

type DownloadLinks = { mac: string | null; win: string | null; version: string | null };

function DownloadSection() {
  const [links, setLinks] = useState<DownloadLinks>({ mac: null, win: null, version: null });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(RELEASES_URL)
      .then((r) => r.json())
      .then((release) => {
        const assets: { name: string; browser_download_url: string }[] = release.assets ?? [];
        const mac = assets.find((a) => a.name.endsWith(".dmg"))?.browser_download_url ?? null;
        const win = assets.find((a) => a.name.endsWith(".exe"))?.browser_download_url ?? null;
        setLinks({ mac, win, version: release.tag_name ?? null });
      })
      .catch(() => setLinks({ mac: null, win: null, version: null }))
      .finally(() => setLoading(false));
  }, []);

  const handleDownload = (url: string | null) => {
    window.open(url ?? RELEASES_PAGE, "_blank", "noopener,noreferrer");
  };

  const versionLabel = (ext: string) =>
    loading ? (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
        <Loader2 size={10} className="animate-spin" /> Loading…
      </span>
    ) : links.version ? (
      <>{ext} · {links.version}</>
    ) : (
      <>View releases</>
    );

  return (
    <>
      <div className="section-label">Desktop App</div>
      <div className="download-grid">
        <button className="download-card" onClick={() => handleDownload(links.mac)} disabled={loading}>
          <AppleIcon />
          <div>
            <div className="download-os-name">macOS</div>
            <div className="download-os-sub">{versionLabel(".dmg")}</div>
          </div>
        </button>
        <button className="download-card" onClick={() => handleDownload(links.win)} disabled={loading}>
          <WindowsIcon />
          <div>
            <div className="download-os-name">Windows</div>
            <div className="download-os-sub">{versionLabel(".exe")}</div>
          </div>
        </button>
      </div>
    </>
  );
}

export default function Home() {
  const [, setLocation] = useLocation();
  const { updateGuestName } = useGuest();
  const [guestStep, setGuestStep] = useState<"hidden" | "form">("hidden");
  const [guestInput, setGuestInput] = useState("");
  const [error, setError] = useState("");

  const handleGuestContinue = () => {
    const name = guestInput.trim();
    if (name.length < 2) {
      setError("Name must be at least 2 characters.");
      return;
    }
    if (name.length > 32) {
      setError("Name must be 32 characters or fewer.");
      return;
    }
    updateGuestName(name);
    setLocation("/portal");
  };

  const isElectron = !!(window as unknown as { electronAPI?: unknown }).electronAPI;

  return (
    <div className="ws-landing">
      <style>{styles}</style>

      <div className="bg-grid" />
      <div className="bg-orb orb1" />
      <div className="bg-orb orb2" />
      <div className="bg-orb orb3" />
      <div className="bg-ring ring1" />
      <div className="bg-ring ring2" />

      <div className="page">
        <div className="logo-wrap">
          <img className="logo-img" src="/logo-icon.png" alt="Writing Sprint" />
        </div>

        <div className="headline">
          <h1>Writing Sprint</h1>
        </div>
        <div className="tagline">
          <p>Race against fellow writers.<br />Find your flow.</p>
        </div>

        <div className="feature-grid">
          <div className="feature-card">
            <div className="feature-icon"><Zap size={18} /></div>
            <div className="feature-title">Sprint</div>
            <div className="feature-desc">Timed sessions to unlock your creativity</div>
          </div>
          <div className="feature-card">
            <div className="feature-icon"><Users size={18} /></div>
            <div className="feature-title">Compete</div>
            <div className="feature-desc">Watch live progress on the race track</div>
          </div>
          <div className="feature-card">
            <div className="feature-icon"><BookOpen size={18} /></div>
            <div className="feature-title">Save</div>
            <div className="feature-desc">All your sprints saved to your account</div>
          </div>
        </div>

        <DownloadSection />

        <SignUpButton mode="modal">
          <button className="cta-primary">
            Create free account <ArrowRight size={18} />
          </button>
        </SignUpButton>
        <SignInButton mode="modal">
          <button className="cta-secondary">Sign in</button>
        </SignInButton>

        <div className="or-divider">
          <div className="or-line" />
          <span className="or-text">or</span>
          <div className="or-line" />
        </div>

        {guestStep === "hidden" ? (
          <button className="guest-link" onClick={() => setGuestStep("form")}>
            <UserRound size={15} />
            Continue as guest
          </button>
        ) : (
          <div className="guest-form">
            <div className="guest-form-title">Choose a display name</div>
            <Input
              autoFocus
              placeholder="e.g. ScribbleKing"
              value={guestInput}
              maxLength={32}
              onChange={(e) => { setGuestInput(e.target.value); setError(""); }}
              onKeyDown={(e) => e.key === "Enter" && handleGuestContinue()}
              style={{ textAlign: "center", borderRadius: 12, padding: "14px", fontSize: "0.95rem" }}
            />
            {error && <p className="guest-error">{error}</p>}
            <button
              className="cta-primary"
              style={{ marginTop: 10, marginBottom: 0 }}
              onClick={handleGuestContinue}
              disabled={!guestInput.trim()}
            >
              Continue <ArrowRight size={18} />
            </button>
            <button
              className="guest-cancel"
              onClick={() => { setGuestStep("hidden"); setGuestInput(""); setError(""); }}
            >
              Cancel
            </button>
          </div>
        )}

        {isElectron && (
          <button className="offline-card" onClick={() => setLocation("/offline-sprint")}>
            <div className="offline-icon"><WifiOff size={18} /></div>
            <div className="offline-text">
              <div className="offline-title">Sprint Offline</div>
              <div className="offline-sub">No account needed · saves locally</div>
            </div>
            <ArrowRight size={16} style={{ color: "var(--muted)" }} />
          </button>
        )}

        <div className="footer-note">
          <span>
            <Lock size={12} />
            Free to use. Your writing stays yours.
          </span>
        </div>
      </div>
    </div>
  );
}
