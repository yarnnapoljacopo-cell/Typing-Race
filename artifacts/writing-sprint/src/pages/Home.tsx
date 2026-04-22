import { useState } from "react";
import { SignInButton, SignUpButton } from "@clerk/react";
import { PenTool, Feather, ArrowRight, Zap, Users, BookOpen, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { setGuestName } from "@/lib/guest";
import { useLocation } from "wouter";

export default function Home() {
  const [, setLocation] = useLocation();
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
    setGuestName(name);
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
        </div>

        <p className="text-xs text-muted-foreground/60">
          Free to use. Your writing stays yours.
        </p>
      </div>
    </div>
  );
}
