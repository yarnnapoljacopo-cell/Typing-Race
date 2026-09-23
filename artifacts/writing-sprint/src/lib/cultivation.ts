import { useSkin } from "./skinContext";

const PREVIOUS_SKIN_KEY = "cultivation.previousSkin";

/** Cultivation is an optional visual layer. Game rules and account data stay shared. */
export function useCultivation() {
  const { activeSkin, setActiveSkin } = useSkin();
  return {
    enabled: activeSkin === "cultivation",
    toggle: () => {
      if (activeSkin !== "cultivation") {
        localStorage.setItem(PREVIOUS_SKIN_KEY, activeSkin);
        setActiveSkin("cultivation");
        return;
      }
      const previous = localStorage.getItem(PREVIOUS_SKIN_KEY);
      setActiveSkin(previous === "eternal" || previous === "final" ? previous : "default");
    },
  };
}
