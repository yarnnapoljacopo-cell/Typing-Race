import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Loader2, FileText, Trash2, Eye, Copy, Download, BookMarked, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Sprint {
  id: number;
  roomCode: string;
  participantName: string;
  wordCount: number;
  rank: number;
  totalParticipants: number;
  updatedAt: string;
  roomMode: string;
  wordGoal: number | null;
}

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

async function fetchSprints(): Promise<Sprint[]> {
  const res = await fetch(`${basePath}/api/user/sprints`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to load sprints");
  return res.json();
}

async function fetchSprintText(id: number): Promise<string> {
  const res = await fetch(`${basePath}/api/user/sprints/${id}/text`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to load text");
  const data = await res.json() as { text: string };
  return data.text ?? "";
}

async function deleteSprint(id: number): Promise<void> {
  const res = await fetch(`${basePath}/api/user/sprints/${id}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok) throw new Error("Failed to delete sprint");
}

async function saveToFiles(sprint: Sprint, text: string): Promise<void> {
  const res = await fetch(`${basePath}/api/user/files`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      roomCode: sprint.roomCode,
      participantName: sprint.participantName,
      text,
      wordCount: sprint.wordCount,
    }),
  });
  if (!res.ok) throw new Error("Failed to save to files");
}

function htmlToPlain(html: string): string {
  if (!html) return "";
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function formatTime(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
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

function ModeBadge({ mode, wordGoal, wordCount }: { mode: string; wordGoal: number | null; wordCount: number }) {
  if (mode === "goal" && wordGoal != null) {
    const met = wordCount >= wordGoal;
    return met ? (
      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300 border border-green-200 dark:border-green-700">
        ✓ Goal: {wordGoal.toLocaleString()} words
      </span>
    ) : (
      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300 border border-red-200 dark:border-red-700">
        ✗ Goal: {wordGoal.toLocaleString()} words
      </span>
    );
  }
  if (mode === "open") {
    return (
      <span className="inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300 border border-violet-200 dark:border-violet-700">
        Open
      </span>
    );
  }
  return null;
}

function SprintViewModal({
  sprint,
  open,
  onClose,
}: {
  sprint: Sprint;
  open: boolean;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [rawText, setRawText] = useState<string | null>(null);
  const [loadingText, setLoadingText] = useState(false);
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedToFiles, setSavedToFiles] = useState(false);

  const plainText = rawText !== null ? htmlToPlain(rawText) : null;

  async function loadText() {
    if (rawText !== null) return;
    setLoadingText(true);
    try {
      const t = await fetchSprintText(sprint.id);
      setRawText(t);
    } catch {
      toast({ title: "Couldn't load text", variant: "destructive" });
    } finally {
      setLoadingText(false);
    }
  }

  function handleOpenChange(isOpen: boolean) {
    if (isOpen) {
      loadText();
    } else {
      onClose();
    }
  }

  async function handleCopy() {
    if (!plainText) return;
    try {
      await navigator.clipboard.writeText(plainText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: "Couldn't copy to clipboard", variant: "destructive" });
    }
  }

  async function handleSaveToFiles() {
    if (!rawText) return;
    setSaving(true);
    try {
      await saveToFiles(sprint, rawText);
      setSavedToFiles(true);
      toast({ title: "Saved to My Files" });
    } catch {
      toast({ title: "Couldn't save to files", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  function handleDownload() {
    if (!plainText) return;
    const filename = `sprint-${sprint.roomCode}-${formatDate(sprint.updatedAt).replace(/[\s,]+/g, "-")}.txt`;
    const blob = new Blob([plainText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  const isEmpty = plainText !== null && plainText.trim() === "";

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl w-full flex flex-col gap-0 p-0 max-h-[90vh]">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border shrink-0">
          <DialogTitle className="flex items-center gap-2 text-base">
            <span className="font-mono text-primary">{sprint.roomCode}</span>
            <span className="text-muted-foreground font-normal text-sm">·</span>
            <span className="text-sm font-normal text-muted-foreground">
              {formatDate(sprint.updatedAt)} at {formatTime(sprint.updatedAt)}
            </span>
          </DialogTitle>
          <DialogDescription className="flex items-center gap-2 mt-1">
            <span className="font-semibold text-foreground">
              {sprint.wordCount.toLocaleString()} {sprint.wordCount === 1 ? "word" : "words"}
            </span>
            <RankBadge rank={sprint.rank} total={sprint.totalParticipants} />
            <ModeBadge mode={sprint.roomMode} wordGoal={sprint.wordGoal} wordCount={sprint.wordCount} />
          </DialogDescription>
        </DialogHeader>

        {/* Text body */}
        <div className="flex-1 overflow-y-auto min-h-0 px-6 py-4">
          {loadingText ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
            </div>
          ) : isEmpty ? (
            <p className="text-sm text-muted-foreground italic text-center py-12">
              No text was saved for this sprint.
            </p>
          ) : plainText !== null ? (
            <pre className="whitespace-pre-wrap text-sm text-foreground font-sans leading-relaxed">
              {plainText}
            </pre>
          ) : null}
        </div>

        {/* Action bar */}
        <div className="px-6 py-4 border-t border-border shrink-0 flex items-center gap-2 flex-wrap">
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={handleCopy}
            disabled={!plainText || isEmpty}
          >
            {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? "Copied!" : "Copy"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={handleSaveToFiles}
            disabled={!rawText || isEmpty || saving || savedToFiles}
          >
            {saving ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : savedToFiles ? (
              <Check className="w-3.5 h-3.5 text-green-500" />
            ) : (
              <BookMarked className="w-3.5 h-3.5" />
            )}
            {savedToFiles ? "Saved!" : "Save to My Files"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={handleDownload}
            disabled={!plainText || isEmpty}
          >
            <Download className="w-3.5 h-3.5" />
            Download
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SprintCard({ sprint, onDelete }: { sprint: Sprint; onDelete: (id: number) => void }) {
  const [confirming, setConfirming] = useState(false);
  const [viewing, setViewing] = useState(false);

  return (
    <>
      <Card className="border-border">
        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-2">
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
                <ModeBadge mode={sprint.roomMode} wordGoal={sprint.wordGoal} wordCount={sprint.wordCount} />
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {confirming ? (
                <>
                  <button
                    onClick={() => onDelete(sprint.id)}
                    className="text-xs font-medium text-destructive hover:text-destructive/80 px-2 py-1 rounded border border-destructive/40 hover:bg-destructive/10 transition-colors"
                  >
                    Delete
                  </button>
                  <button
                    onClick={() => setConfirming(false)}
                    className="text-xs font-medium text-muted-foreground hover:text-foreground px-2 py-1 rounded border border-border hover:bg-muted transition-colors"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground hover:text-foreground h-7 w-7 p-0"
                    onClick={() => setViewing(true)}
                    title="View writing"
                  >
                    <Eye className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground hover:text-destructive h-7 w-7 p-0"
                    onClick={() => setConfirming(true)}
                    title="Delete sprint"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <SprintViewModal
        sprint={sprint}
        open={viewing}
        onClose={() => setViewing(false)}
      />
    </>
  );
}

export default function PastSprints() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: sprints, isLoading, isError, refetch } = useQuery({
    queryKey: ["user-sprints"],
    queryFn: fetchSprints,
  });

  const deleteMutation = useMutation({
    mutationFn: deleteSprint,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-sprints"] });
      toast({ title: "Sprint deleted" });
    },
    onError: () => {
      toast({ title: "Couldn't delete sprint", variant: "destructive" });
    },
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
          <SprintCard key={sprint.id} sprint={sprint} onDelete={(id) => deleteMutation.mutate(id)} />
        ))}
      </div>
    </div>
  );
}
