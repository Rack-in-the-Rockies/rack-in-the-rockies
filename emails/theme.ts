/**
 * Mirrors the @theme tokens in app/globals.css. Email clients cannot read
 * CSS variables, so these are duplicated deliberately; if the site palette
 * changes, change both.
 */
export const emailTheme = {
  coral: "#FF6B6B",
  tangerine: "#FF8E53",
  golden: "#FFC857",
  blush: "#FFE8E0",
  cream: "#FFF9F5",
  warmWhite: "#FFFCFA",
  textDark: "#2D2424",
  textMid: "#6B5454",
  textLight: "#9A8585",
  fontDisplay: "Georgia, 'Times New Roman', serif",
  fontBody:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif",
} as const;
