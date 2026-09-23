import { useEffect, useState } from "react";
import { Check, Feather, Pause, Pencil, Play, Sparkles } from "lucide-react";
import { RANKS, getNextRank, getRankFromXp, xpProgressPercent } from "@/lib/ranks";
import { demoStorageKey } from "@/lib/demoSession";
import "./cultivation-profile.css";

export type CultivatorAppearance = "male" | "female";

/** These are presentation names for the existing ranks, using the same XP. */
export const CULTIVATION_REALMS = [
  "Mortal Initiate", "Qi Gathering", "Foundation Establishment", "Golden Core",
  "Nascent Soul", "Spirit Severing", "Void Ascension", "Immortal Sovereign",
] as const;

const appearanceKey = (accountId: string) => demoStorageKey(`cultivator.appearance.${accountId}`);

function readAppearance(accountId: string): CultivatorAppearance | null {
  try {
    const saved = localStorage.getItem(appearanceKey(accountId));
    return saved === "male" || saved === "female" ? saved : null;
  } catch {
    return null;
  }
}

interface CultivationProfileProps {
  name: string;
  bio: string | null;
  xp: number;
  accountId?: string;
  isOwnProfile: boolean;
  globalPosition?: number;
  onEditBio: () => void;
}

export function CultivationProfile({ name, bio, xp, accountId, isOwnProfile, globalPosition, onEditBio }: CultivationProfileProps) {
  const storageOwner = accountId ?? `public:${name.toLocaleLowerCase()}`;
  const [appearance, setAppearance] = useState<CultivatorAppearance | null>(() => readAppearance(storageOwner));
  const [saveError, setSaveError] = useState(false);
  const [paused, setPaused] = useState(false);
  const [inspectedRealm, setInspectedRealm] = useState<number | null>(null);
  const safeXp = Math.max(0, Number.isFinite(xp) ? xp : 0);
  const rank = getRankFromXp(safeXp);
  const nextRank = getNextRank(rank);
  const progress = xpProgressPercent(safeXp, rank, nextRank);
  const baseUrl = import.meta.env.BASE_URL;

  useEffect(() => {
    setAppearance(readAppearance(storageOwner));
    setInspectedRealm(null);
    setSaveError(false);
  }, [storageOwner]);

  function chooseAppearance(value: CultivatorAppearance) {
    setAppearance(value);
    try {
      localStorage.setItem(appearanceKey(storageOwner), value);
      setSaveError(false);
    } catch {
      setSaveError(true);
    }
  }

  // A preview is an avatar choice, never an inference about the account owner.
  const displayedAppearance = appearance ?? "male";
  const detailRealm = inspectedRealm === null ? null : RANKS[inspectedRealm];

  return (
    <section className="cultivator-profile" aria-label={`${name}'s cultivation profile`}>
      <div className="cultivator-profile__heading">
        <p className="cultivator-profile__eyebrow"><Feather size={14} aria-hidden="true" /> THE WRITER’S PATH</p>
        <h1>{name}</h1>
        <p className="cultivator-profile__motto">{bio || "A quiet mind. A thousand unwritten worlds."}</p>
        {isOwnProfile && <button className="cultivator-profile__edit" onClick={onEditBio} aria-label={bio ? "Edit your bio" : "Add your bio"}><Pencil size={15} /></button>}
      </div>

      <div className={`cultivator-profile__scene${paused ? " cultivator-profile__scene--paused" : ""}`}>
        <div className="cultivator-profile__scene-caption"><Sparkles size={13} aria-hidden="true" /> In quiet cultivation</div>
        <img
          key={displayedAppearance}
          className="cultivator-profile__character"
          src={`${baseUrl}cultivation/cultivator-${displayedAppearance}.png`}
          alt={`${displayedAppearance === "female" ? "Female" : "Male"} cultivator in flowing robes meditating cross-legged`}
          width={1280}
          height={1280}
          decoding="async"
        />
        <button className="cultivator-profile__motion" onClick={() => setPaused(value => !value)} aria-pressed={paused} aria-label={paused ? "Resume meditation animation" : "Pause meditation animation"}>
          {paused ? <Play size={14} aria-hidden="true" /> : <Pause size={14} aria-hidden="true" />}
        </button>
      </div>

      {isOwnProfile && <fieldset className="cultivator-profile__appearance">
        <legend>Cultivator appearance</legend>
        <div className="cultivator-profile__choices">
          {(["male", "female"] as const).map(value => (
            <label key={value} className={appearance === value ? "is-selected" : ""}>
              <input type="radio" name="cultivator-appearance" value={value} checked={appearance === value} onChange={() => chooseAppearance(value)} />
              <span>{value === "male" ? "Male" : "Female"}</span>
              {appearance === value && <Check size={13} aria-hidden="true" />}
            </label>
          ))}
        </div>
        <p role={saveError ? "status" : undefined}>{saveError ? "Selected for this visit. Your browser couldn’t save the appearance." : appearance ? "Appearance saved on this device." : "Choose your appearance. Male preview shown."}</p>
      </fieldset>}

      <div className="cultivator-profile__progress">
        <p className="cultivator-profile__eyebrow">CULTIVATION LEVEL {rank.index + 1}</p>
        <h2>{CULTIVATION_REALMS[rank.index]}</h2>
        <div className="cultivator-profile__xp"><span>{safeXp.toLocaleString()} XP</span><span>{nextRank ? `${nextRank.minXp.toLocaleString()} XP` : "Highest realm"}</span></div>
        <div className="cultivator-profile__progress-track" role="progressbar" aria-label={nextRank ? `Progress toward ${CULTIVATION_REALMS[nextRank.index]}` : "Highest cultivation realm reached"} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
          <div style={{ width: `${progress}%` }} />
        </div>
        <p className="cultivator-profile__next">{nextRank ? <>{(nextRank.minXp - safeXp).toLocaleString()} XP to <strong>{CULTIVATION_REALMS[nextRank.index]}</strong></> : "Your writing continues to shape the global rankings."}</p>
        {globalPosition && <p className="cultivator-profile__standing">No. {globalPosition} on the global rankings</p>}
      </div>

      <div className="cultivator-profile__realms" aria-label="Cultivation realms">
        {RANKS.map(realm => <button key={realm.index} className={`${realm.index <= rank.index ? "is-reached" : ""} ${realm.index === rank.index ? "is-current" : ""}`} onClick={() => setInspectedRealm(inspectedRealm === realm.index ? null : realm.index)} aria-label={`${CULTIVATION_REALMS[realm.index]}, ${realm.minXp.toLocaleString()} XP${realm.index === rank.index ? ", current realm" : ""}`} aria-pressed={inspectedRealm === realm.index} title={CULTIVATION_REALMS[realm.index]}>{String(realm.index + 1).padStart(2, "0")}</button>)}
      </div>
      {detailRealm && <div className="cultivator-profile__realm-detail" role="status"><strong>{CULTIVATION_REALMS[detailRealm.index]}</strong><span>{detailRealm.minXp.toLocaleString()} XP · {detailRealm.index <= rank.index ? "Realm reached" : "Keep writing to ascend"}</span></div>}
      <p className="cultivator-profile__footnote">Every sprint strengthens your practice.</p>
    </section>
  );
}
