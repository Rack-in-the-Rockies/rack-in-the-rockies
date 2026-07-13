/**
 * Decorative flowers, eucalyptus, and mahjong tiles for the Mahjong in Bloom hero.
 * Purely ornamental: hidden from screen readers, non-interactive.
 */

type BloomProps = {
  /** Outer petal color */
  outer: string;
  /** Inner petal color */
  inner: string;
  /** Center color */
  core: string;
  className?: string;
};

/** A ranunculus-style bloom: rings of petals, tighter toward the middle. */
function Bloom({ outer, inner, core, className = "" }: BloomProps) {
  const ring = (count: number, ry: number, cy: number, fill: string, o: number) =>
    Array.from({ length: count }, (_, i) => (
      <ellipse
        key={`${cy}-${i}`}
        cx="50"
        cy={cy}
        rx={ry * 0.62}
        ry={ry}
        fill={fill}
        opacity={o}
        transform={`rotate(${(360 / count) * i} 50 50)`}
      />
    ));

  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true">
      {ring(8, 26, 26, outer, 0.9)}
      {ring(7, 19, 33, inner, 0.95)}
      {ring(6, 12, 40, inner, 1)}
      <circle cx="50" cy="50" r="7" fill={core} />
    </svg>
  );
}

/** A eucalyptus sprig: gently curved stem with round leaves down both sides. */
function Eucalyptus({ className = "" }: { className?: string }) {
  const leaves = [
    { cx: 34, cy: 26, r: 8.5, rot: -32 },
    { cx: 62, cy: 34, r: 9.5, rot: 28 },
    { cx: 32, cy: 50, r: 10, rot: -24 },
    { cx: 64, cy: 60, r: 9, rot: 30 },
    { cx: 38, cy: 74, r: 8, rot: -20 },
    { cx: 60, cy: 84, r: 7, rot: 24 },
  ];

  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true">
      <path
        d="M50 96 C 46 72, 54 48, 48 22 C 47 16, 49 10, 52 6"
        stroke="#8FA37E"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
        opacity="0.75"
      />
      {leaves.map((l, i) => (
        <ellipse
          key={i}
          cx={l.cx}
          cy={l.cy}
          rx={l.r}
          ry={l.r * 0.72}
          fill={i % 2 === 0 ? "#9CB088" : "#B4C4A2"}
          opacity="0.8"
          transform={`rotate(${l.rot} ${l.cx} ${l.cy})`}
        />
      ))}
    </svg>
  );
}

/** A mahjong tile, matching the style used on the homepage hero. */
function Tile({
  face,
  className = "",
}: {
  face: string;
  className?: string;
}) {
  return (
    <div
      className={`absolute flex h-[52px] w-10 items-center justify-center rounded-lg border-2 border-coral/15 bg-white/80 text-lg shadow-lg ${className}`}
      aria-hidden="true"
    >
      {face}
    </div>
  );
}

export function EventHeroDecor() {
  return (
    <div
      className="pointer-events-none absolute inset-0 z-[1] overflow-hidden select-none"
      aria-hidden="true"
    >
      {/* Top-left cluster: bloom + eucalyptus */}
      <Bloom
        outer="#FFB396"
        inner="#FF8E53"
        core="#FFC857"
        className="absolute -left-6 top-4 h-32 w-32 opacity-70 md:h-40 md:w-40"
      />
      <Eucalyptus className="absolute left-16 -top-4 hidden h-32 w-32 rotate-[18deg] opacity-70 md:block" />

      {/* Top-right cluster: bloom + eucalyptus */}
      <Bloom
        outer="#FFC857"
        inner="#FFA76B"
        core="#FF6B6B"
        className="absolute -right-8 top-0 h-28 w-28 opacity-60 md:h-36 md:w-36"
      />
      <Eucalyptus className="absolute right-20 top-16 hidden h-28 w-28 -rotate-[24deg] opacity-60 lg:block" />

      {/* Bottom-left: blush bloom */}
      <Bloom
        outer="#FFD9C6"
        inner="#FFB396"
        core="#FF8E53"
        className="absolute -left-10 bottom-2 hidden h-36 w-36 opacity-55 md:block"
      />

      {/* Bottom-right: coral bloom + eucalyptus */}
      <Bloom
        outer="#FF8E53"
        inner="#FF6B6B"
        core="#FFC857"
        className="absolute -right-6 bottom-4 h-24 w-24 opacity-55 md:h-32 md:w-32"
      />
      <Eucalyptus className="absolute bottom-0 right-24 hidden h-28 w-28 rotate-[140deg] opacity-55 lg:block" />

      {/* Floating tiles */}
      <Tile
        face="🀄"
        className="left-[8%] top-[26%] rotate-[-12deg] animate-[float1_6s_ease-in-out_infinite]"
      />
      <Tile
        face="🀙"
        className="right-[9%] top-[40%] rotate-[10deg] animate-[float2_7s_ease-in-out_infinite]"
      />
      <Tile
        face="🀐"
        className="bottom-[14%] left-[13%] hidden rotate-[7deg] animate-[float3_5s_ease-in-out_infinite] md:flex"
      />
      <Tile
        face="🀇"
        className="bottom-[20%] right-[12%] hidden rotate-[-8deg] animate-[float1_8s_ease-in-out_infinite] md:flex"
      />
    </div>
  );
}
