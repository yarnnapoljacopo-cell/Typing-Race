import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, FileText, ChevronDown, ChevronUp, Download } from "lucide-react";

interface Sprint {
  id: number;
  roomCode: string;
  participantName: string;
  wordCount: number;
  rank: number;
  totalParticipants: number;
  updatedAt: string;
  excerpt: string;
}

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

async function fetchSprints(): Promise<Sprint[]> {
  const res = await fetch(`${basePath}/api/user/sprints`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to load sprints");
  return res.json();
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function formatTime(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function downloadText(text: string, filename: string) {
  const blob = new Blob([text], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

async function fetchFullText(id: number): Promise<string> {
  const res = await fetch(`${basePath}/api/user/sprints/${id}/text`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to load text");
  const data = await res.json();
  return data.text ?? "";
}

function RankBadge({ rank, total }: { rank: number; total: number }) {
  if (total <= 1) return null;

  if (rank === 1) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300 border border-yellow-200 dark:border-yellow-700">
        🥇 1st of {total}
      </span>
    );
  }
  if (rank === 2) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-600">
        🥈 2nd of {total}
      </span>
    );
  }
  if (rank === 3) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300 border border-orange-200 dark:border-orange-700">
        🥉 3rd of {total}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border">
      #{rank} of {total}
    </span>
  );
}

function SprintCard({ sprint }: { sprint: Sprint }) {
  const [expanded, setExpanded] = useState(false);
  const [fullText, setFullText] = useState<string | null>(null);
  const [loadingText, setLoadingText] = useState(false);

  const handleExpand = async () => {
    if (!expanded && fullText === null) {
      setLoadingText(true);
      try {
        const text = await fetchFullText(sprint.id);
        setFullText(text);
      } catch {
        setFullText(sprint.excerpt);
      } finally {
        setLoadingText(false);
      }
    }
    setExpanded((v) => !v);
  };

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    let text = fullText;
    if (text === null) {
      setLoadingText(true);
      try {
        text = await fetchFullText(sprint.id);
        setFullText(text);
      } catch {
        text = sprint.excerpt;
      } finally {
        setLoadingText(false);
      }
    }
    const filename = `sprint-${sprint.roomCode}-${formatDate(sprint.updatedAt).replace(/\s/g, "-")}.txt`;
    downloadText(text ?? "", filename);
  };

  const displayText = expanded ? (fullText ?? sprint.excerpt) : sprint.excerpt;
  const hasMore = sprint.excerpt.length === 200;

  return (
    <Card className="border-border hover:border-primary/30 transition-colors">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-sm font-semibold text-primary">{sprint.roomCode}</span>
              <span className="text-xs text-muted-foreground">·</span>
              <span className="text-xs text-muted-foreground">{formatDate(sprint.updatedAt)}</span>
              <span className="text-xs text-muted-foreground">{formatTime(sprint.updatedAt)}</span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-foreground">
                {sprint.wordCount.toLocaleString()} {sprint.wordCount === 1 ? "word" : "words"}
              </span>
              <RankBadge rank={sprint.rank} total={sprint.totalParticipants} />
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="shrink-0 text-muted-foreground hover:text-foreground"
            onClick={handleDownload}
            disabled={loadingText}
          >
            {loadingText ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
          </Button>
        </div>

        {displayText && (
          <div
            className={`text-sm text-muted-foreground leading-relaxed font-serif ${
              !expanded ? "line-clamp-3" : ""
            }`}
          >
            {displayText}
          </div>
        )}

        {(hasMore || expanded) && (
          <button
            onClick={handleExpand}
            className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors font-medium"
          >
            {expanded ? (
              <><ChevronUp className="w-3 h-3" /> Show less</>
            ) : (
              <><ChevronDown className="w-3 h-3" /> Read more</>
            )}
          </button>
        )}
      </CardContent>
    </Card>
  );
}

export default function PastSprints() {
  const { data: sprints, isLoading, isError, refetch } = useQuery({
    queryKey: ["user-sprints"],
    queryFn: fetchSprints,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="text-center py-12 space-y-3">
        <p className="text-muted-foreground">Couldn't load your sprints.</p>
        <Button variant="outline" size="sm" onClick={() => refetch()}>Try again</Button>
      </div>
    );
  }

  if (!sprints || sprints.length === 0) {
    return (
      <div className="text-center py-16 space-y-3">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 text-primary">
          <FileText size={24} />
        </div>
        <p className="text-lg font-serif font-semibold text-foreground">No sprints yet</p>
        <p className="text-sm text-muted-foreground">Your writing sessions will appear here once you complete them.</p>
      </div>
    );
  }

  const totalWords = sprints.reduce((sum, s) => sum + s.wordCount, 0);
  const wins = sprints.filter((s) => s.rank === 1 && s.totalParticipants > 1).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between px-1">
        <p className="text-sm text-muted-foreground">
          {sprints.length} {sprints.length === 1 ? "sprint" : "sprints"}
          {wins > 0 && (
            <span className="ml-2 text-yellow-600 dark:text-yellow-400 font-medium">
              · 🥇 {wins} {wins === 1 ? "win" : "wins"}
            </span>
          )}
        </p>
        <p className="text-sm font-medium text-foreground">
          {totalWords.toLocaleString()} words total
        </p>
      </div>

      <div className="space-y-3">
        {sprints.map((sprint) => (
          <SprintCard key={sprint.id} sprint={sprint} />
        ))}
      </div>
    </div>
  );
}
