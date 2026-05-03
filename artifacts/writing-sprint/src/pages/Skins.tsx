import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthedFetch } from "@/lib/authedFetch";
import { ArrowLeft, Loader2, Lock, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  CarSkinPreview,
  RoadSkinPreview,
  RARITY_COLOR,
  type SkinRarity,
} from "@/lib/skinCatalog";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

interface SkinDef {
  key: string;
  name: string;
  rarity: SkinRarity;
  unlocked: boolean;
}

interface SkinsData {
  cars: SkinDef[];
  roads: SkinDef[];
  equippedCarSkin: string;
  equippedRoadSkin: string;
}

type AF = (url: string, opts?: RequestInit) => Promise<Response>;

async function fetchSkins(af: AF): Promise<SkinsData> {
  const res = await af(`${basePath}/api/skins`);
  if (!res.ok) throw new Error("Failed to load skins");
  return res.json();
}

async function equipSkin(af: AF, type: "car" | "road", key: string): Promise<void> {
  const res = await af(`${basePath}/api/skins/equip`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type, key }),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? "Failed to equip");
  }
}

function SkinCard({
  skin,
  isEquipped,
  onEquip,
  preview,
  isPending,
}: {
  skin: SkinDef;
  isEquipped: boolean;
  onEquip: () => void;
  preview: React.ReactNode;
  isPending: boolean;
}) {
  const rarityColor = RARITY_COLOR[skin.rarity];
  const locked = !skin.unlocked;
  return (
    <div
      className="rounded-xl border-2 overflow-hidden flex flex-col"
      style={{
        borderColor: isEquipped ? rarityColor : "transparent",
        background: "rgba(255,255,255,0.03)",
        opacity: locked ? 0.55 : 1,
      }}
    >
      <div style={{ position: "relative" }}>
        {preview}
        {locked && (
          <div
            style={{
              position: "absolute", inset: 0,
              background: "rgba(0,0,0,0.55)",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "white", gap: 6, fontSize: "0.75rem", fontWeight: 700,
              letterSpacing: "0.08em", textTransform: "uppercase",
            }}
          >
            <Lock size={14} />
            Coming Soon
          </div>
        )}
      </div>
      <div className="px-3 py-2 flex items-center justify-between gap-2">
        <div className="flex flex-col min-w-0">
          <span className="text-sm font-bold truncate">{skin.name}</span>
          <span
            className="text-[10px] font-bold uppercase tracking-wider"
            style={{ color: rarityColor }}
          >
            {skin.rarity}
          </span>
        </div>
        {locked ? (
          <Button size="sm" variant="ghost" disabled>
            <Lock size={14} />
          </Button>
        ) : isEquipped ? (
          <Button size="sm" variant="default" disabled>
            <Check size={14} className="mr-1" /> Equipped
          </Button>
        ) : (
          <Button size="sm" variant="outline" onClick={onEquip} disabled={isPending}>
            Equip
          </Button>
        )}
      </div>
    </div>
  );
}

export default function Skins() {
  const [, setLocation] = useLocation();
  const authedFetch = useAuthedFetch();
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data, isLoading, error } = useQuery<SkinsData>({
    queryKey: ["skins"],
    queryFn: () => fetchSkins(authedFetch),
  });

  const equipMutation = useMutation({
    mutationFn: ({ type, key }: { type: "car" | "road"; key: string }) =>
      equipSkin(authedFetch, type, key),
    onSuccess: (_data, vars) => {
      qc.setQueryData<SkinsData | undefined>(["skins"], (old) =>
        old
          ? {
              ...old,
              equippedCarSkin: vars.type === "car" ? vars.key : old.equippedCarSkin,
              equippedRoadSkin: vars.type === "road" ? vars.key : old.equippedRoadSkin,
            }
          : old,
      );
      toast({ title: "Skin equipped", description: "It will appear in your next sprint." });
    },
    onError: (err: Error) => {
      toast({ title: "Could not equip", description: err.message, variant: "destructive" });
    },
  });

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/portal")} className="shrink-0">
            <ArrowLeft size={18} />
          </Button>
          <div className="flex items-center gap-2 flex-1">
            <h1 className="font-bold text-lg">Skins</h1>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-8">
        {isLoading && (
          <div className="flex justify-center py-12">
            <Loader2 size={28} className="animate-spin text-muted-foreground" />
          </div>
        )}
        {error && (
          <p className="text-center text-destructive py-8">Failed to load skins.</p>
        )}

        {data && (
          <>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Equipped skins are loaded from the host of every sprint room you create.
              They appear in spectator, regular, kart, and goal modes — but never in boss
              or gladiator matches.
            </p>

            <section>
              <h2 className="font-bold text-base mb-3">Cars</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {data.cars.map((car) => (
                  <SkinCard
                    key={car.key}
                    skin={car}
                    isEquipped={data.equippedCarSkin === car.key}
                    isPending={equipMutation.isPending}
                    onEquip={() => equipMutation.mutate({ type: "car", key: car.key })}
                    preview={<CarSkinPreview skinKey={car.key} />}
                  />
                ))}
              </div>
            </section>

            <section>
              <h2 className="font-bold text-base mb-3">Roads</h2>
              <p className="text-[11px] text-muted-foreground mb-3">
                The road skin is always set by the room host, regardless of which road
                each guest has equipped.
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {data.roads.map((road) => (
                  <SkinCard
                    key={road.key}
                    skin={road}
                    isEquipped={data.equippedRoadSkin === road.key}
                    isPending={equipMutation.isPending}
                    onEquip={() => equipMutation.mutate({ type: "road", key: road.key })}
                    preview={<RoadSkinPreview skinKey={road.key} />}
                  />
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
