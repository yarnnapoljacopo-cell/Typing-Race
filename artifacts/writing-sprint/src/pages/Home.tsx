import { useState } from "react";
import { useLocation } from "wouter";
import { useCreateRoom } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PenTool, ArrowRight, Loader2, Feather, Eye, Lock, Timer } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type RoomMode = "regular" | "open";

export default function Home() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [duration, setDuration] = useState<number>(30);
  const [roomMode, setRoomMode] = useState<RoomMode>("regular");
  const [countdownDelay, setCountdownDelay] = useState<number>(0);

  const createRoomMutation = useCreateRoom({
    mutation: {
      onSuccess: (data) => {
        setLocation(`/room?code=${data.code}&name=${encodeURIComponent(name)}&isCreator=true`);
      },
      onError: (err) => {
        toast({
          title: "Failed to create room",
          description: err.message || "An unexpected error occurred",
          variant: "destructive",
        });
      },
    },
  });

  const handleCreate = () => {
    if (!name.trim()) {
      toast({ title: "Name required", description: "Please enter your name first.", variant: "destructive" });
      return;
    }
    createRoomMutation.mutate({ data: { creatorName: name, durationMinutes: duration, mode: roomMode, ...(countdownDelay > 0 ? { countdownDelayMinutes: countdownDelay } : {}) } as Parameters<typeof createRoomMutation.mutate>[0]["data"] });
  };

  const handleJoin = () => {
    if (!name.trim()) {
      toast({ title: "Name required", description: "Please enter your name first.", variant: "destructive" });
      return;
    }
    if (!joinCode.trim()) {
      toast({ title: "Room code required", description: "Please enter a valid room code.", variant: "destructive" });
      return;
    }
    setLocation(`/room?code=${encodeURIComponent(joinCode.trim().toUpperCase())}&name=${encodeURIComponent(name)}`);
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center p-4 selection:bg-primary/20">

      <div className="absolute inset-0 pointer-events-none overflow-hidden flex items-center justify-center opacity-[0.03]">
        <Feather className="w-full h-full max-w-4xl text-primary" strokeWidth={0.5} />
      </div>

      <div className="w-full max-w-md space-y-8 relative z-10">

        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 text-primary mb-4 shadow-inner">
            <PenTool size={32} />
          </div>
          <h1 className="text-4xl md:text-5xl font-serif font-bold text-foreground tracking-tight">Writing Sprint</h1>
          <p className="text-lg text-muted-foreground font-medium">Race against fellow writers. Find your flow.</p>
        </div>

        <Card className="border-border shadow-xl shadow-primary/5">
          <CardHeader className="pb-4">
            <CardTitle>Join the session</CardTitle>
            <CardDescription>Enter your preferred pen name to get started.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">

            <div className="space-y-2">
              <label htmlFor="name" className="text-sm font-medium text-foreground">Your Name</label>
              <Input
                id="name"
                placeholder="e.g. Virginia Woolf"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="text-lg py-6 focus-visible:ring-primary"
                autoComplete="off"
                onKeyDown={(e) => e.key === "Enter" && handleJoin()}
              />
            </div>

            <Tabs defaultValue="join" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-4">
                <TabsTrigger value="join">Join Room</TabsTrigger>
                <TabsTrigger value="create">Create Room</TabsTrigger>
              </TabsList>

              <TabsContent value="join" className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="code" className="text-sm font-medium text-foreground">Room Code</label>
                  <Input
                    id="code"
                    placeholder="SPRINT-XXXX"
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    className="font-mono text-center tracking-widest text-lg py-6 focus-visible:ring-primary"
                    autoComplete="off"
                    onKeyDown={(e) => e.key === "Enter" && handleJoin()}
                  />
                </div>
                <Button
                  onClick={handleJoin}
                  className="w-full py-6 text-lg hover-elevate group"
                  disabled={!name.trim() || !joinCode.trim()}
                >
                  Enter Room
                  <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </Button>
              </TabsContent>

              <TabsContent value="create" className="space-y-4">
                {/* Duration */}
                <div className="space-y-3">
                  <label className="text-sm font-medium text-foreground">Sprint Duration</label>
                  <div className="grid grid-cols-3 gap-3">
                    {[30, 45, 60].map((d) => (
                      <Button
                        key={d}
                        type="button"
                        variant={duration === d ? "default" : "outline"}
                        className="py-6"
                        onClick={() => setDuration(d)}
                      >
                        {d} min
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Pre-sprint countdown */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
                    <Timer className="w-3.5 h-3.5 text-muted-foreground" />
                    Pre-sprint Timer
                    <span className="text-xs text-muted-foreground font-normal ml-1">(auto-starts after)</span>
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {[0, 5, 10, 15].map((d) => (
                      <Button
                        key={d}
                        type="button"
                        variant={countdownDelay === d ? "default" : "outline"}
                        className="py-5 text-sm"
                        onClick={() => setCountdownDelay(d)}
                      >
                        {d === 0 ? "Off" : `${d}m`}
                      </Button>
                    ))}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {[20, 25, 30].map((d) => (
                      <Button
                        key={d}
                        type="button"
                        variant={countdownDelay === d ? "default" : "outline"}
                        className="py-5 text-sm"
                        onClick={() => setCountdownDelay(d)}
                      >
                        {d}m
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Sprint mode */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Sprint Mode</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setRoomMode("regular")}
                      className={`flex flex-col items-center gap-1.5 rounded-lg border-2 px-4 py-3 transition-all ${
                        roomMode === "regular"
                          ? "border-primary bg-primary/5 text-primary"
                          : "border-border text-muted-foreground hover:border-muted-foreground/40"
                      }`}
                    >
                      <Lock className="w-5 h-5" />
                      <span className="text-sm font-semibold">Regular</span>
                      <span className="text-[10px] text-center leading-tight opacity-70">
                        Private writing
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setRoomMode("open")}
                      className={`flex flex-col items-center gap-1.5 rounded-lg border-2 px-4 py-3 transition-all ${
                        roomMode === "open"
                          ? "border-primary bg-primary/5 text-primary"
                          : "border-border text-muted-foreground hover:border-muted-foreground/40"
                      }`}
                    >
                      <Eye className="w-5 h-5" />
                      <span className="text-sm font-semibold">Spectator</span>
                      <span className="text-[10px] text-center leading-tight opacity-70">
                        See each other's writing live
                      </span>
                    </button>
                  </div>
                </div>

                <Button
                  onClick={handleCreate}
                  className="w-full py-6 text-lg hover-elevate group"
                  disabled={!name.trim() || createRoomMutation.isPending}
                >
                  {createRoomMutation.isPending ? (
                    <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Creating…</>
                  ) : (
                    <>
                      Start New Session
                      <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </>
                  )}
                </Button>
              </TabsContent>
            </Tabs>

          </CardContent>
        </Card>
      </div>
    </div>
  );
}
