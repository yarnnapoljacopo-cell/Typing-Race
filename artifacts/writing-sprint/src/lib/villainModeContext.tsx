import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

interface VillainModeContextType {
  isVillainMode: boolean;
  toggleVillainMode: () => void;
}

const VillainModeContext = createContext<VillainModeContextType>({
  isVillainMode: false,
  toggleVillainMode: () => {},
});

const LS_KEY = "ws-villain-mode";

export function VillainModeProvider({ children }: { children: ReactNode }) {
  const [isVillainMode, setIsVillainMode] = useState(() => {
    try { return localStorage.getItem(LS_KEY) === "1"; } catch { return false; }
  });

  useEffect(() => {
    const root = document.documentElement;
    if (isVillainMode) root.classList.add("villain");
    else root.classList.remove("villain");
    try { localStorage.setItem(LS_KEY, isVillainMode ? "1" : "0"); } catch { /* no-op */ }
  }, [isVillainMode]);

  return (
    <VillainModeContext.Provider value={{ isVillainMode, toggleVillainMode: () => setIsVillainMode((v) => !v) }}>
      {children}
    </VillainModeContext.Provider>
  );
}

export function useVillainMode() {
  return useContext(VillainModeContext);
}
