import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@clerk/react";
import "./Crafting.css";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

/* ── Rarity helpers ──────────────────────────────────────────────────────── */

const RARITY_BORDER_CLASS: Record<string, string> = {
  common: "cf-border-common",
  uncommon: "cf-border-uncommon",
  rare: "cf-border-rare",
  epic: "cf-border-epic",
  mythic: "cf-border-mythic",
  legendary: "cf-border-legendary",
};

const RARITY_BADGE_CLASS: Record<string, string> = {
  common: "cf-badge-common",
  uncommon: "cf-badge-uncommon",
  rare: "cf-badge-rare",
  epic: "cf-badge-epic",
  mythic: "cf-badge-mythic",
  legendary: "cf-badge-legendary",
};

/* ── Types ──────────────────────────────────────────────────────────────── */

interface InventoryItem {
  id: number;
  item_id: number;
  quantity: number;
  name: string;
  rarity: string;
  category: string;
  icon: string;
  description: string;
}

interface Recipe {
  id: number;
  result_item_id: number;
  result_name: string;
  result_icon: string;
  result_rarity: string;
  result_description?: string;
  ingredient_1_id: number | null;
  ingredient_2_id: number | null;
  ingredient_3_id: number | null;
  ingredient_4_id: number | null;
  ing1_name: string | null;
  ing1_icon: string | null;
  ing1_rarity: string | null;
  ing2_name: string | null;
  ing2_icon: string | null;
  ing2_rarity: string | null;
  ing3_name: string | null;
  ing3_icon: string | null;
  ing3_rarity: string | null;
  ing4_name: string | null;
  ing4_icon: string | null;
  ing4_rarity: string | null;
  required_cauldron: string | null;
  base_success_rate: number;
  recipe_type: string;
  is_known: boolean;
}

type Tab = "fusion" | "alchemy" | "tribulation" | "recipes";

/* ── Shared SVG icons ────────────────────────────────────────────────────── */

const IconBack = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 18 9 12 15 6"/>
  </svg>
);
const IconFlask = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2V9M9 21H5a2 2 0 0 1-2-2V9m0 0h18"/>
  </svg>
);
const IconBag = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/>
    <path d="M16 10a4 4 0 0 1-8 0"/>
  </svg>
);
const IconChest = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
  </svg>
);
const IconSun = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3"/>
    <path d="M12 2v3M12 19v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M2 12h3M19 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12"/>
  </svg>
);
const IconZap = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
  </svg>
);
const IconBook = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
    <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
  </svg>
);
const IconPlus = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
);

/* ── Animated cauldron SVG ───────────────────────────────────────────────── */

