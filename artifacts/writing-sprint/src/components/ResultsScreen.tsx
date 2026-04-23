import { Participant } from "@/hooks/useSprintRoom";
import { Button } from "@/components/ui/button";
import { Trophy, Medal, Award, RotateCcw, Home, Zap } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { WritingArchive, type Capsule } from "@/components/WritingArchive";

interface ResultsScreenProps {
  participants: Participant[];
  currentParticipantId: string | null;
  isCreator: boolean;
  onRestart: (duration: number) => void;
  myText: string;
  capsules: Capsule[];
  xpGained?: number | null;
  isBossMode?: boolean;
  isKartMode?: boolean;
}

export function ResultsScreen({
  participants,
  currentParticipantId,
  isCreator,
  onRestart,
  myText,
  capsules,
  xpGained,
  isBossMode = false,
  isKartMode = false,
}: ResultsScreenProps) {
  const [, setLocation] = useLocation();
  const sorted = [...participants].sort((a, b) => {
    if (isKartMode) {
      const aScore = a.wordCount + (a.kartCarOffset ?? 0);
      const bScore = b.wordCount + (b.kartCarOffset ?? 0);
      return bScore - aScore;
    }
    return b.wordCount - a.wordCount;
  });

  const myIndex = sorted.findIndex((p) => p.id === currentParticipantId);
  const isFirstPlace = myIndex === 0;

  const getRankIcon = (index: number) => {
    switch (index) {
      case 0: return <Trophy className="w-6 h-6 text-yellow-500" />;
      case 1: return <Medal className="w-6 h-6 text-gray-400" />;
      case 2: return <Award className="w-6 h-6 text-amber-700" />;
      default: return <span className="w-6 text-center font-bold text-muted-foreground">{index + 1}</span>;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-2xl mx-auto space-y-6"
    >
      <div className="text-center space-y-2">
        <h2 className="text-3xl font-serif font-bold text-foreground">
          {isBossMode ? "🎉 Boss Defeated!" : "Final Results"}
        </h2>
        <p className="text-muted-foreground">
          {isBossMode
            ? "You wrote together and slayed the beast."
            : "The sprint has concluded. Here's how everyone did."}
        </p>
      </div>

      {/* XP gained banner */}
      <AnimatePresence>
        {xpGained != null && xpGained > 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ delay: 0.4, type: "spring", stiffness: 300, damping: 20 }}
            className="relative overflow-hidden rounded-xl border-2 px-5 py-4"
            style={{
              borderColor: isFirstPlace ? "#facc15" : "#7c3aed",
              background: isFirstPlace
                ? "linear-gradient(135deg, rgba(250,204,21,0.08), rgba(251,191,36,0.04))"
                : "linear-gradient(135deg, rgba(124,58,237,0.08), rgba(124,58,237,0.04))",
            }}
          >
            {/* Sparkle effect */}
            {isFirstPlace && (
              <div className="absolute inset-0 pointer-events-none overflow-hidden">
                {[...Array(6)].map((_, i) => (
                  <motion.div
                    key={i}
                    className="absolute w-1 h-1 rounded-full bg-yellow-400"
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{
                      opacity: [0, 1, 0],
                      scale: [0, 1, 0],
                      x: [0, (i % 2 === 0 ? 1 : -1) * (20 + i * 10)],
                      y: [0, -(10 + i * 8)],
                    }}
                    transition={{ delay: 0.5 + i * 0.1, duration: 0.8 }}
                    style={{ left: `${15 + i * 12}%`, top: "50%" }}
                  />
                ))}
              </div>
            )}

            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                style={{
                  background: isFirstPlace
                    ? "linear-gradient(135deg, #facc15, #f59e0b)"
                    : "linear-gradient(135deg, #7c3aed, #5b21b6)",
                }}
              >
                <Zap className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="font-bold text-foreground flex items-center gap-2">
                  <span>+{xpGained} XP earned</span>
                  {isFirstPlace && (
                    <span className="text-xs bg-yellow-400/20 text-yellow-700 dark:text-yellow-300 px-1.5 py-0.5 rounded font-semibold">
                      🥇 2× First Place Bonus!
                    </span>
                  )}
                </div>
                <div className="text-sm text-muted-foreground">
                  {isFirstPlace
                    ? "You led the room — double XP awarded!"
                    : "Keep writing to climb the ranks."}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="bg-card border rounded-lg shadow-sm overflow-hidden">
        <div className="grid grid-cols-12 gap-4 p-4 bg-muted/50 border-b text-sm font-medium text-muted-foreground">
          <div className="col-span-2 text-center">Rank</div>
          <div className="col-span-4">Writer</div>
          <div className="col-span-3 text-right">{isKartMode ? "Race Score" : "Words"}</div>
          <div className="col-span-3 text-right">Speed</div>
        </div>

        <div className="divide-y">
          {sorted.map((p, i) => {
            const isMe = p.id === currentParticipantId;
            const raceScore = isKartMode ? p.wordCount + (p.kartCarOffset ?? 0) : p.wordCount;
            const hasOffset = isKartMode && (p.kartCarOffset ?? 0) !== 0;
            return (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
                className={`grid grid-cols-12 gap-4 p-4 items-center ${isMe ? "bg-primary/5" : ""}`}
              >
                <div className="col-span-2 flex justify-center items-center">{getRankIcon(i)}</div>
                <div className="col-span-4 font-medium text-foreground flex items-center gap-2">
                  <button
                    onClick={() => setLocation(`/profile/${encodeURIComponent(p.name)}`)}
                    className="hover:text-primary hover:underline underline-offset-2 transition-colors text-left"
                  >
                    {p.name}
                  </button>
                  {isMe && <span className="text-xs bg-primary/20 text-primary px-1.5 py-0.5 rounded">You</span>}
                </div>
                <div className="col-span-3 text-right">
                  <span className="font-mono text-lg font-bold">{raceScore}</span>
                  {hasOffset && (
                    <div className="text-xs text-muted-foreground font-mono">
                      ({p.wordCount} real)
                    </div>
                  )}
                </div>
                <div className="col-span-3 text-right text-muted-foreground">
                  <span className="font-mono font-medium text-foreground">{p.wpm}</span> wpm
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Access to my writing */}
      <div className="flex items-center justify-center gap-3 pt-2">
        <WritingArchive
          text={myText}
          capsules={capsules}
          triggerLabel="View My Writing"
          triggerVariant="default"
          triggerSize="lg"
        />
      </div>

      {isCreator ? (
        <div className="flex flex-col items-center gap-4 pt-6 border-t">
          <p className="text-sm font-medium text-foreground">Start another sprint?</p>
          <div className="flex gap-3">
            <Button onClick={() => onRestart(30)} variant="outline" className="gap-2">
              <RotateCcw className="w-4 h-4" /> 30 Min
            </Button>
            <Button onClick={() => onRestart(45)} variant="default" className="gap-2">
              <RotateCcw className="w-4 h-4" /> 45 Min
            </Button>
            <Button onClick={() => onRestart(60)} variant="outline" className="gap-2">
              <RotateCcw className="w-4 h-4" /> 60 Min
            </Button>
          </div>
          <Button variant="ghost" onClick={() => setLocation("/portal")} className="gap-2 text-muted-foreground">
            <Home className="w-4 h-4" /> Go to Home
          </Button>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3 pt-6 border-t">
          <p className="text-sm text-muted-foreground">Waiting for the creator to start a new sprint...</p>
          <Button variant="ghost" onClick={() => setLocation("/portal")} className="gap-2 text-muted-foreground">
            <Home className="w-4 h-4" /> Go to Home
          </Button>
        </div>
      )}
    </motion.div>
  );
}
