import { memo } from "react";
import { Clock, Timer as TimerIcon } from "lucide-react";

interface TimerProps {
  timeLeft: number | null;
  countdownTimeLeft?: number | null;
  status: "waiting" | "countdown" | "running" | "finished";
}

export const Timer = memo(function Timer({ timeLeft, countdownTimeLeft, status }: TimerProps) {
  if (status === "waiting") {
    return (
      <div className="flex flex-col items-center justify-center p-6 bg-card border rounded-lg shadow-sm">
        <Clock className="w-8 h-8 text-muted-foreground mb-2" />
        <h2 className="text-xl font-medium text-foreground">Waiting to Start</h2>
        <p className="text-sm text-muted-foreground text-center max-w-sm mt-1">
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

    return (
      <div className={`flex flex-col items-center justify-center p-6 border rounded-lg shadow-sm transition-colors ${
        isImminent ? "bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-700" : "bg-card"
      }`}>
        <TimerIcon className={`w-6 h-6 mb-2 ${isImminent ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}`} />
        <div className={`text-5xl font-mono font-bold tracking-tighter tabular-nums ${
          isImminent ? "text-amber-700 dark:text-amber-300" : "text-foreground"
        }`}>
          {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
        </div>
        <p className={`text-xs mt-2 uppercase tracking-widest font-medium ${
          isImminent ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"
        }`}>
          {isImminent ? "Sprint starting soon!" : "Until sprint starts"}
        </p>
      </div>
    );
  }

  if (status === "finished") {
    return (
      <div className="flex flex-col items-center justify-center p-4 bg-primary/10 border border-primary/20 rounded-lg text-primary">
        <h2 className="text-lg font-bold">Sprint Finished!</h2>
        <p className="text-sm">Pens down. Great work everyone.</p>
      </div>
    );
  }

  // Running status
  const totalSeconds = timeLeft || 0;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  
  const isLowTime = totalSeconds > 0 && totalSeconds <= 60;

  return (
    <div className={`flex flex-col items-center justify-center p-6 border rounded-lg shadow-sm transition-colors ${isLowTime ? "bg-destructive/10 border-destructive/30" : "bg-card"}`}>
      <div className={`text-6xl font-mono font-bold tracking-tighter ${isLowTime ? "text-destructive" : "text-foreground"}`}>
        {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
      </div>
      <p className={`text-sm mt-2 uppercase tracking-widest font-medium ${isLowTime ? "text-destructive/80" : "text-muted-foreground"}`}>
        {isLowTime ? "Final minute!" : "Remaining"}
      </p>
    </div>
  );
});
