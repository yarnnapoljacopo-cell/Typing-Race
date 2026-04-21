import { Participant } from "@/hooks/useSprintRoom";
import { Button } from "@/components/ui/button";
import { Trophy, Medal, Award, RotateCcw } from "lucide-react";
import { motion } from "framer-motion";
import { WritingArchive, type Capsule } from "@/components/WritingArchive";

interface ResultsScreenProps {
  participants: Participant[];
  currentParticipantId: string | null;
  isCreator: boolean;
  onRestart: (duration: number) => void;
  myText: string;
  capsules: Capsule[];
}

export function ResultsScreen({
  participants,
  currentParticipantId,
  isCreator,
  onRestart,
  myText,
  capsules,
}: ResultsScreenProps) {
  const sorted = [...participants].sort((a, b) => b.wordCount - a.wordCount);

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
        <h2 className="text-3xl font-serif font-bold text-foreground">Final Results</h2>
        <p className="text-muted-foreground">The sprint has concluded. Here's how everyone did.</p>
      </div>

      <div className="bg-card border rounded-lg shadow-sm overflow-hidden">
        <div className="grid grid-cols-12 gap-4 p-4 bg-muted/50 border-b text-sm font-medium text-muted-foreground">
          <div className="col-span-2 text-center">Rank</div>
          <div className="col-span-4">Writer</div>
          <div className="col-span-3 text-right">Words</div>
          <div className="col-span-3 text-right">Speed</div>
        </div>

        <div className="divide-y">
          {sorted.map((p, i) => {
            const isMe = p.id === currentParticipantId;
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
                  {p.name}
                  {isMe && <span className="text-xs bg-primary/20 text-primary px-1.5 py-0.5 rounded">You</span>}
                </div>
                <div className="col-span-3 text-right font-mono text-lg font-bold">{p.wordCount}</div>
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
        </div>
      ) : (
        <div className="text-center pt-6 border-t text-muted-foreground">
          Waiting for the creator to start a new sprint...
        </div>
      )}
    </motion.div>
  );
}
