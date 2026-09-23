import { useId } from "react";

interface VehiclePaint { car: string; shade: string; light: string; trim?: string; }

function Wheel({ x, y, radius = 4 }: { x: number; y: number; radius?: number }) {
  return <g transform={`translate(${x} ${y})`}>
    <circle r={radius} fill="#151c2b" stroke="#080e19" strokeWidth=".7" />
    <circle r={radius * .67} fill="#65748b" stroke="#b3c0d2" strokeWidth=".55" />
    <g className="vehicle-wheel-spokes" stroke="#dce5ef" strokeWidth=".65" strokeLinecap="round">
      <path d="M0 -2.2V2.2M-2.2 0H2.2M-1.55 -1.55L1.55 1.55M-1.55 1.55L1.55 -1.55" />
    </g>
    <circle r=".85" fill="#202c41" />
    <path d={`M${-radius*.72} ${-radius*.3}A${radius*.78} ${radius*.78} 0 0 1 ${radius*.6} ${-radius*.55}`} fill="none" stroke="#ffffff25" strokeWidth=".65" />
  </g>;
}

/** Shared artwork keeps equipped skins and the room's default vehicles consistent.
 * The original SVG dimensions are retained so existing room geometry is unchanged. */
export function RoadCar({ car, shade, light, trim }: VehiclePaint) {
  const id = `car-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  return <svg className="race-vehicle" viewBox="0 0 48 24" width="48" height="24" fill="none" aria-hidden="true">
    <defs>
      <linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop stopColor={light}/><stop offset=".42" stopColor={car}/><stop offset="1" stopColor={shade}/></linearGradient>
      <linearGradient id={`${id}-glass`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#d3f0ff"/><stop offset=".55" stopColor="#789eb8"/><stop offset="1" stopColor="#304762"/></linearGradient>
    </defs>
    <ellipse cx="24" cy="22.4" rx="21" ry="1.2" fill="#060c1a" opacity=".22" />
    <path d="M3 11L8 9L15 3.8Q17 2.5 20 2.5H28Q31 2.5 34 6L37 9L44 10.5Q46 11 46 14V18Q45 20 42 20H5Q2 20 2 17V13Z" fill={`url(#${id})`} stroke={shade} strokeWidth=".8" />
    <path d="M10.5 9L16.5 4.6H22V9ZM23.7 4.6H28.5Q31 4.8 34 9H23.7Z" fill={`url(#${id}-glass)`} stroke="#172c4355" strokeWidth=".55" />
    <path d="M17.7 5.1L13.7 8.2M26 5.3L30 8.2" stroke="#effbff" strokeWidth=".65" opacity=".7" />
    <path d="M5 11.4Q24 9.8 42 11.4" stroke="#fff" opacity=".48" strokeWidth=".7" strokeLinecap="round" />
    <path d="M22.7 10.4V17M8 17H38" stroke={shade} opacity=".6" strokeWidth=".65" />
    <path d="M18.5 11.5H21" stroke="#e4ebf6" strokeWidth=".85" strokeLinecap="round" />
    <path d="M5 16.5H42" stroke={trim ?? light} opacity=".65" strokeWidth="1" />
    <path d="M4.5 20V18.8a6 6 0 0 1 12 0V20M31 20V18.8a6 6 0 0 1 12 0V20" fill={shade} />
    <Wheel x={10.5} y={19.1}/><Wheel x={37} y={19.1}/>
    <path d="M40.5 11.8L45.3 12.6V14.2H41.8Z" fill="#fff4c8" stroke="#ffffff80" strokeWidth=".4" />
    <path d="M2.6 12H5V14.4H2.6" fill="#ffc0ba"/><path d="M43.5 17H46M2.4 17.2H4.3" stroke="#a8b5c8" strokeWidth="1.2" strokeLinecap="round" />
    <path d="M32 9.1L35 9.4" stroke={shade} strokeWidth="1.7" strokeLinecap="round" />
  </svg>;
}

export function RaceKart({ car, shade, light, trim, laneNum }: VehiclePaint & { laneNum: number }) {
  const id = `kart-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  return <svg className="race-vehicle" width="52" height="30" viewBox="0 0 52 30" fill="none" aria-hidden="true">
    <defs>
      <linearGradient id={id} x1=".18" y1="0" x2=".7" y2="1"><stop stopColor={light}/><stop offset=".38" stopColor={car}/><stop offset="1" stopColor={shade}/></linearGradient>
      <linearGradient id={`${id}-metal`} x1="0" y1="0" x2="0" y2="1"><stop stopColor="#d9e2ed"/><stop offset=".45" stopColor="#718196"/><stop offset="1" stopColor="#263344"/></linearGradient>
      <linearGradient id={`${id}-visor`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#c7ecfa"/><stop offset=".38" stopColor="#426981"/><stop offset="1" stopColor="#14263b"/></linearGradient>
    </defs>
    <ellipse cx="26" cy="28" rx="23" ry="1.4" fill="#080e1b" opacity=".28" />
    {/* Reinforced low chassis and rear wing read cleanly at race-track size. */}
    <path d="M5 18L12 15H39L47 19L46 25H7Z" fill="#202b39" stroke="#677789" strokeWidth=".65" />
    <path d="M4 11H15L13 13H3Z" fill={`url(#${id}-metal)`} stroke="#263344" strokeWidth=".65" />
    <path d="M7 12L9 18M12 12L14 17" stroke="#aebbc8" strokeWidth="1.2" />
    <path d="M6 20L13 16L31 15L40 17L48 20L48 23L44 25H9L6 23Z" fill={`url(#${id})`} stroke={shade} strokeWidth="1" />
    <path d="M8 20L18 17L32 17L40 19" stroke="#ffffff" strokeOpacity=".58" strokeWidth=".8" strokeLinecap="round" />
    <path d="M16 19L20 14H31L35 19L29 21H17Z" fill="#1e2b3a" stroke="#79889b" strokeWidth=".7" />
    <path d="M21 13L23 10H27L31 17H24Z" fill={`url(#${id})`} stroke={shade} strokeWidth=".75" />
    <path d="M29 16L34 14" stroke="#c8d3df" strokeWidth="1.7" strokeLinecap="round" />
    <path d="M33 12L35 16" stroke="#263344" strokeWidth="1.4" strokeLinecap="round" />
    <path d="M18 8Q18 3 23.5 2.5Q29.5 3 30 8L29 12H20Z" fill={`url(#${id})`} stroke={shade} strokeWidth=".9" />
    <path d="M21 6.5H29L28.6 10H21.5Z" fill={`url(#${id}-visor)`} stroke="#14263b" strokeWidth=".6" />
    <path d="M21.8 7.2L26.8 7" stroke="#e3f7ff" strokeOpacity=".82" strokeWidth=".7" strokeLinecap="round" />
    <path d="M20 5.5Q23 3 26 4" stroke="#ffffff" strokeOpacity=".75" strokeWidth=".8" strokeLinecap="round" />
    <path d="M35 19L45 20L49 22L45 24H35Z" fill={`url(#${id}-metal)`} stroke="#253346" strokeWidth=".7" />
    <path d="M39 20L46 20.8" stroke="#e7f0f5" strokeOpacity=".75" strokeWidth=".7" />
    <path d="M8 22H17M33 22H43" stroke={trim ?? light} strokeWidth="1.25" strokeLinecap="round" />
    <path d="M4 22H7M48 22H51" stroke="#dce9f4" strokeWidth="1.5" strokeLinecap="round" />
    <rect x="20.5" y="20" width="10" height="5.4" rx="1.25" fill="#e4e9ec" stroke="#344357" strokeWidth=".5"/><text x="25.5" y="24" textAnchor="middle" fontSize="4.4" fontWeight="800" fontFamily="sans-serif" fill="#24344a">{String(laneNum).padStart(2,"0")}</text>
    <Wheel x={12} y={24.5} radius={4.5}/><Wheel x={39} y={24.5} radius={4.5}/>
  </svg>;
}
