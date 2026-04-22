import { createContext, useContext, useState } from "react";
import { getGuestName, setGuestName, clearGuestName } from "@/lib/guest";

interface GuestCtx {
  guestName: string | null;
  updateGuestName: (name: string) => void;
  exitGuest: () => void;
}

export const GuestContext = createContext<GuestCtx>({
  guestName: null,
  updateGuestName: () => {},
  exitGuest: () => {},
});

export function useGuest() {
  return useContext(GuestContext);
}

export function GuestProvider({ children }: { children: React.ReactNode }) {
  const [guestName, setGuestNameState] = useState<string | null>(getGuestName);

  const updateGuestName = (name: string) => {
    setGuestName(name);
    setGuestNameState(name);
  };

  const exitGuest = () => {
    clearGuestName();
    setGuestNameState(null);
  };

  return (
    <GuestContext.Provider value={{ guestName, updateGuestName, exitGuest }}>
      {children}
    </GuestContext.Provider>
  );
}
