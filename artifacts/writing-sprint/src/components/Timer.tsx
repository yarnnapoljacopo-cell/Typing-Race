import { memo } from "react";
import { Clock } from "lucide-react";

interface TimerProps {
  timeLeft: number | null;
  status: "waiting" | "running" | "finished";
}

export const Timer = memo(function Timer({ timeLeft, status }: TimerProps) {
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
    <div className={`flex flex-col items-center justify-center p-6 border rounded-lg shadow-sm transition-colors ${isLowTime ? 'bg-destructive/10 border-destructive/30' : 'bg-card'}`}>
      <div className={`text-6xl font-mono font-bold tracking-tighter ${isLowTime ? 'text-destructive' : 'text-foreground'}`}>
        {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
      </div>
      <p className={`text-sm mt-2 uppercase tracking-widest font-medium ${isLowTime ? 'text-destructive/80' : 'text-muted-foreground'}`}>
        {isLowTime ? 'Final minute!' : 'Remaining'}
      </p>
    </div>
  );
});
