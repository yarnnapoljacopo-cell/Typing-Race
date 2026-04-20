import { memo } from "react";
import { Participant } from "@/hooks/useSprintRoom";
import { motion } from "framer-motion";
import { User, Trophy } from "lucide-react";

interface RaceTrackProps {
  participants: Participant[];
  currentParticipantId: string | null;
}

const LANE_COLORS = [
  "bg-chart-1",
  "bg-chart-2",
  "bg-chart-3",
  "bg-chart-4",
  "bg-chart-5",
  "bg-primary",
];

export const RaceTrack = memo(function RaceTrack({ participants, currentParticipantId }: RaceTrackProps) {
  // Sort participants by ID to maintain consistent lanes
  const sortedParticipants = [...participants].sort((a, b) => a.id.localeCompare(b.id));
  
  // Calculate max WPM to determine track scale, with a minimum to avoid division by zero
  const maxWpm = Math.max(...participants.map((p) => p.wpm), 40);

  return (
    <div className="w-full bg-card border rounded-lg shadow-sm overflow-hidden flex flex-col relative">
      {/* Finish line overlay */}
      <div className="absolute right-8 top-0 bottom-0 w-2 border-r-2 border-dashed border-muted-foreground/30 z-0" />
      
      <div className="p-4 space-y-3 relative z-10">
        {sortedParticipants.map((p, i) => {
          const colorClass = LANE_COLORS[i % LANE_COLORS.length];
          const isMe = p.id === currentParticipantId;
          const progress = Math.min((p.wpm / maxWpm) * 100, 95); // max 95% to stay before finish line visually unless done

          return (
            <div key={p.id} className="relative h-12 flex items-center bg-muted/30 rounded-md overflow-hidden">
              {/* Lane track line */}
              <div className="absolute left-0 right-0 h-0.5 bg-border top-1/2 -translate-y-1/2 z-0" />

              <motion.div
                className="relative z-10 flex items-center gap-3 pl-2 pr-4 h-full"
                initial={{ left: "0%" }}
                animate={{ left: `${progress}%` }}
                transition={{ type: "spring", stiffness: 50, damping: 15 }}
                style={{ translateX: "-5%" }}
              >
                <div className={`flex flex-col items-center justify-center min-w-16 ${isMe ? 'opacity-100' : 'opacity-80'}`}>
                  <div className={`flex items-center justify-center w-8 h-8 rounded-full text-white shadow-sm ${colorClass} ${isMe ? 'ring-2 ring-primary ring-offset-2' : ''}`}>
                    {isMe ? <User size={16} /> : <Trophy size={14} className="opacity-70" />}
                  </div>
                  <div className="text-[10px] font-medium truncate w-full text-center mt-0.5 text-foreground">
                    {p.name} {isMe && "(You)"}
                  </div>
                </div>
                
                <div className="bg-background border shadow-xs px-2 py-0.5 rounded text-xs font-mono font-bold">
                  {p.wpm} <span className="text-[9px] text-muted-foreground font-sans font-normal">WPM</span>
                </div>
              </motion.div>
            </div>
          );
        })}
        {participants.length === 0 && (
          <div className="h-12 flex items-center justify-center text-sm text-muted-foreground italic">
            Waiting for participants...
          </div>
        )}
      </div>
    </div>
  );
});
