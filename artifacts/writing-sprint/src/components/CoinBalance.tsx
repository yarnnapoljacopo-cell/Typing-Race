import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@clerk/react";
import type React from "react";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

interface CoinData {
  balance: number;
}

async function fetchCoins(): Promise<CoinData> {
  const res = await fetch(`${basePath}/api/coins`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch coins");
  return res.json();
}

interface CoinBalanceProps {
  className?: string;
  style?: React.CSSProperties;
}

export function CoinBalance({ className = "", style }: CoinBalanceProps) {
  const { isSignedIn } = useAuth();

  const { data } = useQuery<CoinData>({
    queryKey: ["coinBalance"],
    queryFn: fetchCoins,
    enabled: !!isSignedIn,
    staleTime: 30_000,
    // Keep the last-known balance visible while a background refetch is in
    // flight (e.g. after a Clerk token refresh triggers cache invalidation).
    placeholderData: (prev) => prev,
  });

  if (!isSignedIn || data === undefined) return null;

  return (
    <span
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 7,
        background: "rgba(255,255,255,0.7)",
        border: "1px solid rgba(232,168,56,0.25)",
        borderRadius: 999,
        padding: "5px 13px 5px 8px",
        fontWeight: 600,
        fontSize: "0.88rem",
        color: "#1a1a2e",
        boxShadow: "0 2px 8px rgba(232,168,56,0.10)",
        flexShrink: 0,
        ...style,
      }}
      title="Spirit Coins"
    >
      <span
        style={{
          width: 22,
          height: 22,
          background: "linear-gradient(135deg, #f5c542 0%, #e8933a 100%)",
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 11,
          boxShadow: "0 2px 6px rgba(232,168,56,0.35)",
          flexShrink: 0,
        }}
      >
        ✦
      </span>
      {data.balance.toLocaleString()}
    </span>
  );
}
