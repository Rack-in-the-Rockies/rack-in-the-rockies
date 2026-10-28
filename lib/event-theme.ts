/**
 * AI-designed event themes. Claude returns a design recipe (palette, accent
 * font, tile layout, and simple vector icons); the site renders it with its
 * own components. Everything that reaches the database or the page passes
 * through sanitizeTheme, so a theme can never break the layout, hurt
 * legibility, or carry markup.
 */

export const ACCENT_FONTS = ["script", "serif-italic", "sans-bold"] as const;
export const TILE_LAYOUTS = ["frame", "corners", "scattered"] as const;

export type AccentFont = (typeof ACCENT_FONTS)[number];
export type TileLayout = (typeof TILE_LAYOUTS)[number];

export type ThemeShape =
  | { kind: "path"; d: string; fill: string; stroke: string; strokeWidth: number }
  | { kind: "circle"; cx: number; cy: number; r: number; fill: string; stroke: string; strokeWidth: number }
  | {
      kind: "ellipse";
      cx: number;
      cy: number;
      rx: number;
      ry: number;
      rotate: number;
      fill: string;
      stroke: string;
      strokeWidth: number;
    }
  | {
      kind: "rect";
      x: number;
      y: number;
      width: number;
      height: number;
      rx: number;
      fill: string;
      stroke: string;
      strokeWidth: number;
    }
  | { kind: "line"; x1: number; y1: number; x2: number; y2: number; stroke: string; strokeWidth: number };

export type ThemeIcon = { label: string; shapes: ThemeShape[] };

export type ThemePalette = {
  /** Page background behind the hero */
  background: string;
  /** Session cards and form fields */
  surface: string;
  /** Title and strong text */
  ink: string;
  /** Body copy */
  body: string;
  /** Buttons, prices, title accent */
  accent: string;
  /** Soft glows and badges */
  accentSoft: string;
  /** Tile face and edge */
  tileFace: string;
  tileEdge: string;
};

export type EventTheme = {
  name: string;
  palette: ThemePalette;
  accentFont: AccentFont;
  layout: TileLayout;
  dateIcon: string;
  icons: ThemeIcon[];
};

export const MIN_ICONS = 4;
export const MAX_ICONS = 8;
const MAX_SHAPES = 24;
/** Icons are drawn on a 40 x 40 canvas. */
export const ICON_SIZE = 40;

const HEX = /^#[0-9a-fA-F]{6}$/;
// SVG path commands and numbers only: nothing that could reference a URL.
const PATH_D = /^[MmLlHhVvCcSsQqTtAaZz0-9eE.,\s+-]{1,2000}$/;

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function color(v: unknown, fallback: string): string {
  return typeof v === "string" && HEX.test(v) ? v.toUpperCase() : fallback;
}

function paint(v: unknown): string {
  if (v === "none") return "none";
  return color(v, "none");
}

function num(v: unknown, lo: number, hi: number, fallback = 0): number {
  const n = typeof v === "number" ? v : Number.NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.round(Math.min(hi, Math.max(lo, n)) * 100) / 100;
}

function text(v: unknown, max: number): string {
  return typeof v === "string" ? v.replace(/[<>]/g, "").trim().slice(0, max) : "";
}

// Shapes may poke a little past the canvas, but not wander off it.
const C_LO = -10;
const C_HI = ICON_SIZE + 10;

function sanitizeShape(v: unknown): ThemeShape | null {
  if (!isObj(v)) return null;
  const strokeWidth = num(v.strokeWidth, 0, 6, 1.5);
  switch (v.kind) {
    case "path":
      if (typeof v.d !== "string" || !PATH_D.test(v.d)) return null;
      return { kind: "path", d: v.d.trim(), fill: paint(v.fill), stroke: paint(v.stroke), strokeWidth };
    case "circle":
      return {
        kind: "circle",
        cx: num(v.cx, C_LO, C_HI),
        cy: num(v.cy, C_LO, C_HI),
        r: num(v.r, 0, ICON_SIZE),
        fill: paint(v.fill),
        stroke: paint(v.stroke),
        strokeWidth,
      };
    case "ellipse":
      return {
        kind: "ellipse",
        cx: num(v.cx, C_LO, C_HI),
        cy: num(v.cy, C_LO, C_HI),
        rx: num(v.rx, 0, ICON_SIZE),
        ry: num(v.ry, 0, ICON_SIZE),
        rotate: num(v.rotate, -360, 360),
        fill: paint(v.fill),
        stroke: paint(v.stroke),
        strokeWidth,
      };
    case "rect":
      return {
        kind: "rect",
        x: num(v.x, C_LO, C_HI),
        y: num(v.y, C_LO, C_HI),
        width: num(v.width, 0, ICON_SIZE + 10),
        height: num(v.height, 0, ICON_SIZE + 10),
        rx: num(v.rx, 0, ICON_SIZE / 2),
        fill: paint(v.fill),
        stroke: paint(v.stroke),
        strokeWidth,
      };
    case "line":
      return {
        kind: "line",
        x1: num(v.x1, C_LO, C_HI),
        y1: num(v.y1, C_LO, C_HI),
        x2: num(v.x2, C_LO, C_HI),
        y2: num(v.y2, C_LO, C_HI),
        stroke: paint(v.stroke),
        strokeWidth,
      };
    default:
      return null;
  }
}