function CauldronSVG() {
  return (
    <svg width="100" height="100" viewBox="0 0 100 100" fill="none">
      <defs>
        <radialGradient id="cauldbody" cx="40%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#e8d5a3"/>
          <stop offset="50%" stopColor="#b8925a"/>
          <stop offset="100%" stopColor="#5c3d1e"/>
        </radialGradient>
        <radialGradient id="cauldliquid" cx="50%" cy="30%" r="60%">
          <stop offset="0%" stopColor="#6ee7b7"/>
          <stop offset="50%" stopColor="#0d9373"/>
          <stop offset="100%" stopColor="#064e3b"/>
        </radialGradient>
        <radialGradient id="cauldglow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgba(52,211,153,0.3)"/>
          <stop offset="100%" stopColor="rgba(13,147,115,0)"/>
        </radialGradient>
      </defs>
      <ellipse cx="50" cy="82" rx="28" ry="8" fill="url(#cauldglow)"/>
      <rect x="28" y="76" width="7" height="18" rx="3" fill="#5c3d1e"/>
      <rect x="65" y="76" width="7" height="18" rx="3" fill="#5c3d1e"/>
      <rect x="44" y="80" width="12" height="14" rx="3" fill="#4a3018"/>
      <path d="M18 42 Q16 60 20 74 L80 74 Q84 60 82 42 Z" fill="url(#cauldbody)" stroke="#7a5230" strokeWidth="1.5"/>
      <path d="M18 54 Q50 48 82 54" stroke="#c8960c" strokeWidth="1.5" fill="none" opacity="0.6"/>
      <path d="M19 62 Q50 56 81 62" stroke="#c8960c" strokeWidth="1" fill="none" opacity="0.4"/>
      <ellipse cx="50" cy="42" rx="32" ry="10" fill="#8b6340" stroke="#7a5230" strokeWidth="1.5"/>
      <ellipse cx="50" cy="40" rx="30" ry="8" fill="#a07548"/>
      <ellipse cx="50" cy="40" rx="26" ry="6" fill="url(#cauldliquid)" opacity="0.95"/>
      <ellipse cx="43" cy="39" rx="8" ry="2" fill="rgba(167,243,208,0.5)" transform="rotate(-10 43 39)"/>
      <ellipse cx="56" cy="41" rx="5" ry="1.5" fill="rgba(167,243,208,0.3)" transform="rotate(5 56 41)"/>
      <circle cx="44" cy="38" r="3" fill="rgba(110,231,183,0.6)" stroke="rgba(52,211,153,0.8)" strokeWidth="0.8">
        <animate attributeName="cy" values="38;34;38" dur="2.2s" repeatCount="indefinite"/>
        <animate attributeName="opacity" values="0.6;0;0.6" dur="2.2s" repeatCount="indefinite"/>
      </circle>
      <circle cx="57" cy="39" r="2" fill="rgba(110,231,183,0.5)" stroke="rgba(52,211,153,0.8)" strokeWidth="0.8">
        <animate attributeName="cy" values="39;35;39" dur="1.8s" begin="0.6s" repeatCount="indefinite"/>
        <animate attributeName="opacity" values="0.5;0;0.5" dur="1.8s" begin="0.6s" repeatCount="indefinite"/>
      </circle>
      <circle cx="50" cy="37" r="1.5" fill="rgba(252,211,77,0.6)" stroke="rgba(245,200,66,0.8)" strokeWidth="0.8">
        <animate attributeName="cy" values="37;32;37" dur="2.6s" begin="1s" repeatCount="indefinite"/>
        <animate attributeName="opacity" values="0.6;0;0.6" dur="2.6s" begin="1s" repeatCount="indefinite"/>
      </circle>
      <path d="M16 50 Q8 44 10 36 Q12 28 20 30" stroke="#7a5230" strokeWidth="4" fill="none" strokeLinecap="round"/>
      <path d="M84 50 Q92 44 90 36 Q88 28 80 30" stroke="#7a5230" strokeWidth="4" fill="none" strokeLinecap="round"/>
      <circle cx="10" cy="36" r="4" fill="#8b6340" stroke="#7a5230" strokeWidth="1"/>
      <circle cx="90" cy="36" r="4" fill="#8b6340" stroke="#7a5230" strokeWidth="1"/>
      <text x="50" y="68" textAnchor="middle" fontSize="12" fill="rgba(200,150,12,0.35)" fontFamily="serif">煉</text>
    </svg>
  );
}

/* ── Animated empty state ────────────────────────────────────────────────── */

