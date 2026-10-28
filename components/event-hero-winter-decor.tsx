/**
 * Winter decor for event heroes: an icy frame of mahjong tiles painted with
 * snowflakes, mittens, teacups, and wind letters, after the Snowshoe Mahjong
 * save-the-date. Purely ornamental: hidden from screen readers, non-interactive.
 */

const INK = "#5B84C4";
const PALE = "#9DB7E0";

function Snowflake() {
  const arms = Array.from({ length: 6 }, (_, i) => i * 60);
  return (
    <g stroke={INK} strokeWidth="2" strokeLinecap="round" fill="none">
      {arms.map((deg) => (
        <g key={deg} transform={`rotate(${deg} 20 26)`}>
          <line x1="20" y1="26" x2="20" y2="11" />
          <polyline points="16,15 20,19 24,15" />
          <polyline points="17.5,11.5 20,14 22.5,11.5" />
        </g>
      ))}
      <circle cx="20" cy="26" r="2" fill={INK} stroke="none" />
    </g>
  );
}

function Mitten() {
  return (
    <g>
      <path
        d="M14 36 L14 22 C14 15 18 12 22 12 C27 12 29 16 29 21 L29 36 Z"
        fill={PALE}
        stroke={INK}
        strokeWidth="1.5"
      />
      <path d="M14 26 C9 25 8 19 11 17 C13 16 14 18 14 20" fill={PALE} stroke={INK} strokeWidth="1.5" />
      <rect x="12.5" y="35" width="18" height="5" rx="1.5" fill={INK} />
      <path d="M21.5 20 l0 8 M18 24 l7 0 M19 21.5 l5 5 M24 21.5 l-5 5" stroke="white" strokeWidth="1.2" />
    </g>
  );
}

function Teacup() {
  return (
    <g stroke={INK} strokeWidth="1.5">
      <path d="M10 22 L30 22 L28 32 C27 35 25 36 22 36 L18 36 C15 36 13 35 12 32 Z" fill="white" />
      <path d="M29.5 24.5 C34 24 34 30 28.5 30" fill="none" />
      <ellipse cx="20" cy="38.5" rx="12" ry="2" fill={PALE} />
      <path d="M17 18 C15 15 19 14 17 11 M23 18 C21 15 25 14 23 11" fill="none" stroke={PALE} strokeLinecap="round" />
      <path d="M20 26 l0 6 M17 29 l6 0" stroke={PALE} strokeLinecap="round" />
    </g>
  );
}

function Beanie() {
  return (
    <g>
      <circle cx="20" cy="11" r="4" fill="white" stroke={INK} strokeWidth="1.5" />
      <path d="M9 32 L9 26 C9 18 14 14 20 14 C26 14 31 18 31 26 L31 32 Z" fill={INK} />
      <rect x="7.5" y="31" width="25" height="7" rx="2" fill={PALE} stroke={INK} strokeWidth="1.5" />
      <path d="M13 24 l3 -3 l3 3 l3 -3 l3 3 l3 -3" fill="none" stroke="white" strokeWidth="1.2" />
    </g>
  );
}

function Earmuffs() {
  return (
    <g>
      <path d="M11 28 C10 14 30 14 29 28" fill="none" stroke={INK} strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="11" cy="31" r="6" fill={PALE} stroke={INK} strokeWidth="1.5" />
      <circle cx="29" cy="31" r="6" fill={PALE} stroke={INK} strokeWidth="1.5" />
      <path d="M11 28.5 l0 5 M8.5 31 l5 0 M29 28.5 l0 5 M26.5 31 l5 0" stroke="white" strokeWidth="1.2" />
    </g>
  );
}

function PineSprig() {
  const needles = [14, 19, 24, 29, 34];
  return (
    <g stroke={INK} strokeWidth="1.4" strokeLinecap="round" fill="none">
      <path d="M20 40 L20 10" />
      {needles.map((y) => (
        <g key={y}>
          <path d={`M20 ${y} L13 ${y - 4}`} />
          <path d={`M20 ${y} L27 ${y - 4}`} />
        </g>
      ))}
      <circle cx="20" cy="10" r="1.6" fill={PALE} stroke="none" />
    </g>
  );
}

