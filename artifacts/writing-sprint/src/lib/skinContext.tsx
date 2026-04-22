import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

export type SkinKey = "default" | "eternal" | "final";

interface SkinContextValue {
  activeSkin: SkinKey;
  setActiveSkin: (skin: SkinKey) => void;
}

const SkinContext = createContext<SkinContextValue>({ activeSkin: "default", setActiveSkin: () => {} });

export function SkinProvider({ children }: { children: ReactNode }) {
  const [activeSkin, setActiveSkinState] = useState<SkinKey>(() => {
    return (localStorage.getItem("activeSkin") as SkinKey) ?? "default";
  });

  function setActiveSkin(skin: SkinKey) {
    setActiveSkinState(skin);
    localStorage.setItem("activeSkin", skin);
  }

  useEffect(() => {
    document.documentElement.dataset.skin = activeSkin;
  }, [activeSkin]);

  return (
    <SkinContext.Provider value={{ activeSkin, setActiveSkin }}>
      {children}
    </SkinContext.Provider>
  );
}

export function useSkin() {
  return useContext(SkinContext);
}