function EmptyState({ title, desc, showRarityGuide = false }: {
  title: string;
  desc: string;
  showRarityGuide?: boolean;
}) {
  return (
    <div className="cf-empty-state">
      <div className="cf-cauldron-wrap">
        <div className="cf-orbit-ring">
          <div className="cf-orbit-dot cf-orbit-dot-gold" />
          <div className="cf-orbit-dot cf-orbit-dot-jade" />
          <div className="cf-orbit-dot cf-orbit-dot-red" />
        </div>
        <div className="cf-orbit-ring2" />
        <div className="cf-smoke cf-smoke1" />
        <div className="cf-smoke cf-smoke2" />
        <div className="cf-smoke cf-smoke3" />
        <CauldronSVG />
      </div>

      <div className="cf-empty-title">{title}</div>
      <div className="cf-empty-desc" dangerouslySetInnerHTML={{ __html: desc }} />

      {showRarityGuide && (
        <div className="cf-rarity-guide">
          <div className="cf-rarity-pip cf-pip-common"><div className="cf-rarity-dot" />Common</div>
          <span className="cf-arrow-sep">→</span>
          <div className="cf-rarity-pip cf-pip-uncommon"><div className="cf-rarity-dot" />Uncommon</div>
          <span className="cf-arrow-sep">→</span>
          <div className="cf-rarity-pip cf-pip-rare"><div className="cf-rarity-dot" />Rare</div>
          <span className="cf-arrow-sep">→</span>
          <div className="cf-rarity-pip cf-pip-epic"><div className="cf-rarity-dot" />Epic</div>
        </div>
      )}

      <div className="cf-wisdom-strip">
        <div className="cf-wisdom-label">⚗ Cultivation Wisdom</div>
        <div className="cf-wisdom-text">
          <span>"Three becomes one, the weak becomes strong."</span><br />
          Fuse identical items to transcend their rarity — but only the worthy may reach Epic.
        </div>
      </div>
    </div>
  );
}

/* ── Corner rune SVG ─────────────────────────────────────────────────────── */

function RuneSVG({ color }: { color: string }) {
  return (
    <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
      <path d="M10 10 L40 4 L70 10 L76 40 L70 70 L40 76 L10 70 L4 40 Z" stroke={color} strokeWidth="1.5" fill="none"/>
      <path d="M20 20 L40 15 L60 20 L65 40 L60 60 L40 65 L20 60 L15 40 Z" stroke={color} strokeWidth="1" fill="none"/>
      <circle cx="40" cy="40" r="8" stroke={color} strokeWidth="1" fill="none"/>
      <line x1="40" y1="15" x2="40" y2="65" stroke={color} strokeWidth="0.8" opacity="0.5"/>
      <line x1="15" y1="40" x2="65" y2="40" stroke={color} strokeWidth="0.8" opacity="0.5"/>
    </svg>
  );
}

/* ── Rarity badge ────────────────────────────────────────────────────────── */

function RarityBadge({ rarity }: { rarity: string }) {
  return (
    <span className={`cf-rarity-badge ${RARITY_BADGE_CLASS[rarity] ?? "cf-badge-common"}`}>
      {rarity}
    </span>
  );
}

/* ── AlchemyPanel ────────────────────────────────────────────────────────── */

