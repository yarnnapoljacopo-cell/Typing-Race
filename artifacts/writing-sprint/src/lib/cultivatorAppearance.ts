import { demoStorageKey } from "./demoSession";

export type CultivatorAppearance = "male" | "female";

export function isCultivatorAppearance(value: unknown): value is CultivatorAppearance {
  return value === "male" || value === "female";
}

const appearanceKey = (accountId: string) => demoStorageKey(`cultivator.appearance.${accountId}`);

export function readCultivatorAppearance(accountId: string, accountValue?: unknown): CultivatorAppearance | null {
  try {
    const saved = localStorage.getItem(appearanceKey(accountId));
    if (isCultivatorAppearance(saved)) return saved;
  } catch { /* The account value may still be available. */ }
  return isCultivatorAppearance(accountValue) ? accountValue : null;
}

export function saveCultivatorAppearance(accountId: string, value: CultivatorAppearance): boolean {
  try {
    localStorage.setItem(appearanceKey(accountId), value);
    window.dispatchEvent(new CustomEvent("cultivator-appearance-changed", { detail: { accountId, value } }));
    return true;
  } catch { return false; }
}
