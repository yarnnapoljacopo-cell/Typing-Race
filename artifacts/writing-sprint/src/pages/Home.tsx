import { useState, useEffect } from "react";
import { SignInButton, SignUpButton } from "@clerk/react";
import { PenTool, Feather, ArrowRight, Zap, Users, BookOpen, UserRound, WifiOff, Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useGuest } from "@/lib/guestContext";
import { useLocation } from "wouter";

const RELEASES_URL = "https://api.github.com/repos/yarnnapoljacopo-cell/Typing-Race/releases/latest";
const RELEASES_PAGE = "https://github.com/yarnnapoljacopo-cell/Typing-Race/releases/latest";

function AppleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
    </svg>
  );
}

function WindowsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M3 12V6.75l6-1.32v6.57H3zm17 0V5l-9 1.68V12h9zm0 .75V19l-9-1.68V12.75h9zm-17 0V17.25l6 1.32v-5.82H3z" />
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
    if (url) {
      window.open(url, "_blank", "noopener,noreferrer");
    } else {
      window.open(RELEASES_PAGE, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest">Desktop App</p>
      <div className="grid grid-cols-2 gap-3">
        {/* Mac */}
        <button
          type="button"
          onClick={() => handleDownload(links.mac)}
          disabled={loading}
          className="flex flex-col items-center gap-2.5 rounded-xl border border-border bg-card px-4 py-5 hover:border-primary/40 hover:bg-primary/5 transition-all group disabled:opacity-50 disabled:cursor-wait"
        >
          <AppleIcon className="w-8 h-8 text-foreground group-hover:text-primary transition-colors" />
          <div className="text-center">
            <div className="text-sm font-semibold text-foreground">macOS</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {loading ? (
                <span className="inline-flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Loading…</span>
              ) : links.version ? (
                <span>.dmg · {links.version}</span>
              ) : (
                <span>View releases</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 text-xs text-primary font-medium opacity-0 group-hover:opacity-100 transition-opacity">
            <Download className="w-3 h-3" />
            Download
          </div>
        </button>

        {/* Windows */}
        <button
          type="button"
          onClick={() => handleDownload(links.win)}
          disabled={loading}
          className="flex flex-col items-center gap-2.5 rounded-xl border border-border bg-card px-4 py-5 hover:border-primary/40 hover:bg-primary/5 transition-all group disabled:opacity-50 disabled:cursor-wait"
        >
          <WindowsIcon className="w-8 h-8 text-foreground group-hover:text-primary transition-colors" />
          <div className="text-center">
            <div className="text-sm font-semibold text-foreground">Windows</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {loading ? (
                <span className="inline-flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Loading…</span>
              ) : links.version ? (
                <span>.exe · {links.version}</span>
              ) : (
                <span>View releases</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 text-xs text-primary font-medium opacity-0 group-hover:opacity-100 transition-opacity">
            <Download className="w-3 h-3" />
            Download
          </div>
        </button>
      </div>
    </div>
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

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center p-6 selection:bg-primary/20">

      <div className="absolute inset-0 pointer-events-none overflow-hidden flex items-center justify-center opacity-[0.03]">
        <Feather className="w-full h-full max-w-4xl text-primary" strokeWidth={0.5} />
      </div>

      <div className="w-full max-w-md space-y-10 relative z-10 text-center">

        <div className="space-y-4">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-primary/10 text-primary mb-2 shadow-inner">
            <PenTool size={40} />
          </div>
          <h1 className="text-5xl md:text-6xl font-serif font-bold text-foreground tracking-tight">
            Writing Sprint
          </h1>
          <p className="text-xl text-muted-foreground font-medium leading-relaxed">
            Race against fellow writers.<br />Find your flow.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-4 text-left">
          <div className="rounded-xl border border-border bg-card p-4 space-y-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Zap size={16} className="text-primary" />
            </div>
            <p className="text-sm font-semibold text-foreground">Sprint</p>
            <p className="text-xs text-muted-foreground leading-snug">Timed sessions to unlock your creativity</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4 space-y-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Users size={16} className="text-primary" />
            </div>
            <p className="text-sm font-semibold text-foreground">Compete</p>
            <p className="text-xs text-muted-foreground leading-snug">Watch live progress on the race track</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4 space-y-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <BookOpen size={16} className="text-primary" />
            </div>
            <p className="text-sm font-semibold text-foreground">Save</p>
            <p className="text-xs text-muted-foreground leading-snug">All your sprints saved to your account</p>
          </div>
        </div>

        <DownloadSection />

        <div className="space-y-3">
          <SignUpButton mode="modal">
            <Button className="w-full py-6 text-lg hover-elevate group">
              Create free account
              <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Button>
          </SignUpButton>
          <SignInButton mode="modal">
            <Button variant="outline" className="w-full py-6 text-lg">
              Sign in
            </Button>
          </SignInButton>

          <div className="relative flex items-center gap-3 py-1">
            <div className="flex-1 border-t border-border" />
            <span className="text-xs text-muted-foreground/60 shrink-0">or</span>
            <div className="flex-1 border-t border-border" />
          </div>

          {guestStep === "hidden" ? (
            <Button
              variant="ghost"
              className="w-full py-5 text-base text-muted-foreground hover:text-foreground"
              onClick={() => setGuestStep("form")}
            >
              <UserRound className="mr-2 w-4 h-4" />
              Continue as guest
            </Button>
          ) : (
            <div className="space-y-2 text-left">
              <p className="text-sm font-medium text-foreground text-center">Choose a display name</p>
              <Input
                autoFocus
                placeholder="e.g. ScribbleKing"
                value={guestInput}
                maxLength={32}
                onChange={(e) => { setGuestInput(e.target.value); setError(""); }}
                onKeyDown={(e) => e.key === "Enter" && handleGuestContinue()}
                className="text-center text-base py-5 focus-visible:ring-primary"
              />
              {error && <p className="text-xs text-destructive text-center">{error}</p>}
              <Button
                className="w-full py-5 text-base hover-elevate group"
                onClick={handleGuestContinue}
                disabled={!guestInput.trim()}
              >
                Continue
                <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Button>
              <button
                className="w-full text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors py-1"
                onClick={() => { setGuestStep("hidden"); setGuestInput(""); setError(""); }}
              >
                Cancel
              </button>
            </div>
          )}

          <div className="relative flex items-center gap-3 py-1">
            <div className="flex-1 border-t border-border" />
            <span className="text-xs text-muted-foreground/60 shrink-0">or</span>
            <div className="flex-1 border-t border-border" />
          </div>

          <button
            type="button"
            onClick={() => setLocation("/offline-sprint")}
            className="w-full flex items-center gap-3 rounded-xl border-2 border-dashed border-border px-4 py-3.5 text-left hover:border-muted-foreground/40 hover:bg-muted/30 transition-all group"
          >
            <div className="rounded-lg bg-muted p-2 group-hover:bg-muted-foreground/10 transition-colors">
              <WifiOff className="w-4 h-4 text-muted-foreground" />
            </div>
            <div>
              <div className="text-sm font-semibold text-foreground">Sprint Offline</div>
              <div className="text-xs text-muted-foreground">No account needed · saves locally</div>
            </div>
            <ArrowRight className="ml-auto w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
          </button>
        </div>

        <p className="text-xs text-muted-foreground/60">
          Free to use. Your writing stays yours.
        </p>
      </div>
    </div>
  );
}
