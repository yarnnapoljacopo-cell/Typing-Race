import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, BookOpen, ChevronDown, ChevronUp, Download, Trash2, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface SavedFile {
  id: number;
  roomCode: string;
  participantName: string;
  wordCount: number;
  updatedAt: string;
  excerpt: string;
}

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

async function fetchFiles(): Promise<SavedFile[]> {
  const res = await fetch(`${basePath}/api/user/files`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to load files");
  return res.json();
}

async function fetchFullText(id: number): Promise<string> {
  const res = await fetch(`${basePath}/api/user/sprints/${id}/text`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to load text");
  const data = await res.json();
  return data.text ?? "";
}

async function unsaveFile(id: number): Promise<void> {
  const res = await fetch(`${basePath}/api/user/files/${id}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok) throw new Error("Failed to remove file");
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

function FileCard({ file, onRemove }: { file: SavedFile; onRemove: (id: number) => void }) {
  const [expanded, setExpanded] = useState(false);
  const [fullText, setFullText] = useState<string | null>(null);
  const [loadingText, setLoadingText] = useState(false);

  const handleExpand = async () => {
    if (!expanded && fullText === null) {
      setLoadingText(true);
      try {
        const text = await fetchFullText(file.id);
        setFullText(text);
      } catch {
        setFullText(file.excerpt);
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
        text = await fetchFullText(file.id);
        setFullText(text);
      } catch {
        text = file.excerpt;
      } finally {
        setLoadingText(false);
      }
    }
    const filename = `${file.roomCode}-${formatDate(file.updatedAt).replace(/\s/g, "-")}.txt`;
    downloadText(text ?? "", filename);
  };

  const displayText = expanded ? (fullText ?? file.excerpt) : file.excerpt;
  const hasMore = file.excerpt.length === 200;

  return (
    <Card className="border-border hover:border-primary/30 transition-colors">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-sm font-semibold text-primary">{file.roomCode}</span>
              <span className="text-xs text-muted-foreground">·</span>
              <span className="text-xs text-muted-foreground">{formatDate(file.updatedAt)}</span>
              <span className="text-xs text-muted-foreground">{formatTime(file.updatedAt)}</span>
            </div>
            <div className="text-sm font-medium text-foreground">
              {file.wordCount.toLocaleString()} {file.wordCount === 1 ? "word" : "words"}
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-foreground h-7 w-7 p-0"
              onClick={handleDownload}
              disabled={loadingText}
              title="Download"
            >
              {loadingText ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-destructive h-7 w-7 p-0"
              onClick={() => onRemove(file.id)}
              title="Remove from My Files"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        {displayText && (
          <div className={`text-sm text-muted-foreground leading-relaxed font-serif ${!expanded ? "line-clamp-3" : ""}`}>
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

export default function MyFiles() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: files, isLoading, isError, refetch } = useQuery({
    queryKey: ["user-files"],
    queryFn: fetchFiles,
  });

  const removeMutation = useMutation({
    mutationFn: unsaveFile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-files"] });
      toast({ title: "Removed from My Files" });
    },
    onError: () => {
      toast({ title: "Couldn't remove file", variant: "destructive" });
    },
  });

  return (
    <div className="min-h-screen w-full flex flex-col items-center p-4 pt-8 selection:bg-primary/20">
      <div className="w-full max-w-md space-y-6">

        <div className="flex items-center gap-3">
          <button
            onClick={() => setLocation("/portal")}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="flex items-center gap-2">
            <BookOpen size={22} className="text-primary" />
            <h1 className="text-2xl font-serif font-bold text-foreground">My Files</h1>
          </div>
        </div>

        {isLoading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        )}

        {isError && (
          <div className="text-center py-12 space-y-3">
            <p className="text-muted-foreground">Couldn't load your files.</p>
            <Button variant="outline" size="sm" onClick={() => refetch()}>Try again</Button>
          </div>
        )}

        {files && files.length === 0 && (
          <div className="text-center py-16 space-y-3">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 text-primary">
              <BookOpen size={24} />
            </div>
            <p className="text-lg font-serif font-semibold text-foreground">No saved files yet</p>
            <p className="text-sm text-muted-foreground">
              During a sprint, tap the <BookOpen size={12} className="inline mb-0.5" /> icon below your writing to save it here.
            </p>
          </div>
        )}

        {files && files.length > 0 && (
          <>
            <div className="flex items-center justify-between px-1">
              <p className="text-sm text-muted-foreground">
                {files.length} saved {files.length === 1 ? "file" : "files"}
              </p>
              <p className="text-sm font-medium text-foreground">
                {files.reduce((s, f) => s + f.wordCount, 0).toLocaleString()} words total
              </p>
            </div>
            <div className="space-y-3">
              {files.map((file) => (
                <FileCard
                  key={file.id}
                  file={file}
                  onRemove={(id) => removeMutation.mutate(id)}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