function Wind({ letter }: { letter: string }) {
  return (
    <text
      x="20"
      y="34"
      textAnchor="middle"
      fontFamily="var(--font-playfair), serif"
      fontStyle="italic"
      fontSize="24"
      fontWeight="700"
      fill={PALE}
      stroke={INK}
      strokeWidth="0.8"
    >
      {letter}
    </text>
  );
}

const FACES = {
  snowflake: <Snowflake />,
  mitten: <Mitten />,
  teacup: <Teacup />,
  beanie: <Beanie />,
  earmuffs: <Earmuffs />,
  pine: <PineSprig />,
  north: <Wind letter="N" />,
  south: <Wind letter="S" />,
} as const;

type Face = keyof typeof FACES;

/** A white tile with a pale blue edge, like the tiles on the flyer. */
function WinterTile({ face, rotate = 0 }: { face: Face; rotate?: number }) {
  return (
    <svg
      viewBox="0 0 40 52"
      className="h-full w-full drop-shadow-[0_3px_4px_rgba(62,104,168,0.18)]"
      style={rotate ? { transform: `rotate(${rotate}deg)` } : undefined}
      aria-hidden="true"
    >
      <rect x="1" y="3" width="38" height="48" rx="6" fill="#C9D9EE" />
      <rect x="1" y="1" width="38" height="47" rx="6" fill="#FFFFFF" stroke="#DCE6F4" strokeWidth="1.5" />
      <g transform="translate(0 -1.5)">{FACES[face]}</g>
    </svg>
  );
}

const TOP: Face[] = ["teacup", "snowflake", "pine", "beanie", "south", "snowflake", "mitten"];
const BOTTOM: Face[] = ["pine", "snowflake", "earmuffs", "teacup", "snowflake", "north", "mitten"];
const LEFT: Face[] = ["mitten", "north", "snowflake"];
const RIGHT: Face[] = ["snowflake", "earmuffs", "beanie"];

/** Tiles in the row that only show on wider screens, so phones get 4 per row. */
const WIDE_ONLY = new Set([1, 3, 5]);

function TileRow({ faces, className }: { faces: Face[]; className: string }) {
  return (
    <div className={`absolute inset-x-0 flex justify-center gap-3 px-4 md:gap-4 ${className}`}>
      {faces.map((face, i) => (
        <div
          key={i}
          className={`h-14 w-11 md:h-[68px] md:w-[52px] ${WIDE_ONLY.has(i) ? "hidden sm:block" : ""}`}
        >
          <WinterTile face={face} rotate={i % 2 === 0 ? -3 : 3} />
        </div>
      ))}
    </div>
  );
}

function TileColumn({ faces, className }: { faces: Face[]; className: string }) {
  return (
    <div className={`absolute inset-y-0 hidden flex-col justify-center gap-6 lg:flex ${className}`}>
      {faces.map((face, i) => (
        <div key={i} className="h-[68px] w-[52px]">
          <WinterTile face={face} rotate={i % 2 === 0 ? 4 : -4} />
        </div>
      ))}
    </div>
  );
}

export function EventHeroWinterDecor() {
  return (
    <div
      className="pointer-events-none absolute inset-0 z-0 overflow-hidden select-none"
      aria-hidden="true"
    >
      {/* Frosted glow behind the text */}
      <div className="absolute left-1/2 top-1/2 h-[80%] w-[70%] -translate-x-1/2 -translate-y-1/2 bg-[radial-gradient(ellipse,rgba(255,255,255,0.75)_0%,transparent_70%)]" />

      <TileRow faces={TOP} className="top-4 md:top-5" />
      <TileRow faces={BOTTOM} className="bottom-4 md:bottom-5" />
      <TileColumn faces={LEFT} className="left-[3%] xl:left-[6%]" />
      <TileColumn faces={RIGHT} className="right-[3%] xl:right-[6%]" />
    </div>
  );
}