function AlchemyPanel({
  recipes,
  inventory,
  processing,
  selectedRecipe,
  alchemySelected,
  setSelectedRecipe,
  setAlchemySelected,
  onCraft,
  description,
  cooldownNote,
  dangerMode = false,
}: {
  recipes: Recipe[];
  inventory: InventoryItem[];
  processing: boolean;
  selectedRecipe: Recipe | null;
  alchemySelected: InventoryItem[];
  setSelectedRecipe: (r: Recipe | null) => void;
  setAlchemySelected: (items: InventoryItem[]) => void;
  onCraft: () => void;
  description: string;
  cooldownNote: string;
  dangerMode?: boolean;
}) {
  const knownRecipes = recipes.filter(r => r.is_known);
  const ingredients = inventory.filter(i => i.category === "ingredient");

  const ings = selectedRecipe ? [
    { name: selectedRecipe.ing1_name, icon: selectedRecipe.ing1_icon },
    { name: selectedRecipe.ing2_name, icon: selectedRecipe.ing2_icon },
    { name: selectedRecipe.ing3_name, icon: selectedRecipe.ing3_icon },
    { name: selectedRecipe.ing4_name, icon: selectedRecipe.ing4_icon },
  ].filter(i => i.name) : [];

  return (
    <div>
      <div className={`cf-info-banner${dangerMode ? " danger" : ""}`} style={{ marginBottom: 24 }}>
        <div className="cf-info-title">
          {dangerMode ? "Tribulation Crafting" : "Alchemy"}
          <span className={`cf-info-arrow${dangerMode ? " danger" : ""}`}>
            {dangerMode ? "High Risk" : "Recipe-Based"}
          </span>
        </div>
        <div className="cf-info-desc">{description}</div>
        <div className="cf-info-note">{cooldownNote}</div>
      </div>

      <div className="cf-alchemy-grid">
        {/* Recipe list */}
        <div>
          <div className="cf-section-label">Known Recipes</div>
          {knownRecipes.length === 0 ? (
            <div className="cf-no-recipes">No recipes known yet.<br />Use Recipe Scrolls from your bag!</div>
          ) : (
            <div className="cf-recipe-list-inner">
              {knownRecipes.map(recipe => (
                <button
                  key={recipe.id}
                  className={`cf-recipe-btn${selectedRecipe?.id === recipe.id ? " selected" : ""}`}
                  onClick={() => { setSelectedRecipe(recipe); setAlchemySelected([]); }}
                >
                  <span className="cf-recipe-icon">{recipe.result_icon}</span>
                  <div>
                    <div className="cf-recipe-name">{recipe.result_name}</div>
                    <div className="cf-recipe-meta">{recipe.result_rarity} · {recipe.base_success_rate}%</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Crafting area */}
        <div className="cf-craft-area">
          {!selectedRecipe ? (
            <div className="cf-craft-placeholder">Select a recipe to begin</div>
          ) : (
            <>
              <div className={`cf-recipe-detail ${RARITY_BORDER_CLASS[selectedRecipe.result_rarity] ?? "cf-border-common"}`}>
                <div className="cf-recipe-detail-head">
                  <span className="cf-recipe-detail-icon">{selectedRecipe.result_icon}</span>
                  <div>
                    <div className="cf-recipe-detail-name">{selectedRecipe.result_name}</div>
                    <RarityBadge rarity={selectedRecipe.result_rarity} />
                  </div>
                </div>
                <div className="cf-ing-label">Required ingredients</div>
                <div className="cf-ing-chips">
                  {ings.map((ing, i) => (
                    <span key={i} className="cf-ing-chip">{ing.icon} {ing.name}</span>
                  ))}
                </div>
                {selectedRecipe.required_cauldron && (
                  <div className="cf-cauldron-note">
                    <IconFlask />
                    Cauldron required: {selectedRecipe.required_cauldron.replace("cauldron_", "").replace(/^\w/, c => c.toUpperCase())}
                  </div>
                )}
              </div>

              <div>
                <div className="cf-ing-picker-label">Select ingredients from bag</div>
                {ingredients.length === 0 ? (
                  <div style={{ fontSize: "0.78rem", color: "#9ca3af", fontStyle: "italic", padding: "16px 0" }}>
                    No ingredients in bag. Open chests!
                  </div>
                ) : (
                  <div className="cf-ing-picker">
                    {ingredients.map(item => {
                      const isSel = alchemySelected.some(i => i.id === item.id);
                      return (
                        <button
                          key={item.id}
                          className={`cf-ing-pick-btn${isSel ? " selected" : ""}`}
                          onClick={() => setAlchemySelected(
                            isSel
                              ? alchemySelected.filter(i => i.id !== item.id)
                              : [...alchemySelected, item]
                          )}
                        >
                          {item.icon} {item.name}
                          {isSel && <span className="cf-ing-pick-check">✓</span>}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <button
                className={`cf-craft-btn ${dangerMode ? "cf-craft-btn-tribulation" : "cf-craft-btn-alchemy"}`}
                disabled={processing}
                onClick={onCraft}
              >
                {processing
                  ? <><div className="cf-spin" />Crafting…</>
                  : dangerMode
                    ? <><IconZap />Attempt Tribulation</>
                    : <><IconFlask />Attempt Alchemy</>
                }
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Main component ──────────────────────────────────────────────────────── */

export default function Crafting() {
  const [, setLocation] = useLocation();
  const { isSignedIn } = useAuth();

  const [activeTab, setActiveTab] = useState<Tab>("fusion");
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  const [fusionResult, setFusionResult] = useState<{ name: string; icon: string; rarity: string; message: string } | null>(null);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [alchemySelected, setAlchemySelected] = useState<InventoryItem[]>([]);
  const [craftResult, setCraftResult] = useState<{
    success: boolean;
    message: string;
    result?: { name: string; icon: string; rarity: string };
    outcome?: string;
    xpLost?: number;
  } | null>(null);
  const [recipeFilter, setRecipeFilter] = useState<"all" | "known" | "unknown">("all");
  const [fusionGroupItemId, setFusionGroupItemId] = useState<number | null>(null);

  const [toastMsg, setToastMsg] = useState<{ title: string; desc: string } | null>(null);

  const showToast = (title: string, desc: string) => {
    setToastMsg({ title, desc });
    setTimeout(() => setToastMsg(null), 3500);
  };

  const fetchData = useCallback(async () => {
    try {
      const [invRes, recRes] = await Promise.all([
        fetch(`${basePath}/api/user/bag`, { credentials: "include" }),
        fetch(`${basePath}/api/user/crafting/all-recipes`, { credentials: "include" }),
      ]);
      if (invRes.ok) { const d = await invRes.json(); setInventory(d.inventory ?? []); }
      if (recRes.ok) { const d = await recRes.json(); setRecipes(d); }
    } catch {
      showToast("Error", "Failed to load crafting data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isSignedIn) { setLocation("/portal"); return; }
    fetchData();
  }, [isSignedIn]);

  /* Fusion */
  const fusionCandidates = inventory.reduce<Record<number, InventoryItem[]>>((acc, item) => {
    if (!acc[item.item_id]) acc[item.item_id] = [];
    acc[item.item_id].push(item);
    return acc;
  }, {});
  const fusableGroups = Object.values(fusionCandidates).filter(g =>
    g.reduce((s, i) => s + (i.quantity ?? 1), 0) >= 3
  );

  const performFusion = async () => {
    if (fusionGroupItemId === null) return;
    const group = (fusionCandidates[fusionGroupItemId] ?? []).sort((a, b) => a.id - b.id);
    const ids: number[] = [];
    for (const inv of group) {
      const qty = inv.quantity ?? 1;
      for (let i = 0; i < qty && ids.length < 3; i++) ids.push(inv.id);
    }
    if (ids.length < 3) { showToast("Not enough items", "You need 3 of the same item."); return; }
    setProcessing(true);
    try {
      const res = await fetch(`${basePath}/api/user/crafting/fusion`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inventoryIds: ids }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) { showToast("Fusion failed", data.error ?? "Unknown error"); return; }
      setFusionResult({ ...data.result, message: data.message });
      setFusionGroupItemId(null);
      fetchData();
    } catch { showToast("Error", "Fusion request failed"); }
    finally { setProcessing(false); }
  };

  const performCraft = async (recipeType: "alchemy" | "tribulation") => {
    if (!selectedRecipe) return;
    setProcessing(true);
    try {
      const res = await fetch(`${basePath}/api/user/crafting/${recipeType}`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipeId: selectedRecipe.id, inventoryIds: alchemySelected.map(i => i.id) }),
      });
      const data = await res.json();
      if (!res.ok) { showToast("Cannot craft", data.error ?? "Unknown error"); return; }
      setCraftResult(data);
      setAlchemySelected([]);
      fetchData();
    } catch { showToast("Error", "Crafting request failed"); }
    finally { setProcessing(false); }
  };

  const filteredRecipes = recipes
    .filter(r => activeTab === "alchemy" ? r.recipe_type === "alchemy" : activeTab === "tribulation" ? r.recipe_type === "tribulation" : true)
    .filter(r => recipeFilter === "known" ? r.is_known : recipeFilter === "unknown" ? !r.is_known : true);

  const TABS: { key: Tab; label: string; icon: JSX.Element }[] = [
    { key: "fusion",      label: "Fusion",      icon: <IconSun /> },
    { key: "alchemy",     label: "Alchemy",     icon: <IconFlask /> },
    { key: "tribulation", label: "Tribulation", icon: <IconZap /> },
    { key: "recipes",     label: "Recipe Book", icon: <IconBook /> },
  ];

  /* Selected fusion group info */
  const selGroup = fusionGroupItemId !== null ? (fusionCandidates[fusionGroupItemId] ?? []) : [];
  const selItem = selGroup[0] ?? null;

  return (
    <div className="cf-root">
      {/* Background */}
      <div className="cf-bg-grid" />
      <div className="cf-bg-orb cf-orb1" />
      <div className="cf-bg-orb cf-orb2" />
      <div className="cf-bg-orb cf-orb3" />
      <div className="cf-bg-symbol cf-sym1">煉</div>
      <div className="cf-bg-symbol cf-sym2">丹</div>
      <div className="cf-bg-symbol cf-sym3">道</div>
      <div className="cf-corner-rune cf-rune-tl"><RuneSVG color="#c8960c" /></div>
      <div className="cf-corner-rune cf-rune-br"><RuneSVG color="#0d9373" /></div>

      <div className="cf-page">
        {/* Top nav */}
        <nav className="cf-topnav">
          <button className="cf-nav-back" onClick={() => setLocation("/portal")}>
            <IconBack /> Back
          </button>
          <div className="cf-nav-divider" />
          <div className="cf-nav-title">
            <IconFlask /> Crafting Lab
          </div>
          <div className="cf-nav-right">
            <button className="cf-nav-btn" onClick={() => setLocation("/bag")}>
              <IconBag /> Bag
            </button>
            <button className="cf-nav-btn" onClick={() => setLocation("/chests")}>
              <IconChest /> Chests
            </button>
          </div>
        </nav>

        {/* Tabs */}
        <div className="cf-tab-row" style={{ marginTop: 0 }}>
          {TABS.map(tab => (
            <button
              key={tab.key}
              className={`cf-tab${activeTab === tab.key ? " active" : ""}`}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {/* Loading */}
        {loading && (
          <div className="cf-loading">
            <div className="cf-spin cf-spin-ink" /> Loading…
          </div>
        )}

        {/* ── Fusion Tab ─────────────────────────────────────────────────── */}
        {!loading && activeTab === "fusion" && (
          <div>
            <div className="cf-info-banner">
              <div className="cf-info-title">
                Fusion: 3 identical items
                <span className="cf-info-arrow">→ 1 upgraded item</span>
              </div>
              <div className="cf-info-desc">
                Select 3 identical items from your bag to fuse them into a random item of the next rarity tier. Works up to <strong style={{ color: "#6d28d9", fontWeight: 700 }}>Epic</strong> rarity.
              </div>
            </div>

            {/* Selected panel */}
            <div className="cf-selected-panel">
              <div className="cf-selected-label">Selected</div>
              <div className="cf-selected-slots">
                {fusionGroupItemId !== null && selItem ? (
                  <button
                    className="cf-selected-item-tag"
                    onClick={() => setFusionGroupItemId(null)}
                  >
                    {selItem.icon} {selItem.name} ×3
                    <span className="remove">✕</span>
                  </button>
                ) : (
                  <>
                    <div className="cf-slot-box"><IconPlus /></div>
                    <div className="cf-slot-box"><IconPlus /></div>
                    <div className="cf-slot-box"><IconPlus /></div>
                    <span className="cf-selected-hint">Click an item below to select it for fusion…</span>
                  </>
                )}
              </div>
              <button
                className={`cf-fuse-btn${fusionGroupItemId !== null ? " ready" : ""}`}
                onClick={performFusion}
                disabled={processing}
              >
                {processing
                  ? <><div className="cf-spin" />Fusing…</>
                  : <><IconSun />Fuse</>
                }
              </button>
            </div>

            {/* Item grid or empty state */}
            {fusableGroups.length === 0 ? (
              <EmptyState
                title="Your Cauldron Awaits"
                desc="You need at least <strong>3 identical items</strong> to attempt Fusion.<br />Open chests to collect duplicates!"
                showRarityGuide
              />
            ) : (
              <div>
                <div className="cf-section-label">Fusable items — 3+ copies in bag</div>
                <div className="cf-item-grid">
                  {fusableGroups.map(group => {
                    const item = group[0];
                    const totalQty = group.reduce((s, i) => s + (i.quantity ?? 1), 0);
                    const isSelected = fusionGroupItemId === item.item_id;
                    return (
                      <button
                        key={item.item_id}
                        className={`cf-item-card ${RARITY_BORDER_CLASS[item.rarity] ?? "cf-border-common"}${isSelected ? " selected" : ""}`}
                        onClick={() => setFusionGroupItemId(isSelected ? null : item.item_id)}
                      >
                        <span className="cf-item-icon">{item.icon}</span>
                        <div className="cf-item-name">{item.name}</div>
                        <div className="cf-item-rarity">{item.rarity}</div>
                        <span className="cf-item-qty">×{totalQty}</span>
                        {isSelected && <span className="cf-item-check">✓</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Alchemy Tab ─────────────────────────────────────────────────── */}
        {!loading && activeTab === "alchemy" && (
          <AlchemyPanel
            recipes={filteredRecipes}
            inventory={inventory}
            processing={processing}
            selectedRecipe={selectedRecipe}
            alchemySelected={alchemySelected}
            setSelectedRecipe={setSelectedRecipe}
            setAlchemySelected={setAlchemySelected}
            onCraft={() => performCraft("alchemy")}
            description="Mix ingredients and use known recipes to produce pills and artifacts. Base success rate: 60–80%. Equip a Cauldron to improve odds."
            cooldownNote="1-hour cooldown between attempts (30 min with Alchemy Mastery)"
          />
        )}

        {/* ── Tribulation Tab ─────────────────────────────────────────────── */}
        {!loading && activeTab === "tribulation" && (
          <AlchemyPanel
            recipes={filteredRecipes}
            inventory={inventory}
            processing={processing}
            selectedRecipe={selectedRecipe}
            alchemySelected={alchemySelected}
            setSelectedRecipe={setSelectedRecipe}
            setAlchemySelected={setAlchemySelected}
            onCraft={() => performCraft("tribulation")}
            description="Attempt to forge Mythic and Legendary items through Tribulation crafting. High risk: 30% base success. Failure may destroy ingredients or cost XP."
            cooldownNote="24-hour cooldown between attempts"
            dangerMode
          />
        )}

        {/* ── Recipe Book Tab ─────────────────────────────────────────────── */}
        {!loading && activeTab === "recipes" && (
          <div>
            <div className="cf-filter-pills">
              {(["all", "known", "unknown"] as const).map(f => (
                <button
                  key={f}
                  className={`cf-filter-pill${recipeFilter === f ? " active" : ""}`}
                  onClick={() => setRecipeFilter(f)}
                >
                  {f}
                </button>
              ))}
            </div>

            {filteredRecipes.length === 0 ? (
              <EmptyState
                title="No Recipes Found"
                desc="Open Iron Chests or above to discover Recipe Scrolls."
              />
            ) : (
              <div className="cf-recipes-grid">
                {filteredRecipes.map(recipe => (
                  <div
                    key={recipe.id}
                    className={`cf-recipe-card ${RARITY_BORDER_CLASS[recipe.result_rarity] ?? "cf-border-common"}${!recipe.is_known ? " unknown" : ""}`}
                  >
                    <div className="cf-recipe-card-head">
                      <span className="cf-recipe-card-icon">{recipe.result_icon}</span>
                      <div className="cf-recipe-card-body">
                        <div className="cf-recipe-card-title">
                          {recipe.result_name}
                          {recipe.is_known && <span className="cf-known-badge">Known</span>}
                        </div>
                        <div className="cf-recipe-card-meta">
                          {recipe.result_rarity} · {recipe.recipe_type} · {recipe.base_success_rate}% success
                        </div>
                        {recipe.required_cauldron && (
                          <div className="cf-recipe-card-cauldron">
                            Requires: {recipe.required_cauldron.replace("cauldron_", "").replace(/^\w/, c => c.toUpperCase())} Cauldron
                          </div>
                        )}
                        <div className="cf-recipe-card-ings">
                          {[recipe.ing1_name, recipe.ing2_name, recipe.ing3_name, recipe.ing4_name]
                            .filter(Boolean)
                            .map((name, i) => {
                              const icons = [recipe.ing1_icon, recipe.ing2_icon, recipe.ing3_icon, recipe.ing4_icon];
                              return (
                                <span key={i} className="cf-recipe-card-ing">{icons[i]} {name}</span>
                              );
                            })}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Fusion Result Dialog ───────────────────────────────────────────── */}
      {fusionResult && (
        <div className="cf-dialog-overlay" onClick={() => setFusionResult(null)}>
          <div className="cf-dialog" onClick={e => e.stopPropagation()}>
            <div className="cf-dialog-title">Fusion Complete!</div>
            <div className="cf-dialog-desc">{fusionResult.message}</div>
            <div className={`cf-dialog-item ${RARITY_BORDER_CLASS[fusionResult.rarity] ?? "cf-border-common"}`}>
              <span className="cf-dialog-item-icon">{fusionResult.icon}</span>
              <div className="cf-dialog-item-name">{fusionResult.name}</div>
              <RarityBadge rarity={fusionResult.rarity} />
            </div>
            <button className="cf-dialog-btn" onClick={() => setFusionResult(null)}>Excellent!</button>
          </div>
        </div>
      )}

      {/* ── Craft Result Dialog ────────────────────────────────────────────── */}
      {craftResult && (
        <div className="cf-dialog-overlay" onClick={() => { setCraftResult(null); setSelectedRecipe(null); }}>
          <div className="cf-dialog" onClick={e => e.stopPropagation()}>
            <div className="cf-dialog-title">
              {craftResult.success ? "Success!" : craftResult.outcome === "backlash" ? "Backlash!" : "Failed"}
            </div>
            <div className="cf-dialog-desc">{craftResult.message}</div>
            {craftResult.success && craftResult.result && (
              <div className={`cf-dialog-item ${RARITY_BORDER_CLASS[craftResult.result.rarity] ?? "cf-border-common"}`}>
                <span className="cf-dialog-item-icon">{craftResult.result.icon}</span>
                <div className="cf-dialog-item-name">{craftResult.result.name}</div>
                <RarityBadge rarity={craftResult.result.rarity} />
              </div>
            )}
            {!craftResult.success && (
              <div className="cf-dialog-fail">
                {craftResult.outcome === "destroyed" && "All ingredients lost to the void."}
                {craftResult.outcome === "consolation" && "Ingredients lost, but the heavens took pity on you."}
                {craftResult.outcome === "backlash" && `Struck by tribulation energy.${craftResult.xpLost ? ` −${craftResult.xpLost} XP.` : ""} Ingredients preserved — try again.`}
              </div>
            )}
            <button className="cf-dialog-btn" onClick={() => { setCraftResult(null); setSelectedRecipe(null); }}>OK</button>
          </div>
        </div>
      )}

      {/* ── Toast ─────────────────────────────────────────────────────────── */}
      {toastMsg && (
        <div style={{
          position: "fixed", bottom: 24, right: 24, zIndex: 300,
          background: "white", borderRadius: 12, padding: "12px 18px",
          boxShadow: "0 8px 30px rgba(26,26,46,0.15)",
          border: "1px solid rgba(107,143,212,0.15)",
          fontFamily: "DM Sans, sans-serif", maxWidth: 300,
        }}>
          <div style={{ fontSize: "0.84rem", fontWeight: 700, color: "#1a1a2e", marginBottom: 2 }}>{toastMsg.title}</div>
          <div style={{ fontSize: "0.76rem", color: "#7a7a92" }}>{toastMsg.desc}</div>
        </div>
      )}
    </div>
  );
}
