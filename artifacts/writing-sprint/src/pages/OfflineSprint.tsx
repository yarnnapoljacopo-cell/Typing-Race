import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { WritingToolbar, type WritingStyle, type FormatType } from "@/components/WritingToolbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  WifiOff, Download, Copy, RotateCcw, LogOut, CheckCircle,
  RefreshCw, AlertTriangle, Save, Clock,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// ── Helpers ──────────────────────────────────────────────────────────────────

function countWords(str: string): number {
  let count = 0, inWord = false;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    const wc = (c >= 65 && c <= 90) || (c >= 97 && c <= 122) || (c >= 48 && c <= 57) || c === 95;
    if (wc && !inWord) { count++; inWord = true; }
    else if (!wc) { inWord = false; }
  }
  return count;
}

function fmt(secs: number) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function defaultName() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `sprint-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}-${pad(d.getMinutes())}`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const eAPI = () => (window as any).electronAPI as Record<string, (...a: any[]) => Promise<any>> | undefined;

const DURATIONS = [5, 10, 15, 20, 30, 45, 60];

const DEFAULT_STYLE: WritingStyle = {
  fontFamily: "Georgia, serif",
  fontSize: 18,
  lineHeight: 1.75,
  paragraphMode: "none",
  typewriterMode: false,
};

type Phase = "setup" | "sprinting" | "done";

// ── Component ─────────────────────────────────────────────────────────────────

