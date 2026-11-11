import { ACCENT_FONTS, type AccentFont, type EventTheme } from "@/lib/event-theme";
import type { EventDecor } from "@/lib/event-rules";

/**
 * The colors and accents an event announcement email borrows from an
 * event's look on the site. Email clients cannot run the site's CSS or
 * reliably show inline SVG, so this carries only what email can render:
 * flat colors, a font treatment for the headline accent, and an emoji.
 */
export type EmailStyle = {
  name: string;
  /** Page behind the card */
  background: string;
  /** The card itself */
  card: string;
  border: string;
  /** Header band, drawn as a gradient from headerFrom to headerTo */
  headerFrom: string;
  headerTo: string;
  /** Session box */
  panel: string;
  ink: string;
  body: string;
  muted: string;
  /** Date line, prices, headline accent, button */
  accent: string;
  accentFont: AccentFont;
  dateIcon: string;
};

/** The site's warm palette; also what an unstyled announcement uses. */
export const WARM_EMAIL_STYLE: EmailStyle = {
  name: "Warm",
  background: "#FFF9F5",
  card: "#FFFCFA",
  border: "#FFE8E0",
  headerFrom: "#FF6B6B",
  headerTo: "#FF8E53",
  panel: "#FFF9F5",
  ink: "#2D2424",
  body: "#6B5454",
  muted: "#9A8585",
  accent: "#FF6B6B",
  accentFont: "serif-italic",
  dateIcon: "🀄",
};

/** Mirrors the winter tokens in app/globals.css. */
const WINTER_EMAIL_STYLE: EmailStyle = {
  name: "Winter",
  background: "#EEF4FB",
  card: "#FFFFFF",
  border: "#C9D9EE",
  headerFrom: "#3E68A8",
  headerTo: "#5B84C4",
  panel: "#EEF4FB",
  ink: "#2E3F5C",
  body: "#5A6B85",
  muted: "#5A6B85",
  accent: "#3E68A8",
  accentFont: "script",
  dateIcon: "❄️",
};

/** The email look for an event: its AI theme when it has one, else its decor preset. */
export function emailStyleForEvent(event: {
  decor: EventDecor;
  theme: EventTheme | null;
}): EmailStyle {
  const t = event.theme;
  if (t) {
    const p = t.palette;
    // sanitizeTheme guarantees: light background, light surface, ink and
    // body at 4.5:1 on both, and white text readable on the accent.
    return {
      name: t.name,
      background: p.background,
      card: p.surface,
      border: p.tileEdge,
      headerFrom: p.accent,
      headerTo: p.accent,
      panel: p.background,
      ink: p.ink,
      body: p.body,
      muted: p.body,
      accent: p.accent,
      accentFont: t.accentFont,
      dateIcon: t.dateIcon,
    };
  }
  if (event.decor === "winter") return WINTER_EMAIL_STYLE;
  return { ...WARM_EMAIL_STYLE, name: event.decor === "blooms" ? "Blooms" : "Mountains" };
}

const HEX = /^#[0-9a-fA-F]{6}$/;
const COLOR_KEYS = [
  "background",
  "card",
  "border",
  "headerFrom",
  "headerTo",
  "panel",
  "ink",
  "body",
  "muted",
  "accent",
] as const;

/**
 * Shape check for a style arriving from the composer or the database.
 * Returns undefined unless every color is a plain hex value, so nothing
 * but a color can reach an inline style.
 */
export function parseEmailStyle(v: unknown): EmailStyle | undefined {
  if (typeof v !== "object" || v === null || Array.isArray(v)) return undefined;
  const s = v as Record<string, unknown>;
  const colors = {} as Record<(typeof COLOR_KEYS)[number], string>;
  for (const key of COLOR_KEYS) {
    const c = s[key];
    if (typeof c !== "string" || !HEX.test(c)) return undefined;
    colors[key] = c.toUpperCase();
  }
  const name = typeof s.name === "string" ? s.name.replace(/[<>]/g, "").trim().slice(0, 60) : "";
  const icon = typeof s.dateIcon === "string" ? [...s.dateIcon.replace(/[<>]/g, "")].slice(0, 2).join("") : "";
  return {
    name: name || "Event design",
    ...colors,
    accentFont: ACCENT_FONTS.find((f) => f === s.accentFont) ?? "serif-italic",
    dateIcon: icon,
  };
}