function sanitizeIcon(v: unknown): ThemeIcon | null {
  if (!isObj(v) || !Array.isArray(v.shapes)) return null;
  const shapes = v.shapes
    .slice(0, MAX_SHAPES)
    .map(sanitizeShape)
    .filter((s): s is ThemeShape => s !== null);
  return shapes.length ? { label: text(v.label, 40), shapes } : null;
}

// --- Contrast (WCAG 2) ---

function channel(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
}

export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Mix a color toward black (amount > 0) or white (amount < 0). */
function shade(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const target = amount > 0 ? 0 : 255;
  const t = Math.abs(amount);
  const mix = (c: number) => Math.round(c + (target - c) * t);
  const out = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(mix);
  return `#${out.map((c) => c.toString(16).padStart(2, "0")).join("")}`.toUpperCase();
}

/** Darken or lighten `fg` until it reaches `min` contrast against `bg`. */
function ensureContrast(fg: string, bg: string, min: number): string {
  if (contrast(fg, bg) >= min) return fg;
  const direction = luminance(bg) > 0.4 ? 1 : -1;
  for (let step = 1; step <= 20; step++) {
    const next = shade(fg, direction * step * 0.05);
    if (contrast(next, bg) >= min) return next;
  }
  return direction > 0 ? "#111111" : "#FFFFFF";
}

const FALLBACK: ThemePalette = {
  background: "#FFF9F5",
  surface: "#FFFFFF",
  ink: "#2D2424",
  body: "#6B5454",
  accent: "#D9534F",
  accentSoft: "#FFE8E0",
  tileFace: "#FFFFFF",
  tileEdge: "#FFE8E0",
};

function sanitizePalette(v: unknown): ThemePalette {
  const p = isObj(v) ? v : {};
  // Light backgrounds only: the nav, footer, and registration form around
  // the hero are light, and one dark-on-light text color must read on both
  // the page and the cards.
  let background = color(p.background, FALLBACK.background);
  for (let step = 1; luminance(background) < 0.6 && step <= 20; step++) {
    background = shade(color(p.background, FALLBACK.background), -step * 0.05);
  }
  // Cards and inputs stay light so dark ink always reads on them.
  let surface = color(p.surface, FALLBACK.surface);
  if (luminance(surface) < 0.75) surface = "#FFFFFF";
  const ink = ensureContrast(ensureContrast(color(p.ink, FALLBACK.ink), background, 4.5), surface, 4.5);
  const body = ensureContrast(ensureContrast(color(p.body, FALLBACK.body), background, 4.5), surface, 4.5);
  // White button text on the accent, and the accent as large text on the page.
  let accent = ensureContrast(color(p.accent, FALLBACK.accent), "#FFFFFF", 4.5);
  accent = ensureContrast(accent, background, 3);
  return {
    background,
    surface,
    ink,
    body,
    accent,
    accentSoft: color(p.accentSoft, FALLBACK.accentSoft),
    tileFace: color(p.tileFace, FALLBACK.tileFace),
    tileEdge: color(p.tileEdge, FALLBACK.tileEdge),
  };
}

/**
 * Returns a safe theme, or null when there is nothing usable (not an
 * object, or too few drawable icons).
 */
export function sanitizeTheme(v: unknown): EventTheme | null {
  if (!isObj(v) || !Array.isArray(v.icons)) return null;
  const icons = v.icons
    .slice(0, MAX_ICONS)
    .map(sanitizeIcon)
    .filter((i): i is ThemeIcon => i !== null);
  if (icons.length < MIN_ICONS) return null;
  return {
    name: text(v.name, 60) || "Custom design",
    palette: sanitizePalette(v.palette),
    accentFont: ACCENT_FONTS.find((f) => f === v.accentFont) ?? "serif-italic",
    layout: TILE_LAYOUTS.find((l) => l === v.layout) ?? "corners",
    dateIcon: [...text(v.dateIcon, 16)].slice(0, 2).join("") || "🀄",
    icons,
  };
}

/** CSS custom properties a themed section sets for its children. */
export function themeVars(theme: EventTheme): Record<string, string> {
  const p = theme.palette;
  return {
    "--ev-bg": p.background,
    "--ev-surface": p.surface,
    "--ev-ink": p.ink,
    "--ev-body": p.body,
    "--ev-accent": p.accent,
    "--ev-accent-soft": p.accentSoft,
    "--ev-tile-face": p.tileFace,
    "--ev-tile-edge": p.tileEdge,
  };
}