export default function OfflineSprint() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [phase, setPhase] = useState<Phase>("setup");
  const [duration, setDuration] = useState(20);
  const [customMin, setCustomMin] = useState("");
  const [text, setText] = useState("");
  const [timeLeft, setTimeLeft] = useState(0);
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [writingStyle, setWritingStyle] = useState<WritingStyle>(DEFAULT_STYLE);
  const [autoSaveLabel, setAutoSaveLabel] = useState<"" | "saved">("");
  const [recoveryData, setRecoveryData] = useState<{ exists: boolean; content?: string } | null>(null);
  const [syncing, setSyncing] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const recoveryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoSaveTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const words = countWords(text);
  const elapsed = startTime ? (Date.now() - startTime.getTime()) / 1000 / 60 : 0;
  const wpm = elapsed > 0.1 ? Math.round(words / elapsed) : 0;

  // ── Recovery check on mount ───────────────────────────────────────────────
  useEffect(() => {
    const api = eAPI();
    if (!api?.checkRecovery) return;
    api.checkRecovery().then((r: { exists: boolean; content?: string }) => {
      if (r?.exists) setRecoveryData(r);
    }).catch(() => {});
  }, []);

  // ── Timer ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== "sprinting") return;
    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setPhase("done");
          eAPI()?.dismissRecovery?.().catch(() => {});
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [phase]);

  // ── Auto-save every 30s ───────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== "sprinting") return;
    const api = eAPI();
    if (!api?.saveDraft) return;
    autoSaveTimerRef.current = setInterval(async () => {
      if (!text.trim()) return;
      await api.saveDraft(text).catch(() => {});
      setAutoSaveLabel("saved");
      setTimeout(() => setAutoSaveLabel(""), 2500);
    }, 30_000);
    return () => {
      if (autoSaveTimerRef.current) clearInterval(autoSaveTimerRef.current);
    };
  }, [phase, text]);

  // ── Keystroke recovery (throttled 2s) ────────────────────────────────────
  const scheduleRecoverySave = useCallback(() => {
    if (!eAPI()?.saveRecovery) return;
    if (recoveryTimerRef.current) clearTimeout(recoveryTimerRef.current);
    recoveryTimerRef.current = setTimeout(() => {
      eAPI()?.saveRecovery(text).catch(() => {});
    }, 2000);
  }, [text]);

  // ── Start sprint ──────────────────────────────────────────────────────────
  function handleStart() {
    const mins = customMin ? parseInt(customMin, 10) : duration;
    if (!mins || mins < 1 || mins > 300) {
      toast({ title: "Invalid duration", description: "Pick 1–300 minutes.", variant: "destructive" });
      return;
    }
    setTimeLeft(mins * 60);
    setStartTime(new Date());
    setPhase("sprinting");
    setTimeout(() => textareaRef.current?.focus(), 100);
  }

  // ── Recover ───────────────────────────────────────────────────────────────
  function handleRecover() {
    if (!recoveryData?.content) return;
    setText(recoveryData.content);
    setRecoveryData(null);
    eAPI()?.dismissRecovery?.().catch(() => {});
    handleStart();
  }

  function handleDismissRecovery() {
    setRecoveryData(null);
    eAPI()?.dismissRecovery?.().catch(() => {});
  }

  // ── Text change ───────────────────────────────────────────────────────────
  function handleTextChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setText(e.target.value);
    if (phase === "sprinting") scheduleRecoverySave();
  }

  // ── Format (bold/italic/underline) ───────────────────────────────────────
  function handleFormat(type: FormatType) {
    const ta = textareaRef.current;
    if (!ta) return;
    const { selectionStart: s, selectionEnd: e, value } = ta;
    if (s === e) return;
    const markers: Record<FormatType, string> = { bold: "**", italic: "_", underline: "__" };
    const m = markers[type];
    const newVal = value.slice(0, s) + m + value.slice(s, e) + m + value.slice(e);
    setText(newVal);
    requestAnimationFrame(() => { ta.selectionStart = s + m.length; ta.selectionEnd = e + m.length; });
  }

  // ── Save to computer ─────────────────────────────────────────────────────
  async function handleSave() {
    const api = eAPI();
    if (!api?.saveSprintFile) {
      navigator.clipboard.writeText(text).catch(() => {});
      toast({ title: "Copied to clipboard", description: "Native save not available in browser." });
      return;
    }
    const result = await api.saveSprintFile(text, `${defaultName()}.txt`).catch(() => null);
    if (result?.saved) {
      toast({ title: "Saved!", description: result.path });
    }
  }

  // ── Copy text ────────────────────────────────────────────────────────────
  async function handleCopy() {
    await navigator.clipboard.writeText(text).catch(() => {});
    toast({ title: "Copied to clipboard!" });
  }

  // ── Sync to account ──────────────────────────────────────────────────────
  async function handleSync() {
    const api = eAPI();
    if (!api?.syncOfflineSprint) return;
    const mins = customMin ? parseInt(customMin, 10) : duration;
    setSyncing(true);
    const result = await api.syncOfflineSprint({ duration: mins, words, text }).catch(() => null);
    setSyncing(false);
    if (result?.ok) {
      toast({ title: "Sprint synced to your account!" });
    } else {
      toast({ title: "Sync failed", description: "Make sure you're signed in and connected.", variant: "destructive" });
    }
  }

  // ── New sprint ────────────────────────────────────────────────────────────
  function handleNewSprint() {
    setText("");
    setCustomMin("");
    setPhase("setup");
    setStartTime(null);
    setAutoSaveLabel("");
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SETUP PHASE
  // ─────────────────────────────────────────────────────────────────────────
  if (phase === "setup") {
    return (
      <div className="min-h-[100dvh] bg-background flex flex-col items-center justify-center px-4 py-12">
        <div className="w-full max-w-md space-y-6">

          {/* Recovery banner */}
          {recoveryData?.exists && (
            <div className="rounded-xl border border-yellow-500/40 bg-yellow-500/10 p-4 space-y-3">
              <div className="flex items-center gap-2 text-yellow-600 dark:text-yellow-400 font-medium text-sm">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                We found unsaved writing from your last session.
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={handleRecover} className="flex-1">Recover it</Button>
                <Button size="sm" variant="outline" onClick={handleDismissRecovery} className="flex-1">Dismiss</Button>
              </div>
            </div>
          )}

          <div className="text-center space-y-1">
            <div className="flex items-center justify-center gap-2 text-muted-foreground text-sm mb-4">
              <WifiOff className="w-4 h-4" />
              Offline Solo Sprint
            </div>
            <h1 className="text-3xl font-bold tracking-tight">Set your duration</h1>
            <p className="text-muted-foreground text-sm">Write freely — your work saves locally every 30 seconds.</p>
          </div>

          {/* Duration grid */}
          <div className="grid grid-cols-4 gap-2">
            {DURATIONS.map((d) => (
              <Button
                key={d}
                variant={duration === d && !customMin ? "default" : "outline"}
                className="py-6 text-base"
                onClick={() => { setDuration(d); setCustomMin(""); }}
              >
                {d}m
              </Button>
            ))}
          </div>

          {/* Custom */}
          <div className="flex gap-2 items-center">
            <Input
              type="number"
              min={1}
              max={300}
              placeholder="Custom (min)"
              value={customMin}
              onChange={(e) => setCustomMin(e.target.value)}
              className="flex-1"
            />
          </div>

          <Button className="w-full py-6 text-lg" onClick={handleStart}>
            Start Sprint →
          </Button>

          <button
            className="w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => setLocation("/portal")}
          >
            ← Back to portal
          </button>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // DONE PHASE
  // ─────────────────────────────────────────────────────────────────────────
  if (phase === "done") {
    return (
      <div className="min-h-[100dvh] bg-background flex flex-col items-center justify-center px-4 py-12">
        <div className="w-full max-w-lg space-y-8 text-center">
          <div className="space-y-2">
            <div className="text-5xl font-bold">{words.toLocaleString()}</div>
            <div className="text-muted-foreground text-lg">words written</div>
            <div className="text-sm text-muted-foreground">{wpm} WPM average</div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Button className="py-6 gap-2" onClick={handleSave}>
              <Save className="w-4 h-4" />
              Save to Computer
            </Button>
            <Button variant="outline" className="py-6 gap-2" onClick={handleCopy}>
              <Copy className="w-4 h-4" />
              Copy Text
            </Button>
            <Button variant="outline" className="py-6 gap-2" onClick={handleNewSprint}>
              <RotateCcw className="w-4 h-4" />
              New Sprint
            </Button>
          </div>

          {eAPI()?.syncOfflineSprint && (
            <div className="rounded-xl border border-border p-4 space-y-3">
              <p className="text-sm text-muted-foreground">Want to count this sprint towards your account stats?</p>
              <Button variant="outline" className="gap-2" onClick={handleSync} disabled={syncing}>
                {syncing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                Sync to Account
              </Button>
            </div>
          )}

          <button
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => setLocation("/portal")}
          >
            ← Back to portal
          </button>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SPRINTING PHASE
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-[100dvh] bg-background flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border shrink-0">
        <div className="flex items-center gap-3">
          <span className="font-mono text-2xl font-bold tabular-nums text-foreground">{fmt(timeLeft)}</span>
          <span className="text-sm text-muted-foreground">{words.toLocaleString()} words · {wpm} wpm</span>
        </div>
        <div className="flex items-center gap-2">
          {autoSaveLabel === "saved" && (
            <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
              <CheckCircle className="w-3 h-3" /> Auto-saved
            </span>
          )}
          <Button size="sm" variant="ghost" className="gap-1.5 text-xs" onClick={handleSave}>
            <Download className="w-3.5 h-3.5" /> Download
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="gap-1.5 text-xs text-muted-foreground"
            onClick={() => { if (confirm("End sprint early?")) setPhase("done"); }}
          >
            <LogOut className="w-3.5 h-3.5" /> End
          </Button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="px-4 py-1.5 border-b border-border shrink-0">
        <WritingToolbar
          style={writingStyle}
          onChange={(s) => setWritingStyle((prev) => ({ ...prev, ...s }))}
          onFormat={handleFormat}
        />
      </div>

      {/* Writing area */}
      <div className="flex-1 overflow-y-auto relative">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleTextChange}
          className="w-full h-full min-h-[calc(100dvh-120px)] resize-none border-0 bg-transparent outline-none px-8 py-6"
          placeholder="Start writing…"
          spellCheck
          style={{
            fontFamily: writingStyle.fontFamily,
            fontSize: writingStyle.fontSize,
            lineHeight: writingStyle.lineHeight,
          }}
        />
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-border shrink-0">
        <div
          className="h-1 bg-primary transition-all duration-1000"
          style={{ width: `${100 - (timeLeft / ((customMin ? parseInt(customMin) : duration) * 60)) * 100}%` }}
        />
      </div>
    </div>
  );
}
