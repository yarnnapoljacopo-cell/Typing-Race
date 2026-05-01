import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/react";
import type React from "react";
import { useAuthedFetch } from "@/lib/authedFetch";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

interface CoinData {
  balance: number;
}

const COIN_ICON_STYLE: React.CSSProperties = {
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
};

interface CoinBalanceProps {
  className?: string;
  style?: React.CSSProperties;
}

export function CoinBalance({ className = "", style }: CoinBalanceProps) {
  const { isSignedIn, isLoaded } = useAuth();
  const authedFetch = useAuthedFetch();
  const queryClient = useQueryClient();

  const { data, isLoading, isError, isFetching } = useQuery<CoinData>({
    queryKey: ["coinBalance"],
    queryFn: async () => {
      const res = await authedFetch(`${basePath}/api/coins`);
      if (!res.ok) throw new Error("Failed to fetch coins");
      return res.json();
    },
    enabled: isLoaded && !!isSignedIn,
    staleTime: 30_000,
    retry: 2,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
    placeholderData: (prev) => prev,
  });

  if (!isSignedIn) return null;

  if (isError && data === undefined) {
    return (
      <button
        onClick={() => queryClient.invalidateQueries({ queryKey: ["coinBalance"] })}
        title="Session issue — click to retry, or sign out and back in"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          background: "rgba(255,255,255,0.7)",
          border: "1px solid rgba(220,38,38,0.25)",
          borderRadius: 999,
          padding: "5px 12px 5px 8px",
          fontWeight: 600,
          fontSize: "0.82rem",
          color: "#dc2626",
          cursor: "pointer",
          boxShadow: "0 2px 8px rgba(220,38,38,0.08)",
          flexShrink: 0,
          ...style,
        }}
      >
        <span style={{ ...COIN_ICON_STYLE, background: "linear-gradient(135deg, #fca5a5 0%, #dc2626 100%)" }}>✦</span>
        Session error · Retry
      </button>
    );
  }

  const containerStyle: React.CSSProperties = {
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
    opacity: isLoading || isFetching ? 0.6 : 1,
    ...style,
  };

  return (
    <span
      className={className}
      style={containerStyle}
      title="Spirit Coins"
    >
      <span style={COIN_ICON_STYLE}>✦</span>
      {data !== undefined ? data.balance.toLocaleString() : "…"}
    </span>
  );
}
