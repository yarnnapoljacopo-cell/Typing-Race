export function ChestIcon({ type, className = "w-full h-full" }: { type: string; className?: string }) {
  const normalized = type.replace("_chest", "");

  if (normalized === "mortal") return (
    <svg viewBox="0 0 64 64" fill="none" className={className}>
      <defs>
        <linearGradient id="mc-lid" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#D4A870"/><stop offset="100%" stopColor="#9B6E40"/></linearGradient>
        <linearGradient id="mc-body" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#B8844C"/><stop offset="100%" stopColor="#7A4E28"/></linearGradient>
      </defs>
      <rect x="7" y="32" width="50" height="24" rx="3" fill="url(#mc-body)" stroke="#5C3418" strokeWidth="1.5"/>
      <path d="M7 32 Q7 15 32 15 Q57 15 57 32Z" fill="url(#mc-lid)" stroke="#5C3418" strokeWidth="1.5"/>
      <rect x="7" y="29.5" width="50" height="5" rx="0" fill="#5C3418" opacity="0.25"/>
      <rect x="8" y="28" width="6" height="9" rx="2" fill="#8B6030" stroke="#5C3418" strokeWidth="1"/>
      <rect x="50" y="28" width="6" height="9" rx="2" fill="#8B6030" stroke="#5C3418" strokeWidth="1"/>
      <rect x="25" y="38" width="14" height="10" rx="2.5" fill="#C8A040" stroke="#8B6820" strokeWidth="1.5"/>
      <path d="M29 38 Q29 33 32 33 Q35 33 35 38" stroke="#8B6820" strokeWidth="2" fill="none" strokeLinecap="round"/>
      <circle cx="32" cy="43" r="1.5" fill="#8B6820"/>
      {[37, 43, 49].map(y => (
        <g key={y}>
          <line x1="11" y1={y} x2="22" y2={y} stroke="#5C3418" strokeWidth="0.7" opacity="0.35"/>
          <line x1="42" y1={y} x2="53" y2={y} stroke="#5C3418" strokeWidth="0.7" opacity="0.35"/>
        </g>
      ))}
    </svg>
  );

  if (normalized === "iron") return (
    <svg viewBox="0 0 64 64" fill="none" className={className}>
      <defs>
        <linearGradient id="ic-lid" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#7A8A9A"/><stop offset="100%" stopColor="#4A5568"/></linearGradient>
        <linearGradient id="ic-body" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#5A6A7A"/><stop offset="100%" stopColor="#2D3A48"/></linearGradient>
      </defs>
      <rect x="7" y="32" width="50" height="24" rx="3" fill="url(#ic-body)" stroke="#1A2530" strokeWidth="1.5"/>
      <path d="M7 32 Q7 15 32 15 Q57 15 57 32Z" fill="url(#ic-lid)" stroke="#1A2530" strokeWidth="1.5"/>
      <rect x="7" y="29" width="50" height="5" rx="0" fill="#1A2530" opacity="0.5"/>
      <rect x="7" y="39" width="50" height="3.5" rx="0" fill="#1A2530" opacity="0.35"/>
      <rect x="7" y="48" width="50" height="3.5" rx="0" fill="#1A2530" opacity="0.35"/>
      {[12, 28, 36, 52].map(x => (
        <circle key={x} cx={x} cy="30.5" r="1.8" fill="#8090A0" stroke="#1A2530" strokeWidth="0.7"/>
      ))}
      <rect x="8" y="27" width="7" height="10" rx="2" fill="#6080A0" stroke="#1A2530" strokeWidth="1.2"/>
      <rect x="49" y="27" width="7" height="10" rx="2" fill="#6080A0" stroke="#1A2530" strokeWidth="1.2"/>
      <rect x="25" y="37" width="14" height="10" rx="2" fill="#78889A" stroke="#1A2530" strokeWidth="1.5"/>
      <path d="M29 37 Q29 32 32 32 Q35 32 35 37" stroke="#1A2530" strokeWidth="2" fill="none" strokeLinecap="round"/>
      <circle cx="32" cy="42" r="1.5" fill="#1A2530"/>
    </svg>
  );

  if (normalized === "crystal") return (
    <svg viewBox="0 0 64 64" fill="none" className={className}>
      <defs>
        <linearGradient id="cc-lid" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#A8D8F0"/><stop offset="100%" stopColor="#4090C8"/></linearGradient>
        <linearGradient id="cc-body" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#70B8E8"/><stop offset="100%" stopColor="#2868A8"/></linearGradient>
      </defs>
      <rect x="7" y="32" width="50" height="24" rx="3" fill="url(#cc-body)" stroke="#1A4880" strokeWidth="1.5" opacity="0.9"/>
      <path d="M7 32 Q7 15 32 15 Q57 15 57 32Z" fill="url(#cc-lid)" stroke="#1A4880" strokeWidth="1.5" opacity="0.9"/>
      <path d="M32 15 L20 32 M32 15 L44 32 M32 15 L32 32" stroke="white" strokeWidth="0.8" opacity="0.5"/>
      <ellipse cx="24" cy="22" rx="4" ry="2.5" fill="white" opacity="0.3" transform="rotate(-30 24 22)"/>
      <rect x="7" y="29" width="50" height="5" fill="#1A4880" opacity="0.3"/>
      <rect x="8" y="27" width="6" height="10" rx="2" fill="#60A0D8" stroke="#1A4880" strokeWidth="1.2"/>
      <rect x="50" y="27" width="6" height="10" rx="2" fill="#60A0D8" stroke="#1A4880" strokeWidth="1.2"/>
      <rect x="25" y="37" width="14" height="10" rx="2" fill="#A8D0F0" stroke="#1A4880" strokeWidth="1.5"/>
      <polygon points="32,39 36,43 32,47 28,43" fill="#4890D0" stroke="#1A4880" strokeWidth="0.8"/>
      <polygon points="32,41 34,43 32,45 30,43" fill="white" opacity="0.7"/>
      <polygon points="10,35 13,38 10,41 7,38" fill="#60B0E8" opacity="0.7"/>
      <polygon points="54,35 57,38 54,41 51,38" fill="#60B0E8" opacity="0.7"/>
      <path d="M48 20 L49 22 L51 21 L49 23 L50 25 L49 23 L47 24 L49 23 Z" fill="white" opacity="0.8"/>
    </svg>
  );

  if (normalized === "inferno") return (
    <svg viewBox="0 0 64 64" fill="none" className={className}>
      <defs>
        <linearGradient id="fc-lid" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#C04010"/><stop offset="100%" stopColor="#601008"/></linearGradient>
        <linearGradient id="fc-body" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#A03010"/><stop offset="100%" stopColor="#3A0808"/></linearGradient>
        <radialGradient id="fc-glow" cx="50%" cy="80%" r="60%"><stop offset="0%" stopColor="#FF6020" stopOpacity="0.6"/><stop offset="100%" stopColor="#FF6020" stopOpacity="0"/></radialGradient>
      </defs>
      <ellipse cx="32" cy="56" rx="26" ry="8" fill="url(#fc-glow)"/>
      <rect x="7" y="32" width="50" height="24" rx="3" fill="url(#fc-body)" stroke="#200808" strokeWidth="1.5"/>
      <path d="M7 32 Q7 15 32 15 Q57 15 57 32Z" fill="url(#fc-lid)" stroke="#200808" strokeWidth="1.5"/>
      <path d="M18 36 L22 42 L20 46 L24 52" stroke="#FF8030" strokeWidth="1.2" opacity="0.8"/>
      <path d="M42 34 L46 40 L44 50" stroke="#FF8030" strokeWidth="1" opacity="0.7"/>
      <rect x="7" y="29" width="50" height="5" fill="#200808" opacity="0.5"/>
      <rect x="7" y="40" width="50" height="3" fill="#200808" opacity="0.4"/>
      <rect x="8" y="27" width="6" height="10" rx="2" fill="#803020" stroke="#200808" strokeWidth="1.2"/>
      <rect x="50" y="27" width="6" height="10" rx="2" fill="#803020" stroke="#200808" strokeWidth="1.2"/>
      <rect x="25" y="37" width="14" height="10" rx="2" fill="#C04010" stroke="#200808" strokeWidth="1.5"/>
      <ellipse cx="32" cy="42" rx="4" ry="4" fill="#FF6020" opacity="0.9"/>
      <ellipse cx="32" cy="42" rx="2" ry="2.5" fill="#FFCF00"/>
      <path d="M18 31 Q20 25 18 20 Q23 26 21 31" fill="#FF8030" opacity="0.9"/>
      <path d="M30 31 Q32 22 30 16 Q36 24 34 31" fill="#FFA040" opacity="0.85"/>
      <path d="M44 31 Q46 26 44 21 Q49 27 47 31" fill="#FF8030" opacity="0.8"/>
    </svg>
  );

  if (normalized === "immortal") return (
    <svg viewBox="0 0 64 64" fill="none" className={className}>
      <defs>
        <linearGradient id="imc-lid" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#F0D060"/><stop offset="100%" stopColor="#C09020"/></linearGradient>
        <linearGradient id="imc-body" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#D4A820"/><stop offset="100%" stopColor="#8B6810"/></linearGradient>
        <radialGradient id="imc-glow" cx="50%" cy="50%" r="60%"><stop offset="0%" stopColor="#FFE840" stopOpacity="0.5"/><stop offset="100%" stopColor="#FFE840" stopOpacity="0"/></radialGradient>
      </defs>
      <ellipse cx="32" cy="32" rx="28" ry="26" fill="url(#imc-glow)"/>
      <rect x="7" y="32" width="50" height="24" rx="3" fill="url(#imc-body)" stroke="#7A5010" strokeWidth="1.5"/>
      <path d="M7 32 Q7 15 32 15 Q57 15 57 32Z" fill="url(#imc-lid)" stroke="#7A5010" strokeWidth="1.5"/>
      <path d="M20 26 Q32 18 44 26" stroke="#FFE840" strokeWidth="1" opacity="0.8" fill="none"/>
      <path d="M24 30 Q32 23 40 30" stroke="#FFE840" strokeWidth="0.8" opacity="0.6" fill="none"/>
      <rect x="7" y="29" width="50" height="5" fill="#7A5010" opacity="0.4"/>
      <rect x="7" y="40" width="50" height="3" fill="#7A5010" opacity="0.3"/>
      <path d="M14 37 L18 42 L14 47 L10 42Z" fill="#F0D060" opacity="0.5"/>
      <path d="M46 37 L50 42 L46 47 L42 42Z" fill="#F0D060" opacity="0.5"/>
      <rect x="8" y="27" width="6" height="10" rx="2" fill="#D4A820" stroke="#7A5010" strokeWidth="1.2"/>
      <circle cx="11" cy="32" r="2" fill="#FFE840"/>
      <rect x="50" y="27" width="6" height="10" rx="2" fill="#D4A820" stroke="#7A5010" strokeWidth="1.2"/>
      <circle cx="53" cy="32" r="2" fill="#FFE840"/>
      <rect x="25" y="37" width="14" height="10" rx="2.5" fill="#E8C030" stroke="#7A5010" strokeWidth="1.5"/>
      <path d="M29 37 Q29 32.5 32 32.5 Q35 32.5 35 37" stroke="#7A5010" strokeWidth="1.8" fill="none" strokeLinecap="round"/>
      <polygon points="32,39 35,42 32,45 29,42" fill="#C040C0" stroke="#7A5010" strokeWidth="0.8"/>
      <polygon points="32,40.5 33.5,42 32,43.5 30.5,42" fill="white" opacity="0.7"/>
      <path d="M10 18 L11 21 L14 18 L11 21 L12 24 L11 21 L8 22 L11 21Z" fill="#FFE840" opacity="0.9"/>
      <path d="M50 12 L51 15 L54 12 L51 15 L52 18 L51 15 L48 16 L51 15Z" fill="#FFE840" opacity="0.8"/>
      <path d="M54 48 L55 50 L57 48 L55 50 L56 52 L55 50 L53 51 L55 50Z" fill="#FFE840" opacity="0.7"/>
    </svg>
  );

  return null;
}
