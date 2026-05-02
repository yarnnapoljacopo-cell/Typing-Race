import { useEffect, useState } from "react";
import { useAuth } from "@clerk/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthedFetch } from "@/lib/authedFetch";
import { Button } from "@/components/ui/button";
import { Coins, X } from "lucide-react";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

interface BetSummary {
  totalPot: number;
  bettorCount: number;
  myBet: number | null;
  bettors: Array<{ writerName: string; amount: number }>;
  status: "open" | "closed" | "settled";
  minBet: number;
  maxBet: number;
}

interface CoinData { balance: number }

interface BetModalProps {
  roomCode: string;
  onClose: () => void;
}

export function BetModal({ roomCode, onClose }: BetModalProps) {
  const { isSignedIn, isLoaded } = useAuth();
  const authedFetch = useAuthedFetch();
  const qc = useQueryClient();

  const { data: balanceData } = useQuery<CoinData>({
    queryKey: ["coinBalance"],
    queryFn: async () => {
      const r = await authedFetch(`${basePath}/api/coins`);
      if (!r.ok) throw new Error("failed");
      return r.json();
    },
    enabled: isLoaded && !!isSignedIn,
    staleTime: 10_000,
  });
  const balance = balanceData?.balance ?? 0;

  const { data: betData, refetch: refetchBets } = useQuery<BetSummary>({
    queryKey: ["roomBets", roomCode],
    queryFn: async () => {
      const r = await authedFetch(`${basePath}/api/rooms/${roomCode}/bets`);
      if (!r.ok) throw new Error("failed");
      return r.json();
    },
    enabled: isLoaded && !!isSignedIn,
    refetchInterval: 4000,
  });

  const [amount, setAmount] = useState<string>("10");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Default suggestion: 10% of balance, capped at 100 — but at least 1
    if (balance > 0) {
      setAmount(String(Math.max(1, Math.min(100, Math.floor(balance / 10)))));
    }
  }, [balance]);

  if (!isLoaded || !isSignedIn) {
    // Guests can't bet; auto-dismiss so they can write.
    return (
      <Backdrop>
        <Card>
          <Header onClose={onClose} />
          <p style={{ color: "#475569", fontSize: 14, lineHeight: 1.5 }}>
            Sign in to bet Spirit Coins on this sprint. You can still join and write — the pot
            simply won't include you.
          </p>
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
            <Button onClick={onClose}>Continue without betting</Button>
          </div>
        </Card>
      </Backdrop>
    );
  }

  const myBet = betData?.myBet ?? null;
  const pot = betData?.totalPot ?? 0;
  const bettors = betData?.bettors ?? [];
  const minBet = betData?.minBet ?? 1;
  const maxBet = betData?.maxBet ?? 10000;
  const parsed = Number(amount);
  const isValid = Number.isFinite(parsed) && Number.isInteger(parsed)
    && parsed >= minBet && parsed <= maxBet && parsed <= balance;

  const placeBet = async () => {
    if (!isValid) return;
    setSubmitting(true);
    setError(null);
    try {
      const r = await authedFetch(`${basePath}/api/rooms/${roomCode}/bet`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: parsed }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.error || "Failed to place bet");
      }
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["coinBalance"] }),
        refetchBets(),
      ]);
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Backdrop>
      <Card>
        <Header onClose={onClose} />
        <p style={{ color: "#475569", fontSize: 14, lineHeight: 1.5, marginBottom: 16 }}>
          Bet Spirit Coins on yourself. Whoever finishes the sprint with the most words takes the
          entire pot. Pass if you'd rather just write.
        </p>

        <div style={statRowStyle}>
          <div style={statBoxStyle}>
            <span style={statLabelStyle}>Current pot</span>
            <span style={statValueStyle}><Coins size={14} style={{ color: "#e8933a" }} /> {pot.toLocaleString()}</span>
          </div>
          <div style={statBoxStyle}>
            <span style={statLabelStyle}>Your balance</span>
            <span style={statValueStyle}><Coins size={14} style={{ color: "#e8933a" }} /> {balance.toLocaleString()}</span>
          </div>
        </div>

        {bettors.length > 0 && (
          <div style={{ marginBottom: 14, fontSize: 12, color: "#64748b" }}>
            <strong style={{ color: "#1a1a2e" }}>{bettors.length}</strong> bettor{bettors.length === 1 ? "" : "s"}:&nbsp;
            {bettors.map((b, i) => (
              <span key={b.writerName}>
                {b.writerName} ({b.amount}){i < bettors.length - 1 ? ", " : ""}
              </span>
            ))}
          </div>
        )}

        {myBet != null && myBet > 0 && (
          <div style={{ marginBottom: 14, fontSize: 13, padding: "8px 12px", background: "#fef3c7", borderRadius: 8, color: "#92400e" }}>
            You've already bet <strong>{myBet}</strong> coins. Adding more increases your stake.
          </div>
        )}

        <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#1a1a2e", marginBottom: 6 }}>
          Bet amount
        </label>
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <input
            type="number"
            min={minBet}
            max={Math.min(maxBet, balance)}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            disabled={submitting}
            style={{
              flex: 1, padding: "10px 12px", borderRadius: 8,
              border: "1px solid #cbd5e1", fontSize: 16, fontWeight: 600,
              fontVariantNumeric: "tabular-nums",
            }}
          />
          {[10, 25, 50, 100].filter((v) => v <= balance).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setAmount(String(v))}
              disabled={submitting}
              style={{
                padding: "0 12px", borderRadius: 8, border: "1px solid #cbd5e1",
                background: "white", fontSize: 13, fontWeight: 600, cursor: "pointer",
              }}
            >{v}</button>
          ))}
        </div>
        <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 14 }}>
          Min {minBet} · max {Math.min(maxBet, balance).toLocaleString()}
        </div>

        {error && (
          <div style={{ marginBottom: 12, padding: "8px 12px", background: "#fef2f2", color: "#dc2626", borderRadius: 8, fontSize: 13 }}>
            {error}
          </div>
        )}

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            No thanks
          </Button>
          <Button onClick={placeBet} disabled={!isValid || submitting}>
            {submitting ? "Placing…" : `Bet ${isValid ? parsed : "—"} coins`}
          </Button>
        </div>
      </Card>
    </Backdrop>
  );
}

function Backdrop({ children }: { children: React.ReactNode }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.55)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 16, zIndex: 200,
      }}
    >
      {children}
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        background: "white", borderRadius: 16, padding: 24, maxWidth: 460, width: "100%",
        boxShadow: "0 20px 50px rgba(15,23,42,0.25)",
      }}
    >
      {children}
    </div>
  );
}

function Header({ onClose }: { onClose: () => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
      <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "#1a1a2e", display: "flex", alignItems: "center", gap: 8 }}>
        <Coins size={20} style={{ color: "#e8933a" }} /> Place your bet
      </h2>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", padding: 4 }}
      >
        <X size={20} />
      </button>
    </div>
  );
}

const statRowStyle: React.CSSProperties = { display: "flex", gap: 10, marginBottom: 14 };
const statBoxStyle: React.CSSProperties = {
  flex: 1, background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10,
  padding: "10px 12px", display: "flex", flexDirection: "column", gap: 4,
};
const statLabelStyle: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.5 };
const statValueStyle: React.CSSProperties = { fontSize: 18, fontWeight: 700, color: "#1a1a2e", display: "flex", alignItems: "center", gap: 6, fontVariantNumeric: "tabular-nums" };
