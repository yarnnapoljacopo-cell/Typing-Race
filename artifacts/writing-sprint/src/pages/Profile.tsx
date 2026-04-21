import { useRoute, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Pen, BookOpen, TrendingUp, Hash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface PublicProfile {
  name: string;
  writerName: string;
  totalWords: number;
  highestWordCount: number;
  sprintCount: number;
}

async function fetchProfile(name: string): Promise<PublicProfile> {
  const res = await fetch(`/api/users/by-name/${encodeURIComponent(name)}/profile`);
  if (!res.ok) throw new Error("Failed to load profile");
  return res.json();
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
  return (
    <Card className="flex-1">
      <CardContent className="pt-6 pb-5 px-5 flex flex-col items-center text-center gap-2">
        <div className="text-primary/70">{icon}</div>
        <div className="font-mono text-3xl font-bold text-foreground">{typeof value === "number" ? value.toLocaleString() : value}</div>
        <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{label}</div>
      </CardContent>
    </Card>
  );
}

export default function Profile() {
  const [, params] = useRoute("/profile/:name");
  const [, setLocation] = useLocation();
  const name = decodeURIComponent(params?.name ?? "");

  const { data, isLoading, isError } = useQuery({
    queryKey: ["profile", name],
    queryFn: () => fetchProfile(name),
    enabled: !!name,
  });

  if (!name) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">No name provided.</div>;
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center py-12 px-4">
      <div className="w-full max-w-lg space-y-8">

        <Button variant="ghost" size="sm" onClick={() => history.back()} className="gap-2 text-muted-foreground -ml-2">
          <ArrowLeft className="w-4 h-4" /> Back
        </Button>

        {isLoading && (
          <div className="text-center text-muted-foreground py-16">Loading profile…</div>
        )}

        {isError && (
          <div className="text-center text-destructive py-16">Couldn't load this profile.</div>
        )}

        {data && (
          <>
            <div className="text-center space-y-3">
              <div className="w-20 h-20 rounded-full bg-primary/10 border-4 border-primary/20 flex items-center justify-center mx-auto">
                <span className="text-3xl font-bold text-primary">{data.writerName.charAt(0).toUpperCase()}</span>
              </div>
              <div>
                <h1 className="text-3xl font-serif font-bold text-foreground">{data.writerName}</h1>
                {data.sprintCount === 0 && (
                  <p className="text-muted-foreground text-sm mt-1">No sprints recorded yet.</p>
                )}
              </div>
            </div>

            <div className="flex gap-4">
              <StatCard
                icon={<Pen className="w-5 h-5" />}
                label="All-time words"
                value={data.totalWords}
              />
              <StatCard
                icon={<TrendingUp className="w-5 h-5" />}
                label="Best sprint"
                value={data.highestWordCount}
              />
              <StatCard
                icon={<Hash className="w-5 h-5" />}
                label="Sprints"
                value={data.sprintCount}
              />
            </div>

            {data.sprintCount > 0 && (
              <p className="text-center text-sm text-muted-foreground">
                Averaging <span className="font-semibold text-foreground">
                  {Math.round(data.totalWords / data.sprintCount).toLocaleString()}
                </span> words per sprint
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
