import React from "react";

// ─────────────────────────────────────────────────────────────────────────────
//  ItemIcon — custom SVG illustration for every bag item
//  48×48 viewBox, rarity-matched gradients, highlight + stroke outline
// ─────────────────────────────────────────────────────────────────────────────

const ICONS: Record<string, React.ReactElement> = {

  // ════════════════════════════════════════════════════════
  //  COMMON PILLS  (grey/slate)
  // ════════════════════════════════════════════════════════

  "Qi Gathering Pill": (<>
    <defs><linearGradient id="qgp1" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#f1f5f9"/><stop offset="100%" stopColor="#94a3b8"/></linearGradient></defs>
    <ellipse cx="24" cy="24" rx="11" ry="15" fill="url(#qgp1)" stroke="#64748b" strokeWidth="1.5"/>
    <line x1="13" y1="24" x2="35" y2="24" stroke="white" strokeWidth="1.5" opacity={0.6}/>
    <ellipse cx="20" cy="19" rx="2.5" ry="4" fill="rgba(255,255,255,0.45)" transform="rotate(-15 20 19)"/>
    <path d="M24 14 Q27 14 27 17 Q27 20 24 20 Q21 20 21 17" stroke="#64748b" strokeWidth="1.2" fill="none" strokeLinecap="round"/>
    <circle cx="24" cy="20" r="1" fill="#64748b" opacity={0.5}/>
  </>),

  "Impure Pill": (<>
    <defs><linearGradient id="imp1" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#d1d5db"/><stop offset="100%" stopColor="#6b7280"/></linearGradient></defs>
    <ellipse cx="24" cy="24" rx="11" ry="15" fill="url(#imp1)" stroke="#6b7280" strokeWidth="1.5"/>
    <line x1="13" y1="24" x2="35" y2="24" stroke="white" strokeWidth="1.5" opacity={0.5}/>
    <ellipse cx="20" cy="19" rx="2.5" ry="4" fill="rgba(255,255,255,0.3)" transform="rotate(-15 20 19)"/>
    <circle cx="22" cy="15" r="1.5" fill="#6b7280" opacity={0.7}/>
    <circle cx="26" cy="13" r="1.2" fill="#9ca3af" opacity={0.6}/>
    <circle cx="24" cy="18" r="1" fill="#6b7280" opacity={0.5}/>
    <circle cx="21" cy="12" r="0.8" fill="#6b7280" opacity={0.4}/>
  </>),

  "Earth Qi Pill": (<>
    <defs><linearGradient id="eqp1" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#e7e5e4"/><stop offset="100%" stopColor="#78716c"/></linearGradient></defs>
    <ellipse cx="24" cy="24" rx="11" ry="15" fill="url(#eqp1)" stroke="#78716c" strokeWidth="1.5"/>
    <line x1="13" y1="24" x2="35" y2="24" stroke="white" strokeWidth="1.5" opacity={0.6}/>
    <ellipse cx="20" cy="19" rx="2.5" ry="4" fill="rgba(255,255,255,0.4)" transform="rotate(-15 20 19)"/>
    <path d="M20 16 L24 12 L28 16" stroke="#78716c" strokeWidth="1.3" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    <line x1="20" y1="18" x2="28" y2="18" stroke="#78716c" strokeWidth="1" opacity={0.5}/>
    <line x1="21" y1="20" x2="27" y2="20" stroke="#78716c" strokeWidth="0.8" opacity={0.35}/>
  </>),

  "Mortal Cleansing Pill": (<>
    <defs><linearGradient id="mcp1" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#e0f2fe"/><stop offset="100%" stopColor="#7dd3fc"/></linearGradient></defs>
    <ellipse cx="24" cy="24" rx="11" ry="15" fill="url(#mcp1)" stroke="#64748b" strokeWidth="1.5"/>
    <line x1="13" y1="24" x2="35" y2="24" stroke="white" strokeWidth="1.5" opacity={0.6}/>
    <ellipse cx="20" cy="19" rx="2.5" ry="4" fill="rgba(255,255,255,0.45)" transform="rotate(-15 20 19)"/>
    <path d="M24 10 Q26 14 24 18 Q22 14 24 10Z" fill="#64748b" opacity={0.5}/>
    <circle cx="24" cy="18" r="1.5" fill="rgba(255,255,255,0.6)"/>
  </>),

  // ════════════════════════════════════════════════════════
  //  UNCOMMON PILLS  (green)
  // ════════════════════════════════════════════════════════

  "Body Tempering Pill": (<>
    <defs><linearGradient id="btp1" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#bbf7d0"/><stop offset="100%" stopColor="#16a34a"/></linearGradient></defs>
    <ellipse cx="24" cy="24" rx="11" ry="15" fill="url(#btp1)" stroke="#16a34a" strokeWidth="1.5"/>
    <line x1="13" y1="24" x2="35" y2="24" stroke="white" strokeWidth="1.5" opacity={0.6}/>
    <ellipse cx="20" cy="19" rx="2.5" ry="4" fill="rgba(255,255,255,0.4)" transform="rotate(-15 20 19)"/>
    <path d="M19 13 Q24 11 29 13" stroke="white" strokeWidth="1.2" fill="none" strokeLinecap="round" opacity={0.8}/>
    <path d="M18 16 Q24 14 30 16" stroke="white" strokeWidth="1" fill="none" strokeLinecap="round" opacity={0.6}/>
    <path d="M19 19 Q24 17 29 19" stroke="white" strokeWidth="0.8" fill="none" strokeLinecap="round" opacity={0.4}/>
  </>),

  "Meridian Clearing Pill": (<>
    <defs><linearGradient id="mrd1" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#d1fae5"/><stop offset="100%" stopColor="#059669"/></linearGradient></defs>
    <ellipse cx="24" cy="24" rx="11" ry="15" fill="url(#mrd1)" stroke="#059669" strokeWidth="1.5"/>
    <line x1="13" y1="24" x2="35" y2="24" stroke="white" strokeWidth="1.5" opacity={0.6}/>
    <ellipse cx="20" cy="19" rx="2.5" ry="4" fill="rgba(255,255,255,0.4)" transform="rotate(-15 20 19)"/>
    <path d="M17 13 Q20 16 24 14 Q28 12 31 15" stroke="white" strokeWidth="1.3" fill="none" strokeLinecap="round" opacity={0.9}/>
    <path d="M19 17 Q22 20 24 18" stroke="white" strokeWidth="1" fill="none" strokeLinecap="round" opacity={0.6}/>
  </>),

  "Heaven Qi Pill": (<>
    <defs><linearGradient id="hqp1" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#ecfdf5"/><stop offset="100%" stopColor="#22c55e"/></linearGradient></defs>
    <ellipse cx="24" cy="24" rx="11" ry="15" fill="url(#hqp1)" stroke="#22c55e" strokeWidth="1.5"/>
    <line x1="13" y1="24" x2="35" y2="24" stroke="white" strokeWidth="1.5" opacity={0.6}/>
    <ellipse cx="20" cy="19" rx="2.5" ry="4" fill="rgba(255,255,255,0.4)" transform="rotate(-15 20 19)"/>
    <path d="M19 16 Q21 12 24 13 Q27 12 29 16" stroke="white" strokeWidth="1.3" fill="none" strokeLinecap="round" opacity={0.8}/>
    <path d="M20 14 Q22 11 24 12 Q26 11 28 14" stroke="white" strokeWidth="1" fill="none" strokeLinecap="round" opacity={0.5}/>
    <circle cx="24" cy="11" r="1.5" fill="white" opacity={0.7}/>
  </>),

  "Yin Gathering Pill": (<>
    <defs><linearGradient id="yin1" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#86efac"/><stop offset="100%" stopColor="#15803d"/></linearGradient></defs>
    <ellipse cx="24" cy="24" rx="11" ry="15" fill="url(#yin1)" stroke="#16a34a" strokeWidth="1.5"/>
    <line x1="13" y1="24" x2="35" y2="24" stroke="white" strokeWidth="1.5" opacity={0.6}/>
    <ellipse cx="20" cy="19" rx="2.5" ry="4" fill="rgba(255,255,255,0.4)" transform="rotate(-15 20 19)"/>
    <path d="M27 12 A6 6 0 0 0 21 18 A3 3 0 0 0 24 21" stroke="white" strokeWidth="1.3" fill="none" strokeLinecap="round" opacity={0.85}/>
    <circle cx="24" cy="21" r="1.5" fill="white" opacity={0.8}/>
    <circle cx="21" cy="15" r="1" fill="rgba(0,0,0,0.3)"/>
  </>),

  "Yang Gathering Pill": (<>
    <defs><linearGradient id="yng1" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#f0fdf4"/><stop offset="100%" stopColor="#4ade80"/></linearGradient></defs>
    <ellipse cx="24" cy="24" rx="11" ry="15" fill="url(#yng1)" stroke="#22c55e" strokeWidth="1.5"/>
    <line x1="13" y1="24" x2="35" y2="24" stroke="white" strokeWidth="1.5" opacity={0.6}/>
    <ellipse cx="20" cy="19" rx="2.5" ry="4" fill="rgba(255,255,255,0.45)" transform="rotate(-15 20 19)"/>
    <circle cx="24" cy="15" r="4" fill="rgba(255,255,255,0.3)" stroke="white" strokeWidth="1.2"/>
    <line x1="24" y1="9" x2="24" y2="11" stroke="white" strokeWidth="1.2" strokeLinecap="round" opacity={0.7}/>
    <line x1="28" y1="11" x2="27" y2="12" stroke="white" strokeWidth="1.2" strokeLinecap="round" opacity={0.7}/>
    <line x1="30" y1="15" x2="28" y2="15" stroke="white" strokeWidth="1.2" strokeLinecap="round" opacity={0.7}/>
    <line x1="20" y1="11" x2="21" y2="12" stroke="white" strokeWidth="1.2" strokeLinecap="round" opacity={0.7}/>
    <line x1="18" y1="15" x2="20" y2="15" stroke="white" strokeWidth="1.2" strokeLinecap="round" opacity={0.7}/>
    <circle cx="24" cy="15" r="1.5" fill="white" opacity={0.9}/>
  </>),

  "Beast Bloodline Pill": (<>
    <defs><linearGradient id="bst1" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#bbf7d0"/><stop offset="100%" stopColor="#15803d"/></linearGradient></defs>
    <ellipse cx="24" cy="24" rx="11" ry="15" fill="url(#bst1)" stroke="#15803d" strokeWidth="1.5"/>
    <line x1="13" y1="24" x2="35" y2="24" stroke="white" strokeWidth="1.5" opacity={0.6}/>
    <ellipse cx="20" cy="19" rx="2.5" ry="4" fill="rgba(255,255,255,0.4)" transform="rotate(-15 20 19)"/>
    <path d="M20 19 L22 10 M24 20 L24 10 M28 19 L26 10" stroke="white" strokeWidth="1.3" strokeLinecap="round" opacity={0.9}/>
    <path d="M19 21 L21 13 M23 21 L23 13 M27 21 L25 13" stroke="rgba(21,128,61,0.6)" strokeWidth="0.8" strokeLinecap="round"/>
  </>),

  "Luck Enhancing Pill": (<>
    <defs><linearGradient id="lck1" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#dcfce7"/><stop offset="100%" stopColor="#22c55e"/></linearGradient></defs>
    <ellipse cx="24" cy="24" rx="11" ry="15" fill="url(#lck1)" stroke="#22c55e" strokeWidth="1.5"/>
    <line x1="13" y1="24" x2="35" y2="24" stroke="white" strokeWidth="1.5" opacity={0.6}/>
    <ellipse cx="20" cy="19" rx="2.5" ry="4" fill="rgba(255,255,255,0.4)" transform="rotate(-15 20 19)"/>
    <path d="M24 10 L25 13 L28 13 L26 15 L27 18 L24 16 L21 18 L22 15 L20 13 L23 13 Z" fill="white" opacity={0.85} stroke="#16a34a" strokeWidth="0.5"/>
  </>),

  "Qi Condensation Pill": (<>
    <defs><linearGradient id="qcd1" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#bbf7d0"/><stop offset="100%" stopColor="#16a34a"/></linearGradient></defs>
    <ellipse cx="24" cy="24" rx="11" ry="15" fill="url(#qcd1)" stroke="#16a34a" strokeWidth="1.5"/>
    <line x1="13" y1="24" x2="35" y2="24" stroke="white" strokeWidth="1.5" opacity={0.6}/>
    <ellipse cx="20" cy="19" rx="2.5" ry="4" fill="rgba(255,255,255,0.4)" transform="rotate(-15 20 19)"/>
    <ellipse cx="24" cy="15" rx="5" ry="5" fill="none" stroke="white" strokeWidth="1.2" opacity={0.7}/>
    <ellipse cx="24" cy="15" rx="3" ry="3" fill="none" stroke="white" strokeWidth="1" opacity={0.5}/>
    <circle cx="24" cy="15" r="1.2" fill="white" opacity={0.9}/>
  </>),

  // ════════════════════════════════════════════════════════
  //  RARE PILLS  (blue)
  // ════════════════════════════════════════════════════════

  "Foundation Pill": (<>
    <defs><linearGradient id="fnd1" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#93c5fd"/><stop offset="100%" stopColor="#2563eb"/></linearGradient></defs>
    <ellipse cx="24" cy="24" rx="11" ry="15" fill="url(#fnd1)" stroke="#3b82f6" strokeWidth="1.5"/>
    <line x1="13" y1="24" x2="35" y2="24" stroke="white" strokeWidth="1.5" opacity={0.6}/>
    <ellipse cx="20" cy="19" rx="2.5" ry="4" fill="rgba(255,255,255,0.4)" transform="rotate(-15 20 19)"/>
    <path d="M18 19 L24 11 L30 19 Z" fill="rgba(255,255,255,0.4)" stroke="white" strokeWidth="1.2" strokeLinejoin="round"/>
    <line x1="18" y1="19" x2="30" y2="19" stroke="white" strokeWidth="1.2" opacity={0.7}/>
  </>),

  "Heaven Earth Pill": (<>
    <defs><linearGradient id="hep1" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#bfdbfe"/><stop offset="100%" stopColor="#1d4ed8"/></linearGradient></defs>
    <ellipse cx="24" cy="24" rx="11" ry="15" fill="url(#hep1)" stroke="#3b82f6" strokeWidth="1.5"/>
    <line x1="13" y1="24" x2="35" y2="24" stroke="white" strokeWidth="1.5" opacity={0.6}/>
    <ellipse cx="20" cy="19" rx="2.5" ry="4" fill="rgba(255,255,255,0.4)" transform="rotate(-15 20 19)"/>
    <circle cx="21" cy="13" r="1.2" fill="white" opacity={0.7}/>
    <circle cx="24" cy="11" r="1.2" fill="white" opacity={0.7}/>
    <circle cx="27" cy="13" r="1.2" fill="white" opacity={0.7}/>
    <line x1="17" y1="17" x2="31" y2="17" stroke="white" strokeWidth="1.3" opacity={0.8}/>
    <path d="M18 19 Q24 20 30 19" stroke="rgba(255,255,255,0.5)" strokeWidth="0.8" fill="none"/>
  </>),

  "Yin-Yang Harmony Pill": (<>
    <defs><linearGradient id="yyh1" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#bfdbfe"/><stop offset="100%" stopColor="#1e40af"/></linearGradient></defs>
    <ellipse cx="24" cy="24" rx="11" ry="15" fill="url(#yyh1)" stroke="#3b82f6" strokeWidth="1.5"/>
    <line x1="13" y1="24" x2="35" y2="24" stroke="white" strokeWidth="1.5" opacity={0.6}/>
    <ellipse cx="20" cy="19" rx="2.5" ry="4" fill="rgba(255,255,255,0.4)" transform="rotate(-15 20 19)"/>
    <path d="M24 10 A5 5 0 0 1 24 20 A2.5 2.5 0 0 0 24 15 A2.5 2.5 0 0 1 24 10Z" fill="rgba(255,255,255,0.8)"/>
    <path d="M24 10 A5 5 0 0 0 24 20 A2.5 2.5 0 0 1 24 15 A2.5 2.5 0 0 0 24 10Z" fill="rgba(30,64,175,0.7)"/>
    <circle cx="24" cy="12.5" r="1.2" fill="rgba(30,64,175,0.7)"/>
    <circle cx="24" cy="17.5" r="1.2" fill="rgba(255,255,255,0.9)"/>
    <circle cx="24" cy="15" r="5" fill="none" stroke="white" strokeWidth="0.8" opacity={0.5}/>
  </>),

  "Lightning Tribulation Remnant Pill": (<>
    <defs><linearGradient id="ltr1" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#93c5fd"/><stop offset="100%" stopColor="#1e40af"/></linearGradient></defs>
    <ellipse cx="24" cy="24" rx="11" ry="15" fill="url(#ltr1)" stroke="#3b82f6" strokeWidth="1.5"/>
    <line x1="13" y1="24" x2="35" y2="24" stroke="white" strokeWidth="1.5" opacity={0.6}/>
    <ellipse cx="20" cy="19" rx="2.5" ry="4" fill="rgba(255,255,255,0.4)" transform="rotate(-15 20 19)"/>
    <path d="M26 10 L22 16 L25 16 L21 22" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
    <path d="M25.5 10.5 L21.5 16 L24.5 16 L20.5 22" stroke="rgba(147,197,253,0.4)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
  </>),

  "Dragon Bloodline Fragment Pill": (<>
    <defs><linearGradient id="dbf1" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#bfdbfe"/><stop offset="100%" stopColor="#1d4ed8"/></linearGradient></defs>
    <ellipse cx="24" cy="24" rx="11" ry="15" fill="url(#dbf1)" stroke="#3b82f6" strokeWidth="1.5"/>
    <line x1="13" y1="24" x2="35" y2="24" stroke="white" strokeWidth="1.5" opacity={0.6}/>
    <ellipse cx="20" cy="19" rx="2.5" ry="4" fill="rgba(255,255,255,0.4)" transform="rotate(-15 20 19)"/>
    <path d="M20 18 L22 14 L24 18 Z" fill="rgba(255,255,255,0.7)" stroke="white" strokeWidth="0.7"/>
    <path d="M22 18 L24 14 L26 18 Z" fill="rgba(255,255,255,0.6)" stroke="white" strokeWidth="0.7"/>
    <path d="M24 18 L26 14 L28 18 Z" fill="rgba(255,255,255,0.5)" stroke="white" strokeWidth="0.7"/>
    <path d="M21 14 L23 10 L25 14 Z" fill="rgba(255,255,255,0.5)" stroke="white" strokeWidth="0.7"/>
  </>),

  "Time Acceleration Elixir": (<>
    <defs><linearGradient id="tae1" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#93c5fd"/><stop offset="100%" stopColor="#1d4ed8"/></linearGradient></defs>
    <ellipse cx="24" cy="24" rx="11" ry="15" fill="url(#tae1)" stroke="#3b82f6" strokeWidth="1.5"/>
    <line x1="13" y1="24" x2="35" y2="24" stroke="white" strokeWidth="1.5" opacity={0.6}/>
    <ellipse cx="20" cy="19" rx="2.5" ry="4" fill="rgba(255,255,255,0.4)" transform="rotate(-15 20 19)"/>
    <ellipse cx="24" cy="11.5" rx="4.5" ry="3" fill="rgba(255,255,255,0.2)" stroke="white" strokeWidth="1.2"/>
    <ellipse cx="24" cy="18.5" rx="4.5" ry="3" fill="rgba(255,255,255,0.2)" stroke="white" strokeWidth="1.2"/>
    <path d="M21.5 8.5 L26.5 8.5" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
    <path d="M21.5 21.5 L26.5 21.5" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
    <path d="M24 11.5 L22 14.5 L24 15" stroke="white" strokeWidth="0.9" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
  </>),

  "Fortune Reversal Pill": (<>
    <defs><linearGradient id="frt1" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#bfdbfe"/><stop offset="100%" stopColor="#2563eb"/></linearGradient></defs>
    <ellipse cx="24" cy="24" rx="11" ry="15" fill="url(#frt1)" stroke="#3b82f6" strokeWidth="1.5"/>
    <line x1="13" y1="24" x2="35" y2="24" stroke="white" strokeWidth="1.5" opacity={0.6}/>
    <ellipse cx="20" cy="19" rx="2.5" ry="4" fill="rgba(255,255,255,0.4)" transform="rotate(-15 20 19)"/>
    <path d="M27 11 Q20 11 20 15 Q20 18 24 18 Q28 18 28 21 Q28 24 21 24" stroke="white" strokeWidth="1.3" fill="none" strokeLinecap="round"/>
    <path d="M19 22 L21 24 L19 26" stroke="white" strokeWidth="1.3" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
  </>),

  "Fate Altering Pill": (<>
    <defs><linearGradient id="fat1" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#93c5fd"/><stop offset="100%" stopColor="#1e40af"/></linearGradient></defs>
    <ellipse cx="24" cy="24" rx="11" ry="15" fill="url(#fat1)" stroke="#3b82f6" strokeWidth="1.5"/>
    <line x1="13" y1="24" x2="35" y2="24" stroke="white" strokeWidth="1.5" opacity={0.6}/>
    <ellipse cx="20" cy="19" rx="2.5" ry="4" fill="rgba(255,255,255,0.4)" transform="rotate(-15 20 19)"/>
    <path d="M24 10 L25.2 13.5 L29 13.5 L26 15.8 L27.2 19.3 L24 17 L20.8 19.3 L22 15.8 L19 13.5 L22.8 13.5 Z" fill="white" opacity={0.8} stroke="rgba(30,64,175,0.4)" strokeWidth="0.5"/>
  </>),

  // ════════════════════════════════════════════════════════
  //  EPIC PILLS  (purple)
  // ════════════════════════════════════════════════════════

  "Core Pill": (<>
    <defs>
      <linearGradient id="cor1" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#c4b5fd"/><stop offset="100%" stopColor="#5b21b6"/></linearGradient>
      <radialGradient id="cor2" cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor="#fde68a"/><stop offset="100%" stopColor="#d97706" stopOpacity="0"/></radialGradient>
    </defs>
    <ellipse cx="24" cy="24" rx="11" ry="15" fill="url(#cor1)" stroke="#8b5cf6" strokeWidth="1.5"/>
    <line x1="13" y1="24" x2="35" y2="24" stroke="white" strokeWidth="1.5" opacity={0.6}/>
    <ellipse cx="20" cy="19" rx="2.5" ry="4" fill="rgba(255,255,255,0.35)" transform="rotate(-15 20 19)"/>
    <circle cx="24" cy="15" r="5" fill="url(#cor2)" opacity={0.8}/>
    <circle cx="24" cy="15" r="3" fill="rgba(255,255,255,0.3)" stroke="rgba(255,220,100,0.8)" strokeWidth="1"/>
    <circle cx="24" cy="15" r="1.5" fill="white" opacity={0.95}/>
  </>),

  "Triple XP Pill": (<>
    <defs><linearGradient id="txp1" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#ddd6fe"/><stop offset="100%" stopColor="#6d28d9"/></linearGradient></defs>
    <ellipse cx="24" cy="24" rx="11" ry="15" fill="url(#txp1)" stroke="#8b5cf6" strokeWidth="1.5"/>
    <line x1="13" y1="24" x2="35" y2="24" stroke="white" strokeWidth="1.5" opacity={0.6}/>
    <ellipse cx="20" cy="19" rx="2.5" ry="4" fill="rgba(255,255,255,0.35)" transform="rotate(-15 20 19)"/>
    <circle cx="24" cy="11" r="3" fill="rgba(255,255,255,0.35)" stroke="white" strokeWidth="1.2"/>
    <circle cx="24" cy="16" r="3" fill="rgba(255,255,255,0.25)" stroke="white" strokeWidth="1"/>
    <circle cx="24" cy="21" r="3" fill="rgba(255,255,255,0.15)" stroke="white" strokeWidth="0.8"/>
    <circle cx="24" cy="11" r="1.2" fill="white" opacity={0.9}/>
  </>),

  "Taiji Pill": (<>
    <defs><linearGradient id="taj1" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#c4b5fd"/><stop offset="100%" stopColor="#4c1d95"/></linearGradient></defs>
    <ellipse cx="24" cy="24" rx="11" ry="15" fill="url(#taj1)" stroke="#8b5cf6" strokeWidth="1.5"/>
    <line x1="13" y1="24" x2="35" y2="24" stroke="white" strokeWidth="1.5" opacity={0.6}/>
    <ellipse cx="20" cy="19" rx="2.5" ry="4" fill="rgba(255,255,255,0.35)" transform="rotate(-15 20 19)"/>
    <path d="M24 10 A5 5 0 0 1 24 20 A2.5 2.5 0 0 0 24 15 A2.5 2.5 0 0 1 24 10Z" fill="rgba(255,255,255,0.85)"/>
    <path d="M24 10 A5 5 0 0 0 24 20 A2.5 2.5 0 0 1 24 15 A2.5 2.5 0 0 0 24 10Z" fill="rgba(76,29,149,0.7)"/>
    <circle cx="24" cy="12.5" r="1.2" fill="rgba(76,29,149,0.8)"/>
    <circle cx="24" cy="17.5" r="1.2" fill="rgba(255,255,255,0.9)"/>
    <circle cx="24" cy="15" r="5" fill="none" stroke="white" strokeWidth="1" opacity={0.7}/>
  </>),

  "Karma Pill": (<>
    <defs><linearGradient id="krm1" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#ede9fe"/><stop offset="100%" stopColor="#5b21b6"/></linearGradient></defs>
    <ellipse cx="24" cy="24" rx="11" ry="15" fill="url(#krm1)" stroke="#8b5cf6" strokeWidth="1.5"/>
    <line x1="13" y1="24" x2="35" y2="24" stroke="white" strokeWidth="1.5" opacity={0.6}/>
    <ellipse cx="20" cy="19" rx="2.5" ry="4" fill="rgba(255,255,255,0.35)" transform="rotate(-15 20 19)"/>
    <path d="M19 15 Q19 11 22 11 Q25 11 25 14 Q25 17 22 17 Q25 17 25 20 Q25 23 22 23 Q19 23 19 19" stroke="white" strokeWidth="1.4" fill="none" strokeLinecap="round"/>
  </>),

  "Heaven Defying Luck Pill": (<>
    <defs><linearGradient id="hdl1" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#c4b5fd"/><stop offset="100%" stopColor="#6d28d9"/></linearGradient></defs>
    <ellipse cx="24" cy="24" rx="11" ry="15" fill="url(#hdl1)" stroke="#8b5cf6" strokeWidth="1.5"/>
    <line x1="13" y1="24" x2="35" y2="24" stroke="white" strokeWidth="1.5" opacity={0.6}/>
    <ellipse cx="20" cy="19" rx="2.5" ry="4" fill="rgba(255,255,255,0.35)" transform="rotate(-15 20 19)"/>
    <path d="M19 19 L21 14 L24 12 L27 14 L29 19 L27 18 L24 21 L21 18 Z" fill="rgba(255,255,255,0.5)" stroke="white" strokeWidth="1"/>
    <path d="M21 14 L24 12 L27 14" fill="rgba(255,220,100,0.6)" stroke="rgba(253,230,138,0.9)" strokeWidth="0.8"/>
  </>),

  "False Tribulation Pill": (<>
    <defs><linearGradient id="ftr1" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#ddd6fe"/><stop offset="100%" stopColor="#5b21b6"/></linearGradient></defs>
    <ellipse cx="24" cy="24" rx="11" ry="15" fill="url(#ftr1)" stroke="#8b5cf6" strokeWidth="1.5"/>
    <line x1="13" y1="24" x2="35" y2="24" stroke="white" strokeWidth="1.5" opacity={0.6}/>
    <ellipse cx="20" cy="19" rx="2.5" ry="4" fill="rgba(255,255,255,0.35)" transform="rotate(-15 20 19)"/>
    <path d="M19 19 Q21 16 24 16 Q27 16 29 19" stroke="white" strokeWidth="1.3" fill="none" strokeLinecap="round"/>
    <path d="M26 11 L24 15 L26 15 L22 21" stroke="rgba(255,255,255,0.9)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
  </>),

  "Phoenix Bloodline Essence Pill": (<>
    <defs><linearGradient id="pbp1" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#ede9fe"/><stop offset="100%" stopColor="#7c3aed"/></linearGradient></defs>
    <ellipse cx="24" cy="24" rx="11" ry="15" fill="url(#pbp1)" stroke="#8b5cf6" strokeWidth="1.5"/>
    <line x1="13" y1="24" x2="35" y2="24" stroke="white" strokeWidth="1.5" opacity={0.6}/>
    <ellipse cx="20" cy="19" rx="2.5" ry="4" fill="rgba(255,255,255,0.35)" transform="rotate(-15 20 19)"/>
    <path d="M24 22 Q17 18 19 12 Q21 17 24 15 Q27 17 29 12 Q31 18 24 22Z" fill="rgba(255,100,50,0.5)" stroke="rgba(255,150,50,0.9)" strokeWidth="1.2"/>
    <path d="M24 22 Q21 19 22 15 Q23 18 24 16 Q25 18 26 15 Q27 19 24 22Z" fill="rgba(255,220,100,0.6)"/>
  </>),

  "Dao Comprehension Pill": (<>
    <defs><linearGradient id="dcp1" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#c4b5fd"/><stop offset="100%" stopColor="#4c1d95"/></linearGradient></defs>
    <ellipse cx="24" cy="24" rx="11" ry="15" fill="url(#dcp1)" stroke="#8b5cf6" strokeWidth="1.5"/>
    <line x1="13" y1="24" x2="35" y2="24" stroke="white" strokeWidth="1.5" opacity={0.6}/>
    <ellipse cx="20" cy="19" rx="2.5" ry="4" fill="rgba(255,255,255,0.35)" transform="rotate(-15 20 19)"/>
    <ellipse cx="24" cy="15" rx="5" ry="3.5" fill="rgba(255,255,255,0.2)" stroke="white" strokeWidth="1.2"/>
    <circle cx="24" cy="15" r="2.5" fill="rgba(255,255,255,0.15)" stroke="white" strokeWidth="1"/>
    <circle cx="24" cy="15" r="1.2" fill="white" opacity={0.9}/>
    <line x1="24" y1="10" x2="24" y2="13" stroke="white" strokeWidth="0.9" strokeLinecap="round" opacity={0.6}/>
  </>),

  "Forbidden Technique Pill": (<>
    <defs><linearGradient id="fbt1" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#ddd6fe"/><stop offset="100%" stopColor="#3b0764"/></linearGradient></defs>
    <ellipse cx="24" cy="24" rx="11" ry="15" fill="url(#fbt1)" stroke="#7c3aed" strokeWidth="1.5"/>
    <line x1="13" y1="24" x2="35" y2="24" stroke="white" strokeWidth="1.5" opacity={0.6}/>
    <ellipse cx="20" cy="19" rx="2.5" ry="4" fill="rgba(255,255,255,0.35)" transform="rotate(-15 20 19)"/>
    <line x1="19" y1="11" x2="29" y2="21" stroke="rgba(255,50,50,0.8)" strokeWidth="2" strokeLinecap="round"/>
    <line x1="29" y1="11" x2="19" y2="21" stroke="rgba(255,50,50,0.8)" strokeWidth="2" strokeLinecap="round"/>
    <circle cx="24" cy="16" r="6" fill="none" stroke="rgba(255,100,100,0.4)" strokeWidth="1.2"/>
  </>),

  "Destiny Pill": (<>
    <defs><linearGradient id="dst1" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#c4b5fd"/><stop offset="100%" stopColor="#5b21b6"/></linearGradient></defs>
    <ellipse cx="24" cy="24" rx="11" ry="15" fill="url(#dst1)" stroke="#8b5cf6" strokeWidth="1.5"/>
    <line x1="13" y1="24" x2="35" y2="24" stroke="white" strokeWidth="1.5" opacity={0.6}/>
    <ellipse cx="20" cy="19" rx="2.5" ry="4" fill="rgba(255,255,255,0.35)" transform="rotate(-15 20 19)"/>
    <path d="M24 9 L25.5 13.5 L30 13.5 L26.5 16 L27.8 20.5 L24 18 L20.2 20.5 L21.5 16 L18 13.5 L22.5 13.5 Z" fill="rgba(255,255,255,0.75)" stroke="rgba(255,220,100,0.8)" strokeWidth="0.8"/>
    <circle cx="24" cy="13" r="1" fill="rgba(255,220,100,0.9)"/>
  </>),

  // ════════════════════════════════════════════════════════
  //  MYTHIC PILLS  (amber/gold)
  // ════════════════════════════════════════════════════════

  "Nascent Pill": (<>
    <defs><linearGradient id="nsc1" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#fde68a"/><stop offset="100%" stopColor="#b45309"/></linearGradient></defs>
    <ellipse cx="24" cy="24" rx="11" ry="15" fill="url(#nsc1)" stroke="#f59e0b" strokeWidth="1.5"/>
    <line x1="13" y1="24" x2="35" y2="24" stroke="white" strokeWidth="1.5" opacity={0.5}/>
    <ellipse cx="20" cy="19" rx="2.5" ry="4" fill="rgba(255,255,255,0.4)" transform="rotate(-15 20 19)"/>
    <circle cx="24" cy="14" r="3.5" fill="rgba(255,255,255,0.25)" stroke="rgba(255,220,100,0.9)" strokeWidth="1.2"/>
    <path d="M22 13 Q24 11 26 13 Q24 15 22 13Z" fill="rgba(255,220,100,0.8)"/>
    <line x1="24" y1="15.5" x2="24" y2="18" stroke="rgba(255,255,255,0.7)" strokeWidth="0.9" strokeLinecap="round"/>
    <line x1="22" y1="16.5" x2="24" y2="17" stroke="rgba(255,255,255,0.5)" strokeWidth="0.8" strokeLinecap="round"/>
    <line x1="26" y1="16.5" x2="24" y2="17" stroke="rgba(255,255,255,0.5)" strokeWidth="0.8" strokeLinecap="round"/>
  </>),

  "Nine Heavens Pill": (<>
    <defs><linearGradient id="nhp1" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#fef3c7"/><stop offset="100%" stopColor="#d97706"/></linearGradient></defs>
    <ellipse cx="24" cy="24" rx="11" ry="15" fill="url(#nhp1)" stroke="#f59e0b" strokeWidth="1.5"/>
    <line x1="13" y1="24" x2="35" y2="24" stroke="white" strokeWidth="1.5" opacity={0.5}/>
    <ellipse cx="20" cy="19" rx="2.5" ry="4" fill="rgba(255,255,255,0.4)" transform="rotate(-15 20 19)"/>
    <circle cx="21" cy="12" r="1.3" fill="white" opacity={0.9}/>
    <circle cx="24" cy="11" r="1.3" fill="white" opacity={0.9}/>
    <circle cx="27" cy="12" r="1.3" fill="white" opacity={0.9}/>
    <circle cx="20" cy="15.5" r="1.1" fill="white" opacity={0.7}/>
    <circle cx="24" cy="15" r="1.3" fill="rgba(255,220,100,0.9)"/>
    <circle cx="28" cy="15.5" r="1.1" fill="white" opacity={0.7}/>
    <circle cx="21" cy="19" r="1" fill="white" opacity={0.6}/>
    <circle cx="24" cy="19.5" r="1.1" fill="white" opacity={0.7}/>
    <circle cx="27" cy="19" r="1" fill="white" opacity={0.6}/>
  </>),

  "Heaven Swallowing Pill": (<>
    <defs>
      <linearGradient id="hsw1" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#fde68a"/><stop offset="100%" stopColor="#92400e"/></linearGradient>
      <radialGradient id="hsw2" cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor="#1a1a2e"/><stop offset="100%" stopColor="#1a1a2e" stopOpacity="0"/></radialGradient>
    </defs>
    <ellipse cx="24" cy="24" rx="11" ry="15" fill="url(#hsw1)" stroke="#f59e0b" strokeWidth="1.5"/>
    <line x1="13" y1="24" x2="35" y2="24" stroke="white" strokeWidth="1.5" opacity={0.5}/>
    <ellipse cx="20" cy="19" rx="2.5" ry="4" fill="rgba(255,255,255,0.4)" transform="rotate(-15 20 19)"/>
    <circle cx="24" cy="15" r="4.5" fill="url(#hsw2)" opacity={0.85}/>
    <circle cx="24" cy="15" r="3.5" fill="none" stroke="rgba(253,230,138,0.8)" strokeWidth="0.8"/>
    <circle cx="24" cy="15" r="2" fill="none" stroke="rgba(253,230,138,0.5)" strokeWidth="0.6"/>
    <path d="M21 12 Q24 10 27 12 Q25 14 24 15 Q23 14 21 12Z" fill="rgba(253,230,138,0.4)"/>
  </>),

  "Dao Heart Pill": (<>
    <defs><linearGradient id="dht1" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#fde68a"/><stop offset="100%" stopColor="#b45309"/></linearGradient></defs>
    <ellipse cx="24" cy="24" rx="11" ry="15" fill="url(#dht1)" stroke="#f59e0b" strokeWidth="1.5"/>
    <line x1="13" y1="24" x2="35" y2="24" stroke="white" strokeWidth="1.5" opacity={0.5}/>
    <ellipse cx="20" cy="19" rx="2.5" ry="4" fill="rgba(255,255,255,0.4)" transform="rotate(-15 20 19)"/>
    <path d="M24 20 Q20 16 20 13.5 Q20 11 22 11 Q23.5 11 24 12.5 Q24.5 11 26 11 Q28 11 28 13.5 Q28 16 24 20Z" fill="rgba(255,150,150,0.5)" stroke="rgba(255,80,80,0.7)" strokeWidth="1.2"/>
    <circle cx="24" cy="14" r="1" fill="rgba(255,220,220,0.8)"/>
  </>),

  "Primal Chaos Pill": (<>
    <defs><linearGradient id="prc1" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#fde68a"/><stop offset="50%" stopColor="#7c3aed"/><stop offset="100%" stopColor="#b45309"/></linearGradient></defs>
    <ellipse cx="24" cy="24" rx="11" ry="15" fill="url(#prc1)" stroke="#f59e0b" strokeWidth="1.5"/>
    <line x1="13" y1="24" x2="35" y2="24" stroke="white" strokeWidth="1.5" opacity={0.5}/>
    <ellipse cx="20" cy="19" rx="2.5" ry="4" fill="rgba(255,255,255,0.4)" transform="rotate(-15 20 19)"/>
    <path d="M24 11 Q27 12 27 15 Q27 18 24 18 Q21 17 21 14 Q22 11 25 12 Q27 13 26 16" stroke="white" strokeWidth="1.3" fill="none" strokeLinecap="round"/>
    <circle cx="24" cy="15" r="1.5" fill="rgba(255,255,255,0.7)"/>
  </>),

  "Supreme Yin-Yang Pill": (<>
    <defs>
      <linearGradient id="syy1" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#fef3c7"/><stop offset="100%" stopColor="#d97706"/></linearGradient>
    </defs>
    <ellipse cx="24" cy="24" rx="11" ry="15" fill="url(#syy1)" stroke="#f59e0b" strokeWidth="1.5"/>
    <line x1="13" y1="24" x2="35" y2="24" stroke="white" strokeWidth="1.5" opacity={0.5}/>
    <ellipse cx="20" cy="19" rx="2.5" ry="4" fill="rgba(255,255,255,0.4)" transform="rotate(-15 20 19)"/>
    <path d="M24 10 A5 5 0 0 1 24 20 A2.5 2.5 0 0 0 24 15 A2.5 2.5 0 0 1 24 10Z" fill="rgba(255,255,255,0.85)"/>
    <path d="M24 10 A5 5 0 0 0 24 20 A2.5 2.5 0 0 1 24 15 A2.5 2.5 0 0 0 24 10Z" fill="rgba(180,83,9,0.7)"/>
    <circle cx="24" cy="12.5" r="1.2" fill="rgba(180,83,9,0.8)"/>
    <circle cx="24" cy="17.5" r="1.2" fill="rgba(255,255,255,0.9)"/>
    <circle cx="24" cy="15" r="5" fill="none" stroke="rgba(255,220,100,0.9)" strokeWidth="1.2"/>
    <line x1="24" y1="9" x2="24" y2="8" stroke="rgba(245,158,11,0.8)" strokeWidth="1.5" strokeLinecap="round"/>
    <line x1="29" y1="10" x2="30" y2="9" stroke="rgba(245,158,11,0.8)" strokeWidth="1.2" strokeLinecap="round"/>
    <line x1="19" y1="10" x2="18" y2="9" stroke="rgba(245,158,11,0.8)" strokeWidth="1.2" strokeLinecap="round"/>
  </>),

  "True Dragon Bloodline Pill": (<>
    <defs><linearGradient id="tdb1" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#fde68a"/><stop offset="100%" stopColor="#7c2d12"/></linearGradient></defs>
    <ellipse cx="24" cy="24" rx="11" ry="15" fill="url(#tdb1)" stroke="#f59e0b" strokeWidth="1.5"/>
    <line x1="13" y1="24" x2="35" y2="24" stroke="white" strokeWidth="1.5" opacity={0.5}/>
    <ellipse cx="20" cy="19" rx="2.5" ry="4" fill="rgba(255,255,255,0.4)" transform="rotate(-15 20 19)"/>
    <path d="M20 19 L22 15 L24 19 Z" fill="rgba(255,255,255,0.65)" stroke="white" strokeWidth="0.6"/>
    <path d="M22 19 L24 15 L26 19 Z" fill="rgba(255,255,255,0.55)" stroke="white" strokeWidth="0.6"/>
    <path d="M24 19 L26 15 L28 19 Z" fill="rgba(255,255,255,0.45)" stroke="white" strokeWidth="0.6"/>
    <path d="M21 15 L23 11 L25 15 Z" fill="rgba(255,220,100,0.7)" stroke="rgba(255,220,100,0.9)" strokeWidth="0.6"/>
    <path d="M23 15 L25 11 L27 15 Z" fill="rgba(255,220,100,0.6)" stroke="rgba(255,220,100,0.9)" strokeWidth="0.6"/>
  </>),

  "Celestial Bloodline Pill": (<>
    <defs><linearGradient id="cbp1" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#fde68a"/><stop offset="100%" stopColor="#b45309"/></linearGradient></defs>
    <ellipse cx="24" cy="24" rx="11" ry="15" fill="url(#cbp1)" stroke="#f59e0b" strokeWidth="1.5"/>
    <line x1="13" y1="24" x2="35" y2="24" stroke="white" strokeWidth="1.5" opacity={0.5}/>
    <ellipse cx="20" cy="19" rx="2.5" ry="4" fill="rgba(255,255,255,0.4)" transform="rotate(-15 20 19)"/>
    <circle cx="24" cy="15" r="4" fill="none" stroke="rgba(255,220,100,0.9)" strokeWidth="1.3"/>
    <line x1="24" y1="9" x2="24" y2="11" stroke="rgba(255,255,255,0.8)" strokeWidth="1.2" strokeLinecap="round"/>
    <line x1="28.8" y1="10.4" x2="27.5" y2="12" stroke="rgba(255,255,255,0.7)" strokeWidth="1.2" strokeLinecap="round"/>
    <line x1="19.2" y1="10.4" x2="20.5" y2="12" stroke="rgba(255,255,255,0.7)" strokeWidth="1.2" strokeLinecap="round"/>
    <circle cx="24" cy="15" r="2" fill="rgba(255,255,255,0.6)" stroke="rgba(255,220,100,0.9)" strokeWidth="0.8"/>
    <circle cx="24" cy="15" r="0.8" fill="white" opacity={0.95}/>
  </>),

  "Immortal Cultivation Pill": (<>
    <defs><linearGradient id="icp1" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#fef3c7"/><stop offset="100%" stopColor="#d97706"/></linearGradient></defs>
    <ellipse cx="24" cy="24" rx="11" ry="15" fill="url(#icp1)" stroke="#f59e0b" strokeWidth="1.5"/>
    <line x1="13" y1="24" x2="35" y2="24" stroke="white" strokeWidth="1.5" opacity={0.5}/>
    <ellipse cx="20" cy="19" rx="2.5" ry="4" fill="rgba(255,255,255,0.4)" transform="rotate(-15 20 19)"/>
    <path d="M24 21 Q18 17 20 11 Q22 15 24 13 Q26 15 28 11 Q30 17 24 21Z" fill="rgba(255,180,50,0.5)" stroke="rgba(255,220,100,0.9)" strokeWidth="1.2"/>
    <path d="M24 20 Q22 17 22.5 14 Q23.5 17 24 15.5 Q24.5 17 25.5 14 Q26 17 24 20Z" fill="rgba(255,255,255,0.5)"/>
    <circle cx="24" cy="21" r="1.2" fill="rgba(255,220,100,0.9)"/>
  </>),

  "World Destroying Pill": (<>
    <defs><linearGradient id="wdp1" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="#fde68a"/><stop offset="50%" stopColor="#ef4444"/><stop offset="100%" stopColor="#78350f"/></linearGradient></defs>
    <ellipse cx="24" cy="24" rx="11" ry="15" fill="url(#wdp1)" stroke="#f59e0b" strokeWidth="1.5"/>
    <line x1="13" y1="24" x2="35" y2="24" stroke="white" strokeWidth="1.5" opacity={0.5}/>
    <ellipse cx="20" cy="19" rx="2.5" ry="4" fill="rgba(255,255,255,0.4)" transform="rotate(-15 20 19)"/>
    <path d="M24 11 L25.5 14 L29 14 L26.5 16.2 L27.5 20 L24 17.8 L20.5 20 L21.5 16.2 L19 14 L22.5 14 Z" fill="rgba(255,80,80,0.5)" stroke="rgba(255,150,50,0.9)" strokeWidth="0.8"/>
    <circle cx="24" cy="15.5" r="1.5" fill="rgba(255,255,200,0.8)"/>
    <line x1="22" y1="9" x2="22.5" y2="11" stroke="rgba(255,150,50,0.6)" strokeWidth="0.8" strokeLinecap="round"/>
    <line x1="26" y1="9" x2="25.5" y2="11" stroke="rgba(255,150,50,0.6)" strokeWidth="0.8" strokeLinecap="round"/>
  </>),

  "Tribulation Evasion Pill": (<>
    <defs><linearGradient id="trb1" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#fde68a"/><stop offset="100%" stopColor="#b45309"/></linearGradient></defs>
    <ellipse cx="24" cy="24" rx="11" ry="15" fill="url(#trb1)" stroke="#f59e0b" strokeWidth="1.5"/>
    <line x1="13" y1="24" x2="35" y2="24" stroke="white" strokeWidth="1.5" opacity={0.5}/>
    <ellipse cx="20" cy="19" rx="2.5" ry="4" fill="rgba(255,255,255,0.4)" transform="rotate(-15 20 19)"/>
    <path d="M20 19 Q20 12 24 12 Q28 12 28 19" stroke="white" strokeWidth="1.3" fill="none" strokeLinecap="round"/>
    <line x1="20" y1="19" x2="28" y2="19" stroke="white" strokeWidth="1.3" strokeLinecap="round"/>
    <path d="M26 10 L24 13 L26 13 L22 18" stroke="rgba(255,255,180,0.9)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
  </>),

  "Immortal Luck Pill": (<>
    <defs><linearGradient id="ilp1" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#fef3c7"/><stop offset="100%" stopColor="#d97706"/></linearGradient></defs>
    <ellipse cx="24" cy="24" rx="11" ry="15" fill="url(#ilp1)" stroke="#f59e0b" strokeWidth="1.5"/>
    <line x1="13" y1="24" x2="35" y2="24" stroke="white" strokeWidth="1.5" opacity={0.5}/>
    <ellipse cx="20" cy="19" rx="2.5" ry="4" fill="rgba(255,255,255,0.4)" transform="rotate(-15 20 19)"/>
    <path d="M24 20 Q22 16 22 13 Q22 11 24 11 Q26 11 26 13 Q26 16 24 20Z" fill="rgba(255,255,255,0.4)" stroke="white" strokeWidth="1"/>
    <path d="M24 20 Q21 17 18.5 15.5 Q17 13.5 18.5 12 Q20 10.5 21.5 12.5 Q22.5 14.5 24 20Z" fill="rgba(255,255,255,0.3)" stroke="white" strokeWidth="1"/>
    <path d="M24 20 Q27 17 29.5 15.5 Q31 13.5 29.5 12 Q28 10.5 26.5 12.5 Q25.5 14.5 24 20Z" fill="rgba(255,255,255,0.3)" stroke="white" strokeWidth="1"/>
    <line x1="24" y1="20" x2="24" y2="22" stroke="rgba(255,220,100,0.8)" strokeWidth="1.5" strokeLinecap="round"/>
    <circle cx="24" cy="14" r="1.5" fill="rgba(255,220,100,0.9)"/>
  </>),

  // ════════════════════════════════════════════════════════
  //  LEGENDARY PILLS  (pink/magenta)
  // ════════════════════════════════════════════════════════

  "Immortality Pill": (<>
    <defs><linearGradient id="imm1" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#fbcfe8"/><stop offset="100%" stopColor="#9d174d"/></linearGradient></defs>
    <ellipse cx="24" cy="24" rx="11" ry="15" fill="url(#imm1)" stroke="#ec4899" strokeWidth="1.5"/>
    <line x1="13" y1="24" x2="35" y2="24" stroke="white" strokeWidth="1.5" opacity={0.6}/>
    <ellipse cx="20" cy="19" rx="2.5" ry="4" fill="rgba(255,255,255,0.4)" transform="rotate(-15 20 19)"/>
    <path d="M24 20 Q20 15 22 10 Q23 14 24 12 Q25 14 26 10 Q28 15 24 20Z" fill="rgba(255,150,50,0.5)" stroke="rgba(255,100,200,0.9)" strokeWidth="1.2"/>
    <circle cx="24" cy="20" r="1.5" fill="rgba(255,255,255,0.8)"/>
    <circle cx="22" cy="10" r="1.2" fill="rgba(255,180,220,0.8)"/>
    <circle cx="26" cy="10" r="1.2" fill="rgba(255,180,220,0.8)"/>
    <path d="M22 6 L24 4 L26 6" stroke="rgba(236,72,153,0.7)" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
  </>),

  "True Immortal Pill": (<>
    <defs>
      <linearGradient id="tip1" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#fce7f3"/><stop offset="100%" stopColor="#831843"/></linearGradient>
      <radialGradient id="tip2" cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor="#fde68a" stopOpacity="0.9"/><stop offset="100%" stopColor="#ec4899" stopOpacity="0"/></radialGradient>
    </defs>
    <circle cx="24" cy="15" r="9" fill="url(#tip2)" opacity={0.5}/>
    <ellipse cx="24" cy="24" rx="11" ry="15" fill="url(#tip1)" stroke="#ec4899" strokeWidth="1.5"/>
    <line x1="13" y1="24" x2="35" y2="24" stroke="white" strokeWidth="1.5" opacity={0.6}/>
    <ellipse cx="20" cy="19" rx="2.5" ry="4" fill="rgba(255,255,255,0.45)" transform="rotate(-15 20 19)"/>
    <circle cx="24" cy="14" r="3" fill="rgba(255,255,255,0.4)" stroke="rgba(255,220,100,0.9)" strokeWidth="1.2"/>
    <line x1="24" y1="9" x2="24" y2="11" stroke="rgba(255,220,100,0.9)" strokeWidth="1.3" strokeLinecap="round"/>
    <line x1="28.5" y1="10.2" x2="27.2" y2="11.5" stroke="rgba(255,220,100,0.7)" strokeWidth="1.2" strokeLinecap="round"/>
    <line x1="19.5" y1="10.2" x2="20.8" y2="11.5" stroke="rgba(255,220,100,0.7)" strokeWidth="1.2" strokeLinecap="round"/>
    <line x1="30" y1="14" x2="28" y2="14" stroke="rgba(255,220,100,0.7)" strokeWidth="1.2" strokeLinecap="round"/>
    <line x1="18" y1="14" x2="20" y2="14" stroke="rgba(255,220,100,0.7)" strokeWidth="1.2" strokeLinecap="round"/>
    <circle cx="24" cy="14" r="1.3" fill="white" opacity={0.95}/>
  </>),

  "Undying Pill": (<>
    <defs><linearGradient id="und1" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#fce7f3"/><stop offset="100%" stopColor="#9d174d"/></linearGradient></defs>
    <ellipse cx="24" cy="24" rx="11" ry="15" fill="url(#und1)" stroke="#ec4899" strokeWidth="1.5"/>
    <line x1="13" y1="24" x2="35" y2="24" stroke="white" strokeWidth="1.5" opacity={0.6}/>
    <ellipse cx="20" cy="19" rx="2.5" ry="4" fill="rgba(255,255,255,0.4)" transform="rotate(-15 20 19)"/>
    <path d="M20 20 Q16 15 20 11 Q21.5 14 24 12 Q26.5 14 28 11 Q32 15 28 20 Q26 16 24 18 Q22 16 20 20Z" fill="rgba(255,100,200,0.4)" stroke="rgba(255,150,220,0.9)" strokeWidth="1.2"/>
    <circle cx="24" cy="15" r="2" fill="rgba(255,200,220,0.6)" stroke="rgba(255,100,200,0.8)" strokeWidth="0.8"/>
    <circle cx="24" cy="15" r="0.8" fill="white" opacity={0.9}/>
  </>),

  "Creation Pill": (<>
    <defs>
      <linearGradient id="crp1" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#fce7f3"/><stop offset="100%" stopColor="#4c1d95"/></linearGradient>
      <radialGradient id="crp2" cx="50%" cy="40%" r="50%"><stop offset="0%" stopColor="#fde68a" stopOpacity="0.9"/><stop offset="100%" stopColor="#ec4899" stopOpacity="0"/></radialGradient>
    </defs>
    <circle cx="24" cy="14" r="8" fill="url(#crp2)" opacity={0.7}/>
    <ellipse cx="24" cy="24" rx="11" ry="15" fill="url(#crp1)" stroke="#ec4899" strokeWidth="1.5"/>
    <line x1="13" y1="24" x2="35" y2="24" stroke="white" strokeWidth="1.5" opacity={0.6}/>
    <ellipse cx="20" cy="19" rx="2.5" ry="4" fill="rgba(255,255,255,0.4)" transform="rotate(-15 20 19)"/>
    <path d="M24 10 Q25.5 12 27 14 Q25.5 13.5 24 15 Q22.5 13.5 21 14 Q22.5 12 24 10Z" fill="rgba(255,220,100,0.7)" stroke="rgba(255,200,50,0.9)" strokeWidth="0.8"/>
    <path d="M24 15 Q26 16.5 27 18 Q25 17 24 18 Q23 17 21 18 Q22 16.5 24 15Z" fill="rgba(255,200,240,0.5)" stroke="rgba(236,72,153,0.7)" strokeWidth="0.8"/>
    <circle cx="24" cy="14" r="1.3" fill="white" opacity={0.95}/>
  </>),

  "Chaos Pill": (<>
    <defs>
      <linearGradient id="chp1" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#fce7f3"/><stop offset="50%" stopColor="#7c3aed"/><stop offset="100%" stopColor="#1a1a2e"/></linearGradient>
      <radialGradient id="chp2" cx="50%" cy="40%" r="60%"><stop offset="0%" stopColor="#fde68a" stopOpacity="0.6"/><stop offset="100%" stopColor="#4c1d95" stopOpacity="0"/></radialGradient>
    </defs>
    <ellipse cx="24" cy="24" rx="11" ry="15" fill="url(#chp1)" stroke="#ec4899" strokeWidth="1.5"/>
    <ellipse cx="24" cy="24" rx="11" ry="15" fill="url(#chp2)"/>
    <line x1="13" y1="24" x2="35" y2="24" stroke="white" strokeWidth="1.5" opacity={0.5}/>
    <ellipse cx="20" cy="19" rx="2.5" ry="4" fill="rgba(255,255,255,0.35)" transform="rotate(-15 20 19)"/>
    <path d="M24 10 Q27 11 27 14 Q27 17 24 17 Q21 17 21 14 Q22 11 25 12 Q27 13 26 16" stroke="rgba(255,220,100,0.8)" strokeWidth="1.3" fill="none" strokeLinecap="round"/>
    <circle cx="21" cy="11" r="1" fill="rgba(255,100,200,0.7)"/>
    <circle cx="27" cy="11" r="1" fill="rgba(100,200,255,0.7)"/>
    <circle cx="24" cy="17" r="1.2" fill="rgba(255,220,100,0.8)"/>
  </>),

  // ════════════════════════════════════════════════════════
  //  RECIPES / SCROLLS
  // ════════════════════════════════════════════════════════

  "Scroll: Yin-Yang Harmony": (<>
    <defs><linearGradient id="syy_s" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#dcfce7"/><stop offset="100%" stopColor="#86efac"/></linearGradient></defs>
    <rect x="11" y="10" width="26" height="28" rx="2" fill="url(#syy_s)" stroke="#22c55e" strokeWidth="1.3"/>
    <rect x="8" y="8" width="32" height="5" rx="2.5" fill="#15803d" stroke="#16a34a" strokeWidth="1"/>
    <rect x="8" y="35" width="32" height="5" rx="2.5" fill="#15803d" stroke="#16a34a" strokeWidth="1"/>
    <path d="M24 16 A6 6 0 0 1 24 28 A3 3 0 0 0 24 22 A3 3 0 0 1 24 16Z" fill="rgba(255,255,255,0.9)"/>
    <path d="M24 16 A6 6 0 0 0 24 28 A3 3 0 0 1 24 22 A3 3 0 0 0 24 16Z" fill="#16a34a" opacity={0.7}/>
    <circle cx="24" cy="19" r="1.5" fill="#16a34a" opacity={0.8}/>
    <circle cx="24" cy="25" r="1.5" fill="rgba(255,255,255,0.9)"/>
  </>),

  "Scroll: Basic Fusion": (<>
    <defs><linearGradient id="sbf_s" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#dcfce7"/><stop offset="100%" stopColor="#86efac"/></linearGradient></defs>
    <rect x="11" y="10" width="26" height="28" rx="2" fill="url(#sbf_s)" stroke="#22c55e" strokeWidth="1.3"/>
    <rect x="8" y="8" width="32" height="5" rx="2.5" fill="#15803d" stroke="#16a34a" strokeWidth="1"/>
    <rect x="8" y="35" width="32" height="5" rx="2.5" fill="#15803d" stroke="#16a34a" strokeWidth="1"/>
    <circle cx="19" cy="22" r="3.5" fill="rgba(34,197,94,0.3)" stroke="#22c55e" strokeWidth="1.2"/>
    <circle cx="29" cy="22" r="3.5" fill="rgba(34,197,94,0.3)" stroke="#22c55e" strokeWidth="1.2"/>
    <circle cx="24" cy="22" r="4" fill="rgba(22,163,74,0.5)" stroke="#16a34a" strokeWidth="1.3"/>
    <path d="M19 22 L24 22 L29 22" stroke="#22c55e" strokeWidth="1" strokeLinecap="round" opacity={0.5}/>
  </>),

  "Scroll: Mortal Cleansing": (<>
    <defs><linearGradient id="smc_s" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#f0fdf4"/><stop offset="100%" stopColor="#bbf7d0"/></linearGradient></defs>
    <rect x="11" y="10" width="26" height="28" rx="2" fill="url(#smc_s)" stroke="#22c55e" strokeWidth="1.3"/>
    <rect x="8" y="8" width="32" height="5" rx="2.5" fill="#15803d" stroke="#16a34a" strokeWidth="1"/>
    <rect x="8" y="35" width="32" height="5" rx="2.5" fill="#15803d" stroke="#16a34a" strokeWidth="1"/>
    <path d="M24 16 Q26 20 24 26 Q22 20 24 16Z" fill="rgba(34,197,94,0.6)" stroke="#22c55e" strokeWidth="1.2"/>
    <ellipse cx="22" cy="21" rx="2.5" ry="4" fill="rgba(255,255,255,0.4)" transform="rotate(-10 22 21)"/>
    <circle cx="24" cy="26" r="2" fill="rgba(34,197,94,0.4)"/>
  </>),

  "Scroll: Foundation Building": (<>
    <defs><linearGradient id="sfb_s" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#dbeafe"/><stop offset="100%" stopColor="#93c5fd"/></linearGradient></defs>
    <rect x="11" y="10" width="26" height="28" rx="2" fill="url(#sfb_s)" stroke="#3b82f6" strokeWidth="1.3"/>
    <rect x="8" y="8" width="32" height="5" rx="2.5" fill="#1d4ed8" stroke="#2563eb" strokeWidth="1"/>
    <rect x="8" y="35" width="32" height="5" rx="2.5" fill="#1d4ed8" stroke="#2563eb" strokeWidth="1"/>
    <path d="M18 28 L24 16 L30 28 Z" fill="rgba(59,130,246,0.4)" stroke="#3b82f6" strokeWidth="1.3" strokeLinejoin="round"/>
    <line x1="18" y1="28" x2="30" y2="28" stroke="#3b82f6" strokeWidth="1.3" strokeLinecap="round"/>
  </>),

  "Scroll: Essence Extraction": (<>
    <defs><linearGradient id="see_s" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#eff6ff"/><stop offset="100%" stopColor="#bfdbfe"/></linearGradient></defs>
    <rect x="11" y="10" width="26" height="28" rx="2" fill="url(#see_s)" stroke="#3b82f6" strokeWidth="1.3"/>
    <rect x="8" y="8" width="32" height="5" rx="2.5" fill="#1e40af" stroke="#2563eb" strokeWidth="1"/>
    <rect x="8" y="35" width="32" height="5" rx="2.5" fill="#1e40af" stroke="#2563eb" strokeWidth="1"/>
    <path d="M24 17 L29 21 L27 21 L27 27 L21 27 L21 21 L19 21 Z" fill="rgba(59,130,246,0.4)" stroke="#3b82f6" strokeWidth="1.2" strokeLinejoin="round"/>
    <line x1="24" y1="21" x2="24" y2="27" stroke="#3b82f6" strokeWidth="0.8" opacity={0.5}/>
  </>),

  "Scroll: Pill Splitting": (<>
    <defs><linearGradient id="sps_s" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#dbeafe"/><stop offset="100%" stopColor="#93c5fd"/></linearGradient></defs>
    <rect x="11" y="10" width="26" height="28" rx="2" fill="url(#sps_s)" stroke="#3b82f6" strokeWidth="1.3"/>
    <rect x="8" y="8" width="32" height="5" rx="2.5" fill="#1d4ed8" stroke="#2563eb" strokeWidth="1"/>
    <rect x="8" y="35" width="32" height="5" rx="2.5" fill="#1d4ed8" stroke="#2563eb" strokeWidth="1"/>
    <ellipse cx="20" cy="22" rx="5" ry="7" fill="rgba(59,130,246,0.3)" stroke="#3b82f6" strokeWidth="1.2"/>
    <ellipse cx="28" cy="22" rx="5" ry="7" fill="rgba(59,130,246,0.2)" stroke="#93c5fd" strokeWidth="1"/>
    <line x1="24" y1="16" x2="24" y2="28" stroke="#3b82f6" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="2 1.5"/>
  </>),

  "Scroll: Beast Core Fusion": (<>
    <defs><linearGradient id="sbc_s" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#eff6ff"/><stop offset="100%" stopColor="#bfdbfe"/></linearGradient></defs>
    <rect x="11" y="10" width="26" height="28" rx="2" fill="url(#sbc_s)" stroke="#3b82f6" strokeWidth="1.3"/>
    <rect x="8" y="8" width="32" height="5" rx="2.5" fill="#1e40af" stroke="#2563eb" strokeWidth="1"/>
    <rect x="8" y="35" width="32" height="5" rx="2.5" fill="#1e40af" stroke="#2563eb" strokeWidth="1"/>
    <path d="M20 20 L22 16 L24 18 L26 16 L28 20 L26 22 L24 20 L22 22 Z" fill="rgba(59,130,246,0.4)" stroke="#3b82f6" strokeWidth="1.2" strokeLinejoin="round"/>
    <circle cx="24" cy="26" r="3" fill="rgba(59,130,246,0.3)" stroke="#3b82f6" strokeWidth="1.2"/>
    <circle cx="24" cy="26" r="1.2" fill="#3b82f6" opacity={0.7}/>
  </>),

  "Scroll: Core Formation": (<>
    <defs><linearGradient id="scf_s" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#ede9fe"/><stop offset="100%" stopColor="#c4b5fd"/></linearGradient></defs>
    <rect x="11" y="10" width="26" height="28" rx="2" fill="url(#scf_s)" stroke="#8b5cf6" strokeWidth="1.3"/>
    <rect x="8" y="8" width="32" height="5" rx="2.5" fill="#4c1d95" stroke="#7c3aed" strokeWidth="1"/>
    <rect x="8" y="35" width="32" height="5" rx="2.5" fill="#4c1d95" stroke="#7c3aed" strokeWidth="1"/>
    <circle cx="24" cy="22" r="7" fill="rgba(139,92,246,0.2)" stroke="#8b5cf6" strokeWidth="1.2"/>
    <circle cx="24" cy="22" r="4" fill="rgba(139,92,246,0.3)" stroke="#8b5cf6" strokeWidth="1"/>
    <circle cx="24" cy="22" r="1.8" fill="#a78bfa"/>
    <circle cx="24" cy="22" r="0.8" fill="white" opacity={0.9}/>
  </>),

  "Scroll: Tribulation Pill": (<>
    <defs><linearGradient id="stp_s" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#ede9fe"/><stop offset="100%" stopColor="#c4b5fd"/></linearGradient></defs>
    <rect x="11" y="10" width="26" height="28" rx="2" fill="url(#stp_s)" stroke="#8b5cf6" strokeWidth="1.3"/>
    <rect x="8" y="8" width="32" height="5" rx="2.5" fill="#4c1d95" stroke="#7c3aed" strokeWidth="1"/>
    <rect x="8" y="35" width="32" height="5" rx="2.5" fill="#4c1d95" stroke="#7c3aed" strokeWidth="1"/>
    <path d="M27 15 L23 21 L26 21 L21 29" stroke="#8b5cf6" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
    <path d="M26.5 15.5 L22.5 21 L25.5 21 L20.5 29" stroke="rgba(196,181,253,0.5)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
  </>),

  "Scroll: Alchemy Mastery": (<>
    <defs><linearGradient id="sam_s" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#f5f3ff"/><stop offset="100%" stopColor="#ddd6fe"/></linearGradient></defs>
    <rect x="11" y="10" width="26" height="28" rx="2" fill="url(#sam_s)" stroke="#8b5cf6" strokeWidth="1.3"/>
    <rect x="8" y="8" width="32" height="5" rx="2.5" fill="#5b21b6" stroke="#7c3aed" strokeWidth="1"/>
    <rect x="8" y="35" width="32" height="5" rx="2.5" fill="#5b21b6" stroke="#7c3aed" strokeWidth="1"/>
    <path d="M24 15 L25.8 20 L31 20 L26.8 23 L28.4 28 L24 25 L19.6 28 L21.2 23 L17 20 L22.2 20 Z" fill="rgba(139,92,246,0.5)" stroke="#8b5cf6" strokeWidth="1.2"/>
    <circle cx="24" cy="21" r="2" fill="white" opacity={0.8}/>
  </>),

  "Scroll: Forbidden Arts": (<>
    <defs><linearGradient id="sfa_s" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#ede9fe"/><stop offset="100%" stopColor="#a78bfa"/></linearGradient></defs>
    <rect x="11" y="10" width="26" height="28" rx="2" fill="url(#sfa_s)" stroke="#7c3aed" strokeWidth="1.3"/>
    <rect x="8" y="8" width="32" height="5" rx="2.5" fill="#3b0764" stroke="#6d28d9" strokeWidth="1"/>
    <rect x="8" y="35" width="32" height="5" rx="2.5" fill="#3b0764" stroke="#6d28d9" strokeWidth="1"/>
    <line x1="18" y1="15" x2="30" y2="29" stroke="rgba(239,68,68,0.8)" strokeWidth="2" strokeLinecap="round"/>
    <line x1="30" y1="15" x2="18" y2="29" stroke="rgba(239,68,68,0.8)" strokeWidth="2" strokeLinecap="round"/>
    <circle cx="24" cy="22" r="6" fill="none" stroke="rgba(239,68,68,0.4)" strokeWidth="1.2"/>
    <circle cx="24" cy="22" r="3" fill="none" stroke="rgba(239,68,68,0.3)" strokeWidth="0.8"/>
  </>),

  "Scroll: Dragon Bloodline": (<>
    <defs><linearGradient id="sdb_s" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#ede9fe"/><stop offset="100%" stopColor="#c4b5fd"/></linearGradient></defs>
    <rect x="11" y="10" width="26" height="28" rx="2" fill="url(#sdb_s)" stroke="#8b5cf6" strokeWidth="1.3"/>
    <rect x="8" y="8" width="32" height="5" rx="2.5" fill="#4c1d95" stroke="#7c3aed" strokeWidth="1"/>
    <rect x="8" y="35" width="32" height="5" rx="2.5" fill="#4c1d95" stroke="#7c3aed" strokeWidth="1"/>
    <path d="M19 22 L21 18 L23 22 Z" fill="rgba(139,92,246,0.7)" stroke="#8b5cf6" strokeWidth="0.8"/>
    <path d="M21 22 L23 18 L25 22 Z" fill="rgba(139,92,246,0.6)" stroke="#8b5cf6" strokeWidth="0.8"/>
    <path d="M23 22 L25 18 L27 22 Z" fill="rgba(139,92,246,0.5)" stroke="#8b5cf6" strokeWidth="0.8"/>
    <path d="M20 18 L22 14 L24 18 Z" fill="rgba(196,181,253,0.6)" stroke="#a78bfa" strokeWidth="0.8"/>
    <path d="M22 18 L24 14 L26 18 Z" fill="rgba(196,181,253,0.5)" stroke="#a78bfa" strokeWidth="0.8"/>
    <line x1="17" y1="24" x2="31" y2="24" stroke="#8b5cf6" strokeWidth="0.8" opacity={0.4}/>
  </>),

  "Scroll: Nascent Soul": (<>
    <defs><linearGradient id="sns_s" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#fef3c7"/><stop offset="100%" stopColor="#fde68a"/></linearGradient></defs>
    <rect x="11" y="10" width="26" height="28" rx="2" fill="url(#sns_s)" stroke="#f59e0b" strokeWidth="1.3"/>
    <rect x="8" y="8" width="32" height="5" rx="2.5" fill="#92400e" stroke="#b45309" strokeWidth="1"/>
    <rect x="8" y="35" width="32" height="5" rx="2.5" fill="#92400e" stroke="#b45309" strokeWidth="1"/>
    <circle cx="24" cy="19" r="3.5" fill="rgba(245,158,11,0.3)" stroke="#f59e0b" strokeWidth="1.2"/>
    <path d="M22 19 Q24 17 26 19 Q24 21 22 19Z" fill="rgba(245,158,11,0.6)"/>
    <line x1="24" y1="22" x2="24" y2="26" stroke="#d97706" strokeWidth="1.3" strokeLinecap="round"/>
    <line x1="22" y1="23.5" x2="24" y2="23" stroke="#d97706" strokeWidth="1" strokeLinecap="round"/>
    <line x1="26" y1="23.5" x2="24" y2="23" stroke="#d97706" strokeWidth="1" strokeLinecap="round"/>
    <line x1="22" y1="27" x2="24" y2="26" stroke="#d97706" strokeWidth="1" strokeLinecap="round"/>
    <line x1="26" y1="27" x2="24" y2="26" stroke="#d97706" strokeWidth="1" strokeLinecap="round"/>
  </>),

  "Scroll: Supreme Yin-Yang": (<>
    <defs><linearGradient id="syys_s" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#fffbeb"/><stop offset="100%" stopColor="#fde68a"/></linearGradient></defs>
    <rect x="11" y="10" width="26" height="28" rx="2" fill="url(#syys_s)" stroke="#f59e0b" strokeWidth="1.3"/>
    <rect x="8" y="8" width="32" height="5" rx="2.5" fill="#92400e" stroke="#b45309" strokeWidth="1"/>
    <rect x="8" y="35" width="32" height="5" rx="2.5" fill="#92400e" stroke="#b45309" strokeWidth="1"/>
    <path d="M24 15 A7 7 0 0 1 24 29 A3.5 3.5 0 0 0 24 22 A3.5 3.5 0 0 1 24 15Z" fill="rgba(255,255,255,0.9)"/>
    <path d="M24 15 A7 7 0 0 0 24 29 A3.5 3.5 0 0 1 24 22 A3.5 3.5 0 0 0 24 15Z" fill="#d97706" opacity={0.8}/>
    <circle cx="24" cy="18.5" r="1.5" fill="#d97706" opacity={0.9}/>
    <circle cx="24" cy="25.5" r="1.5" fill="rgba(255,255,255,0.9)"/>
    <circle cx="24" cy="22" r="7" fill="none" stroke="rgba(245,158,11,0.7)" strokeWidth="1"/>
  </>),

  "Scroll: Primal Chaos": (<>
    <defs><linearGradient id="spc_s" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#fef3c7"/><stop offset="100%" stopColor="#fde68a"/></linearGradient></defs>
    <rect x="11" y="10" width="26" height="28" rx="2" fill="url(#spc_s)" stroke="#f59e0b" strokeWidth="1.3"/>
    <rect x="8" y="8" width="32" height="5" rx="2.5" fill="#78350f" stroke="#b45309" strokeWidth="1"/>
    <rect x="8" y="35" width="32" height="5" rx="2.5" fill="#78350f" stroke="#b45309" strokeWidth="1"/>
    <path d="M24 16 Q27 17 27 20 Q27 23 24 23 Q21 22 21 19 Q22 16 25 17 Q27 18 26 21" stroke="#f59e0b" strokeWidth="1.4" fill="none" strokeLinecap="round"/>
    <circle cx="24" cy="20" r="1.5" fill="rgba(245,158,11,0.8)"/>
    <circle cx="20" cy="16" r="1" fill="rgba(245,158,11,0.5)"/>
    <circle cx="28" cy="16" r="1" fill="rgba(245,158,11,0.5)"/>
  </>),

  "Scroll: World Destroying": (<>
    <defs><linearGradient id="swd_s" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#fef3c7"/><stop offset="50%" stopColor="#ef4444"/><stop offset="100%" stopColor="#fde68a"/></linearGradient></defs>
    <rect x="11" y="10" width="26" height="28" rx="2" fill="url(#swd_s)" stroke="#f59e0b" strokeWidth="1.3"/>
    <rect x="8" y="8" width="32" height="5" rx="2.5" fill="#7f1d1d" stroke="#b91c1c" strokeWidth="1"/>
    <rect x="8" y="35" width="32" height="5" rx="2.5" fill="#7f1d1d" stroke="#b91c1c" strokeWidth="1"/>
    <circle cx="24" cy="22" r="6" fill="rgba(239,68,68,0.25)" stroke="rgba(239,68,68,0.7)" strokeWidth="1"/>
    <line x1="24" y1="15" x2="24" y2="18" stroke="rgba(253,230,138,0.9)" strokeWidth="1.3" strokeLinecap="round"/>
    <line x1="29.2" y1="16.8" x2="27.4" y2="18.8" stroke="rgba(253,230,138,0.8)" strokeWidth="1.3" strokeLinecap="round"/>
    <line x1="18.8" y1="16.8" x2="20.6" y2="18.8" stroke="rgba(253,230,138,0.8)" strokeWidth="1.3" strokeLinecap="round"/>
    <line x1="31" y1="22" x2="28" y2="22" stroke="rgba(253,230,138,0.8)" strokeWidth="1.3" strokeLinecap="round"/>
    <line x1="17" y1="22" x2="20" y2="22" stroke="rgba(253,230,138,0.8)" strokeWidth="1.3" strokeLinecap="round"/>
    <circle cx="24" cy="22" r="2.5" fill="rgba(239,68,68,0.5)" stroke="rgba(253,230,138,0.8)" strokeWidth="0.8"/>
    <circle cx="24" cy="22" r="1" fill="rgba(255,240,200,0.9)"/>
  </>),

  "Scroll: Celestial Bloodline": (<>
    <defs><linearGradient id="scb_s" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#fffbeb"/><stop offset="100%" stopColor="#fef3c7"/></linearGradient></defs>
    <rect x="11" y="10" width="26" height="28" rx="2" fill="url(#scb_s)" stroke="#f59e0b" strokeWidth="1.3"/>
    <rect x="8" y="8" width="32" height="5" rx="2.5" fill="#92400e" stroke="#b45309" strokeWidth="1"/>
    <rect x="8" y="35" width="32" height="5" rx="2.5" fill="#92400e" stroke="#b45309" strokeWidth="1"/>
    <circle cx="24" cy="22" r="6" fill="none" stroke="rgba(245,158,11,0.7)" strokeWidth="1.2"/>
    <line x1="24" y1="15" x2="24" y2="17" stroke="#f59e0b" strokeWidth="1.2" strokeLinecap="round"/>
    <line x1="28.6" y1="16.3" x2="27.3" y2="17.9" stroke="#f59e0b" strokeWidth="1.2" strokeLinecap="round"/>
    <line x1="19.4" y1="16.3" x2="20.7" y2="17.9" stroke="#f59e0b" strokeWidth="1.2" strokeLinecap="round"/>
    <circle cx="24" cy="22" r="3.5" fill="rgba(245,158,11,0.2)" stroke="#f59e0b" strokeWidth="1"/>
    <circle cx="24" cy="22" r="1.5" fill="#f59e0b" opacity={0.8}/>
    <circle cx="24" cy="22" r="0.6" fill="white"/>
  </>),

  "Scroll: Immortal Alchemy": (<>
    <defs>
      <linearGradient id="sia_s" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#fef9e7"/><stop offset="100%" stopColor="#fde68a"/></linearGradient>
    </defs>
    <rect x="11" y="10" width="26" height="28" rx="2" fill="url(#sia_s)" stroke="#f59e0b" strokeWidth="1.5"/>
    <rect x="8" y="8" width="32" height="5" rx="2.5" fill="#78350f" stroke="#b45309" strokeWidth="1.2"/>
    <rect x="8" y="35" width="32" height="5" rx="2.5" fill="#78350f" stroke="#b45309" strokeWidth="1.2"/>
    <path d="M24 25 Q18 20 20 14 Q22 18 24 16 Q26 18 28 14 Q30 20 24 25Z" fill="rgba(245,158,11,0.4)" stroke="#f59e0b" strokeWidth="1.2"/>
    <path d="M24 24 Q21 20 22 16 Q23 19 24 17.5 Q25 19 26 16 Q27 20 24 24Z" fill="rgba(255,255,200,0.5)"/>
    <circle cx="24" cy="25" r="1.5" fill="rgba(245,158,11,0.9)"/>
    <circle cx="20" cy="13" r="1.2" fill="rgba(245,158,11,0.6)"/>
    <circle cx="28" cy="13" r="1.2" fill="rgba(245,158,11,0.6)"/>
  </>),

  "Scroll: Creation": (<>
    <defs>
      <linearGradient id="sc_s" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#fdf2f8"/><stop offset="100%" stopColor="#fbcfe8"/></linearGradient>
    </defs>
    <rect x="11" y="10" width="26" height="28" rx="2" fill="url(#sc_s)" stroke="#ec4899" strokeWidth="1.5"/>
    <rect x="8" y="8" width="32" height="5" rx="2.5" fill="#831843" stroke="#9d174d" strokeWidth="1.2"/>
    <rect x="8" y="35" width="32" height="5" rx="2.5" fill="#831843" stroke="#9d174d" strokeWidth="1.2"/>
    <path d="M24 14 Q26 16 27 18 Q25.5 17.5 24 19 Q22.5 17.5 21 18 Q22 16 24 14Z" fill="rgba(236,72,153,0.5)" stroke="#ec4899" strokeWidth="1"/>
    <path d="M24 19 Q26 20.5 27 22 Q25.5 21.5 24 23 Q22.5 21.5 21 22 Q22 20.5 24 19Z" fill="rgba(236,72,153,0.4)" stroke="#f9a8d4" strokeWidth="0.9"/>
    <circle cx="24" cy="26" r="2.5" fill="rgba(236,72,153,0.3)" stroke="#ec4899" strokeWidth="1"/>
    <circle cx="24" cy="26" r="1" fill="#ec4899" opacity={0.8}/>
  </>),

  "Scroll: Undying": (<>
    <defs>
      <linearGradient id="su_s" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#fdf2f8"/><stop offset="100%" stopColor="#f9a8d4"/></linearGradient>
    </defs>
    <rect x="11" y="10" width="26" height="28" rx="2" fill="url(#su_s)" stroke="#ec4899" strokeWidth="1.5"/>
    <rect x="8" y="8" width="32" height="5" rx="2.5" fill="#831843" stroke="#9d174d" strokeWidth="1.2"/>
    <rect x="8" y="35" width="32" height="5" rx="2.5" fill="#831843" stroke="#9d174d" strokeWidth="1.2"/>
    <path d="M20 22 Q16 17 20 13 Q21.5 16 24 14 Q26.5 16 28 13 Q32 17 28 22 Q26 18 24 20 Q22 18 20 22Z" fill="rgba(236,72,153,0.35)" stroke="#ec4899" strokeWidth="1.2"/>
    <circle cx="24" cy="17" r="2" fill="rgba(236,72,153,0.4)" stroke="#f9a8d4" strokeWidth="0.8"/>
    <circle cx="24" cy="17" r="0.8" fill="white" opacity={0.8}/>
    <line x1="24" y1="22" x2="24" y2="27" stroke="#ec4899" strokeWidth="1.2" strokeLinecap="round"/>
  </>),

  "Scroll: True Immortal": (<>
    <defs>
      <linearGradient id="sti_s" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#fff0f6"/><stop offset="100%" stopColor="#fce7f3"/></linearGradient>
    </defs>
    <rect x="11" y="10" width="26" height="28" rx="2" fill="url(#sti_s)" stroke="#ec4899" strokeWidth="1.5"/>
    <rect x="8" y="8" width="32" height="5" rx="2.5" fill="#9d174d" stroke="#be185d" strokeWidth="1.2"/>
    <rect x="8" y="35" width="32" height="5" rx="2.5" fill="#9d174d" stroke="#be185d" strokeWidth="1.2"/>
    <circle cx="24" cy="21" r="6" fill="rgba(236,72,153,0.15)" stroke="#ec4899" strokeWidth="1"/>
    <line x1="24" y1="14" x2="24" y2="16" stroke="#ec4899" strokeWidth="1.3" strokeLinecap="round"/>
    <line x1="29.2" y1="15.8" x2="27.5" y2="17.5" stroke="#f9a8d4" strokeWidth="1.2" strokeLinecap="round"/>
    <line x1="18.8" y1="15.8" x2="20.5" y2="17.5" stroke="#f9a8d4" strokeWidth="1.2" strokeLinecap="round"/>
    <line x1="31" y1="21" x2="29" y2="21" stroke="#f9a8d4" strokeWidth="1.2" strokeLinecap="round"/>
    <line x1="17" y1="21" x2="19" y2="21" stroke="#f9a8d4" strokeWidth="1.2" strokeLinecap="round"/>
    <circle cx="24" cy="21" r="2.5" fill="rgba(236,72,153,0.4)" stroke="#ec4899" strokeWidth="0.8"/>
    <circle cx="24" cy="21" r="1" fill="white" opacity={0.9}/>
  </>),

  "Scroll: Heaven's Path": (<>
    <defs>
      <linearGradient id="shp_s" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#fdf2f8"/><stop offset="50%" stopColor="#fde68a"/><stop offset="100%" stopColor="#fce7f3"/></linearGradient>
    </defs>
    <rect x="11" y="10" width="26" height="28" rx="2" fill="url(#shp_s)" stroke="#ec4899" strokeWidth="1.5"/>
    <rect x="8" y="8" width="32" height="5" rx="2.5" fill="#831843" stroke="#9d174d" strokeWidth="1.2"/>
    <rect x="8" y="35" width="32" height="5" rx="2.5" fill="#831843" stroke="#9d174d" strokeWidth="1.2"/>
    <path d="M16 28 Q18 22 24 18 Q30 22 32 28" stroke="#ec4899" strokeWidth="1.4" fill="none" strokeLinecap="round"/>
    <path d="M20 24 Q22 21 24 20 Q26 21 28 24" stroke="rgba(253,230,138,0.9)" strokeWidth="1.2" fill="none" strokeLinecap="round"/>
    <circle cx="24" cy="17" r="3" fill="rgba(253,230,138,0.5)" stroke="rgba(245,158,11,0.8)" strokeWidth="1.2"/>
    <circle cx="24" cy="17" r="1.2" fill="rgba(255,255,200,0.9)"/>
    <path d="M22 28 L22 30 Q22 32 24 32 Q26 32 26 30 L26 28" stroke="#ec4899" strokeWidth="1.2" fill="none" strokeLinecap="round"/>
  </>),

  // ════════════════════════════════════════════════════════
  //  COMMON TREASURES
  // ════════════════════════════════════════════════════════

  "Low Grade Spirit Stone": (<>
    <defs><linearGradient id="lgss" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#e2e8f0"/><stop offset="50%" stopColor="#94a3b8"/><stop offset="100%" stopColor="#475569"/></linearGradient></defs>
    <path d="M24 8 L34 20 L24 40 L14 20 Z" fill="url(#lgss)" stroke="#64748b" strokeWidth="1.5" strokeLinejoin="round"/>
    <path d="M24 8 L29 20 L24 40 L19 20 Z" fill="rgba(255,255,255,0.18)"/>
    <line x1="14" y1="20" x2="34" y2="20" stroke="rgba(255,255,255,0.35)" strokeWidth="1.2"/>
    <path d="M17 14 L24 8 L31 14" stroke="rgba(255,255,255,0.45)" strokeWidth="1" fill="none"/>
    <circle cx="24" cy="8" r="2" fill="rgba(255,255,255,0.7)"/>
  </>),

  "Basic Qi Talisman": (<>
    <defs><linearGradient id="bqt" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#fafafa"/><stop offset="100%" stopColor="#e5e7eb"/></linearGradient></defs>
    <rect x="14" y="8" width="20" height="30" rx="2" fill="url(#bqt)" stroke="#9ca3af" strokeWidth="1.5"/>
    <rect x="14" y="8" width="20" height="4" rx="2" fill="#9ca3af" opacity={0.2}/>
    <line x1="14" y1="14" x2="34" y2="14" stroke="#9ca3af" strokeWidth="0.8" opacity={0.5}/>
    <line x1="14" y1="32" x2="34" y2="32" stroke="#9ca3af" strokeWidth="0.8" opacity={0.5}/>
    <path d="M24 18 L25.5 22 L29.5 22 L26.5 24.5 L27.5 28 L24 26 L20.5 28 L21.5 24.5 L18.5 22 L22.5 22 Z" fill="#9ca3af" opacity={0.5}/>
    <line x1="22" y1="36" x2="20" y2="42" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" opacity={0.6}/>
    <line x1="24" y1="36" x2="24" y2="42" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" opacity={0.6}/>
    <line x1="26" y1="36" x2="28" y2="42" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" opacity={0.6}/>
  </>),

  "Mortal Cultivation Jade Slip": (<>
    <defs><linearGradient id="mcjs" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#d1fae5"/><stop offset="100%" stopColor="#6ee7b7"/></linearGradient></defs>
    <rect x="10" y="12" width="28" height="24" rx="3" fill="url(#mcjs)" stroke="#34d399" strokeWidth="1.5"/>
    <rect x="10" y="12" width="28" height="6" rx="3" fill="rgba(52,211,153,0.25)"/>
    <line x1="14" y1="22" x2="34" y2="22" stroke="rgba(52,211,153,0.6)" strokeWidth="1"/>
    <line x1="14" y1="26" x2="34" y2="26" stroke="rgba(52,211,153,0.5)" strokeWidth="0.9"/>
    <line x1="14" y1="30" x2="28" y2="30" stroke="rgba(52,211,153,0.4)" strokeWidth="0.9"/>
    <path d="M12 14 Q10 14 10 16" stroke="#34d399" strokeWidth="1.3" fill="none" strokeLinecap="round"/>
    <path d="M36 14 Q38 14 38 16" stroke="#34d399" strokeWidth="1.3" fill="none" strokeLinecap="round"/>
    <ellipse cx="18" cy="16" rx="3" ry="2" fill="rgba(255,255,255,0.4)"/>
  </>),

  "Failure Ash": (<>
    <defs><linearGradient id="fash" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#f1f5f9"/><stop offset="100%" stopColor="#94a3b8"/></linearGradient></defs>
    <ellipse cx="24" cy="32" rx="12" ry="4" fill="rgba(100,116,139,0.3)"/>
    <path d="M18 28 Q14 22 16 16 Q20 20 24 18 Q28 20 32 16 Q34 22 30 28 Z" fill="url(#fash)" stroke="#94a3b8" strokeWidth="1.3"/>
    <path d="M20 26 Q18 22 20 18 Q22 21 24 20 Q26 21 28 18 Q30 22 28 26" fill="rgba(148,163,184,0.3)" stroke="rgba(148,163,184,0.5)" strokeWidth="0.8"/>
    <circle cx="20" cy="12" r="2" fill="#94a3b8" opacity={0.5}/>
    <circle cx="24" cy="10" r="1.5" fill="#94a3b8" opacity={0.4}/>
    <circle cx="28" cy="12" r="1.8" fill="#94a3b8" opacity={0.45}/>
  </>),

  // ════════════════════════════════════════════════════════
  //  UNCOMMON TREASURES
  // ════════════════════════════════════════════════════════

  "Mid Grade Spirit Stone": (<>
    <defs><linearGradient id="mgss" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#dcfce7"/><stop offset="50%" stopColor="#4ade80"/><stop offset="100%" stopColor="#15803d"/></linearGradient></defs>
    <path d="M24 7 L36 20 L24 41 L12 20 Z" fill="url(#mgss)" stroke="#22c55e" strokeWidth="1.5" strokeLinejoin="round"/>
    <path d="M24 7 L30 20 L24 41 L18 20 Z" fill="rgba(255,255,255,0.2)"/>
    <line x1="12" y1="20" x2="36" y2="20" stroke="rgba(255,255,255,0.4)" strokeWidth="1.2"/>
    <path d="M16 13 L24 7 L32 13" stroke="rgba(255,255,255,0.5)" strokeWidth="1" fill="none"/>
    <circle cx="24" cy="7" r="2.5" fill="rgba(255,255,255,0.8)"/>
    <circle cx="19" cy="14" r="1.2" fill="rgba(255,255,255,0.4)"/>
  </>),

  "Spirit Gathering Talisman": (<>
    <defs><linearGradient id="sgt" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#f0fdf4"/><stop offset="100%" stopColor="#bbf7d0"/></linearGradient></defs>
    <rect x="14" y="8" width="20" height="30" rx="2" fill="url(#sgt)" stroke="#22c55e" strokeWidth="1.5"/>
    <rect x="14" y="8" width="20" height="4" rx="2" fill="rgba(34,197,94,0.25)"/>
    <line x1="14" y1="14" x2="34" y2="14" stroke="#22c55e" strokeWidth="0.8" opacity={0.5}/>
    <line x1="14" y1="32" x2="34" y2="32" stroke="#22c55e" strokeWidth="0.8" opacity={0.5}/>
    <circle cx="24" cy="23" r="5" fill="none" stroke="#22c55e" strokeWidth="1.2" opacity={0.7}/>
    <circle cx="24" cy="23" r="3" fill="rgba(34,197,94,0.2)" stroke="#22c55e" strokeWidth="1"/>
    <path d="M24 16 L24 18" stroke="#22c55e" strokeWidth="1.2" strokeLinecap="round" opacity={0.6}/>
    <path d="M24 28 L24 30" stroke="#22c55e" strokeWidth="1.2" strokeLinecap="round" opacity={0.6}/>
    <path d="M18 23 L16 23" stroke="#22c55e" strokeWidth="1.2" strokeLinecap="round" opacity={0.6}/>
    <path d="M30 23 L32 23" stroke="#22c55e" strokeWidth="1.2" strokeLinecap="round" opacity={0.6}/>
    <line x1="22" y1="36" x2="21" y2="42" stroke="#22c55e" strokeWidth="1.5" strokeLinecap="round" opacity={0.6}/>
    <line x1="24" y1="36" x2="24" y2="42" stroke="#22c55e" strokeWidth="1.5" strokeLinecap="round" opacity={0.6}/>
    <line x1="26" y1="36" x2="27" y2="42" stroke="#22c55e" strokeWidth="1.5" strokeLinecap="round" opacity={0.6}/>
  </>),

  "Jade Ring": (<>
    <defs><linearGradient id="jring" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#bbf7d0"/><stop offset="100%" stopColor="#15803d"/></linearGradient></defs>
    <circle cx="24" cy="26" r="13" fill="none" stroke="#22c55e" strokeWidth="4.5"/>
    <circle cx="24" cy="26" r="10" fill="rgba(34,197,94,0.07)"/>
    <circle cx="24" cy="26" r="13" fill="none" stroke="#86efac" strokeWidth="2" opacity={0.4}/>
    <circle cx="24" cy="13" r="5" fill="url(#jring)" stroke="#16a34a" strokeWidth="1.3"/>
    <ellipse cx="22" cy="11" rx="2" ry="2.5" fill="rgba(255,255,255,0.45)" transform="rotate(-20 22 11)"/>
    <path d="M21 13 L23 11 L25 13 L23 15 Z" fill="#16a34a" opacity={0.8}/>
    <circle cx="24" cy="13" r="1.5" fill="rgba(255,255,255,0.6)"/>
  </>),

  "Prayer Beads": (<>
    <defs><radialGradient id="pbeadg" cx="35%" cy="30%" r="65%"><stop offset="0%" stopColor="#dcfce7"/><stop offset="100%" stopColor="#15803d"/></radialGradient></defs>
    <circle cx="24" cy="24" r="14" fill="none" stroke="#22c55e" strokeWidth="0.8" strokeDasharray="2 2" opacity={0.5}/>
    <circle cx="24" cy="10" r="3.5" fill="url(#pbeadg)" stroke="#16a34a" strokeWidth="1"/>
    <circle cx="32" cy="14" r="3.5" fill="url(#pbeadg)" stroke="#16a34a" strokeWidth="1"/>
    <circle cx="37" cy="22" r="3.5" fill="url(#pbeadg)" stroke="#16a34a" strokeWidth="1"/>
    <circle cx="34" cy="31" r="3.5" fill="url(#pbeadg)" stroke="#16a34a" strokeWidth="1"/>
    <circle cx="24" cy="37" r="3.5" fill="url(#pbeadg)" stroke="#16a34a" strokeWidth="1"/>
    <circle cx="14" cy="31" r="3.5" fill="url(#pbeadg)" stroke="#16a34a" strokeWidth="1"/>
    <circle cx="11" cy="22" r="3.5" fill="url(#pbeadg)" stroke="#16a34a" strokeWidth="1"/>
    <circle cx="16" cy="14" r="3.5" fill="url(#pbeadg)" stroke="#16a34a" strokeWidth="1"/>
    <circle cx="23" cy="9" r="1" fill="rgba(255,255,255,0.5)"/>
    <circle cx="23" cy="36" r="1" fill="rgba(255,255,255,0.5)"/>
  </>),

  "Spirit Brush": (<>
    <defs><linearGradient id="sbrush" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#dcfce7"/><stop offset="100%" stopColor="#22c55e"/></linearGradient></defs>
    <rect x="21" y="8" width="6" height="24" rx="3" fill="url(#sbrush)" stroke="#22c55e" strokeWidth="1.5"/>
    <path d="M21 28 Q18 34 22 40 L26 40 Q30 34 27 28 Z" fill="#15803d" stroke="#16a34a" strokeWidth="1.2"/>
    <path d="M22 28 Q20 32 23 38" stroke="rgba(255,255,255,0.3)" strokeWidth="1.2" fill="none" strokeLinecap="round"/>
    <rect x="21" y="8" width="6" height="4" rx="2" fill="rgba(22,163,74,0.5)"/>
    <ellipse cx="23" cy="10" rx="1.5" ry="2.5" fill="rgba(255,255,255,0.35)"/>
    <circle cx="24" cy="38" r="2" fill="rgba(34,197,94,0.5)"/>
  </>),

  "Dao Seed": (<>
    <defs><linearGradient id="dseed" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#d1fae5"/><stop offset="100%" stopColor="#059669"/></linearGradient></defs>
    <ellipse cx="24" cy="28" rx="9" ry="11" fill="url(#dseed)" stroke="#22c55e" strokeWidth="1.5"/>
    <path d="M24 20 L24 8" stroke="#16a34a" strokeWidth="2" strokeLinecap="round"/>
    <path d="M24 14 Q18 11 15 14" stroke="#22c55e" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
    <path d="M24 11 Q30 8 33 11" stroke="#22c55e" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
    <ellipse cx="22" cy="26" rx="2.5" ry="4" fill="rgba(255,255,255,0.3)" transform="rotate(-10 22 26)"/>
    <circle cx="24" cy="8" r="2" fill="#22c55e" opacity={0.7}/>
  </>),

  "Cultivation Manual Fragment": (<>
    <defs><linearGradient id="cmf" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#f0fdf4"/><stop offset="100%" stopColor="#bbf7d0"/></linearGradient></defs>
    <rect x="10" y="8" width="28" height="36" rx="3" fill="url(#cmf)" stroke="#22c55e" strokeWidth="1.5"/>
    <rect x="10" y="8" width="6" height="36" rx="3" fill="rgba(22,163,74,0.35)" stroke="#22c55e" strokeWidth="0.5"/>
    <path d="M20 17 L34 17" stroke="#22c55e" strokeWidth="1" opacity={0.6}/>
    <path d="M20 21 L34 21" stroke="#22c55e" strokeWidth="1" opacity={0.5}/>
    <path d="M20 25 L34 25" stroke="#22c55e" strokeWidth="0.9" opacity={0.4}/>
    <path d="M20 29 L34 29" stroke="#22c55e" strokeWidth="0.9" opacity={0.35}/>
    <path d="M20 33 L30 33" stroke="#22c55e" strokeWidth="0.8" opacity={0.3}/>
    <path d="M32 38 L35 42 M36 36 L40 38" stroke="#22c55e" strokeWidth="1.2" strokeLinecap="round" opacity={0.5}/>
  </>),

  // ════════════════════════════════════════════════════════
  //  RARE TREASURES
  // ════════════════════════════════════════════════════════

  "High Grade Spirit Stone": (<>
    <defs><linearGradient id="hgss" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#bfdbfe"/><stop offset="40%" stopColor="#3b82f6"/><stop offset="100%" stopColor="#1e3a8a"/></linearGradient></defs>
    <path d="M24 6 L38 20 L24 42 L10 20 Z" fill="url(#hgss)" stroke="#3b82f6" strokeWidth="1.5" strokeLinejoin="round"/>
    <path d="M24 6 L31 20 L24 42 L17 20 Z" fill="rgba(255,255,255,0.2)"/>
    <line x1="10" y1="20" x2="38" y2="20" stroke="rgba(255,255,255,0.4)" strokeWidth="1.2"/>
    <path d="M15 13 L24 6 L33 13" stroke="rgba(255,255,255,0.55)" strokeWidth="1.2" fill="none"/>
    <circle cx="24" cy="6" r="2.5" fill="rgba(255,255,255,0.85)"/>
    <circle cx="19" cy="13" r="1.5" fill="rgba(255,255,255,0.4)"/>
    <circle cx="29" cy="13" r="1.5" fill="rgba(255,255,255,0.4)"/>
  </>),

  "Bronze Alchemy Cauldron": (<>
    <defs><linearGradient id="bac" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#fed7aa"/><stop offset="100%" stopColor="#92400e"/></linearGradient></defs>
    <path d="M14 18 Q12 26 14 34 L34 34 Q36 26 34 18 Z" fill="rgba(180,83,9,0.15)" stroke="#b45309" strokeWidth="1.5"/>
    <ellipse cx="24" cy="18" rx="10" ry="4" fill="rgba(217,119,6,0.3)" stroke="#b45309" strokeWidth="1.5"/>
    <path d="M18 14 L18 10 Q18 8 20 8 L28 8 Q30 8 30 10 L30 14" stroke="#b45309" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
    <path d="M12 22 Q8 22 8 26 Q8 30 12 30" stroke="#b45309" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
    <path d="M36 22 Q40 22 40 26 Q40 30 36 30" stroke="#b45309" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
    <line x1="18" y1="34" x2="16" y2="40" stroke="#92400e" strokeWidth="2" strokeLinecap="round"/>
    <line x1="30" y1="34" x2="32" y2="40" stroke="#92400e" strokeWidth="2" strokeLinecap="round"/>
    <path d="M19 24 Q24 19 29 24" stroke="#f59e0b" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
    <circle cx="24" cy="18" r="2" fill="#fcd34d" opacity={0.6}/>
  </>),

  "Spirit Ring": (<>
    <defs>
      <linearGradient id="sring1" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#e0e7ff"/><stop offset="100%" stopColor="#1e40af"/></linearGradient>
      <radialGradient id="sring2" cx="35%" cy="30%" r="65%"><stop offset="0%" stopColor="#93c5fd"/><stop offset="100%" stopColor="#1d4ed8"/></radialGradient>
    </defs>
    <circle cx="24" cy="27" r="12" fill="none" stroke="#3b82f6" strokeWidth="4"/>
    <circle cx="24" cy="27" r="9" fill="rgba(59,130,246,0.06)"/>
    <circle cx="24" cy="27" r="12" fill="none" stroke="#bfdbfe" strokeWidth="1.5" opacity={0.5}/>
    <circle cx="24" cy="15" r="5.5" fill="url(#sring2)" stroke="#2563eb" strokeWidth="1.3"/>
    <ellipse cx="22" cy="13" rx="2" ry="2.5" fill="rgba(255,255,255,0.5)" transform="rotate(-20 22 13)"/>
    <circle cx="24" cy="15" r="2.5" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="0.8"/>
    <circle cx="24" cy="15" r="1.2" fill="rgba(255,255,255,0.7)"/>
  </>),

  "Mountain Suppressing Seal": (<>
    <defs><linearGradient id="mss" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#bfdbfe"/><stop offset="100%" stopColor="#1e3a8a"/></linearGradient></defs>
    <rect x="10" y="28" width="28" height="12" rx="3" fill="url(#mss)" stroke="#3b82f6" strokeWidth="1.5"/>
    <path d="M10 28 L16 14 L24 22 L32 10 L38 28 Z" fill="rgba(59,130,246,0.18)" stroke="#3b82f6" strokeWidth="1.5" strokeLinejoin="round"/>
    <circle cx="16" cy="14" r="2.5" fill="#3b82f6"/>
    <circle cx="32" cy="10" r="2.5" fill="#3b82f6"/>
    <path d="M14 34 Q24 30 34 34" stroke="rgba(255,255,255,0.4)" strokeWidth="0.8" fill="none"/>
    <rect x="21" y="31" width="6" height="6" rx="1" fill="rgba(59,130,246,0.4)"/>
  </>),

  "Heaven Defying Talisman": (<>
    <defs><linearGradient id="hdt" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#eff6ff"/><stop offset="100%" stopColor="#bfdbfe"/></linearGradient></defs>
    <rect x="14" y="8" width="20" height="30" rx="2" fill="url(#hdt)" stroke="#3b82f6" strokeWidth="1.5"/>
    <rect x="14" y="8" width="20" height="4" rx="2" fill="rgba(59,130,246,0.3)"/>
    <line x1="14" y1="14" x2="34" y2="14" stroke="#3b82f6" strokeWidth="0.8" opacity={0.5}/>
    <line x1="14" y1="32" x2="34" y2="32" stroke="#3b82f6" strokeWidth="0.8" opacity={0.5}/>
    <path d="M27 16 L23 22 L26 22 L21 30" stroke="#3b82f6" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
    <circle cx="24" cy="24" r="5" fill="none" stroke="rgba(59,130,246,0.4)" strokeWidth="0.8"/>
    <line x1="22" y1="36" x2="21" y2="42" stroke="#3b82f6" strokeWidth="1.5" strokeLinecap="round" opacity={0.6}/>
    <line x1="24" y1="36" x2="24" y2="42" stroke="#3b82f6" strokeWidth="1.5" strokeLinecap="round" opacity={0.6}/>
    <line x1="26" y1="36" x2="27" y2="42" stroke="#3b82f6" strokeWidth="1.5" strokeLinecap="round" opacity={0.6}/>
  </>),

  "Ten Thousand Year Spirit Milk": (<>
    <defs><linearGradient id="tysm" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#f8fafc"/><stop offset="100%" stopColor="#bfdbfe"/></linearGradient></defs>
    <path d="M19 10 Q17 14 16 18 Q14 26 18 34 L30 34 Q34 26 32 18 Q31 14 29 10 Z" fill="url(#tysm)" stroke="#3b82f6" strokeWidth="1.5"/>
    <path d="M18 10 L30 10" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round"/>
    <path d="M22 8 L26 8" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round"/>
    <ellipse cx="21" cy="22" rx="2" ry="4.5" fill="rgba(255,255,255,0.5)" transform="rotate(-10 21 22)"/>
    <path d="M21 28 Q24 25 27 28" stroke="#3b82f6" strokeWidth="1" fill="none" strokeLinecap="round" opacity={0.5}/>
    <circle cx="27" cy="16" r="1.5" fill="rgba(255,255,255,0.7)"/>
  </>),

  "Void Essence": (<>
    <defs><radialGradient id="vess" cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor="#e0e7ff"/><stop offset="60%" stopColor="#6366f1"/><stop offset="100%" stopColor="#1e1b4b"/></radialGradient></defs>
    <circle cx="24" cy="24" r="14" fill="rgba(99,102,241,0.08)" stroke="#6366f1" strokeWidth="1" strokeDasharray="3 2"/>
    <path d="M24 14 Q30 18 28 24 Q26 30 20 28 Q14 26 16 20 Q18 14 24 14Z" fill="rgba(99,102,241,0.2)" stroke="#6366f1" strokeWidth="1.3"/>
    <path d="M24 18 Q28 20 26 24 Q24 28 20 26 Q16 24 18 20 Q20 16 24 18Z" fill="rgba(139,92,246,0.25)" stroke="#8b5cf6" strokeWidth="1.1"/>
    <circle cx="24" cy="24" r="4" fill="url(#vess)"/>
    <circle cx="24" cy="24" r="1.8" fill="white" opacity={0.9}/>
    <circle cx="20" cy="16" r="1.2" fill="#a5b4fc" opacity={0.6}/>
    <circle cx="30" cy="20" r="1" fill="#c7d2fe" opacity={0.5}/>
  </>),

  "Cultivation Ring": (<>
    <defs>
      <linearGradient id="cring1" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="#bfdbfe"/><stop offset="50%" stopColor="#60a5fa"/><stop offset="100%" stopColor="#bfdbfe"/></linearGradient>
      <radialGradient id="cring2" cx="35%" cy="30%" r="65%"><stop offset="0%" stopColor="#a5f3fc"/><stop offset="100%" stopColor="#0369a1"/></radialGradient>
    </defs>
    <circle cx="24" cy="28" r="12" fill="none" stroke="#3b82f6" strokeWidth="4.5"/>
    <circle cx="24" cy="28" r="9" fill="rgba(59,130,246,0.06)"/>
    <circle cx="24" cy="28" r="12" fill="none" stroke="#93c5fd" strokeWidth="1.5" opacity={0.4}/>
    <path d="M21 28 A3 3 0 1 1 27 28" fill="none" stroke="#bfdbfe" strokeWidth="1.2" opacity={0.6}/>
    <circle cx="24" cy="16" r="5" fill="url(#cring2)" stroke="#2563eb" strokeWidth="1.3"/>
    <circle cx="19" cy="20" r="2.5" fill="#93c5fd" stroke="#3b82f6" strokeWidth="1"/>
    <circle cx="29" cy="20" r="2.5" fill="#93c5fd" stroke="#3b82f6" strokeWidth="1"/>
    <ellipse cx="22.5" cy="14.5" rx="1.5" ry="2" fill="rgba(255,255,255,0.5)" transform="rotate(-20 22.5 14.5)"/>
    <circle cx="24" cy="16" r="1.3" fill="rgba(255,255,255,0.7)"/>
  </>),

  "Ancient Sect Manual": (<>
    <defs><linearGradient id="asm" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#eff6ff"/><stop offset="100%" stopColor="#bfdbfe"/></linearGradient></defs>
    <rect x="10" y="8" width="28" height="36" rx="3" fill="url(#asm)" stroke="#3b82f6" strokeWidth="1.5"/>
    <rect x="10" y="8" width="7" height="36" rx="3" fill="rgba(37,99,235,0.4)" stroke="#2563eb" strokeWidth="0.5"/>
    <path d="M21 16 L34 16" stroke="#3b82f6" strokeWidth="1" opacity={0.6}/>
    <path d="M21 20 L34 20" stroke="#3b82f6" strokeWidth="1" opacity={0.5}/>
    <path d="M21 24 L34 24" stroke="#3b82f6" strokeWidth="0.9" opacity={0.45}/>
    <path d="M21 28 L34 28" stroke="#3b82f6" strokeWidth="0.9" opacity={0.4}/>
    <path d="M21 32 L30 32" stroke="#3b82f6" strokeWidth="0.8" opacity={0.35}/>
    <path d="M24 38 L26 36 L28 38" stroke="#3b82f6" strokeWidth="1" strokeLinecap="round" fill="none" opacity={0.5}/>
  </>),

  "Spirit Bead Necklace": (<>
    <defs><radialGradient id="sbng" cx="35%" cy="30%" r="65%"><stop offset="0%" stopColor="#bfdbfe"/><stop offset="100%" stopColor="#1e40af"/></radialGradient></defs>
    <path d="M10 20 Q10 10 24 8 Q38 10 38 20 Q38 30 24 40 Q10 30 10 20Z" fill="none" stroke="#3b82f6" strokeWidth="0.7" strokeDasharray="2 3" opacity={0.4}/>
    <circle cx="24" cy="8" r="3" fill="url(#sbng)" stroke="#2563eb" strokeWidth="1"/>
    <circle cx="32" cy="11" r="3" fill="url(#sbng)" stroke="#2563eb" strokeWidth="1"/>
    <circle cx="37" cy="18" r="3" fill="url(#sbng)" stroke="#2563eb" strokeWidth="1"/>
    <circle cx="36" cy="27" r="3" fill="url(#sbng)" stroke="#2563eb" strokeWidth="1"/>
    <circle cx="30" cy="35" r="3" fill="url(#sbng)" stroke="#2563eb" strokeWidth="1"/>
    <circle cx="24" cy="38" r="3" fill="url(#sbng)" stroke="#2563eb" strokeWidth="1"/>
    <circle cx="18" cy="35" r="3" fill="url(#sbng)" stroke="#2563eb" strokeWidth="1"/>
    <circle cx="12" cy="27" r="3" fill="url(#sbng)" stroke="#2563eb" strokeWidth="1"/>
    <circle cx="11" cy="18" r="3" fill="url(#sbng)" stroke="#2563eb" strokeWidth="1"/>
    <circle cx="16" cy="11" r="3" fill="url(#sbng)" stroke="#2563eb" strokeWidth="1"/>
    <circle cx="23" cy="7.5" r="1" fill="rgba(255,255,255,0.6)"/>
    <circle cx="23" cy="37.5" r="1" fill="rgba(255,255,255,0.6)"/>
  </>),

  "Refining Furnace": (<>
    <defs><linearGradient id="rfurn" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#bfdbfe"/><stop offset="100%" stopColor="#7f1d1d"/></linearGradient></defs>
    <rect x="10" y="20" width="28" height="20" rx="3" fill="rgba(239,68,68,0.15)" stroke="#dc2626" strokeWidth="1.5"/>
    <ellipse cx="24" cy="20" rx="14" ry="5" fill="rgba(239,68,68,0.2)" stroke="#dc2626" strokeWidth="1.5"/>
    <path d="M32 8 Q36 12 34 16 L30 20 L28 18 L32 14 Q28 12 28 8 Z" fill="#ef4444" opacity={0.7}/>
    <path d="M20 6 Q16 10 18 14 L22 18 L20 20 L16 15 Q14 10 18 6 Z" fill="#f97316" opacity={0.6}/>
    <path d="M24 10 Q26 14 24 18 Q22 14 24 10Z" fill="#fde68a" opacity={0.8}/>
    <line x1="14" y1="28" x2="34" y2="28" stroke="rgba(220,38,38,0.4)" strokeWidth="1" opacity={0.5}/>
    <rect x="21" y="31" width="6" height="6" rx="1" fill="rgba(220,38,38,0.3)"/>
  </>),

  // ════════════════════════════════════════════════════════
  //  EPIC TREASURES
  // ════════════════════════════════════════════════════════

  "King Grade Spirit Stone": (<>
    <defs><linearGradient id="kgss" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#a5f3fc"/><stop offset="40%" stopColor="#22d3ee"/><stop offset="100%" stopColor="#0e7490"/></linearGradient></defs>
    <path d="M24 5 L40 20 L24 43 L8 20 Z" fill="url(#kgss)" stroke="#0891b2" strokeWidth="1.5" strokeLinejoin="round"/>
    <path d="M24 5 L32 20 L24 43 L16 20 Z" fill="rgba(255,255,255,0.22)"/>
    <line x1="8" y1="20" x2="40" y2="20" stroke="rgba(255,255,255,0.4)" strokeWidth="1.3"/>
    <path d="M13 12 L24 5 L35 12" stroke="rgba(255,255,255,0.55)" strokeWidth="1.2" fill="none"/>
    <circle cx="24" cy="5" r="3" fill="rgba(255,255,255,0.9)"/>
    <circle cx="17" cy="12" r="1.5" fill="rgba(255,255,255,0.45)"/>
    <circle cx="31" cy="12" r="1.5" fill="rgba(255,255,255,0.45)"/>
    <path d="M16" y1="20" x2="20" y2="28" stroke="rgba(255,255,255,0.2)" strokeWidth="0.8"/>
  </>),

  "Spirit Cauldron": (<>
    <defs><linearGradient id="scald" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#ede9fe"/><stop offset="100%" stopColor="#4c1d95"/></linearGradient></defs>
    <path d="M12 18 Q10 26 12 36 L36 36 Q38 26 36 18 Z" fill="rgba(139,92,246,0.12)" stroke="#7c3aed" strokeWidth="1.5"/>
    <ellipse cx="24" cy="18" rx="12" ry="5" fill="rgba(167,139,250,0.3)" stroke="#7c3aed" strokeWidth="1.5"/>
    <path d="M16 14 L16 10 Q16 8 18 8 L30 8 Q32 8 32 10 L32 14" stroke="#7c3aed" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
    <path d="M10 22 Q6 22 6 27 Q6 32 10 32" stroke="#7c3aed" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
    <path d="M38 22 Q42 22 42 27 Q42 32 38 32" stroke="#7c3aed" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
    <line x1="16" y1="36" x2="14" y2="42" stroke="#5b21b6" strokeWidth="2" strokeLinecap="round"/>
    <line x1="32" y1="36" x2="34" y2="42" stroke="#5b21b6" strokeWidth="2" strokeLinecap="round"/>
    <path d="M17 26 Q24 21 31 26" stroke="#c4b5fd" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
    <path d="M19 30 Q24 26 29 30" stroke="#a78bfa" strokeWidth="1" fill="none" strokeLinecap="round" opacity={0.6}/>
    <circle cx="24" cy="18" r="2.5" fill="#c4b5fd" opacity={0.7}/>
  </>),

  "Spatial Pouch": (<>
    <defs><linearGradient id="sptr" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#ede9fe"/><stop offset="100%" stopColor="#4c1d95"/></linearGradient></defs>
    <path d="M12 24 Q12 14 18 11 L30 11 Q36 14 36 24 Q36 36 24 40 Q12 36 12 24Z" fill="url(#sptr)" stroke="#8b5cf6" strokeWidth="1.5"/>
    <path d="M16 11 Q18 8 20 9 L22 11" stroke="#8b5cf6" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
    <path d="M32 11 Q30 8 28 9 L26 11" stroke="#8b5cf6" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
    <ellipse cx="22" cy="20" rx="4" ry="7" fill="rgba(196,181,253,0.35)" transform="rotate(-10 22 20)"/>
    <path d="M20 28 Q24 24 28 28" stroke="#c4b5fd" strokeWidth="1.2" fill="none" strokeLinecap="round"/>
    <circle cx="24" cy="32" r="2.5" fill="rgba(139,92,246,0.4)" stroke="#a78bfa" strokeWidth="0.8"/>
    <circle cx="24" cy="32" r="1" fill="#c4b5fd"/>
  </>),

  "Dao Fruit": (<>
    <defs>
      <radialGradient id="dfrut" cx="40%" cy="30%" r="65%"><stop offset="0%" stopColor="#fbcfe8"/><stop offset="100%" stopColor="#7c3aed"/></radialGradient>
    </defs>
    <path d="M24 40 Q14 34 12 24 Q10 14 18 10 Q24 8 30 10 Q38 14 36 24 Q34 34 24 40Z" fill="url(#dfrut)" stroke="#8b5cf6" strokeWidth="1.5"/>
    <path d="M24 8 Q26 4 28 5" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" fill="none"/>
    <path d="M22 8 Q18 4 16 6" stroke="#16a34a" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
    <ellipse cx="18" cy="22" rx="4" ry="6" fill="rgba(255,255,255,0.25)" transform="rotate(-20 18 22)"/>
    <path d="M20 32 Q24 29 28 32" stroke="rgba(255,255,255,0.4)" strokeWidth="1" fill="none" strokeLinecap="round"/>
    <circle cx="28" cy="18" r="2" fill="rgba(255,255,255,0.3)"/>
  </>),

  "Fate Sealing Talisman": (<>
    <defs><linearGradient id="fst" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#ede9fe"/><stop offset="100%" stopColor="#c4b5fd"/></linearGradient></defs>
    <rect x="14" y="8" width="20" height="30" rx="2" fill="url(#fst)" stroke="#8b5cf6" strokeWidth="1.5"/>
    <rect x="14" y="8" width="20" height="4" rx="2" fill="rgba(139,92,246,0.35)"/>
    <line x1="14" y1="14" x2="34" y2="14" stroke="#8b5cf6" strokeWidth="0.8" opacity={0.5}/>
    <line x1="14" y1="32" x2="34" y2="32" stroke="#8b5cf6" strokeWidth="0.8" opacity={0.5}/>
    <circle cx="24" cy="23" r="6" fill="none" stroke="#8b5cf6" strokeWidth="1.2"/>
    <circle cx="24" cy="23" r="3" fill="rgba(139,92,246,0.3)"/>
    <path d="M24 16 L24 17" stroke="#8b5cf6" strokeWidth="1.2" strokeLinecap="round"/>
    <path d="M24 29 L24 30" stroke="#8b5cf6" strokeWidth="1.2" strokeLinecap="round"/>
    <path d="M17 23 L18 23" stroke="#8b5cf6" strokeWidth="1.2" strokeLinecap="round"/>
    <path d="M30 23 L31 23" stroke="#8b5cf6" strokeWidth="1.2" strokeLinecap="round"/>
    <line x1="22" y1="36" x2="21" y2="42" stroke="#8b5cf6" strokeWidth="1.5" strokeLinecap="round" opacity={0.6}/>
    <line x1="24" y1="36" x2="24" y2="42" stroke="#8b5cf6" strokeWidth="1.5" strokeLinecap="round" opacity={0.6}/>
    <line x1="26" y1="36" x2="27" y2="42" stroke="#8b5cf6" strokeWidth="1.5" strokeLinecap="round" opacity={0.6}/>
  </>),

  "Heaven Locking Seal": (<>
    <defs><linearGradient id="hls" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#ede9fe"/><stop offset="100%" stopColor="#5b21b6"/></linearGradient></defs>
    <rect x="10" y="16" width="28" height="24" rx="3" fill="url(#hls)" stroke="#7c3aed" strokeWidth="1.5"/>
    <path d="M16 16 L16 11 Q16 8 24 8 Q32 8 32 11 L32 16" stroke="#7c3aed" strokeWidth="2" fill="none" strokeLinecap="round"/>
    <rect x="17" y="11" width="14" height="7" rx="1" fill="rgba(139,92,246,0.2)" stroke="#8b5cf6" strokeWidth="0.8"/>
    <circle cx="24" cy="26" r="5" fill="rgba(139,92,246,0.3)" stroke="#8b5cf6" strokeWidth="1.3"/>
    <path d="M24 22 L24 26" stroke="#c4b5fd" strokeWidth="2" strokeLinecap="round"/>
    <circle cx="24" cy="28.5" r="1.5" fill="#a78bfa"/>
    <line x1="14" y1="22" x2="34" y2="22" stroke="rgba(139,92,246,0.3)" strokeWidth="0.8" opacity={0.5}/>
  </>),

  "Heavenly Tribulation Stone": (<>
    <defs>
      <linearGradient id="hts" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#c4b5fd"/><stop offset="100%" stopColor="#1a1a2e"/></linearGradient>
    </defs>
    <path d="M24 6 L38 20 L32 38 L16 38 L10 20 Z" fill="url(#hts)" stroke="#7c3aed" strokeWidth="1.5" strokeLinejoin="round"/>
    <path d="M24 6 L32 20 L28 38 L20 38 L16 20 Z" fill="rgba(255,255,255,0.12)"/>
    <path d="M28 10 L24 16 L27 16 L22 24" stroke="rgba(253,230,138,0.9)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
    <circle cx="24" cy="32" r="3" fill="rgba(139,92,246,0.4)" stroke="#a78bfa" strokeWidth="1"/>
    <circle cx="24" cy="32" r="1.3" fill="#c4b5fd"/>
  </>),

  "Karma Beads": (<>
    <defs><radialGradient id="kbdg" cx="35%" cy="30%" r="65%"><stop offset="0%" stopColor="#ede9fe"/><stop offset="100%" stopColor="#5b21b6"/></radialGradient></defs>
    <circle cx="24" cy="24" r="14" fill="none" stroke="#8b5cf6" strokeWidth="0.8" strokeDasharray="2 2" opacity={0.5}/>
    <circle cx="24" cy="10" r="4" fill="url(#kbdg)" stroke="#7c3aed" strokeWidth="1.1"/>
    <circle cx="33" cy="14" r="4" fill="url(#kbdg)" stroke="#7c3aed" strokeWidth="1.1"/>
    <circle cx="38" cy="24" r="4" fill="url(#kbdg)" stroke="#7c3aed" strokeWidth="1.1"/>
    <circle cx="33" cy="34" r="4" fill="url(#kbdg)" stroke="#7c3aed" strokeWidth="1.1"/>
    <circle cx="24" cy="38" r="4" fill="url(#kbdg)" stroke="#7c3aed" strokeWidth="1.1"/>
    <circle cx="15" cy="34" r="4" fill="url(#kbdg)" stroke="#7c3aed" strokeWidth="1.1"/>
    <circle cx="10" cy="24" r="4" fill="url(#kbdg)" stroke="#7c3aed" strokeWidth="1.1"/>
    <circle cx="15" cy="14" r="4" fill="url(#kbdg)" stroke="#7c3aed" strokeWidth="1.1"/>
    <circle cx="23" cy="9.5" r="1.2" fill="rgba(255,255,255,0.55)"/>
    <circle cx="23" cy="37.5" r="1.2" fill="rgba(255,255,255,0.55)"/>
    <path d="M22 24 Q24 22 26 24 Q24 26 22 24Z" fill="#8b5cf6" stroke="#c4b5fd" strokeWidth="0.5"/>
    <circle cx="24" cy="24" r="4" fill="rgba(139,92,246,0.2)" stroke="#8b5cf6" strokeWidth="1"/>
  </>),

  "Nine Dragon Beads": (<>
    <defs>
      <radialGradient id="ndbg" cx="35%" cy="30%" r="60%"><stop offset="0%" stopColor="#c4b5fd"/><stop offset="100%" stopColor="#5b21b6"/></radialGradient>
      <radialGradient id="ndcg" cx="35%" cy="30%" r="60%"><stop offset="0%" stopColor="#fde68a"/><stop offset="100%" stopColor="#d97706"/></radialGradient>
    </defs>
    <circle cx="24" cy="24" r="14" fill="none" stroke="#8b5cf6" strokeWidth="0.8" strokeDasharray="3 2" opacity={0.6}/>
    <circle cx="24" cy="10" r="4" fill="url(#ndbg)" stroke="#7c3aed" strokeWidth="1.1"/>
    <circle cx="33" cy="14" r="4" fill="url(#ndbg)" stroke="#7c3aed" strokeWidth="1.1"/>
    <circle cx="38" cy="24" r="4" fill="url(#ndbg)" stroke="#7c3aed" strokeWidth="1.1"/>
    <circle cx="33" cy="34" r="4" fill="url(#ndbg)" stroke="#7c3aed" strokeWidth="1.1"/>
    <circle cx="24" cy="38" r="4" fill="url(#ndbg)" stroke="#7c3aed" strokeWidth="1.1"/>
    <circle cx="15" cy="34" r="4" fill="url(#ndbg)" stroke="#7c3aed" strokeWidth="1.1"/>
    <circle cx="10" cy="24" r="4" fill="url(#ndbg)" stroke="#7c3aed" strokeWidth="1.1"/>
    <circle cx="15" cy="14" r="4" fill="url(#ndbg)" stroke="#7c3aed" strokeWidth="1.1"/>
    <circle cx="23" cy="9.5" r="1.2" fill="rgba(255,255,255,0.55)"/>
    <circle cx="32.5" cy="13.5" r="1.2" fill="rgba(255,255,255,0.55)"/>
    <circle cx="23" cy="37.5" r="1.2" fill="rgba(255,255,255,0.55)"/>
    <circle cx="24" cy="24" r="5" fill="url(#ndcg)" stroke="#b45309" strokeWidth="1.3"/>
    <circle cx="23" cy="23" r="1.8" fill="rgba(255,255,255,0.6)"/>
  </>),

  "Ancestral Seal": (<>
    <defs><linearGradient id="ancs" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#ede9fe"/><stop offset="100%" stopColor="#4c1d95"/></linearGradient></defs>
    <rect x="10" y="12" width="28" height="28" rx="3" fill="url(#ancs)" stroke="#8b5cf6" strokeWidth="1.5"/>
    <rect x="10" y="12" width="28" height="7" rx="3" fill="rgba(139,92,246,0.3)"/>
    <path d="M14 22 L34 22" stroke="#a78bfa" strokeWidth="0.8" opacity={0.5}/>
    <path d="M14 34 L34 34" stroke="#a78bfa" strokeWidth="0.8" opacity={0.5}/>
    <path d="M24 24 L25.5 28 L29.5 28 L26.5 30.5 L27.5 34.5 L24 32 L20.5 34.5 L21.5 30.5 L18.5 28 L22.5 28 Z" fill="rgba(196,181,253,0.6)" stroke="#a78bfa" strokeWidth="0.8"/>
    <line x1="16" y1="38" x2="15" y2="44" stroke="#7c3aed" strokeWidth="1.8" strokeLinecap="round"/>
    <line x1="24" y1="38" x2="24" y2="44" stroke="#7c3aed" strokeWidth="1.8" strokeLinecap="round"/>
    <line x1="32" y1="38" x2="33" y2="44" stroke="#7c3aed" strokeWidth="1.8" strokeLinecap="round"/>
  </>),

  "Space Tear Fragment": (<>
    <defs>
      <radialGradient id="stf" cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor="#1a1a2e"/><stop offset="50%" stopColor="#4c1d95"/><stop offset="100%" stopColor="#ede9fe"/></radialGradient>
    </defs>
    <path d="M14 14 L34 14 Q38 14 38 18 L38 30 Q38 34 34 34 L14 34 Q10 34 10 30 L10 18 Q10 14 14 14Z" fill="url(#stf)" stroke="#8b5cf6" strokeWidth="1.5"/>
    <path d="M20 20 Q24 16 28 20 Q32 24 28 28 Q24 32 20 28 Q16 24 20 20Z" fill="none" stroke="#c4b5fd" strokeWidth="1" strokeDasharray="2 2" opacity={0.8}/>
    <path d="M22 22 Q24 20 26 22 Q28 24 26 26 Q24 28 22 26 Q20 24 22 22Z" fill="rgba(255,255,255,0.1)" stroke="#e9d5ff" strokeWidth="1"/>
    <circle cx="24" cy="24" r="2.5" fill="rgba(196,181,253,0.4)"/>
    <circle cx="19" cy="19" r="1.5" fill="#c4b5fd" opacity={0.6}/>
    <circle cx="30" cy="18" r="1.2" fill="#c4b5fd" opacity={0.5}/>
    <circle cx="29" cy="30" r="1" fill="#c4b5fd" opacity={0.4}/>
  </>),

  "Soul Binding Ring": (<>
    <defs>
      <linearGradient id="sbring" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#1e1b4b"/><stop offset="100%" stopColor="#4c1d95"/></linearGradient>
      <radialGradient id="sbrgem" cx="35%" cy="30%" r="65%"><stop offset="0%" stopColor="#a78bfa"/><stop offset="100%" stopColor="#3b0764"/></radialGradient>
    </defs>
    <circle cx="24" cy="28" r="13" fill="none" stroke="#7c3aed" strokeWidth="5.5"/>
    <circle cx="24" cy="28" r="9" fill="rgba(76,29,149,0.08)"/>
    <circle cx="24" cy="28" r="13" fill="none" stroke="#4c1d95" strokeWidth="2" opacity={0.5}/>
    <path d="M17 22 Q19 20 21 22 Q19 24 17 22Z" fill="#7c3aed" opacity={0.7}/>
    <path d="M27 22 Q29 20 31 22 Q29 24 27 22Z" fill="#7c3aed" opacity={0.7}/>
    <path d="M19 22 Q22 21 24 21 Q26 21 29 22" stroke="#a78bfa" strokeWidth="0.8" fill="none" opacity={0.5}/>
    <circle cx="24" cy="15" r="6" fill="url(#sbrgem)" stroke="#6d28d9" strokeWidth="1.5"/>
    <ellipse cx="22" cy="13" rx="2" ry="2.5" fill="rgba(255,255,255,0.3)" transform="rotate(-20 22 13)"/>
    <path d="M21 13 Q24 11 27 13" stroke="rgba(196,181,253,0.5)" strokeWidth="0.8" fill="none"/>
    <circle cx="24" cy="15" r="2" fill="rgba(196,181,253,0.5)" stroke="#a78bfa" strokeWidth="0.8"/>
    <circle cx="24" cy="15" r="0.8" fill="rgba(255,255,255,0.6)"/>
  </>),

  "Void Ring": (<>
    <defs>
      <radialGradient id="vrng1" cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor="#ede9fe"/><stop offset="40%" stopColor="#6d28d9"/><stop offset="100%" stopColor="#1a1a2e"/></radialGradient>
      <radialGradient id="vrgem" cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor="#020617"/><stop offset="60%" stopColor="#1e1b4b"/><stop offset="100%" stopColor="#4c1d95"/></radialGradient>
    </defs>
    <circle cx="24" cy="28" r="12" fill="none" stroke="#8b5cf6" strokeWidth="4.5"/>
    <circle cx="24" cy="28" r="8.5" fill="none" stroke="#c4b5fd" strokeWidth="1" opacity={0.3}/>
    <path d="M20 28 A4 4 0 1 1 28 28 A4 4 0 0 1 20 28" fill="none" stroke="#6d28d9" strokeWidth="1.5" strokeDasharray="3 2"/>
    <circle cx="24" cy="16" r="6.5" fill="url(#vrgem)" stroke="#8b5cf6" strokeWidth="1.5"/>
    <circle cx="24" cy="16" r="4" fill="none" stroke="#a78bfa" strokeWidth="0.8" opacity={0.6}/>
    <circle cx="24" cy="16" r="2" fill="rgba(139,92,246,0.3)" stroke="#c4b5fd" strokeWidth="0.8"/>
    <circle cx="22" cy="14" r="1.5" fill="rgba(196,181,253,0.35)"/>
    <circle cx="24" cy="16" r="0.8" fill="rgba(255,255,255,0.5)"/>
    <circle cx="20" cy="12" r="1" fill="#a78bfa" opacity={0.6}/>
    <circle cx="28" cy="12" r="0.8" fill="#a78bfa" opacity={0.5}/>
  </>),

  "Phoenix Feather": (<>
    <defs><linearGradient id="pfth" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#fde68a"/><stop offset="50%" stopColor="#ef4444"/><stop offset="100%" stopColor="#ede9fe"/></linearGradient></defs>
    <path d="M24 40 Q16 30 14 20 Q14 10 20 8 Q26 10 26 20 Q26 30 24 40Z" fill="url(#pfth)" stroke="#f59e0b" strokeWidth="1.3"/>
    <path d="M26 36 Q34 26 36 16 Q36 8 30 8 Q24 10 24 20 Q24 30 26 36Z" fill="rgba(245,158,11,0.4)" stroke="#ef4444" strokeWidth="1.2"/>
    <path d="M24 40 Q22 34 20 28 Q22 26 24 30 Q26 26 28 28 Q26 34 24 40Z" fill="rgba(255,255,255,0.2)"/>
    <path d="M20 20 Q22 18 24 20" stroke="rgba(255,255,255,0.4)" strokeWidth="0.8" fill="none"/>
    <path d="M24 16 Q26 14 28 16" stroke="rgba(255,255,255,0.35)" strokeWidth="0.8" fill="none"/>
    <path d="M22 12 Q24 10 26 12" stroke="rgba(255,220,100,0.5)" strokeWidth="0.8" fill="none"/>
    <circle cx="24" cy="8" r="2.5" fill="rgba(253,230,138,0.7)" stroke="#f59e0b" strokeWidth="1"/>
  </>),

  "Dragon Scale": (<>
    <defs><linearGradient id="drscl" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#bbf7d0"/><stop offset="50%" stopColor="#0891b2"/><stop offset="100%" stopColor="#164e63"/></linearGradient></defs>
    <path d="M12 12 Q16 8 24 8 Q32 8 36 12 L34 24 Q32 34 24 40 Q16 34 14 24 Z" fill="url(#drscl)" stroke="#0369a1" strokeWidth="1.5"/>
    <path d="M14 18 Q18 14 24 14 Q30 14 34 18" fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.3)" strokeWidth="0.8"/>
    <path d="M13 24 Q16 20 24 20 Q32 20 35 24" fill="rgba(255,255,255,0.1)" stroke="rgba(255,255,255,0.25)" strokeWidth="0.8"/>
    <path d="M14 30 Q18 26 24 26 Q30 26 34 30" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.2)" strokeWidth="0.8"/>
    <ellipse cx="18" cy="16" rx="3" ry="4.5" fill="rgba(255,255,255,0.25)" transform="rotate(-15 18 16)"/>
    <circle cx="24" cy="8" r="2" fill="rgba(255,255,255,0.6)"/>
    <path d="M28 32 L30 36" stroke="rgba(255,255,255,0.3)" strokeWidth="0.8" strokeLinecap="round"/>
  </>),

  // ════════════════════════════════════════════════════════
  //  MYTHIC TREASURES
  // ════════════════════════════════════════════════════════

  "Emperor Grade Spirit Stone": (<>
    <defs>
      <linearGradient id="egss" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#fef3c7"/><stop offset="40%" stopColor="#fbbf24"/><stop offset="100%" stopColor="#78350f"/></linearGradient>
      <radialGradient id="egss2" cx="50%" cy="30%" r="60%"><stop offset="0%" stopColor="#fef9e7" stopOpacity="0.9"/><stop offset="100%" stopColor="#f59e0b" stopOpacity="0"/></radialGradient>
    </defs>
    <circle cx="24" cy="24" r="16" fill="url(#egss2)" opacity={0.5}/>
    <path d="M24 4 L42 20 L24 44 L6 20 Z" fill="url(#egss)" stroke="#f59e0b" strokeWidth="1.5" strokeLinejoin="round"/>
    <path d="M24 4 L33 20 L24 44 L15 20 Z" fill="rgba(255,255,255,0.2)"/>
    <line x1="6" y1="20" x2="42" y2="20" stroke="rgba(255,255,255,0.4)" strokeWidth="1.4"/>
    <path d="M12 12 L24 4 L36 12" stroke="rgba(255,255,255,0.6)" strokeWidth="1.4" fill="none"/>
    <circle cx="24" cy="4" r="3.5" fill="rgba(255,255,255,0.95)"/>
    <circle cx="15" cy="12" r="2" fill="rgba(255,255,255,0.5)"/>
    <circle cx="33" cy="12" r="2" fill="rgba(255,255,255,0.5)"/>
    <path d="M17" y1="20" x2="20" y2="28" stroke="rgba(255,255,255,0.2)" strokeWidth="0.8"/>
    <path d="M28" y1="20" x2="31" y2="28" stroke="rgba(255,255,255,0.15)" strokeWidth="0.8"/>
  </>),

  "Heaven Cauldron": (<>
    <defs>
      <linearGradient id="hcald" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#fde68a"/><stop offset="100%" stopColor="#78350f"/></linearGradient>
      <radialGradient id="hcald2" cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor="#fef3c7" stopOpacity="0.8"/><stop offset="100%" stopColor="#f59e0b" stopOpacity="0"/></radialGradient>
    </defs>
    <circle cx="24" cy="22" r="14" fill="url(#hcald2)"/>
    <path d="M10 18 Q8 26 10 36 L38 36 Q40 26 38 18 Z" fill="rgba(245,158,11,0.12)" stroke="#d97706" strokeWidth="1.5"/>
    <ellipse cx="24" cy="18" rx="14" ry="6" fill="rgba(253,230,138,0.35)" stroke="#d97706" strokeWidth="1.5"/>
    <path d="M16 14 L16 10 Q16 8 18 8 L30 8 Q32 8 32 10 L32 14" stroke="#d97706" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
    <path d="M8 22 Q4 22 4 27 Q4 32 8 32" stroke="#d97706" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
    <path d="M40 22 Q44 22 44 27 Q44 32 40 32" stroke="#d97706" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
    <line x1="14" y1="36" x2="12" y2="42" stroke="#78350f" strokeWidth="2" strokeLinecap="round"/>
    <line x1="34" y1="36" x2="36" y2="42" stroke="#78350f" strokeWidth="2" strokeLinecap="round"/>
    <path d="M17 26 Q24 20 31 26" stroke="#fbbf24" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
    <path d="M18 30 Q24 25 30 30" stroke="#fcd34d" strokeWidth="1.2" fill="none" strokeLinecap="round" opacity={0.7}/>
    <circle cx="24" cy="18" r="3" fill="#fde68a" opacity={0.8}/>
    <circle cx="24" cy="18" r="1.2" fill="white" opacity={0.8}/>
  </>),

  "Immortal Storage Ring": (<>
    <defs>
      <linearGradient id="isrng" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="#fde68a"/><stop offset="50%" stopColor="#f59e0b"/><stop offset="100%" stopColor="#fde68a"/></linearGradient>
      <radialGradient id="isrgem" cx="35%" cy="30%" r="65%"><stop offset="0%" stopColor="#fef3c7"/><stop offset="40%" stopColor="#fbbf24"/><stop offset="100%" stopColor="#d97706"/></radialGradient>
    </defs>
    <circle cx="24" cy="29" r="13" fill="none" stroke="#f59e0b" strokeWidth="5"/>
    <circle cx="24" cy="29" r="9.5" fill="none" stroke="#fde68a" strokeWidth="2.5"/>
    <circle cx="24" cy="29" r="6" fill="rgba(245,158,11,0.08)"/>
    <circle cx="24" cy="29" r="13" fill="none" stroke="#fef3c7" strokeWidth="1" opacity={0.4}/>
    <path d="M18 25 Q20 23 22 25 Q20 27 18 25Z" fill="#f59e0b" opacity={0.5}/>
    <path d="M26 25 Q28 23 30 25 Q28 27 26 25Z" fill="#f59e0b" opacity={0.5}/>
    <circle cx="24" cy="16" r="7" fill="url(#isrgem)" stroke="#d97706" strokeWidth="1.5"/>
    <circle cx="24" cy="16" r="5" fill="none" stroke="rgba(253,230,138,0.6)" strokeWidth="0.8"/>
    <ellipse cx="21.5" cy="14" rx="2.5" ry="3" fill="rgba(255,255,255,0.5)" transform="rotate(-20 21.5 14)"/>
    <circle cx="24" cy="16" r="2" fill="rgba(255,255,255,0.6)" stroke="rgba(253,230,138,0.9)" strokeWidth="0.8"/>
    <circle cx="24" cy="16" r="0.8" fill="white" opacity={0.95}/>
    <circle cx="18" cy="21" r="1.5" fill="#fcd34d" stroke="#d97706" strokeWidth="0.8"/>
    <circle cx="30" cy="21" r="1.5" fill="#fcd34d" stroke="#d97706" strokeWidth="0.8"/>
  </>),

  "Heaven's Mirror": (<>
    <defs><radialGradient id="hmirr" cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor="#fef9e7"/><stop offset="50%" stopColor="#fde68a"/><stop offset="100%" stopColor="#d97706"/></radialGradient></defs>
    <ellipse cx="24" cy="26" rx="14" ry="15" fill="url(#hmirr)" stroke="#f59e0b" strokeWidth="1.5"/>
    <ellipse cx="24" cy="26" rx="11" ry="12" fill="rgba(255,255,255,0.25)" stroke="rgba(253,230,138,0.6)" strokeWidth="0.8"/>
    <ellipse cx="20" cy="22" rx="5" ry="7" fill="rgba(255,255,255,0.3)" transform="rotate(-20 20 22)"/>
    <line x1="22" y1="8" x2="26" y2="8" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round"/>
    <rect x="21" y="8" width="6" height="4" rx="1" fill="#d97706" stroke="#f59e0b" strokeWidth="1"/>
    <path d="M18 40 Q18 44 20 44 L28 44 Q30 44 30 40" fill="#d97706" stroke="#f59e0b" strokeWidth="1.2"/>
    <circle cx="24" cy="22" r="4" fill="rgba(255,255,255,0.15)" stroke="rgba(253,230,138,0.4)" strokeWidth="0.6"/>
  </>),

  "Qilin Horn Fragment": (<>
    <defs><linearGradient id="qhf" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#fef3c7"/><stop offset="100%" stopColor="#f59e0b"/></linearGradient></defs>
    <path d="M24 6 Q30 10 32 18 Q34 26 30 34 Q26 40 24 42 Q22 40 20 34 Q16 26 18 18 Q20 10 24 6Z" fill="url(#qhf)" stroke="#d97706" strokeWidth="1.5"/>
    <path d="M24 6 Q26 10 27 16 Q28 22 26 28 Q25 32 24 34" stroke="rgba(255,255,255,0.4)" strokeWidth="1" fill="none" strokeLinecap="round"/>
    <path d="M30 14 Q34 12 36 8" stroke="#f59e0b" strokeWidth="1.2" fill="none" strokeLinecap="round" opacity={0.7}/>
    <path d="M18 14 Q14 12 12 8" stroke="#f59e0b" strokeWidth="1.2" fill="none" strokeLinecap="round" opacity={0.6}/>
    <ellipse cx="21" cy="18" rx="3" ry="5" fill="rgba(255,255,255,0.3)" transform="rotate(-10 21 18)"/>
    <circle cx="24" cy="6" r="2.5" fill="rgba(255,255,255,0.8)"/>
  </>),

  "Nine Heavens Tribulation Crystal": (<>
    <defs>
      <linearGradient id="nhtc" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#fef3c7"/><stop offset="100%" stopColor="#1a1a2e"/></linearGradient>
    </defs>
    <path d="M24 6 L38 22 L32 40 L16 40 L10 22 Z" fill="url(#nhtc)" stroke="#f59e0b" strokeWidth="1.5" strokeLinejoin="round"/>
    <path d="M24 6 L32 22 L28 40 L20 40 L16 22 Z" fill="rgba(255,255,255,0.12)"/>
    <path d="M29 12 L25 18 L28 18 L23 26" stroke="rgba(253,230,138,0.9)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
    <circle cx="24" cy="34" r="3.5" fill="rgba(245,158,11,0.35)" stroke="#f59e0b" strokeWidth="1.2"/>
    <circle cx="24" cy="34" r="1.5" fill="#fde68a"/>
    <circle cx="15" cy="20" r="1.2" fill="rgba(253,230,138,0.6)"/>
    <circle cx="33" cy="20" r="1.2" fill="rgba(253,230,138,0.6)"/>
  </>),

  "Immortal Cultivation Bible": (<>
    <defs><linearGradient id="icbib" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#fef3c7"/><stop offset="100%" stopColor="#d97706"/></linearGradient></defs>
    <rect x="8" y="8" width="32" height="38" rx="3" fill="url(#icbib)" stroke="#f59e0b" strokeWidth="1.5"/>
    <rect x="8" y="8" width="8" height="38" rx="3" fill="rgba(217,119,6,0.5)" stroke="#f59e0b" strokeWidth="0.5"/>
    <path d="M20 16 L36 16" stroke="#d97706" strokeWidth="1" opacity={0.6}/>
    <path d="M20 20 L36 20" stroke="#d97706" strokeWidth="1" opacity={0.5}/>
    <path d="M20 24 L36 24" stroke="#d97706" strokeWidth="0.9" opacity={0.45}/>
    <path d="M20 28 L36 28" stroke="#d97706" strokeWidth="0.9" opacity={0.4}/>
    <path d="M20 32 L36 32" stroke="#d97706" strokeWidth="0.8" opacity={0.35}/>
    <path d="M20 36 L32 36" stroke="#d97706" strokeWidth="0.8" opacity={0.3}/>
    <circle cx="12" cy="24" r="2" fill="#fde68a" opacity={0.8}/>
    <circle cx="12" cy="32" r="1.5" fill="#fde68a" opacity={0.6}/>
    <path d="M22 40 L24 38 L26 40" stroke="#f59e0b" strokeWidth="1" strokeLinecap="round" fill="none"/>
    <circle cx="24" cy="38" r="1.5" fill="rgba(253,230,138,0.8)"/>
  </>),

  "World Sealing Monument": (<>
    <defs><linearGradient id="wsm" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#fde68a"/><stop offset="100%" stopColor="#78350f"/></linearGradient></defs>
    <path d="M18 8 L30 8 L34 14 L30 42 L18 42 L14 14 Z" fill="url(#wsm)" stroke="#f59e0b" strokeWidth="1.5" strokeLinejoin="round"/>
    <path d="M14 14 L34 14" stroke="#fde68a" strokeWidth="1.5" strokeLinecap="round"/>
    <path d="M18 8 L30 8" stroke="#fde68a" strokeWidth="2" strokeLinecap="round"/>
    <line x1="18" y1="20" x2="30" y2="20" stroke="rgba(253,230,138,0.5)" strokeWidth="0.9"/>
    <line x1="18" y1="26" x2="30" y2="26" stroke="rgba(253,230,138,0.4)" strokeWidth="0.8"/>
    <line x1="18" y1="32" x2="30" y2="32" stroke="rgba(253,230,138,0.35)" strokeWidth="0.8"/>
    <path d="M22 38 L24 35 L26 38" fill="rgba(253,230,138,0.4)" stroke="#f59e0b" strokeWidth="0.8"/>
    <circle cx="24" cy="11" r="2" fill="#fde68a" opacity={0.8}/>
  </>),

  "Dao Carving Sword": (<>
    <defs><linearGradient id="dcsw" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#fef3c7"/><stop offset="100%" stopColor="#d97706"/></linearGradient></defs>
    <path d="M24 6 L28 18 L26 38 L22 38 L20 18 Z" fill="url(#dcsw)" stroke="#f59e0b" strokeWidth="1.3"/>
    <line x1="20" y1="18" x2="28" y2="18" stroke="#d97706" strokeWidth="2" strokeLinecap="round"/>
    <line x1="12" y1="18" x2="36" y2="18" stroke="#d97706" strokeWidth="1.3" strokeLinecap="round"/>
    <path d="M22 38 L20 42 Q24 44 28 42 L26 38" stroke="#d97706" strokeWidth="1.3" fill="rgba(217,119,6,0.3)"/>
    <ellipse cx="22" cy="12" rx="2" ry="4" fill="rgba(255,255,255,0.35)" transform="rotate(-10 22 12)"/>
    <path d="M22 20 Q24 18 26 20 Q24 22 22 20Z" fill="rgba(253,230,138,0.6)"/>
    <circle cx="24" cy="6" r="2" fill="rgba(255,255,255,0.8)"/>
  </>),

  "Karmic Ring": (<>
    <defs>
      <linearGradient id="krng1" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="#fde68a"/><stop offset="30%" stopColor="#f59e0b"/><stop offset="70%" stopColor="#d97706"/><stop offset="100%" stopColor="#fde68a"/></linearGradient>
      <radialGradient id="krgem" cx="35%" cy="30%" r="65%"><stop offset="0%" stopColor="#fef3c7"/><stop offset="50%" stopColor="#fbbf24"/><stop offset="100%" stopColor="#92400e"/></radialGradient>
    </defs>
    <circle cx="24" cy="29" r="13" fill="none" stroke="#f59e0b" strokeWidth="5.5"/>
    <circle cx="24" cy="29" r="9" fill="rgba(245,158,11,0.07)"/>
    <circle cx="24" cy="29" r="13" fill="none" stroke="#fde68a" strokeWidth="1.5" opacity={0.45}/>
    <path d="M18 26 Q24 24 30 26 Q24 28 18 26Z" fill="rgba(253,230,138,0.5)" stroke="#fde68a" strokeWidth="0.6"/>
    <path d="M14 32 Q18 30 20 32" stroke="#fde68a" strokeWidth="1" fill="none" opacity={0.6}/>
    <path d="M28 32 Q30 30 34 32" stroke="#fde68a" strokeWidth="1" fill="none" opacity={0.6}/>
    <circle cx="24" cy="16" r="7.5" fill="url(#krgem)" stroke="#d97706" strokeWidth="1.5"/>
    <circle cx="24" cy="16" r="5.5" fill="none" stroke="rgba(253,230,138,0.6)" strokeWidth="0.8"/>
    <ellipse cx="21.5" cy="14" rx="2.5" ry="3" fill="rgba(255,255,255,0.5)" transform="rotate(-20 21.5 14)"/>
    <path d="M22 14 Q24 12 26 14 Q24 16 22 14Z" fill="rgba(253,230,138,0.7)"/>
    <circle cx="24" cy="16" r="2.5" fill="rgba(255,255,255,0.4)" stroke="rgba(253,230,138,0.9)" strokeWidth="0.8"/>
    <circle cx="24" cy="16" r="1" fill="white" opacity={0.95}/>
    <circle cx="16" cy="18" r="1.5" fill="#fcd34d" stroke="#d97706" strokeWidth="0.8"/>
    <circle cx="32" cy="18" r="1.5" fill="#fcd34d" stroke="#d97706" strokeWidth="0.8"/>
    <circle cx="24" cy="9" r="1.5" fill="#fcd34d" opacity={0.7}/>
  </>),

  "Immortal Sealing Talisman": (<>
    <defs><linearGradient id="ist" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#fffbeb"/><stop offset="100%" stopColor="#fde68a"/></linearGradient></defs>
    <rect x="14" y="8" width="20" height="30" rx="2" fill="url(#ist)" stroke="#f59e0b" strokeWidth="1.5"/>
    <rect x="14" y="8" width="20" height="4" rx="2" fill="rgba(245,158,11,0.4)"/>
    <line x1="14" y1="14" x2="34" y2="14" stroke="#f59e0b" strokeWidth="0.8" opacity={0.5}/>
    <line x1="14" y1="32" x2="34" y2="32" stroke="#f59e0b" strokeWidth="0.8" opacity={0.5}/>
    <circle cx="24" cy="23" r="7" fill="none" stroke="#f59e0b" strokeWidth="1.3"/>
    <circle cx="24" cy="23" r="4.5" fill="none" stroke="rgba(245,158,11,0.6)" strokeWidth="1"/>
    <line x1="16" y1="16" x2="32" y2="30" stroke="rgba(245,158,11,0.3)" strokeWidth="0.7" opacity={0.5}/>
    <line x1="32" y1="16" x2="16" y2="30" stroke="rgba(245,158,11,0.3)" strokeWidth="0.7" opacity={0.5}/>
    <circle cx="24" cy="23" r="2" fill="rgba(245,158,11,0.5)"/>
    <line x1="22" y1="36" x2="21" y2="42" stroke="#f59e0b" strokeWidth="1.5" strokeLinecap="round" opacity={0.6}/>
    <line x1="24" y1="36" x2="24" y2="42" stroke="#f59e0b" strokeWidth="1.5" strokeLinecap="round" opacity={0.6}/>
    <line x1="26" y1="36" x2="27" y2="42" stroke="#f59e0b" strokeWidth="1.5" strokeLinecap="round" opacity={0.6}/>
  </>),

  "Heaven Destroying Talisman": (<>
    <defs><linearGradient id="hdtal" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#fef3c7"/><stop offset="100%" stopColor="#78350f"/></linearGradient></defs>
    <rect x="14" y="8" width="20" height="28" rx="2" fill="url(#hdtal)" stroke="#f59e0b" strokeWidth="1.5"/>
    <line x1="14" y1="14" x2="34" y2="14" stroke="#f59e0b" strokeWidth="1" opacity={0.4}/>
    <line x1="14" y1="30" x2="34" y2="30" stroke="#f59e0b" strokeWidth="1" opacity={0.4}/>
    <path d="M24 16 L26 22 L32 22 L27 26 L29 32 L24 28 L19 32 L21 26 L16 22 L22 22 Z" fill="rgba(245,158,11,0.35)" stroke="#f59e0b" strokeWidth="1.1"/>
    <line x1="21" y1="36" x2="19" y2="42" stroke="#f59e0b" strokeWidth="1.5" strokeLinecap="round"/>
    <line x1="24" y1="36" x2="24" y2="42" stroke="#f59e0b" strokeWidth="1.5" strokeLinecap="round"/>
    <line x1="27" y1="36" x2="29" y2="42" stroke="#f59e0b" strokeWidth="1.5" strokeLinecap="round"/>
    <circle cx="24" cy="23" r="1.5" fill="#fde68a" opacity={0.9}/>
  </>),

  "Space-Time Reversal Stone": (<>
    <defs>
      <radialGradient id="strs" cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor="#fef3c7"/><stop offset="50%" stopColor="#f59e0b"/><stop offset="100%" stopColor="#6d28d9"/></radialGradient>
    </defs>
    <circle cx="24" cy="24" r="16" fill="url(#strs)" stroke="#f59e0b" strokeWidth="1.5"/>
    <circle cx="24" cy="24" r="12" fill="none" stroke="rgba(253,230,138,0.5)" strokeWidth="0.8"/>
    <path d="M20 16 Q20 12 24 12 Q28 12 28 16 Q28 20 24 20 Q20 20 20 16" stroke="rgba(255,255,255,0.7)" strokeWidth="1.2" fill="none" strokeLinecap="round"/>
    <path d="M19 22 L21 24 L19 26" stroke="rgba(255,255,255,0.8)" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
    <path d="M28 16 Q32 18 32 22 Q32 26 28 28" stroke="rgba(255,255,255,0.5)" strokeWidth="1" fill="none" strokeLinecap="round"/>
    <circle cx="24" cy="24" r="3" fill="rgba(255,255,255,0.3)" stroke="rgba(255,255,255,0.7)" strokeWidth="0.8"/>
    <circle cx="24" cy="24" r="1.2" fill="white" opacity={0.9}/>
  </>),

  "Immortal Ink Stone": (<>
    <defs><linearGradient id="iis" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#fffbeb"/><stop offset="100%" stopColor="#f59e0b"/></linearGradient></defs>
    <rect x="10" y="20" width="28" height="18" rx="3" fill="url(#iis)" stroke="#f59e0b" strokeWidth="1.5"/>
    <ellipse cx="24" cy="20" rx="14" ry="4" fill="rgba(245,158,11,0.2)" stroke="#f59e0b" strokeWidth="1.2"/>
    <path d="M32 8 Q36 12 34 16 L30 20 L28 18 L32 14 Q28 12 28 8 Z" fill="#f59e0b" opacity={0.7}/>
    <line x1="30" y1="20" x2="28" y2="18" stroke="#d97706" strokeWidth="1.5"/>
    <ellipse cx="22" cy="26" rx="6" ry="3" fill="rgba(245,158,11,0.2)" stroke="#f59e0b" strokeWidth="1" opacity={0.6}/>
    <circle cx="24" cy="26" r="2" fill="#f59e0b" opacity={0.4}/>
    <ellipse cx="20" cy="24" rx="1.5" ry="2.5" fill="rgba(255,255,255,0.35)"/>
  </>),

  "Heaven Piercing Brush": (<>
    <defs><linearGradient id="hpb" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#fef3c7"/><stop offset="100%" stopColor="#d97706"/></linearGradient></defs>
    <rect x="21" y="6" width="6" height="26" rx="3" fill="url(#hpb)" stroke="#f59e0b" strokeWidth="1.5"/>
    <path d="M21 28 Q18 34 22 42 L26 42 Q30 34 27 28 Z" fill="#78350f" stroke="#d97706" strokeWidth="1.3"/>
    <path d="M22 28 Q20 32 23 40" stroke="rgba(255,255,255,0.25)" strokeWidth="1" fill="none" strokeLinecap="round"/>
    <rect x="21" y="6" width="6" height="4" rx="2" fill="rgba(217,119,6,0.5)"/>
    <ellipse cx="23" cy="8" rx="1.5" ry="2.5" fill="rgba(255,255,255,0.4)"/>
    <circle cx="24" cy="40" r="2.5" fill="rgba(245,158,11,0.5)"/>
    <circle cx="18" cy="8" r="1.2" fill="rgba(253,230,138,0.7)"/>
    <circle cx="30" cy="8" r="1.2" fill="rgba(253,230,138,0.7)"/>
    <circle cx="14" cy="14" r="1" fill="rgba(253,230,138,0.5)"/>
  </>),

  // ════════════════════════════════════════════════════════
  //  LEGENDARY TREASURES / ARTIFACTS
  // ════════════════════════════════════════════════════════

  "Immortal Crystal": (<>
    <defs>
      <linearGradient id="icrys" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#fce7f3"/><stop offset="40%" stopColor="#fbcfe8"/><stop offset="100%" stopColor="#9d174d"/></linearGradient>
      <radialGradient id="icrys2" cx="50%" cy="30%" r="60%"><stop offset="0%" stopColor="#fde68a" stopOpacity="0.8"/><stop offset="100%" stopColor="#ec4899" stopOpacity="0"/></radialGradient>
    </defs>
    <circle cx="24" cy="24" r="16" fill="url(#icrys2)" opacity={0.6}/>
    <path d="M24 3 L44 22 L24 45 L4 22 Z" fill="url(#icrys)" stroke="#ec4899" strokeWidth="1.5" strokeLinejoin="round"/>
    <path d="M24 3 L34 22 L24 45 L14 22 Z" fill="rgba(255,255,255,0.22)"/>
    <line x1="4" y1="22" x2="44" y2="22" stroke="rgba(255,255,255,0.4)" strokeWidth="1.4"/>
    <path d="M10 12 L24 3 L38 12" stroke="rgba(255,255,255,0.6)" strokeWidth="1.4" fill="none"/>
    <circle cx="24" cy="3" r="3.5" fill="rgba(255,255,255,0.95)"/>
    <circle cx="13" cy="12" r="2" fill="rgba(255,255,255,0.55)"/>
    <circle cx="35" cy="12" r="2" fill="rgba(255,255,255,0.55)"/>
  </>),

  "Chaos Cauldron": (<>
    <defs>
      <linearGradient id="ccald" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#fce7f3"/><stop offset="50%" stopColor="#7c3aed"/><stop offset="100%" stopColor="#1a1a2e"/></linearGradient>
      <radialGradient id="ccald2" cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor="#fde68a" stopOpacity="0.7"/><stop offset="100%" stopColor="#ec4899" stopOpacity="0"/></radialGradient>
    </defs>
    <circle cx="24" cy="22" r="14" fill="url(#ccald2)"/>
    <path d="M10 18 Q8 28 10 38 L38 38 Q40 28 38 18 Z" fill="rgba(236,72,153,0.1)" stroke="#ec4899" strokeWidth="1.5"/>
    <ellipse cx="24" cy="18" rx="14" ry="6" fill="rgba(236,72,153,0.2)" stroke="#ec4899" strokeWidth="1.5"/>
    <path d="M16 14 L16 10 Q16 8 18 8 L30 8 Q32 8 32 10 L32 14" stroke="#ec4899" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
    <path d="M8 22 Q4 22 4 28 Q4 34 8 34" stroke="#ec4899" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
    <path d="M40 22 Q44 22 44 28 Q44 34 40 34" stroke="#ec4899" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
    <line x1="14" y1="38" x2="12" y2="44" stroke="#831843" strokeWidth="2" strokeLinecap="round"/>
    <line x1="34" y1="38" x2="36" y2="44" stroke="#831843" strokeWidth="2" strokeLinecap="round"/>
    <path d="M24 14 Q25 12 26 14 Q24 18 22 14 Q23 12 24 14Z" fill="rgba(253,230,138,0.7)"/>
    <path d="M17 26 Q24 21 31 26" stroke="#f9a8d4" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
    <circle cx="24" cy="18" r="3" fill="rgba(236,72,153,0.5)"/>
    <circle cx="24" cy="18" r="1.2" fill="rgba(255,255,255,0.7)"/>
    <circle cx="18" cy="30" r="1.5" fill="rgba(196,181,253,0.6)"/>
    <circle cx="30" cy="28" r="1.2" fill="rgba(253,230,138,0.5)"/>
  </>),

  "Book of Life and Death": (<>
    <defs><linearGradient id="bold" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#fce7f3"/><stop offset="100%" stopColor="#831843"/></linearGradient></defs>
    <rect x="8" y="8" width="32" height="38" rx="3" fill="url(#bold)" stroke="#ec4899" strokeWidth="1.5"/>
    <rect x="8" y="8" width="8" height="38" rx="3" fill="rgba(157,23,77,0.6)" stroke="#ec4899" strokeWidth="0.5"/>
    <path d="M20 16 L36 16" stroke="#f9a8d4" strokeWidth="0.9" opacity={0.6}/>
    <path d="M20 20 L36 20" stroke="#f9a8d4" strokeWidth="0.9" opacity={0.5}/>
    <path d="M20 24 L36 24" stroke="#f9a8d4" strokeWidth="0.8" opacity={0.45}/>
    <path d="M20 28 L36 28" stroke="#f9a8d4" strokeWidth="0.8" opacity={0.4}/>
    <path d="M20 32 L36 32" stroke="#f9a8d4" strokeWidth="0.7" opacity={0.35}/>
    <path d="M23 36 Q24 34 25 36" fill="none" stroke="#ec4899" strokeWidth="0.8"/>
    <circle cx="12" cy="20" r="2.5" fill="rgba(255,255,255,0.5)"/>
    <circle cx="12" cy="30" r="2.5" fill="rgba(157,23,77,0.7)"/>
    <path d="M11 20 Q12 18 13 20" stroke="rgba(255,255,255,0.5)" strokeWidth="0.6" fill="none"/>
    <path d="M26 38 L28 36 L30 38" stroke="#ec4899" strokeWidth="1" strokeLinecap="round" fill="none"/>
  </>),

  "Wheel of Reincarnation Fragment": (<>
    <defs>
      <linearGradient id="worf1" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#fde68a"/><stop offset="100%" stopColor="#f59e0b"/></linearGradient>
      <linearGradient id="worf2" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#7c3aed"/><stop offset="100%" stopColor="#4c1d95"/></linearGradient>
    </defs>
    <path d="M24 8 A16 16 0 0 1 40 24 L32 24 A8 8 0 0 0 24 16 Z" fill="url(#worf1)" stroke="#ec4899" strokeWidth="1.3"/>
    <path d="M24 8 A16 16 0 0 0 8 24 L16 24 A8 8 0 0 1 24 16 Z" fill="url(#worf2)" stroke="#ec4899" strokeWidth="1.3" opacity={0.8}/>
    <path d="M8 24 A16 16 0 0 0 24 40 L24 32 A8 8 0 0 1 16 24 Z" fill="rgba(236,72,153,0.2)" stroke="#ec4899" strokeWidth="1.3"/>
    <circle cx="24" cy="24" r="5" fill="rgba(236,72,153,0.3)" stroke="#ec4899" strokeWidth="1.2"/>
    <circle cx="24" cy="24" r="2" fill="#f9a8d4"/>
    <line x1="24" y1="8" x2="24" y2="5" stroke="#ec4899" strokeWidth="1.5" strokeLinecap="round"/>
    <line x1="40" y1="24" x2="43" y2="24" stroke="#ec4899" strokeWidth="1.5" strokeLinecap="round"/>
    <line x1="8" y1="24" x2="5" y2="24" stroke="#ec4899" strokeWidth="1.5" strokeLinecap="round"/>
  </>),

  "Jade Emperor's Decree": (<>
    <defs><linearGradient id="jed" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#fce7f3"/><stop offset="100%" stopColor="#fde68a"/></linearGradient></defs>
    <rect x="12" y="10" width="24" height="30" rx="2" fill="url(#jed)" stroke="#ec4899" strokeWidth="1.5"/>
    <rect x="8" y="8" width="32" height="5" rx="2.5" fill="#831843" stroke="#ec4899" strokeWidth="1.2"/>
    <rect x="8" y="37" width="32" height="5" rx="2.5" fill="#831843" stroke="#ec4899" strokeWidth="1.2"/>
    <path d="M16 17 L32 17" stroke="#ec4899" strokeWidth="1" opacity={0.6}/>
    <path d="M16 21 L32 21" stroke="#ec4899" strokeWidth="0.9" opacity={0.5}/>
    <path d="M16 25 L32 25" stroke="#ec4899" strokeWidth="0.8" opacity={0.45}/>
    <path d="M16 29 L32 29" stroke="#ec4899" strokeWidth="0.8" opacity={0.4}/>
    <circle cx="24" cy="23" r="3.5" fill="rgba(253,230,138,0.5)" stroke="rgba(245,158,11,0.7)" strokeWidth="0.8"/>
    <circle cx="24" cy="23" r="1.5" fill="rgba(253,230,138,0.8)"/>
  </>),

  "Pangu's Axe Fragment": (<>
    <defs><linearGradient id="paxf" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#fce7f3"/><stop offset="100%" stopColor="#831843"/></linearGradient></defs>
    <path d="M28 8 Q38 12 38 20 Q38 28 30 30 L18 42 L14 38 L26 26 Q18 24 16 16 Q14 8 22 7 Z" fill="url(#paxf)" stroke="#ec4899" strokeWidth="1.5" strokeLinejoin="round"/>
    <path d="M28 10 Q35 14 34 20 Q33 25 28 27" stroke="rgba(255,255,255,0.3)" strokeWidth="1.2" fill="none" strokeLinecap="round"/>
    <line x1="16" y1="40" x2="12" y2="44" stroke="#9d174d" strokeWidth="2" strokeLinecap="round"/>
    <ellipse cx="24" cy="17" rx="5" ry="7" fill="rgba(255,255,255,0.2)" transform="rotate(-30 24 17)"/>
    <circle cx="30" cy="14" r="2" fill="rgba(255,255,255,0.5)"/>
    <circle cx="22" cy="30" r="1.5" fill="rgba(253,230,138,0.6)"/>
  </>),

  "Nuwa's Stone": (<>
    <defs>
      <radialGradient id="nwst" cx="50%" cy="40%" r="60%"><stop offset="0%" stopColor="#fce7f3"/><stop offset="30%" stopColor="#bbf7d0"/><stop offset="60%" stopColor="#bfdbfe"/><stop offset="100%" stopColor="#831843"/></radialGradient>
    </defs>
    <path d="M12 16 Q10 24 14 34 Q18 42 24 42 Q30 42 34 34 Q38 24 36 16 Q32 8 24 8 Q16 8 12 16Z" fill="url(#nwst)" stroke="#ec4899" strokeWidth="1.5"/>
    <ellipse cx="18" cy="22" rx="4" ry="6" fill="rgba(255,255,255,0.3)" transform="rotate(-15 18 22)"/>
    <path d="M22 28 Q24 24 26 28 Q28 32 24 34 Q20 32 22 28Z" fill="rgba(255,255,255,0.15)"/>
    <circle cx="30" cy="18" r="2.5" fill="rgba(255,255,255,0.35)"/>
    <circle cx="20" cy="34" r="2" fill="rgba(255,255,255,0.25)"/>
    <circle cx="24" cy="8" r="2" fill="rgba(255,255,255,0.7)"/>
  </>),

  "Heaven Defying Constitution": (<>
    <defs><linearGradient id="hdc" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#fce7f3"/><stop offset="100%" stopColor="#831843"/></linearGradient></defs>
    <path d="M24 6 L32 10 L36 18 L34 28 L30 36 L24 42 L18 36 L14 28 L12 18 L16 10 Z" fill="url(#hdc)" stroke="#ec4899" strokeWidth="1.5" strokeLinejoin="round"/>
    <path d="M24 12 L29 15 L31 21 L29 27 L24 30 L19 27 L17 21 L19 15 Z" fill="rgba(255,255,255,0.15)" stroke="rgba(236,72,153,0.5)" strokeWidth="0.8"/>
    <path d="M22 20 Q24 17 26 20" stroke="rgba(255,255,255,0.7)" strokeWidth="1.2" fill="none"/>
    <path d="M20 24 Q24 21 28 24" stroke="rgba(255,255,255,0.6)" strokeWidth="1" fill="none"/>
    <circle cx="24" cy="22" r="4" fill="rgba(236,72,153,0.3)" stroke="rgba(249,168,212,0.6)" strokeWidth="0.8"/>
    <circle cx="24" cy="22" r="1.5" fill="rgba(255,255,255,0.7)"/>
  </>),

  "Dao of Writing": (<>
    <defs><linearGradient id="dow" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#fce7f3"/><stop offset="100%" stopColor="#9d174d"/></linearGradient></defs>
    <rect x="20" y="6" width="8" height="28" rx="4" fill="url(#dow)" stroke="#ec4899" strokeWidth="1.5"/>
    <path d="M20 30 Q17 36 21 42 L27 42 Q31 36 28 30 Z" fill="#831843" stroke="#9d174d" strokeWidth="1.3"/>
    <path d="M21 30 Q19 34 22 40" stroke="rgba(255,255,255,0.25)" strokeWidth="1" fill="none" strokeLinecap="round"/>
    <rect x="20" y="6" width="8" height="5" rx="3" fill="rgba(157,23,77,0.5)"/>
    <ellipse cx="22" cy="8" rx="2" ry="3" fill="rgba(255,255,255,0.4)"/>
    <circle cx="24" cy="40" r="3" fill="rgba(236,72,153,0.5)"/>
    <circle cx="16" cy="8" r="1.2" fill="rgba(249,168,212,0.7)"/>
    <circle cx="32" cy="8" r="1.2" fill="rgba(249,168,212,0.7)"/>
    <path d="M14 14 Q16 13 18 14" stroke="#ec4899" strokeWidth="0.8" fill="none" strokeLinecap="round" opacity={0.5}/>
    <path d="M30 14 Q32 13 34 14" stroke="#ec4899" strokeWidth="0.8" fill="none" strokeLinecap="round" opacity={0.5}/>
  </>),

  "Chronicle of Heaven": (<>
    <defs><linearGradient id="coh" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#fce7f3"/><stop offset="100%" stopColor="#4c1d95"/></linearGradient></defs>
    <rect x="8" y="8" width="32" height="38" rx="3" fill="url(#coh)" stroke="#ec4899" strokeWidth="1.5"/>
    <rect x="8" y="8" width="8" height="38" rx="3" fill="rgba(131,24,67,0.5)" stroke="#ec4899" strokeWidth="0.5"/>
    <circle cx="24" cy="20" r="5" fill="rgba(236,72,153,0.2)" stroke="#ec4899" strokeWidth="1"/>
    <circle cx="24" cy="20" r="2.5" fill="rgba(253,230,138,0.7)" stroke="rgba(245,158,11,0.8)" strokeWidth="0.8"/>
    <circle cx="24" cy="20" r="1" fill="white" opacity={0.9}/>
    <circle cx="18" cy="28" r="1.5" fill="rgba(196,181,253,0.7)"/>
    <circle cx="24" cy="30" r="1" fill="rgba(249,168,212,0.7)"/>
    <circle cx="30" cy="27" r="1.2" fill="rgba(253,230,138,0.7)"/>
    <circle cx="22" cy="34" r="0.8" fill="rgba(196,181,253,0.5)"/>
    <circle cx="28" cy="35" r="0.8" fill="rgba(249,168,212,0.5)"/>
    <path d="M20 17 L34 17" stroke="#f9a8d4" strokeWidth="0.8" opacity={0.5}/>
    <path d="M20 38 L30 38" stroke="#f9a8d4" strokeWidth="0.8" opacity={0.4}/>
  </>),

  "Immortal Emperor Seal": (<>
    <defs><linearGradient id="ies" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#fce7f3"/><stop offset="100%" stopColor="#78350f"/></linearGradient></defs>
    <rect x="10" y="12" width="28" height="28" rx="3" fill="url(#ies)" stroke="#ec4899" strokeWidth="1.5"/>
    <rect x="10" y="12" width="28" height="8" rx="3" fill="rgba(131,24,67,0.4)"/>
    <path d="M14" y1="22" x2="34" y2="22" stroke="#f9a8d4" strokeWidth="0.8" opacity={0.5}/>
    <path d="M14" y1="34" x2="34" y2="34" stroke="#f9a8d4" strokeWidth="0.8" opacity={0.5}/>
    <path d="M24 24 L25.8 29 L31 29 L26.8 32 L28.4 37 L24 34 L19.6 37 L21.2 32 L17 29 L22.2 29 Z" fill="rgba(253,230,138,0.7)" stroke="rgba(245,158,11,0.9)" strokeWidth="0.8"/>
    <line x1="18" y1="8" x2="22" y2="12" stroke="#ec4899" strokeWidth="1.8" strokeLinecap="round"/>
    <line x1="26" y1="8" x2="26" y2="12" stroke="#ec4899" strokeWidth="1.8" strokeLinecap="round"/>
    <line x1="30" y1="8" x2="26" y2="12" stroke="#ec4899" strokeWidth="1.8" strokeLinecap="round"/>
    <path d="M18 8 L30 8" stroke="#ec4899" strokeWidth="1.3" strokeLinecap="round"/>
  </>),

  "Wheel of Reincarnation": (<>
    <defs>
      <linearGradient id="wor1" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#fde68a"/><stop offset="100%" stopColor="#f59e0b"/></linearGradient>
      <linearGradient id="wor2" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#7c3aed"/><stop offset="100%" stopColor="#4c1d95"/></linearGradient>
    </defs>
    <circle cx="24" cy="24" r="16" fill="none" stroke="#ec4899" strokeWidth="1.5" strokeDasharray="4 2"/>
    <circle cx="24" cy="24" r="12" fill="#4c1d95" opacity={0.12}/>
    <path d="M24 12 A12 12 0 0 1 24 36 A6 6 0 0 0 24 24 A6 6 0 0 1 24 12Z" fill="url(#wor1)" opacity={0.9}/>
    <path d="M24 12 A12 12 0 0 0 24 36 A6 6 0 0 1 24 24 A6 6 0 0 0 24 12Z" fill="url(#wor2)" opacity={0.9}/>
    <circle cx="24" cy="18" r="2.5" fill="#fde68a" stroke="#f59e0b" strokeWidth="0.5"/>
    <circle cx="24" cy="30" r="2.5" fill="#4c1d95" stroke="#7c3aed" strokeWidth="0.5"/>
    <circle cx="24" cy="24" r="3" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="1"/>
    <circle cx="24" cy="24" r="14" fill="none" stroke="#ec4899" strokeWidth="1" opacity={0.5}/>
    <line x1="24" y1="8" x2="24" y2="5" stroke="#ec4899" strokeWidth="1.5" strokeLinecap="round"/>
    <line x1="24" y1="43" x2="24" y2="40" stroke="#ec4899" strokeWidth="1.5" strokeLinecap="round"/>
    <line x1="8" y1="24" x2="5" y2="24" stroke="#ec4899" strokeWidth="1.5" strokeLinecap="round"/>
    <line x1="43" y1="24" x2="40" y2="24" stroke="#ec4899" strokeWidth="1.5" strokeLinecap="round"/>
    <line x1="13" y1="13" x2="11" y2="11" stroke="#ec4899" strokeWidth="1.2" strokeLinecap="round"/>
    <line x1="35" y1="35" x2="37" y2="37" stroke="#ec4899" strokeWidth="1.2" strokeLinecap="round"/>
    <line x1="35" y1="13" x2="37" y2="11" stroke="#ec4899" strokeWidth="1.2" strokeLinecap="round"/>
    <line x1="13" y1="35" x2="11" y2="37" stroke="#ec4899" strokeWidth="1.2" strokeLinecap="round"/>
  </>),

  // ════════════════════════════════════════════════════════
  //  COMMON INGREDIENTS
  // ════════════════════════════════════════════════════════

  "Common Spirit Herb": (<>
    <defs><linearGradient id="csh" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#d1d5db"/><stop offset="100%" stopColor="#6b7280"/></linearGradient></defs>
    <line x1="24" y1="40" x2="24" y2="26" stroke="#57534e" strokeWidth="2.5" strokeLinecap="round"/>
    <path d="M24 34 Q18 30 15 22 Q18 16 23 19 Q24 22 24 34Z" fill="url(#csh)" stroke="#6b7280" strokeWidth="1.2" opacity={0.9}/>
    <path d="M24 30 Q30 26 33 18 Q30 12 25 15 Q24 18 24 30Z" fill="url(#csh)" stroke="#6b7280" strokeWidth="1.2" opacity={0.75}/>
    <path d="M18 24 Q20 22 22 24" stroke="#9ca3af" strokeWidth="1" fill="none"/>
    <path d="M27 19 Q29 17 31 19" stroke="#9ca3af" strokeWidth="1" fill="none"/>
  </>),

  "Mortal Qi Grass": (<>
    <line x1="18" y1="40" x2="22" y2="22" stroke="#6b7280" strokeWidth="2" strokeLinecap="round"/>
    <line x1="24" y1="40" x2="24" y2="20" stroke="#6b7280" strokeWidth="2.5" strokeLinecap="round"/>
    <line x1="30" y1="40" x2="26" y2="22" stroke="#6b7280" strokeWidth="2" strokeLinecap="round"/>
    <line x1="16" y1="40" x2="20" y2="26" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round"/>
    <line x1="32" y1="40" x2="28" y2="26" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round"/>
    <path d="M22 22 Q20 16 22 12" stroke="#78716c" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
    <path d="M24 20 Q24 14 24 10" stroke="#6b7280" strokeWidth="2" fill="none" strokeLinecap="round"/>
    <path d="M26 22 Q28 16 26 12" stroke="#78716c" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
  </>),

  "Stone Fragment": (<>
    <defs><linearGradient id="stfg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#e2e8f0"/><stop offset="100%" stopColor="#64748b"/></linearGradient></defs>
    <path d="M14 18 L20 8 L34 10 L40 22 L36 36 L20 38 L12 28 Z" fill="url(#stfg)" stroke="#64748b" strokeWidth="1.5" strokeLinejoin="round"/>
    <path d="M20 8 L22 18 L34 10" stroke="rgba(255,255,255,0.25)" strokeWidth="0.8" fill="none"/>
    <path d="M14 18 L22 18 L20 38" stroke="rgba(255,255,255,0.15)" strokeWidth="0.8" fill="none"/>
    <path d="M34 10 L36 24 L36 36" stroke="rgba(0,0,0,0.1)" strokeWidth="0.8" fill="none"/>
    <ellipse cx="20" cy="16" rx="3" ry="4" fill="rgba(255,255,255,0.2)" transform="rotate(-20 20 16)"/>
  </>),

  "Impure Qi Crystal": (<>
    <defs><linearGradient id="iqcg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#e2e8f0"/><stop offset="100%" stopColor="#94a3b8"/></linearGradient></defs>
    <path d="M24 8 L30 16 L28 38 L20 38 L18 16 Z" fill="url(#iqcg)" stroke="#64748b" strokeWidth="1.5" strokeLinejoin="round"/>
    <path d="M24 8 L28 16 L26 38 L22 38 L20 16 Z" fill="rgba(255,255,255,0.2)"/>
    <line x1="18" y1="16" x2="30" y2="16" stroke="rgba(255,255,255,0.4)" strokeWidth="1"/>
    <circle cx="22" cy="22" r="1.5" fill="rgba(100,116,139,0.6)"/>
    <circle cx="26" cy="30" r="1.2" fill="rgba(100,116,139,0.5)"/>
    <circle cx="25" cy="14" r="1.5" fill="rgba(255,255,255,0.6)"/>
  </>),

  "Ash Root": (<>
    <defs><linearGradient id="ashr" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#d6d3d1"/><stop offset="100%" stopColor="#78716c"/></linearGradient></defs>
    <line x1="24" y1="40" x2="24" y2="26" stroke="#57534e" strokeWidth="2.5" strokeLinecap="round"/>
    <path d="M24 36 Q18 32 18 40" stroke="#57534e" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
    <path d="M24 36 Q30 32 30 40" stroke="#57534e" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
    <path d="M24 32 Q18 28 14 22 Q16 16 22 18 Q24 20 24 32Z" fill="url(#ashr)" stroke="#78716c" strokeWidth="1.2" opacity={0.9}/>
    <path d="M24 28 Q30 24 34 18 Q32 12 26 14 Q24 16 24 28Z" fill="url(#ashr)" stroke="#78716c" strokeWidth="1.2" opacity={0.75}/>
    <path d="M18 24 Q20 22 22 24" stroke="#d6d3d1" strokeWidth="1" fill="none"/>
    <path d="M28 19 Q30 17 32 19" stroke="#d6d3d1" strokeWidth="1" fill="none"/>
  </>),

  // ════════════════════════════════════════════════════════
  //  UNCOMMON INGREDIENTS
  // ════════════════════════════════════════════════════════

  "Thousand Year Ginseng": (<>
    <defs><linearGradient id="tyg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#dcfce7"/><stop offset="100%" stopColor="#22c55e"/></linearGradient></defs>
    <path d="M22 40 L20 36 L14 32 M22 40 L22 28" stroke="#15803d" strokeWidth="2" strokeLinecap="round" fill="none"/>
    <path d="M26 40 L28 36 L34 32 M26 40 L26 28" stroke="#15803d" strokeWidth="2" strokeLinecap="round" fill="none"/>
    <path d="M20 28 Q16 24 16 18 Q16 10 22 10 Q24 10 24 16" stroke="#15803d" strokeWidth="2" fill="none" strokeLinecap="round"/>
    <path d="M28 28 Q32 24 32 18 Q32 10 26 10 Q24 10 24 16" stroke="#15803d" strokeWidth="2" fill="none" strokeLinecap="round"/>
    <ellipse cx="24" cy="16" rx="6" ry="8" fill="url(#tyg)" stroke="#22c55e" strokeWidth="1.3"/>
    <ellipse cx="22" cy="14" rx="2" ry="3" fill="rgba(255,255,255,0.35)" transform="rotate(-10 22 14)"/>
    <circle cx="24" cy="10" r="2.5" fill="#bbf7d0" stroke="#22c55e" strokeWidth="1"/>
    <circle cx="24" cy="10" r="1" fill="rgba(255,255,255,0.6)"/>
  </>),

  "Spirit Moss": (<>
    <defs><linearGradient id="smoss" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#bbf7d0"/><stop offset="100%" stopColor="#16a34a"/></linearGradient></defs>
    <ellipse cx="24" cy="30" rx="16" ry="8" fill="url(#smoss)" stroke="#22c55e" strokeWidth="1.3"/>
    <path d="M10 30 Q10 24 16 22 Q20 20 24 22 Q28 20 32 22 Q38 24 38 30" fill="rgba(34,197,94,0.2)" stroke="#22c55e" strokeWidth="1"/>
    <circle cx="18" cy="26" r="3" fill="rgba(34,197,94,0.4)" stroke="#16a34a" strokeWidth="0.8"/>
    <circle cx="24" cy="24" r="3.5" fill="rgba(34,197,94,0.5)" stroke="#16a34a" strokeWidth="0.8"/>
    <circle cx="30" cy="26" r="3" fill="rgba(34,197,94,0.4)" stroke="#16a34a" strokeWidth="0.8"/>
    <circle cx="22" cy="30" r="2.5" fill="rgba(34,197,94,0.35)" stroke="#16a34a" strokeWidth="0.7"/>
    <circle cx="28" cy="30" r="2.5" fill="rgba(34,197,94,0.35)" stroke="#16a34a" strokeWidth="0.7"/>
    <path d="M16 28 Q18 24 20 26 Q22 20 24 22 Q26 20 28 26 Q30 24 32 28" stroke="rgba(255,255,255,0.4)" strokeWidth="0.7" fill="none"/>
  </>),

  "Jade Flower": (<>
    <defs><linearGradient id="jflw" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#dcfce7"/><stop offset="100%" stopColor="#4ade80"/></linearGradient></defs>
    <line x1="24" y1="40" x2="24" y2="28" stroke="#15803d" strokeWidth="2.5" strokeLinecap="round"/>
    <path d="M24 30 Q20 28 18 30" stroke="#15803d" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
    <path d="M20 16 Q20 10 24 9 Q28 10 28 16 Q28 22 24 24 Q20 22 20 16Z" fill="url(#jflw)" stroke="#22c55e" strokeWidth="1.3"/>
    <path d="M12 20 Q10 14 14 12 Q18 10 20 16 Q18 22 14 22 Q12 22 12 20Z" fill="url(#jflw)" stroke="#22c55e" strokeWidth="1.2" opacity={0.8}/>
    <path d="M36 20 Q38 14 34 12 Q30 10 28 16 Q30 22 34 22 Q36 22 36 20Z" fill="url(#jflw)" stroke="#22c55e" strokeWidth="1.2" opacity={0.8}/>
    <circle cx="24" cy="16" r="4" fill="rgba(253,230,138,0.6)" stroke="#d97706" strokeWidth="1.2"/>
    <circle cx="24" cy="16" r="2" fill="#fde68a"/>
    <circle cx="24" cy="16" r="0.8" fill="white" opacity={0.8}/>
  </>),

  "Iron Core Dust": (<>
    <defs><radialGradient id="icd" cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor="#d1fae5"/><stop offset="100%" stopColor="#15803d"/></radialGradient></defs>
    <circle cx="24" cy="24" r="10" fill="rgba(34,197,94,0.12)" stroke="#22c55e" strokeWidth="1.5"/>
    <circle cx="24" cy="24" r="5" fill="rgba(34,197,94,0.2)" stroke="#22c55e" strokeWidth="1"/>
    <circle cx="24" cy="24" r="2" fill="#22c55e"/>
    <line x1="24" y1="10" x2="24" y2="7" stroke="#22c55e" strokeWidth="2" strokeLinecap="round"/>
    <line x1="24" y1="38" x2="24" y2="41" stroke="#22c55e" strokeWidth="2" strokeLinecap="round"/>
    <line x1="10" y1="24" x2="7" y2="24" stroke="#22c55e" strokeWidth="2" strokeLinecap="round"/>
    <line x1="38" y1="24" x2="41" y2="24" stroke="#22c55e" strokeWidth="2" strokeLinecap="round"/>
    <line x1="14" y1="14" x2="12" y2="12" stroke="#22c55e" strokeWidth="1.5" strokeLinecap="round"/>
    <line x1="34" y1="34" x2="36" y2="36" stroke="#22c55e" strokeWidth="1.5" strokeLinecap="round"/>
    <line x1="34" y1="14" x2="36" y2="12" stroke="#22c55e" strokeWidth="1.5" strokeLinecap="round"/>
    <line x1="14" y1="34" x2="12" y2="36" stroke="#22c55e" strokeWidth="1.5" strokeLinecap="round"/>
    <circle cx="24" cy="10" r="2" fill="#22c55e" opacity={0.5}/>
    <circle cx="24" cy="38" r="2" fill="#22c55e" opacity={0.5}/>
    <circle cx="10" cy="24" r="2" fill="#22c55e" opacity={0.5}/>
    <circle cx="38" cy="24" r="2" fill="#22c55e" opacity={0.5}/>
  </>),

  "Cold Spring Water": (<>
    <defs><linearGradient id="csw" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#e0f2fe"/><stop offset="100%" stopColor="#38bdf8"/></linearGradient></defs>
    <path d="M24 8 Q32 18 34 28 A10 10 0 0 1 14 28 Q16 18 24 8Z" fill="url(#csw)" stroke="#22c55e" strokeWidth="1.5"/>
    <ellipse cx="20" cy="26" rx="3" ry="4" fill="rgba(255,255,255,0.3)" transform="rotate(-20 20 26)"/>
    <path d="M18 20 L16 18 M21 14 L19 12 M27 14 L29 12" stroke="rgba(147,197,253,0.7)" strokeWidth="1.2" strokeLinecap="round"/>
    <path d="M30 18 L32 16" stroke="rgba(147,197,253,0.6)" strokeWidth="1.2" strokeLinecap="round"/>
    <path d="M24 8 Q25 14 27 20" stroke="rgba(255,255,255,0.3)" strokeWidth="0.8" strokeLinecap="round" fill="none"/>
  </>),

  "Solar Flame Petal": (<>
    <defs>
      <radialGradient id="sfp" cx="50%" cy="30%" r="60%"><stop offset="0%" stopColor="#fde68a"/><stop offset="100%" stopColor="#dc2626"/></radialGradient>
    </defs>
    <path d="M24 8 Q30 12 32 18 Q34 24 30 28 Q26 32 24 40 Q22 32 18 28 Q14 24 16 18 Q18 12 24 8Z" fill="url(#sfp)" stroke="#f59e0b" strokeWidth="1.3"/>
    <path d="M24 8 Q26 14 27 20 Q26 26 24 30" stroke="rgba(255,255,255,0.35)" strokeWidth="1" fill="none" strokeLinecap="round"/>
    <path d="M24 8 Q22 14 21 20 Q22 26 24 30" stroke="rgba(255,200,50,0.4)" strokeWidth="0.8" fill="none" strokeLinecap="round"/>
    <ellipse cx="21" cy="18" rx="2.5" ry="5" fill="rgba(255,255,255,0.25)" transform="rotate(-10 21 18)"/>
    <circle cx="24" cy="8" r="2" fill="rgba(255,255,200,0.8)"/>
  </>),

  // ════════════════════════════════════════════════════════
  //  RARE INGREDIENTS
  // ════════════════════════════════════════════════════════

  "Blood Lotus": (<>
    <defs><linearGradient id="blts" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#fecaca"/><stop offset="100%" stopColor="#991b1b"/></linearGradient></defs>
    <line x1="24" y1="40" x2="24" y2="28" stroke="#15803d" strokeWidth="2.5" strokeLinecap="round"/>
    <path d="M24 34 Q17 30 13 33" stroke="#15803d" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
    <path d="M20 10 Q24 6 28 10 Q32 14 28 18 Q24 22 20 18 Q16 14 20 10Z" fill="url(#blts)" stroke="#dc2626" strokeWidth="1.3"/>
    <path d="M12 16 Q10 12 14 10 Q18 8 20 12 Q22 16 18 18 Q14 20 12 16Z" fill="rgba(220,38,38,0.4)" stroke="#ef4444" strokeWidth="1"/>
    <path d="M36 16 Q38 12 34 10 Q30 8 28 12 Q26 16 30 18 Q34 20 36 16Z" fill="rgba(220,38,38,0.4)" stroke="#ef4444" strokeWidth="1"/>
    <circle cx="24" cy="18" r="5.5" fill="rgba(220,38,38,0.2)" stroke="#dc2626" strokeWidth="1.5"/>
    <circle cx="24" cy="18" r="2.5" fill="#dc2626"/>
    <circle cx="24" cy="18" r="1" fill="#fef2f2"/>
  </>),

  "Nine Cold Ice Grass": (<>
    <defs><linearGradient id="ncig" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#e0f2fe"/><stop offset="100%" stopColor="#3b82f6"/></linearGradient></defs>
    <line x1="24" y1="40" x2="24" y2="22" stroke="#1d4ed8" strokeWidth="2.5" strokeLinecap="round"/>
    <path d="M24 30 Q18 26 14 20 Q16 14 22 18 L24 30Z" fill="url(#ncig)" stroke="#3b82f6" strokeWidth="1.2"/>
    <path d="M24 30 Q30 26 34 20 Q32 14 26 18 L24 30Z" fill="url(#ncig)" stroke="#3b82f6" strokeWidth="1.2"/>
    <path d="M24 24 Q20 20 18 14 Q22 10 26 14 L24 24Z" fill="#bfdbfe" stroke="#2563eb" strokeWidth="1.1"/>
    <path d="M24 24 Q28 20 30 14 Q26 10 22 14 L24 24Z" fill="#bfdbfe" stroke="#2563eb" strokeWidth="1.1"/>
    <path d="M22 17 L20 13 M24 16 L24 12 M26 17 L28 13" stroke="#93c5fd" strokeWidth="1.2" strokeLinecap="round" opacity={0.8}/>
    <circle cx="24" cy="12" r="2" fill="#bfdbfe" stroke="#3b82f6" strokeWidth="1"/>
    <circle cx="24" cy="12" r="0.8" fill="white"/>
  </>),

  "Thunder Bamboo": (<>
    <defs><linearGradient id="tbam" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#bbf7d0"/><stop offset="100%" stopColor="#16a34a"/></linearGradient></defs>
    <rect x="20" y="8" width="8" height="34" rx="4" fill="url(#tbam)" stroke="#22c55e" strokeWidth="1.5"/>
    <line x1="20" y1="16" x2="28" y2="16" stroke="#15803d" strokeWidth="1.5"/>
    <line x1="20" y1="24" x2="28" y2="24" stroke="#15803d" strokeWidth="1.5"/>
    <line x1="20" y1="32" x2="28" y2="32" stroke="#15803d" strokeWidth="1.5"/>
    <path d="M28 16 Q34 14 36 18" stroke="#22c55e" strokeWidth="1.2" fill="none" strokeLinecap="round"/>
    <path d="M28 24 Q34 22 36 26" stroke="#22c55e" strokeWidth="1.2" fill="none" strokeLinecap="round"/>
    <path d="M28 10 L26 16 L29 16 L25 22" stroke="rgba(147,197,253,0.8)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
    <ellipse cx="22" cy="12" rx="1.5" ry="3" fill="rgba(255,255,255,0.35)"/>
  </>),

  "Spirit Python Gallbladder": (<>
    <defs><radialGradient id="spgb" cx="40%" cy="30%" r="65%"><stop offset="0%" stopColor="#d1fae5"/><stop offset="100%" stopColor="#0d9488"/></radialGradient></defs>
    <path d="M14 18 Q12 24 16 32 Q20 40 26 40 Q32 38 34 30 Q36 22 32 16 Q28 10 22 12 Q16 14 14 18Z" fill="url(#spgb)" stroke="#14b8a6" strokeWidth="1.5"/>
    <path d="M18 28 Q20 24 24 26 Q28 28 26 32 Q24 36 20 34 Q16 32 18 28Z" fill="rgba(255,255,255,0.2)" stroke="rgba(20,184,166,0.5)" strokeWidth="0.8"/>
    <ellipse cx="20" cy="22" rx="3" ry="5" fill="rgba(255,255,255,0.25)" transform="rotate(-15 20 22)"/>
    <circle cx="26" cy="16" r="2" fill="rgba(20,184,166,0.5)" stroke="#0d9488" strokeWidth="0.8"/>
    <circle cx="26" cy="16" r="0.8" fill="rgba(255,255,255,0.6)"/>
  </>),

  "Heaven Dew Drop": (<>
    <defs><radialGradient id="hddg" cx="40%" cy="30%" r="60%"><stop offset="0%" stopColor="#bfdbfe"/><stop offset="100%" stopColor="#1d4ed8"/></radialGradient></defs>
    <path d="M24 8 Q32 18 34 28 A10 10 0 0 1 14 28 Q16 18 24 8Z" fill="url(#hddg)" stroke="#3b82f6" strokeWidth="1.5"/>
    <ellipse cx="20" cy="26" rx="3" ry="4" fill="rgba(255,255,255,0.3)" transform="rotate(-20 20 26)"/>
    <circle cx="24" cy="30" r="2" fill="rgba(255,255,255,0.2)"/>
    <circle cx="28" cy="18" r="2.5" fill="rgba(255,255,255,0.3)"/>
    <path d="M24 8 Q25 14 27 20" stroke="rgba(255,255,255,0.35)" strokeWidth="0.8" strokeLinecap="round" fill="none"/>
    <circle cx="24" cy="8" r="2" fill="#bfdbfe" opacity={0.8}/>
  </>),

  "Crimson Spirit Mushroom": (<>
    <defs>
      <radialGradient id="csm" cx="50%" cy="30%" r="65%"><stop offset="0%" stopColor="#fecaca"/><stop offset="100%" stopColor="#991b1b"/></radialGradient>
    </defs>
    <path d="M12 26 Q12 16 24 14 Q36 16 36 26 Q36 30 24 32 Q12 30 12 26Z" fill="url(#csm)" stroke="#dc2626" strokeWidth="1.5"/>
    <rect x="21" y="30" width="6" height="14" rx="3" fill="rgba(220,38,38,0.2)" stroke="#dc2626" strokeWidth="1.2"/>
    <ellipse cx="18" cy="22" rx="3" ry="4" fill="rgba(255,255,255,0.25)" transform="rotate(-20 18 22)"/>
    <circle cx="26" cy="19" r="2" fill="rgba(255,255,255,0.2)"/>
    <line x1="14" y1="28" x2="34" y2="28" stroke="rgba(185,28,28,0.4)" strokeWidth="0.8"/>
    <circle cx="24" cy="14" r="2" fill="rgba(254,202,202,0.6)"/>
  </>),

  // ════════════════════════════════════════════════════════
  //  EPIC INGREDIENTS
  // ════════════════════════════════════════════════════════

  "Nine Leaf Immortal Grass": (<>
    <defs>
      <linearGradient id="nlig1" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#bbf7d0"/><stop offset="100%" stopColor="#16a34a"/></linearGradient>
      <linearGradient id="nlig2" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#86efac"/><stop offset="100%" stopColor="#15803d"/></linearGradient>
    </defs>
    <line x1="24" y1="40" x2="24" y2="24" stroke="#166534" strokeWidth="2.5" strokeLinecap="round"/>
    <path d="M24 36 Q18 34 16 28 Q18 24 22 26 L24 36Z" fill="url(#nlig1)" stroke="#22c55e" strokeWidth="1"/>
    <path d="M24 36 Q30 34 32 28 Q30 24 26 26 L24 36Z" fill="url(#nlig1)" stroke="#22c55e" strokeWidth="1"/>
    <path d="M24 30 Q18 28 14 22 Q16 16 22 18 L24 30Z" fill="url(#nlig2)" stroke="#16a34a" strokeWidth="1.1"/>
    <path d="M24 30 Q30 28 34 22 Q32 16 26 18 L24 30Z" fill="url(#nlig2)" stroke="#16a34a" strokeWidth="1.1"/>
    <path d="M24 24 Q20 20 18 14 Q22 10 26 14 L24 24Z" fill="#15803d" stroke="#166534" strokeWidth="1.2" opacity={0.9}/>
    <path d="M24 24 Q28 20 30 14 Q26 10 22 14 L24 24Z" fill="#15803d" stroke="#166534" strokeWidth="1.2" opacity={0.85}/>
    <circle cx="24" cy="10" r="3" fill="#fde68a" stroke="#d97706" strokeWidth="1.2"/>
    <circle cx="24" cy="10" r="1.2" fill="white" opacity={0.7}/>
  </>),

  "Phoenix Tail Feather": (<>
    <defs>
      <linearGradient id="ptf" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#fde68a"/><stop offset="40%" stopColor="#f97316"/><stop offset="100%" stopColor="#dc2626"/></linearGradient>
    </defs>
    <path d="M24 40 Q14 28 12 18 Q12 8 18 7 Q24 8 26 18 Q28 28 24 40Z" fill="url(#ptf)" stroke="#ef4444" strokeWidth="1.3"/>
    <path d="M24 40 Q30 30 34 20 Q38 10 34 8 Q30 8 26 18 Q28 28 24 40Z" fill="rgba(245,158,11,0.4)" stroke="#f59e0b" strokeWidth="1.2"/>
    <path d="M24 40 Q22 34 20 26 Q21 24 24 28 Q27 24 28 26 Q26 34 24 40Z" fill="rgba(255,255,255,0.15)"/>
    <path d="M19 22 Q21 20 23 22" stroke="rgba(255,255,255,0.4)" strokeWidth="0.8" fill="none"/>
    <path d="M23 16 Q25 14 27 16" stroke="rgba(255,255,255,0.35)" strokeWidth="0.8" fill="none"/>
    <path d="M20 10 Q22 8 24 10" stroke="rgba(255,255,255,0.3)" strokeWidth="0.8" fill="none"/>
    <circle cx="18" cy="8" r="2.5" fill="rgba(253,230,138,0.7)" stroke="#f59e0b" strokeWidth="1"/>
  </>),

  "Dragon Whisker": (<>
    <defs><linearGradient id="dwsk" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#ede9fe"/><stop offset="100%" stopColor="#4c1d95"/></linearGradient></defs>
    <path d="M16 38 Q12 30 14 20 Q16 12 22 10 Q28 8 32 14 Q36 20 34 28 Q32 36 28 40 L26 38 Q30 34 30 26 Q30 18 26 14 Q22 12 20 18 Q18 24 20 32 Z" fill="url(#dwsk)" stroke="#7c3aed" strokeWidth="1.3"/>
    <path d="M20 22 Q22 20 24 22" stroke="#c4b5fd" strokeWidth="1" fill="none" strokeLinecap="round"/>
    <path d="M22 28 Q24 26 26 28" stroke="#a78bfa" strokeWidth="0.9" fill="none" strokeLinecap="round"/>
    <path d="M21 14 Q18 8 16 8" stroke="#8b5cf6" strokeWidth="1.3" fill="none" strokeLinecap="round"/>
    <path d="M29 12 Q32 6 34 6" stroke="#8b5cf6" strokeWidth="1.3" fill="none" strokeLinecap="round"/>
    <circle cx="16" cy="8" r="2" fill="#c4b5fd" opacity={0.8}/>
    <circle cx="34" cy="6" r="2" fill="#c4b5fd" opacity={0.8}/>
  </>),

  "Void Crystal Shard": (<>
    <defs>
      <linearGradient id="vcs" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#ede9fe"/><stop offset="50%" stopColor="#7c3aed"/><stop offset="100%" stopColor="#1a1a2e"/></linearGradient>
    </defs>
    <path d="M24 8 L32 18 L28 40 L20 40 L16 18 Z" fill="url(#vcs)" stroke="#8b5cf6" strokeWidth="1.5" strokeLinejoin="round"/>
    <path d="M24 8 L28 18 L26 40 L22 40 L20 18 Z" fill="rgba(255,255,255,0.15)"/>
    <line x1="16" y1="18" x2="32" y2="18" stroke="rgba(196,181,253,0.5)" strokeWidth="1"/>
    <circle cx="24" cy="28" r="3" fill="rgba(255,255,255,0.05)" stroke="rgba(196,181,253,0.5)" strokeWidth="0.8"/>
    <circle cx="24" cy="28" r="1.2" fill="rgba(196,181,253,0.4)"/>
    <circle cx="26" cy="13" r="2" fill="rgba(255,255,255,0.6)"/>
    <circle cx="20" cy="22" r="1" fill="rgba(196,181,253,0.6)"/>
  </>),

  "Celestial Spring Water": (<>
    <defs><radialGradient id="cswr" cx="40%" cy="30%" r="60%"><stop offset="0%" stopColor="#e0e7ff"/><stop offset="100%" stopColor="#4f46e5"/></radialGradient></defs>
    <path d="M24 8 Q32 18 34 28 A10 10 0 0 1 14 28 Q16 18 24 8Z" fill="url(#cswr)" stroke="#6366f1" strokeWidth="1.5"/>
    <ellipse cx="20" cy="26" rx="3" ry="4" fill="rgba(255,255,255,0.35)" transform="rotate(-20 20 26)"/>
    <circle cx="24" cy="30" r="2.5" fill="rgba(255,255,255,0.2)"/>
    <circle cx="28" cy="18" r="3" fill="rgba(255,255,255,0.3)"/>
    <path d="M24 8 Q25 14 27 20" stroke="rgba(255,255,255,0.4)" strokeWidth="0.8" strokeLinecap="round" fill="none"/>
    <circle cx="24" cy="8" r="2.5" fill="#c7d2fe" opacity={0.8}/>
    <line x1="22" y1="6" x2="20" y2="4" stroke="#a5b4fc" strokeWidth="1" strokeLinecap="round"/>
    <line x1="26" y1="6" x2="28" y2="4" stroke="#a5b4fc" strokeWidth="1" strokeLinecap="round"/>
  </>),

  "Heaven Defying Herb": (<>
    <defs><linearGradient id="hdh" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#ede9fe"/><stop offset="100%" stopColor="#4c1d95"/></linearGradient></defs>
    <line x1="24" y1="40" x2="24" y2="22" stroke="#6d28d9" strokeWidth="2" strokeLinecap="round"/>
    <path d="M24 30 Q16 26 12 18 Q16 12 24 16 Q24 22 24 30Z" fill="url(#hdh)" stroke="#7c3aed" strokeWidth="1.2"/>
    <path d="M24 26 Q32 22 36 14 Q32 8 24 12 Q24 18 24 26Z" fill="rgba(139,92,246,0.4)" stroke="#8b5cf6" strokeWidth="1.2"/>
    <path d="M18 16 Q20 14 22 16" stroke="#a78bfa" strokeWidth="1" fill="none" opacity={0.6}/>
    <path d="M30 12 Q32 10 34 12" stroke="#a78bfa" strokeWidth="1" fill="none" opacity={0.6}/>
    <circle cx="24" cy="10" r="3" fill="rgba(139,92,246,0.3)" stroke="#8b5cf6" strokeWidth="1.2"/>
    <path d="M22 10 L24 8 L26 10 L24 12 Z" fill="#8b5cf6"/>
  </>),

  "True Blood Lotus": (<>
    <defs>
      <linearGradient id="tblts" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#fca5a5"/><stop offset="100%" stopColor="#7f1d1d"/></linearGradient>
    </defs>
    <line x1="24" y1="40" x2="24" y2="28" stroke="#15803d" strokeWidth="2.5" strokeLinecap="round"/>
    <path d="M24 34 Q17 30 13 33" stroke="#15803d" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
    <path d="M20 10 Q24 6 28 10 Q32 14 28 18 Q24 22 20 18 Q16 14 20 10Z" fill="url(#tblts)" stroke="#dc2626" strokeWidth="1.3"/>
    <path d="M12 16 Q10 12 14 10 Q18 8 20 12 Q22 16 18 18 Q14 20 12 16Z" fill="rgba(220,38,38,0.5)" stroke="#ef4444" strokeWidth="1.1"/>
    <path d="M36 16 Q38 12 34 10 Q30 8 28 12 Q26 16 30 18 Q34 20 36 16Z" fill="rgba(220,38,38,0.5)" stroke="#ef4444" strokeWidth="1.1"/>
    <path d="M14 26 Q10 24 10 20 Q10 16 14 16 Q18 16 18 20 Q18 24 14 26Z" fill="rgba(220,38,38,0.3)" stroke="#fca5a5" strokeWidth="1"/>
    <path d="M34 26 Q38 24 38 20 Q38 16 34 16 Q30 16 30 20 Q30 24 34 26Z" fill="rgba(220,38,38,0.3)" stroke="#fca5a5" strokeWidth="1"/>
    <circle cx="24" cy="18" r="5" fill="rgba(220,38,38,0.25)" stroke="#dc2626" strokeWidth="1.5"/>
    <circle cx="24" cy="18" r="2.5" fill="#dc2626"/>
    <circle cx="24" cy="18" r="1" fill="#fef2f2"/>
  </>),

  "Ancient Tree Heartwood": (<>
    <defs><linearGradient id="ath" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#fde68a"/><stop offset="100%" stopColor="#92400e"/></linearGradient></defs>
    <circle cx="24" cy="26" r="16" fill="url(#ath)" stroke="#d97706" strokeWidth="1.5"/>
    <circle cx="24" cy="26" r="13" fill="none" stroke="rgba(146,64,14,0.5)" strokeWidth="0.8"/>
    <circle cx="24" cy="26" r="10" fill="none" stroke="rgba(146,64,14,0.4)" strokeWidth="0.7"/>
    <circle cx="24" cy="26" r="7" fill="none" stroke="rgba(146,64,14,0.35)" strokeWidth="0.7"/>
    <circle cx="24" cy="26" r="4" fill="none" stroke="rgba(146,64,14,0.3)" strokeWidth="0.6"/>
    <ellipse cx="22" cy="23" rx="5" ry="7" fill="rgba(255,255,255,0.2)" transform="rotate(-10 22 23)"/>
    <path d="M18 14 Q22 10 24 8 Q22 12 18 14Z" fill="#16a34a" stroke="#15803d" strokeWidth="1"/>
    <path d="M30 14 Q26 10 24 8 Q26 12 30 14Z" fill="#16a34a" stroke="#15803d" strokeWidth="1"/>
  </>),

  // ════════════════════════════════════════════════════════
  //  MYTHIC INGREDIENTS
  // ════════════════════════════════════════════════════════

  "Heavenly Flame Essence": (<>
    <defs>
      <radialGradient id="hfe1" cx="50%" cy="90%" r="70%"><stop offset="0%" stopColor="#fde68a"/><stop offset="35%" stopColor="#f59e0b"/><stop offset="65%" stopColor="#ef4444"/><stop offset="100%" stopColor="#7f1d1d" stopOpacity="0"/></radialGradient>
      <radialGradient id="hfe2" cx="40%" cy="80%" r="50%"><stop offset="0%" stopColor="#fef3c7"/><stop offset="100%" stopColor="#f59e0b" stopOpacity="0"/></radialGradient>
    </defs>
    <path d="M24 40 Q13 31 15 21 Q17 13 24 9 Q21 17 26 20 Q23 13 28 9 Q37 17 33 27 Q35 21 31 19 Q37 29 24 40Z" fill="url(#hfe1)"/>
    <path d="M24 38 Q17 29 20 23 Q22 19 24 17 Q23 22 27 23 Q31 25 29 32 Q27 36 24 38Z" fill="url(#hfe2)" opacity={0.8}/>
    <ellipse cx="24" cy="29" rx="4" ry="5" fill="#fef3c7" opacity={0.5}/>
    <circle cx="24" cy="28" r="2" fill="white" opacity={0.6}/>
    <circle cx="20" cy="18" r="1.5" fill="#fde68a" opacity={0.5}/>
    <circle cx="28" cy="16" r="1" fill="#fde68a" opacity={0.4}/>
  </>),

  "Nine Heavens Lightning Seed": (<>
    <defs><linearGradient id="nhls" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#fde68a"/><stop offset="100%" stopColor="#d97706"/></linearGradient></defs>
    <ellipse cx="24" cy="28" rx="8" ry="10" fill="rgba(245,158,11,0.12)" stroke="#f59e0b" strokeWidth="1.2"/>
    <path d="M26 8 L18 24 L24 24 L22 40 L30 22 L24 22 Z" fill="url(#nhls)" stroke="#d97706" strokeWidth="0.5"/>
    <path d="M25.5 8.5 L17.5 24.5 L23.5 24.5 L21.5 40.5 L29.5 22.5 L23.5 22.5 Z" stroke="rgba(253,230,138,0.4)" strokeWidth="2" fill="none"/>
    <circle cx="18" cy="14" r="2" fill="#fde68a" opacity={0.6}/>
    <circle cx="32" cy="18" r="1.5" fill="#fde68a" opacity={0.4}/>
    <line x1="10" y1="28" x2="14" y2="26" stroke="#f59e0b" strokeWidth="1.2" strokeLinecap="round" opacity={0.5}/>
    <line x1="38" y1="28" x2="34" y2="26" stroke="#f59e0b" strokeWidth="1.2" strokeLinecap="round" opacity={0.5}/>
  </>),

  "Qilin Blood Drop": (<>
    <defs>
      <radialGradient id="qbd" cx="40%" cy="30%" r="60%"><stop offset="0%" stopColor="#fde68a"/><stop offset="50%" stopColor="#ef4444"/><stop offset="100%" stopColor="#7f1d1d"/></radialGradient>
    </defs>
    <path d="M24 8 Q32 18 34 28 A10 10 0 0 1 14 28 Q16 18 24 8Z" fill="url(#qbd)" stroke="#f59e0b" strokeWidth="1.5"/>
    <ellipse cx="20" cy="26" rx="3" ry="4" fill="rgba(255,255,255,0.25)" transform="rotate(-20 20 26)"/>
    <circle cx="24" cy="30" r="2" fill="rgba(255,255,255,0.15)"/>
    <path d="M24 8 Q25 14 27 20" stroke="rgba(253,230,138,0.4)" strokeWidth="0.8" strokeLinecap="round" fill="none"/>
    <circle cx="24" cy="8" r="2.5" fill="rgba(253,230,138,0.7)"/>
    <path d="M18 10 L14 6 M24 8 L24 4 M30 10 L34 6" stroke="#f59e0b" strokeWidth="1.2" strokeLinecap="round" opacity={0.7}/>
  </>),

  "Phoenix Core": (<>
    <defs>
      <radialGradient id="phc1" cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor="#fef3c7"/><stop offset="35%" stopColor="#fbbf24"/><stop offset="70%" stopColor="#f97316"/><stop offset="100%" stopColor="#b91c1c"/></radialGradient>
      <radialGradient id="phc2" cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor="#fde68a" stopOpacity="0.8"/><stop offset="100%" stopColor="#f59e0b" stopOpacity="0"/></radialGradient>
    </defs>
    <circle cx="24" cy="26" r="14" fill="url(#phc2)"/>
    <path d="M24 8 Q17 12 19 18 Q15 13 13 18 Q17 25 24 16 Q31 25 35 18 Q33 13 29 18 Q31 12 24 8Z" fill="#fcd34d" stroke="#f59e0b" strokeWidth="1.2"/>
    <circle cx="24" cy="26" r="10" fill="url(#phc1)" stroke="#f97316" strokeWidth="1.5"/>
    <circle cx="24" cy="26" r="5" fill="#fef3c7" opacity={0.8}/>
    <circle cx="24" cy="26" r="2.5" fill="white" opacity={0.95}/>
    <circle cx="21" cy="23" r="1.5" fill="rgba(255,255,255,0.6)"/>
  </>),

  "Dragon Soul Fragment": (<>
    <defs>
      <radialGradient id="dsf" cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor="#ede9fe"/><stop offset="40%" stopColor="#7c3aed"/><stop offset="100%" stopColor="#1a1a2e"/></radialGradient>
    </defs>
    <path d="M14 14 Q12 22 14 32 Q16 38 22 40 Q28 40 34 36 Q38 32 38 24 Q38 14 32 10 Q26 6 20 8 Q14 10 14 14Z" fill="url(#dsf)" stroke="#8b5cf6" strokeWidth="1.5"/>
    <path d="M18 18 Q16 22 18 28 Q20 34 24 36" stroke="rgba(196,181,253,0.5)" strokeWidth="1.2" fill="none" strokeLinecap="round"/>
    <path d="M28 12 Q32 14 34 18" stroke="rgba(196,181,253,0.4)" strokeWidth="1" fill="none" strokeLinecap="round"/>
    <circle cx="22" cy="20" r="2.5" fill="rgba(196,181,253,0.4)" stroke="#c4b5fd" strokeWidth="0.8"/>
    <circle cx="30" cy="22" r="2" fill="rgba(196,181,253,0.35)" stroke="#a78bfa" strokeWidth="0.7"/>
    <circle cx="26" cy="30" r="3" fill="rgba(255,255,255,0.1)" stroke="rgba(196,181,253,0.5)" strokeWidth="0.8"/>
    <ellipse cx="20" cy="26" rx="3" ry="5" fill="rgba(255,255,255,0.15)" transform="rotate(-15 20 26)"/>
  </>),

  "Void Origin Crystal": (<>
    <defs>
      <linearGradient id="voc" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#ede9fe"/><stop offset="30%" stopColor="#7c3aed"/><stop offset="70%" stopColor="#4c1d95"/><stop offset="100%" stopColor="#020617"/></linearGradient>
      <radialGradient id="voc2" cx="50%" cy="30%" r="60%"><stop offset="0%" stopColor="#c4b5fd" stopOpacity="0.7"/><stop offset="100%" stopColor="#7c3aed" stopOpacity="0"/></radialGradient>
    </defs>
    <circle cx="24" cy="24" r="14" fill="url(#voc2)"/>
    <path d="M24 8 L32 18 L28 40 L20 40 L16 18 Z" fill="url(#voc)" stroke="#8b5cf6" strokeWidth="1.5" strokeLinejoin="round"/>
    <path d="M24 8 L28 18 L26 40 L22 40 L20 18 Z" fill="rgba(255,255,255,0.12)"/>
    <line x1="16" y1="18" x2="32" y2="18" stroke="rgba(196,181,253,0.5)" strokeWidth="1"/>
    <circle cx="24" cy="28" r="4" fill="rgba(255,255,255,0.05)" stroke="rgba(196,181,253,0.6)" strokeWidth="0.8"/>
    <circle cx="24" cy="28" r="1.5" fill="rgba(196,181,253,0.5)"/>
    <circle cx="26" cy="12" r="2.5" fill="rgba(255,255,255,0.65)"/>
    <circle cx="20" cy="22" r="1.2" fill="rgba(196,181,253,0.7)"/>
    <circle cx="28" cy="32" r="1" fill="rgba(196,181,253,0.5)"/>
  </>),

  "Primordial Chaos Grass": (<>
    <defs>
      <linearGradient id="pcg1" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#fde68a"/><stop offset="50%" stopColor="#7c3aed"/><stop offset="100%" stopColor="#1a1a2e"/></linearGradient>
    </defs>
    <line x1="24" y1="40" x2="24" y2="22" stroke="#4c1d95" strokeWidth="2.5" strokeLinecap="round"/>
    <path d="M24 32 Q16 26 12 18 Q14 10 22 16 L24 32Z" fill="url(#pcg1)" stroke="#7c3aed" strokeWidth="1.3" opacity={0.9}/>
    <path d="M24 28 Q32 22 36 14 Q34 6 26 12 L24 28Z" fill="rgba(196,181,253,0.5)" stroke="#8b5cf6" strokeWidth="1.2" opacity={0.85}/>
    <circle cx="24" cy="10" r="3.5" fill="rgba(253,230,138,0.7)" stroke="#f59e0b" strokeWidth="1.2"/>
    <circle cx="24" cy="10" r="1.5" fill="rgba(255,255,255,0.8)"/>
    <circle cx="16" cy="14" r="1.5" fill="rgba(196,181,253,0.6)"/>
    <circle cx="32" cy="12" r="1.2" fill="rgba(253,230,138,0.5)"/>
  </>),

  // ════════════════════════════════════════════════════════
  //  LEGENDARY INGREDIENTS
  // ════════════════════════════════════════════════════════

  "Pangu's Blood Drop": (<>
    <defs><radialGradient id="pbd" cx="40%" cy="30%" r="60%"><stop offset="0%" stopColor="#ff6b6b"/><stop offset="100%" stopColor="#b91c1c"/></radialGradient></defs>
    <path d="M24 8 Q32 18 34 28 A10 10 0 0 1 14 28 Q16 18 24 8Z" fill="url(#pbd)" stroke="#ef4444" strokeWidth="1.5"/>
    <ellipse cx="20" cy="26" rx="3" ry="4" fill="rgba(255,255,255,0.25)" transform="rotate(-20 20 26)"/>
    <circle cx="24" cy="30" r="2" fill="rgba(255,255,255,0.15)"/>
    <path d="M24 8 Q26 14 28 20" stroke="rgba(255,150,150,0.4)" strokeWidth="1" strokeLinecap="round" fill="none"/>
    <circle cx="24" cy="8" r="2.5" fill="rgba(255,150,150,0.6)"/>
    <path d="M18 10 L14 6 M24 8 L24 4 M30 10 L34 6" stroke="#ef4444" strokeWidth="1.2" strokeLinecap="round" opacity={0.6}/>
    <circle cx="24" cy="4" r="1.5" fill="#fca5a5" opacity={0.7}/>
  </>),

  "Nuwa's Clay": (<>
    <defs><linearGradient id="nwcl" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#fde8e8"/><stop offset="100%" stopColor="#be185d"/></linearGradient></defs>
    <path d="M18 10 Q14 14 14 20 Q14 32 18 38 L30 38 Q34 32 34 20 Q34 14 30 10 Z" fill="url(#nwcl)" stroke="#ec4899" strokeWidth="1.5"/>
    <path d="M16 12 L32 12" stroke="#ec4899" strokeWidth="1.5" strokeLinecap="round"/>
    <path d="M20 8 L28 8" stroke="#ec4899" strokeWidth="2" strokeLinecap="round"/>
    <path d="M18 38 L30 38" stroke="#ec4899" strokeWidth="2" strokeLinecap="round"/>
    <path d="M20 20 Q24 16 28 20 Q24 24 20 20Z" fill="#ec4899" opacity={0.3}/>
    <line x1="20" y1="28" x2="28" y2="28" stroke="#ec4899" strokeWidth="1" opacity={0.5}/>
    <line x1="19" y1="33" x2="29" y2="33" stroke="#ec4899" strokeWidth="1" opacity={0.4}/>
    <ellipse cx="21" cy="16" rx="2.5" ry="3.5" fill="rgba(255,255,255,0.25)" transform="rotate(-10 21 16)"/>
  </>),

  "Heaven's Tear": (<>
    <defs>
      <radialGradient id="htear" cx="40%" cy="30%" r="60%"><stop offset="0%" stopColor="#fce7f3"/><stop offset="100%" stopColor="#9d174d"/></radialGradient>
    </defs>
    <path d="M24 8 Q32 18 34 28 A10 10 0 0 1 14 28 Q16 18 24 8Z" fill="url(#htear)" stroke="#ec4899" strokeWidth="1.5"/>
    <ellipse cx="20" cy="26" rx="3" ry="4" fill="rgba(255,255,255,0.35)" transform="rotate(-20 20 26)"/>
    <circle cx="24" cy="30" r="2.5" fill="rgba(255,255,255,0.25)"/>
    <circle cx="28" cy="18" r="3.5" fill="rgba(255,255,255,0.3)"/>
    <path d="M24 8 Q25 14 27 20" stroke="rgba(255,255,255,0.4)" strokeWidth="0.8" strokeLinecap="round" fill="none"/>
    <circle cx="24" cy="8" r="2.5" fill="#fce7f3" opacity={0.85}/>
    <circle cx="18" cy="10" r="1.5" fill="rgba(236,72,153,0.5)"/>
    <circle cx="30" cy="10" r="1.5" fill="rgba(236,72,153,0.5)"/>
  </>),

  "Dao Origin Seed": (<>
    <defs>
      <radialGradient id="dos" cx="50%" cy="40%" r="60%"><stop offset="0%" stopColor="#fce7f3"/><stop offset="50%" stopColor="#7c3aed"/><stop offset="100%" stopColor="#1a1a2e"/></radialGradient>
    </defs>
    <ellipse cx="24" cy="28" rx="10" ry="12" fill="url(#dos)" stroke="#ec4899" strokeWidth="1.5"/>
    <path d="M24 20 L24 8" stroke="#4c1d95" strokeWidth="2" strokeLinecap="round"/>
    <path d="M24 14 Q18 11 15 14" stroke="#ec4899" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
    <path d="M24 11 Q30 8 33 11" stroke="#ec4899" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
    <ellipse cx="21" cy="26" rx="3" ry="5" fill="rgba(255,255,255,0.2)" transform="rotate(-10 21 26)"/>
    <circle cx="24" cy="8" r="2.5" fill="#ec4899" opacity={0.8}/>
    <circle cx="24" cy="8" r="1" fill="rgba(255,255,255,0.7)"/>
    <circle cx="24" cy="28" r="3" fill="rgba(255,255,255,0.1)" stroke="rgba(236,72,153,0.4)" strokeWidth="0.8"/>
  </>),

  "True Immortal Bone Fragment": (<>
    <defs><linearGradient id="tibf" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#fffbeb"/><stop offset="100%" stopColor="#fce7f3"/></linearGradient></defs>
    <g transform="rotate(45 24 24)">
      <rect x="20" y="8" width="8" height="32" rx="4" fill="url(#tibf)" stroke="#ec4899" strokeWidth="1.5"/>
      <circle cx="24" cy="10" r="6" fill="#fff1f9" stroke="#ec4899" strokeWidth="1.5"/>
      <circle cx="24" cy="38" r="6" fill="#fff1f9" stroke="#ec4899" strokeWidth="1.5"/>
      <circle cx="22" cy="8" r="2" fill="rgba(255,255,255,0.7)"/>
      <circle cx="22" cy="36" r="2" fill="rgba(255,255,255,0.6)"/>
      <line x1="24" y1="16" x2="24" y2="32" stroke="#ec4899" strokeWidth="1" opacity={0.35} strokeDasharray="2 2"/>
    </g>
    <circle cx="36" cy="12" r="3" fill="#fcd34d" opacity={0.5}/>
    <circle cx="12" cy="36" r="2" fill="#fcd34d" opacity={0.4}/>
  </>),

  "Creation Flame": (<>
    <defs>
      <radialGradient id="crf1" cx="50%" cy="90%" r="70%"><stop offset="0%" stopColor="#fde68a"/><stop offset="25%" stopColor="#f59e0b"/><stop offset="55%" stopColor="#ec4899"/><stop offset="100%" stopColor="#4c1d95" stopOpacity="0"/></radialGradient>
      <radialGradient id="crf2" cx="40%" cy="80%" r="50%"><stop offset="0%" stopColor="#fef3c7"/><stop offset="100%" stopColor="#ec4899" stopOpacity="0"/></radialGradient>
    </defs>
    <path d="M24 40 Q13 31 15 21 Q17 13 24 9 Q21 17 26 20 Q23 13 28 9 Q37 17 33 27 Q35 21 31 19 Q37 29 24 40Z" fill="url(#crf1)"/>
    <path d="M24 38 Q17 29 20 23 Q22 19 24 17 Q23 22 27 23 Q31 25 29 32 Q27 36 24 38Z" fill="url(#crf2)" opacity={0.8}/>
    <ellipse cx="24" cy="29" rx="4" ry="5" fill="#fef3c7" opacity={0.5}/>
    <circle cx="24" cy="28" r="2" fill="white" opacity={0.7}/>
    <circle cx="19" cy="15" r="1.5" fill="#fde68a" opacity={0.5}/>
    <circle cx="29" cy="13" r="1.2" fill="#fbcfe8" opacity={0.5}/>
    <circle cx="18" cy="26" r="1" fill="#c4b5fd" opacity={0.5}/>
  </>),
};

// ─────────────────────────────────────────────────────────────────────────────
//  ItemIcon component
// ─────────────────────────────────────────────────────────────────────────────

interface ItemIconProps {
  name: string;
  size?: number;
}

export function ItemIcon({ name, size = 38 }: ItemIconProps) {
  const content = ICONS[name];
  if (!content) return null;
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none">
      {content}
    </svg>
  );
}
