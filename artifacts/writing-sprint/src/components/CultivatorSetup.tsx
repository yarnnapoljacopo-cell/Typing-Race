import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth, useUser } from "@/lib/auth";
import { isDemoSession } from "@/lib/demoSession";
import { readCultivatorAppearance, saveCultivatorAppearance, type CultivatorAppearance } from "@/lib/cultivatorAppearance";
import "./cultivator-setup.css";

/** One-time appearance choice after sign-in; the profile can change it later. */
export function CultivatorSetup() {
  const { isSignedIn, userId } = useAuth();
  const { user } = useUser();
  const [path] = useLocation();
  const accountValue = user?.unsafeMetadata?.cultivatorAppearance;
  const [choice, setChoice] = useState<CultivatorAppearance | null>(null);
  const [complete, setComplete] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setComplete(Boolean(userId && readCultivatorAppearance(userId, accountValue)));
    setChoice(null);
    setError("");
  }, [userId, accountValue]);

  if (!isSignedIn || !userId || complete || readCultivatorAppearance(userId, accountValue) || path.startsWith("/sign-") || path.startsWith("/sim/")) return null;

  async function finish() {
    if (!choice || !userId || saving) return;
    setSaving(true);
    setError("");
    if (!isDemoSession() && user?.update) {
      try {
        await user.update({ unsafeMetadata: { ...user.unsafeMetadata, cultivatorAppearance: choice } });
      } catch {
        // Keep the choice locally if the account metadata endpoint is unavailable.
      }
    }
    if (!saveCultivatorAppearance(userId, choice)) {
      setError("Your browser could not save this choice. Please allow local storage and try again.");
      setSaving(false);
      return;
    }
    setComplete(true);
    setSaving(false);
  }

  return <div className="cultivator-setup__overlay">
    <section className="cultivator-setup" role="dialog" aria-modal="true" aria-labelledby="cultivator-setup-title" aria-describedby="cultivator-setup-description">
      <p className="cultivator-setup__eyebrow">BEGIN YOUR WRITER’S PATH</p>
      <h2 id="cultivator-setup-title">Choose your cultivator</h2>
      <p id="cultivator-setup-description">Select the character who will represent you as you write. You can change this later in your profile.</p>
      <div className="cultivator-setup__choices" role="group" aria-label="Cultivator appearance">
        {(["male", "female"] as const).map(value => <button
          key={value}
          type="button"
          className={choice === value ? "cultivator-setup__choice is-selected" : "cultivator-setup__choice"}
          aria-pressed={choice === value}
          onClick={() => setChoice(value)}
        >
          <img src={`${import.meta.env.BASE_URL}cultivation/cultivator-${value}.png`} alt="" />
          <span>{value === "male" ? "Male" : "Female"}</span>
        </button>)}
      </div>
      {error && <p className="cultivator-setup__error" role="alert">{error}</p>}
      <button className="cultivator-setup__continue" type="button" disabled={!choice || saving} onClick={finish}>
        {saving ? "Saving…" : "Continue"}
      </button>
    </section>
  </div>;
}
