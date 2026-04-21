import { useState } from "react";
import { Participant, ParticipantText } from "@/hooks/useSprintRoom";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Eye, FileText, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

const LANE_COLORS = [
  "#3b82f6", // blue
  "#ef4444", // red
  "#22c55e", // green
  "#f59e0b", // amber
  "#a855f7", // purple
  "#ec4899", // pink
  "#14b8a6", // teal
  "#f97316", // orange
];

interface SpectatorViewProps {
  participants: Participant[];
  participantTexts: Record<string, ParticipantText>;
  currentParticipantId: string | null;
}

function WritingPreview({
  text,
  wordCount,
  fullText,
}: {
  text: string;
  wordCount: number;
  fullText: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (!fullText) return;
    // Strip HTML tags so clipboard contains plain text
    const tmp = document.createElement("div");
    tmp.innerHTML = fullText;
    const plain = tmp.innerText ?? tmp.textContent ?? fullText;
    navigator.clipboard.writeText(plain).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <FileText className="w-3 h-3" />
          <span className="font-mono font-semibold">{wordCount}</span>
          <span>words written</span>
        </div>
        {fullText && (
          <Button
            size="sm"
            variant="outline"
            className="h-7 px-2 text-xs gap-1.5"
            onClick={handleCopy}
          >
            {copied ? (
              <><Check className="w-3 h-3 text-green-500" /> Copied!</>
            ) : (
              <><Copy className="w-3 h-3" /> Copy all</>
            )}
          </Button>
        )}
      </div>
      {text ? (
        <div className="max-h-64 overflow-auto rounded border bg-muted/30 p-3">
          <div
            className="font-serif text-xs break-words leading-relaxed text-foreground"
            dangerouslySetInnerHTML={{ __html: text }}
          />
        </div>
      ) : (
        <p className="text-xs text-muted-foreground italic">Nothing written yet…</p>
      )}
    </div>
  );
}

export function SpectatorView({
  participants,
  participantTexts,
  currentParticipantId,
}: SpectatorViewProps) {
  const sorted = [...participants].sort((a, b) => b.wordCount - a.wordCount);
  const [openId, setOpenId] = useState<string | null>(null);

  if (participants.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground space-y-2">
        <Eye className="w-10 h-10 opacity-30 mx-auto" />
        <p className="text-sm">Waiting for writers to join…</p>
      </div>
    );
  }

  return (
    <div className="space-y-2 w-full">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
        <Eye className="w-3.5 h-3.5" />
        Writers — hover to read
      </p>
      {sorted.map((p, i) => {
        const color = LANE_COLORS[i % LANE_COLORS.length];
        const pText = participantTexts[p.id];
        const fullText = pText?.text ?? "";
        const preview = fullText.length > 600
          ? fullText.slice(0, 600) + "…"
          : fullText;
        const isMe = p.id === currentParticipantId;

        return (
          <HoverCard
            key={p.id}
            open={openId === p.id}
            onOpenChange={(open) => setOpenId(open ? p.id : null)}
          >
            <HoverCardTrigger asChild>
              <button
                className="w-full flex items-center gap-3 bg-card border rounded-lg px-3 py-2.5 text-left hover:bg-muted/40 transition-colors cursor-pointer"
                style={{ borderLeft: `3px solid ${color}` }}
              >
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0"
                  style={{ backgroundColor: color }}
                >
                  {p.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-foreground truncate">{p.name}</span>
                    {isMe && (
                      <span className="text-[10px] bg-primary/15 text-primary px-1.5 py-0.5 rounded font-semibold">
                        You
                      </span>
                    )}
                    {p.isCreator && (
                      <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded">
                        Host
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 mt-0.5">
                    <span className="text-xs font-mono font-semibold text-foreground">
                      {p.wordCount}
                    </span>
                    <span className="text-xs text-muted-foreground">words</span>
                    {p.wpm > 0 && (
                      <>
                        <span className="text-muted-foreground/40 text-xs">·</span>
                        <span className="text-xs font-mono text-muted-foreground">{p.wpm} wpm</span>
                      </>
                    )}
                  </div>
                </div>
                <Eye className="w-4 h-4 text-muted-foreground/50 flex-shrink-0" />
              </button>
            </HoverCardTrigger>
            <HoverCardContent
              side="left"
              align="start"
              className="w-80 shadow-lg"
            >
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div
                    className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
                    style={{ backgroundColor: color }}
                  >
                    {p.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-sm font-semibold">{p.name}</span>
                </div>
                <WritingPreview
                  text={preview}
                  wordCount={p.wordCount}
                  fullText={fullText}
                />
              </div>
            </HoverCardContent>
          </HoverCard>
        );
      })}
    </div>
  );
}
