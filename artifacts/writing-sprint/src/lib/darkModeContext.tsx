import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

interface DarkModeContextType {
  isDark: boolean;
  toggleDarkMode: () => void;
}

const DarkModeContext = createContext<DarkModeContextType>({
  isDark: false,
  toggleDarkMode: () => {},
});

const LS_KEY = "ws-dark-mode";

export function DarkModeProvider({ children }: { children: ReactNode }) {
  const [isDark, setIsDark] = useState(() => {
    try { return localStorage.getItem(LS_KEY) === "1"; } catch { return false; }
  });

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) root.classList.add("dark");
    else root.classList.remove("dark");
    try { localStorage.setItem(LS_KEY, isDark ? "1" : "0"); } catch { /* no-op */ }
  }, [isDark]);

  return (
    <DarkModeContext.Provider value={{ isDark, toggleDarkMode: () => setIsDark((v) => !v) }}>
      {children}
    </DarkModeContext.Provider>
  );
}

export function useDarkMode() {
  return useContext(DarkModeContext);
}
