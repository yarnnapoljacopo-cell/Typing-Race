import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Archive, Copy, Check, Clock, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export interface Capsule {
  wordCount: number;
  savedAt: number;   // ms epoch
  text: string;
}

interface WritingArchiveProps {
  text: string;
  capsules: Capsule[];
  triggerLabel?: string;
  triggerVariant?: "default" | "outline" | "secondary" | "ghost";
  triggerSize?: "default" | "sm" | "lg";
  triggerClassName?: string;
}

function formatTime(ms: number): string {
  const d = new Date(ms);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast({ title: "Copied to clipboard", description: `${text.length.toLocaleString()} characters` });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: "Copy failed", description: "Please copy manually.", variant: "destructive" });
    }
  };

  return (
    <Button onClick={handleCopy} variant="outline" size="sm" className="gap-1.5">
      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
      {copied ? "Copied" : label}
    </Button>
  );
}

export function WritingArchive({
  text,
  capsules,
  triggerLabel = "My Writing",
  triggerVariant = "outline",
  triggerSize = "default",
  triggerClassName = "",
}: WritingArchiveProps) {
  const [activeTab, setActiveTab] = useState<"current" | "capsules">("current");

  const sortedCapsules = [...capsules].sort((a, b) => b.wordCount - a.wordCount);
  const wordCount = text.match(/\b\w+\b/g)?.length ?? 0;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant={triggerVariant} size={triggerSize} className={`gap-2 ${triggerClassName}`}>
          <Archive className="w-4 h-4" />
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="font-serif">Your Writing</DialogTitle>
          <DialogDescription>
            View, copy, or save your work. Time Capsule saves a snapshot every 200 words automatically.
          </DialogDescription>
        </DialogHeader>

        {/* Tabs */}
        <div className="flex items-center gap-1 border-b">
          <button
            onClick={() => setActiveTab("current")}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === "current"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            Full Text
            <span className="ml-1 text-xs font-mono opacity-70">{wordCount}w</span>
          </button>
          <button
            onClick={() => setActiveTab("capsules")}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === "capsules"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            Time Capsules
            <span className="ml-1 text-xs font-mono opacity-70">{capsules.length}</span>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
          {activeTab === "current" ? (
            <div className="flex-1 flex flex-col min-h-0 gap-3 pt-3">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  {text ? `${wordCount.toLocaleString()} words · ${text.length.toLocaleString()} characters` : "Nothing written yet."}
                </p>
                {text && <CopyButton text={text} label="Copy All" />}
              </div>
              <div className="flex-1 min-h-0 overflow-auto bg-muted/30 border rounded-md p-4">
                {text ? (
                  <pre className="font-serif text-sm whitespace-pre-wrap break-words text-foreground leading-relaxed">
                    {text}
                  </pre>
                ) : (
                  <p className="text-muted-foreground text-sm italic text-center py-8">
                    Once you start writing, your full text will appear here.
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col min-h-0 gap-3 pt-3">
              {sortedCapsules.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center text-muted-foreground py-12">
                  <Clock className="w-10 h-10 opacity-30 mb-3" />
                  <p className="text-sm">No capsules saved yet.</p>
                  <p className="text-xs mt-1">Reach 200 words to save your first time capsule.</p>
                </div>
              ) : (
                <div className="flex-1 min-h-0 overflow-auto space-y-3 pr-1">
                  {sortedCapsules.map((c) => (
                    <div key={c.wordCount} className="bg-muted/30 border rounded-md overflow-hidden">
                      <div className="flex items-center justify-between bg-muted/50 px-3 py-2 border-b">
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-mono font-bold text-foreground">
                            {c.wordCount.toLocaleString()} words
                          </span>
                          <span className="text-xs text-muted-foreground">
                            saved at {formatTime(c.savedAt)}
                          </span>
                        </div>
                        <CopyButton text={c.text} />
                      </div>
                      <div className="p-3 max-h-40 overflow-auto">
                        <pre className="font-serif text-xs whitespace-pre-wrap break-words text-foreground leading-relaxed">
                          {c.text.length > 500 ? c.text.slice(0, 500) + "…" : c.text}
                        </pre>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
