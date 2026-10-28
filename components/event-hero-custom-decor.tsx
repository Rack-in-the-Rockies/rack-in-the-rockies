/**
 * Tile art for AI-designed event themes. Icons arrive as sanitized shape
 * lists (lib/event-theme.ts) and render as plain SVG elements, so nothing in
 * a theme is ever injected as markup. Purely ornamental: hidden from screen
 * readers, non-interactive.
 */

import { ICON_SIZE, type EventTheme, type ThemeIcon, type ThemeShape } from "@/lib/event-theme";

function Shape({ shape }: { shape: ThemeShape }) {
  const stroke = { stroke: shape.stroke, strokeWidth: shape.strokeWidth, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (shape.kind) {
    case "path":
      return <path d={shape.d} fill={shape.fill} {...stroke} />;
    case "circle":
      return <circle cx={shape.cx} cy={shape.cy} r={shape.r} fill={shape.fill} {...stroke} />;
    case "ellipse":
      return (
        <ellipse
          cx={shape.cx}
          cy={shape.cy}
          rx={shape.rx}
          ry={shape.ry}
          fill={shape.fill}
          transform={shape.rotate ? `rotate(${shape.rotate} ${shape.cx} ${shape.cy})` : undefined}
          {...stroke}
        />
      );
    case "rect":
      return (
        <rect x={shape.x} y={shape.y} width={shape.width} height={shape.height} rx={shape.rx} fill={shape.fill} {...stroke} />
      );
    case "line":
      return <line x1={shape.x1} y1={shape.y1} x2={shape.x2} y2={shape.y2} {...stroke} />;
  }
}

/** A mahjong tile with the icon centered on its face. */
function ThemeTile({ icon, rotate }: { icon: ThemeIcon; rotate: number }) {
  return (
    <svg
      viewBox="0 0 40 52"
      className="h-full w-full drop-shadow-[0_3px_4px_rgba(0,0,0,0.12)]"
      style={{ transform: `rotate(${rotate}deg)` }}
      aria-hidden="true"
    >
      <rect x="1" y="3" width="38" height="48" rx="6" fill="var(--ev-tile-edge)" />
      <rect x="1" y="1" width="38" height="47" rx="6" fill="var(--ev-tile-face)" stroke="var(--ev-tile-edge)" strokeWidth="1.5" />
      {/* Fit the 40 x 40 icon canvas into the face with a small margin. */}
      <svg x="3" y="5.5" width="34" height="34" viewBox={`0 0 ${ICON_SIZE} ${ICON_SIZE}`} overflow="visible">
        {icon.shapes.map((shape, i) => (
          <Shape key={i} shape={shape} />
        ))}
      </svg>
    </svg>
  );
}

const tilt = (i: number) => (i % 2 === 0 ? -4 : 4);
const pick = (icons: ThemeIcon[], n: number, offset: number) =>
  Array.from({ length: n }, (_, i) => icons[(i + offset) % icons.length]);

function Frame({ icons }: { icons: ThemeIcon[] }) {
  const row = (offset: number, className: string) => (
    <div className={`absolute inset-x-0 flex justify-center gap-3 px-4 md:gap-4 ${className}`}>
      {pick(icons, 7, offset).map((icon, i) => (
        <div key={i} className={`h-14 w-11 md:h-[68px] md:w-[52px] ${i % 2 === 1 ? "hidden sm:block" : ""}`}>
          <ThemeTile icon={icon} rotate={tilt(i)} />
        </div>
      ))}
    </div>
  );
  const column = (offset: number, className: string) => (
    <div className={`absolute inset-y-0 hidden flex-col justify-center gap-6 lg:flex ${className}`}>
      {pick(icons, 3, offset).map((icon, i) => (
        <div key={i} className="h-[68px] w-[52px]">
          <ThemeTile icon={icon} rotate={-tilt(i)} />
        </div>
      ))}
    </div>
  );
  return (
    <>
      {row(0, "top-4 md:top-5")}
      {row(3, "bottom-4 md:bottom-5")}
      {column(1, "left-[3%] xl:left-[6%]")}
      {column(5, "right-[3%] xl:right-[6%]")}
    </>
  );
}

const CORNER_SPOTS = [
  "left-[4%] top-[10%]",
  "right-[5%] top-[14%]",
  "left-[8%] bottom-[12%] hidden md:block",
  "right-[9%] bottom-[16%] hidden md:block",
];

const SCATTER_SPOTS = [
  "left-[3%] top-[8%] animate-[float1_6s_ease-in-out_infinite]",
  "right-[4%] top-[12%] animate-[float2_7s_ease-in-out_infinite]",
  "left-[11%] top-[46%] hidden lg:block animate-[float3_5s_ease-in-out_infinite]",
  "right-[10%] top-[50%] hidden lg:block animate-[float1_8s_ease-in-out_infinite]",
  "left-[5%] bottom-[8%] hidden md:block animate-[float2_6s_ease-in-out_infinite]",
  "right-[6%] bottom-[10%] hidden md:block animate-[float3_7s_ease-in-out_infinite]",
];

function Spots({ icons, spots }: { icons: ThemeIcon[]; spots: string[] }) {
  return (
    <>
      {spots.map((spot, i) => (
        <div key={i} className={`absolute h-[60px] w-[46px] md:h-[78px] md:w-[60px] ${spot}`}>
          <ThemeTile icon={icons[i % icons.length]} rotate={tilt(i) * 2} />
        </div>
      ))}
    </>
  );
}

export function EventHeroCustomDecor({ theme }: { theme: EventTheme }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden select-none" aria-hidden="true">
      {/* Soft glow behind the text */}
      <div className="absolute left-1/2 top-1/2 h-[80%] w-[70%] -translate-x-1/2 -translate-y-1/2 bg-[radial-gradient(ellipse,rgba(255,255,255,0.7)_0%,transparent_70%)]" />
      {theme.layout === "frame" ? (
        <Frame icons={theme.icons} />
      ) : (
        <Spots icons={theme.icons} spots={theme.layout === "corners" ? CORNER_SPOTS : SCATTER_SPOTS} />
      )}
    </div>
  );
}
