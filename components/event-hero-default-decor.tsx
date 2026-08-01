/**
 * Default decorative art for event heroes: layered mountain silhouettes and
 * floating mahjong tiles in the brand palette. Purely ornamental: hidden
 * from screen readers, non-interactive. Shown when an event has no image.
 */

function Tile({ className, rotate }: { className?: string; rotate: number }) {
  return (
    <svg
      viewBox="0 0 40 52"
      className={className}
      style={{ transform: `rotate(${rotate}deg)` }}
      aria-hidden="true"
    >
      <rect x="1" y="1" width="38" height="50" rx="6" fill="#FFFCFA" stroke="#FFE8E0" strokeWidth="2" />
      <circle cx="20" cy="20" r="7" fill="none" stroke="#FF6B6B" strokeWidth="2.5" />
      <circle cx="20" cy="20" r="2.5" fill="#FF8E53" />
      <rect x="13" y="33" width="14" height="3" rx="1.5" fill="#FFC857" />
      <rect x="13" y="39" width="14" height="3" rx="1.5" fill="#FFC857" opacity="0.6" />
    </svg>
  );
}

function MountainRange({ className, flip }: { className?: string; flip?: boolean }) {
  return (
    <svg
      viewBox="0 0 320 140"
      className={className}
      style={flip ? { transform: "scaleX(-1)" } : undefined}
      aria-hidden="true"
      preserveAspectRatio="none"
    >
      <path d="M0 140 L70 40 L110 90 L170 10 L230 100 L280 55 L320 140 Z" fill="#FF6B6B" opacity="0.10" />
      <path d="M0 140 L50 80 L120 30 L190 110 L250 60 L320 140 Z" fill="#FF8E53" opacity="0.12" />
      <path d="M155 30 L170 10 L185 32 L170 26 Z" fill="#FFFCFA" opacity="0.8" />
    </svg>
  );
}

export function EventHeroDefaultDecor() {
  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden" aria-hidden="true">
      <MountainRange className="absolute -bottom-1 left-0 w-[55%] max-w-md" />
      <MountainRange className="absolute -bottom-1 right-0 w-[45%] max-w-sm" flip />
      <Tile className="absolute left-[5%] top-[12%] w-12 opacity-90 drop-shadow-md md:w-16" rotate={-12} />
      <Tile className="absolute right-[6%] top-[18%] w-11 opacity-85 drop-shadow-md md:w-14" rotate={10} />
      <Tile className="absolute left-[12%] bottom-[24%] w-10 opacity-75 drop-shadow-md md:w-12" rotate={7} />
      <Tile className="absolute right-[14%] bottom-[28%] w-11 opacity-80 drop-shadow-md md:w-14" rotate={-6} />
    </div>
  );
}
