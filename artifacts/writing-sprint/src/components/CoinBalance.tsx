import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@clerk/react";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

interface CoinData {
  balance: number;
  daily_coins_earned: number;
  daily_cap: number;
}

async function fetchCoins(): Promise<CoinData> {
  const res = await fetch(`${basePath}/api/coins`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch coins");
  return res.json();
}

interface CoinBalanceProps {
  className?: string;
  showDailyCap?: boolean;
}

export function CoinBalance({ className = "", showDailyCap = false }: CoinBalanceProps) {
  const { isSignedIn } = useAuth();

  const { data } = useQuery<CoinData>({
    queryKey: ["coinBalance"],
    queryFn: fetchCoins,
    enabled: !!isSignedIn,
    staleTime: 30_000,
  });

  if (!isSignedIn || data === undefined) return null;

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 font-semibold text-sm ${className}`}
      title={showDailyCap ? `${data.daily_coins_earned}/${data.daily_cap} earned today` : "Spirit Coins"}
    >
      🪙 {data.balance.toLocaleString()}
      {showDailyCap && (
        <span className="text-xs opacity-70">
          ({data.daily_coins_earned}/{data.daily_cap})
        </span>
      )}
    </span>
  );
}
