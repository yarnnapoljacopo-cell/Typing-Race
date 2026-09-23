import { useEffect, useId, useRef, useState } from "react";

/** A short reaction only when a real score/health change is received. */
export function useBattleReaction(value: number, enabled: boolean, direction: "increase" | "decrease" = "increase") {
  const previous = useRef(value);
  const sequence = useRef(0);
  const [reaction, setReaction] = useState<{ id: number; amount: number } | null>(null);
  useEffect(() => {
    const delta = direction === "increase" ? value - previous.current : previous.current - value;
    previous.current = value;
    if (!enabled || delta <= 0) { setReaction(null); return; }
    setReaction({ id: ++sequence.current, amount: Math.round(delta) });
    const timer = setTimeout(() => setReaction(null), 650);
    return () => clearTimeout(timer);
  }, [value, enabled, direction]);
  return reaction;
}

/** Layered vector characters extend the app's original rounded game artwork. */
export function BattleCharacter({ character, label, defeated = false, attacking = false, hit = false, active = true, attackId = 0, hitId = 0 }: {
  character: number; label: string; defeated?: boolean; attacking?: boolean; hit?: boolean; active?: boolean; attackId?: number; hitId?: number;
}) {
  const id = useId().replace(/:/g, "");
  const fighter = character >= 4;
  const warm = character === 2 || character === 5;
  const body = character === 3 ? ["#80c5dd", "#5375b4"] : warm ? ["#e2a0ae", "#9e648f"] : ["#ad9de4", "#7162b7"];
  const dark = character === 3 ? "#344b80" : warm ? "#704360" : "#493e81";
  const outline = { stroke: dark, strokeWidth: 2.7, strokeLinejoin: "round" as const, strokeLinecap: "round" as const };
  return <svg className={`battle-character${defeated ? " character-defeated" : ""}${active ? " character-active" : ""}${attacking ? " character-attacking" : ""}${hit ? " character-hit" : ""}${character === 5 ? " character-facing-left" : ""}`} viewBox="0 0 180 190" role="img" aria-label={label}>
    <defs>
      <linearGradient id={`${id}-body`} x1="0" y1="0" x2=".8" y2="1"><stop stopColor={body[0]} /><stop offset="1" stopColor={body[1]} /></linearGradient>
      <linearGradient id={`${id}-metal`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#f3edff" /><stop offset=".5" stopColor="#acb8dd" /><stop offset="1" stopColor="#7c8caf" /></linearGradient>
      <linearGradient id={`${id}-horn`} x1="0" y1="0" x2="0" y2="1"><stop stopColor="#f8e9bd" /><stop offset="1" stopColor="#cab387" /></linearGradient>
    </defs>
    <ellipse className="character-shadow" cx="90" cy="176" rx={fighter ? 37 : 44} ry="6" fill={dark} opacity=".13" />
    <g key={hitId} className="character-reaction"><g className="character-idle">
      {fighter ? <>
        <path className="character-cape" d="M65 90Q43 117 46 157L61 151L73 163L93 151L120 160Q114 121 110 93Z" fill={warm ? "#d4879c" : "#9b8cd4"} {...outline} />
        <path d="M74 140L71 168Q59 174 68 176H85L88 144M99 142L101 172Q119 180 123 173L113 168L111 138" fill={dark} {...outline} />
        <path d="M67 92Q87 81 111 92L116 131Q91 146 64 130Z" fill={`url(#${id}-metal)`} {...outline} />
        <path d="M74 100Q89 109 107 100M91 106V130" fill="none" stroke="#f6f4ff" strokeWidth="2.4" opacity=".8" />
        <path d="M65 129L116 129L112 144L99 141L91 149L80 141L65 144Z" fill={body[1]} {...outline} />
        <rect x="67" y="126" width="47" height="8" rx="3" fill={dark} /><rect x="85" y="126" width="11" height="8" rx="2" fill="#edca7c" />
        <g key={attackId} className="character-sword-arm">
          <path d="M110 96Q123 97 130 117" fill="none" stroke={dark} strokeWidth="13" strokeLinecap="round" />
          <path d="M110 95Q123 98 130 115" fill="none" stroke={`url(#${id}-metal)`} strokeWidth="8" strokeLinecap="round" />
          <path d="M130 112L151 56L158 46L160 61L139 115Z" fill={`url(#${id}-metal)`} {...outline} />
          <path d="M153 60L136 105" stroke="white" strokeWidth="2" strokeLinecap="round" />
          <path d="M123 108L146 117M131 115L126 129" stroke="#d5b777" strokeWidth="6" strokeLinecap="round" />
        </g>
        <g className="character-shield">
          <path d="M60 99Q72 97 74 115L66 145Q42 140 38 114L42 100Z" fill={body[1]} {...outline} />
          <path d="M47 106L66 105L65 129L60 136Q46 129 47 106Z" fill={body[0]} stroke="#eee5ff" strokeWidth="2" />
          <path d="M56 113L62 119L57 126L51 120Z" fill="#f3d598" />
        </g>
        <g className="character-head">
          <path className="character-plume" d="M67 48Q61 23 91 20Q114 21 112 43L99 49Q106 28 83 35L80 50Z" fill={warm ? "#dc91a6" : "#aaa0e3"} {...outline} />
          <path d="M79 28Q98 24 103 35M73 33L78 42" stroke="#ffffff70" strokeWidth="2" strokeLinecap="round" />
          <path d="M61 66Q59 43 87 40Q114 39 120 65L118 89L102 95L88 84L73 95L59 85Z" fill={`url(#${id}-metal)`} {...outline} />
          <path d="M66 65Q86 57 114 66L111 82L97 84L89 77L81 85L67 80Z" fill={dark} />
          <g className="character-eyes"><path d={defeated ? "M72 69L80 76M80 69L72 76M99 69L107 76M107 69L99 76" : "M71 69Q78 73 83 70M97 70Q104 73 110 69"} fill="none" stroke={defeated ? "#b1bed9" : "#fff1bb"} strokeWidth="3" strokeLinecap="round" /></g>
          <path d="M88 44V63L91 86" stroke="#f4f3ff" strokeWidth="3" strokeLinecap="round" /><path d="M66 55Q71 46 81 46" stroke="white" strokeWidth="3" strokeLinecap="round" opacity=".7" />
        </g>
      </> : <>
        {character === 0 && <>
          <path className="character-tail" d="M117 141Q154 162 149 129L142 117L157 124L158 139Q156 168 122 157" fill={body[1]} {...outline} />
          <path className="character-wing-left" d="M58 86Q30 63 21 81L29 105L41 101L45 121L63 109Z" fill={body[1]} {...outline} />
          <path className="character-wing-right" d="M122 86Q150 63 159 81L151 105L139 101L135 121L117 109Z" fill={body[1]} {...outline} />
          <path d="M28 82L51 105M152 82L130 105" stroke={body[0]} strokeWidth="2" />
        </>}
        {character === 3 && <g className="character-tendrils" fill="none" stroke={body[1]} strokeWidth="12" strokeLinecap="round">
          <path d="M65 122Q27 129 35 152Q43 167 57 153M116 122Q154 129 145 152Q136 166 122 154M77 143Q60 170 80 167M102 143Q120 171 102 167" />
          <path d="M48 111Q20 99 32 86M128 111Q157 97 146 83" strokeWidth="8" />
        </g>}
        {character === 1 ? <path className="character-cloak" d="M57 85Q42 123 43 158Q55 149 64 164Q80 155 90 170Q99 156 116 164Q127 149 140 158Q134 118 120 85Z" fill={`url(#${id}-body)`} {...outline} /> : <>
          <path d="M57 150L55 167Q60 178 78 171L80 150M102 151L104 171Q123 178 127 167L124 149" fill={body[1]} {...outline} />
          <path d="M54 108Q51 88 89 90Q128 86 128 112L126 148Q125 166 91 165Q56 164 54 146Z" fill={`url(#${id}-body)`} {...outline} />
          <ellipse cx="90" cy="135" rx="21" ry="22" fill={body[0]} opacity=".65" />
        </>}
        <path className="character-hand-left" d="M57 109Q44 102 42 117L40 130Q47 137 55 128" fill={body[0]} {...outline} />
        <path className="character-hand-right" d="M123 109Q136 102 138 117L140 130Q133 137 125 128" fill={body[0]} {...outline} />
        {character === 2 && <><path d="M56 104L43 100L46 91L64 87M121 105L136 100L133 91L116 87" fill="#dec5e7" {...outline} /><path d="M67 117L90 111L114 117L110 145L90 156L70 145Z" fill={dark} stroke="#e8c4dd" strokeWidth="2.5" /><path d="M90 120L101 131L90 144L79 131Z" fill="#edb47e" /><path d="M62 155H121" stroke={dark} strokeWidth="6" /></>}
        <g className="character-head">
          {character !== 1 && <><path d="M59 52Q38 43 46 22Q52 39 70 39M120 52Q140 43 132 22Q126 39 110 39" fill={`url(#${id}-horn)`} {...outline} />{character >= 2 && <path d="M81 39L89 20L99 39" fill={`url(#${id}-horn)`} {...outline} />}</>}
          {character === 1 ? <><path d="M45 77Q42 46 90 22Q138 46 135 77L122 111L58 111Z" fill={`url(#${id}-body)`} {...outline} /><path d="M60 77Q58 52 90 43Q122 52 120 77L110 98L70 98Z" fill={dark} /><path d="M63 50Q77 37 89 33" stroke="#d7cdff" strokeWidth="3" strokeLinecap="round" opacity=".7" /></> : <>
            <path d="M52 66Q50 40 88 39Q125 37 129 63L132 88Q127 115 91 115Q56 115 49 91Z" fill={`url(#${id}-body)`} {...outline} />
            <path d="M58 63Q60 48 78 48" stroke="#e2d9ff" strokeWidth="4" strokeLinecap="round" opacity=".6" />
            <path d="M50 65L33 57L40 82L52 85M128 65L145 57L139 82L130 85" fill={body[0]} {...outline} />
          </>}
          <g className="character-eyes">
            {defeated ? <path d="M65 73L78 86M78 73L65 86M103 73L116 86M116 73L103 86" fill="none" stroke={character === 1 ? "#d7cbf8" : dark} strokeWidth="3" strokeLinecap="round" /> : <>
              <ellipse cx="72" cy="79" rx="12" ry="15" fill="#fffcf5" /><ellipse cx="109" cy="79" rx="12" ry="15" fill="#fffcf5" />
              <ellipse cx="76" cy="81" rx="6" ry="9" fill={dark} /><ellipse cx="105" cy="81" rx="6" ry="9" fill={dark} /><circle cx="78" cy="77" r="2.5" fill="white" /><circle cx="107" cy="77" r="2.5" fill="white" />
              {character === 3 && <><ellipse cx="91" cy="57" rx="8" ry="9" fill="#fffcf5" /><ellipse cx="91" cy="58" rx="4" ry="6" fill={dark} /><circle cx="92" cy="56" r="1.5" fill="white" /></>}
            </>}
          </g>
          <path d={defeated ? "M83 101Q91 97 99 101" : "M80 97Q91 106 102 96"} fill="none" stroke={character === 1 ? "#b9a9e4" : dark} strokeWidth="2.7" strokeLinecap="round" />
          {!defeated && <path d="M82 99L86 106L89 101M94 101L98 106L101 98" fill="#fffaf0" />}
          {character !== 1 && <><ellipse cx="60" cy="96" rx="6" ry="3" fill="#edbbd1" opacity=".5" /><ellipse cx="121" cy="96" rx="6" ry="3" fill="#edbbd1" opacity=".5" /></>}
          {character === 2 && <path d="M59 61L78 66M121 61L103 66" fill="none" stroke={dark} strokeWidth="4" strokeLinecap="round" />}
        </g>
      </>}
    </g></g>
    {hit && !defeated && <g key={hitId} className="character-impact" stroke="#e6af59" strokeWidth="3" strokeLinecap="round"><path d="M139 41L150 32M146 52L161 50M137 30L141 18" /></g>}
  </svg>;
}
