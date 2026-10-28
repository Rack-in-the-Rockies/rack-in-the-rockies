import { describe, it, expect } from "vitest";
import { contrast, sanitizeTheme, themeVars } from "@/lib/event-theme";
import { parseEventInput } from "@/lib/event-rules";

const snowflake = {
  label: "Snowflake",
  shapes: [
    { kind: "line", x1: 20, y1: 6, x2: 20, y2: 34, stroke: "#5B84C4", strokeWidth: 2 },
    { kind: "circle", cx: 20, cy: 20, r: 3, fill: "#5B84C4", stroke: "none", strokeWidth: 0 },
  ],
};

const valid = {
  name: "Snowshoe Winter",
  palette: {
    background: "#EEF4FB",
    surface: "#FFFFFF",
    ink: "#2E3F5C",
    body: "#5A6B85",
    accent: "#3E68A8",
    accentSoft: "#DCE6F4",
    tileFace: "#FFFFFF",
    tileEdge: "#C9D9EE",
  },
  accentFont: "script",
  layout: "frame",
  dateIcon: "❄️",
  icons: [snowflake, snowflake, snowflake, snowflake],
};

describe("sanitizeTheme", () => {
  it("keeps a well-formed theme", () => {
    const theme = sanitizeTheme(valid)!;
    expect(theme.name).toBe("Snowshoe Winter");
    expect(theme.layout).toBe("frame");
    expect(theme.accentFont).toBe("script");
    expect(theme.palette.ink).toBe("#2E3F5C");
    expect(theme.icons).toHaveLength(4);
  });

  it("rejects non-objects and themes with too few drawable icons", () => {
    expect(sanitizeTheme(null)).toBeNull();
    expect(sanitizeTheme("theme")).toBeNull();
    expect(sanitizeTheme({ ...valid, icons: [snowflake, snowflake, snowflake] })).toBeNull();
    expect(sanitizeTheme({ ...valid, icons: [snowflake, snowflake, snowflake, { shapes: [] }] })).toBeNull();
  });

  it("caps the icon count", () => {
    expect(sanitizeTheme({ ...valid, icons: Array(12).fill(snowflake) })!.icons).toHaveLength(8);
  });

  it("drops shapes that could carry anything but geometry", () => {
    const icon = {
      label: "<b>bad</b>",
      shapes: [
        { kind: "path", d: "M0 0 L10 10 url(javascript:alert(1))", fill: "#000000", stroke: "none", strokeWidth: 1 },
        { kind: "image", href: "https://evil.example/x.png" },
        { kind: "path", d: "M4 4 L36 36 Z", fill: "red; background:url(x)", stroke: "#123456", strokeWidth: 99 },
      ],
    };
    const theme = sanitizeTheme({ ...valid, icons: [icon, snowflake, snowflake, snowflake] })!;
    expect(theme.icons[0].label).toBe("bbad/b");
    expect(theme.icons[0].shapes).toEqual([
      { kind: "path", d: "M4 4 L36 36 Z", fill: "none", stroke: "#123456", strokeWidth: 6 },
    ]);
  });

  it("clamps coordinates to near the icon canvas", () => {
    const icon = {
      label: "Far",
      shapes: [{ kind: "circle", cx: 5000, cy: -5000, r: Number.NaN, fill: "#000000", stroke: "none", strokeWidth: 1 }],
    };
    const shape = sanitizeTheme({ ...valid, icons: [icon, snowflake, snowflake, snowflake] })!.icons[0].shapes[0];
    expect(shape).toMatchObject({ cx: 50, cy: -10, r: 0 });
  });

  it("falls back on unknown enums, bad colors, and missing names", () => {
    const theme = sanitizeTheme({
      ...valid,
      name: "",
      accentFont: "comic-sans",
      layout: "spiral",
      palette: { ...valid.palette, tileEdge: "blue" },
    })!;
    expect(theme.name).toBe("Custom design");
    expect(theme.accentFont).toBe("serif-italic");
    expect(theme.layout).toBe("corners");
    expect(theme.palette.tileEdge).toBe("#FFE8E0");
  });

  it("keeps the date icon short", () => {
    expect(sanitizeTheme({ ...valid, dateIcon: "🎿⛷️🏔️ snow day" })!.dateIcon).toBe("🎿⛷");
    expect(sanitizeTheme({ ...valid, dateIcon: "" })!.dateIcon).toBe("🀄");
  });

  describe("legibility", () => {
    it("darkens text that would wash out on the background", () => {
      const p = sanitizeTheme({ ...valid, palette: { ...valid.palette, ink: "#F0F0F0", body: "#DDDDDD" } })!.palette;
      expect(contrast(p.ink, p.background)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(p.body, p.background)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(p.ink, p.surface)).toBeGreaterThanOrEqual(4.5);
    });

    it("deepens an accent too pale for white button text", () => {
      const p = sanitizeTheme({ ...valid, palette: { ...valid.palette, accent: "#FFD6E0" } })!.palette;
      expect(contrast("#FFFFFF", p.accent)).toBeGreaterThanOrEqual(4.5);
    });

    it("lightens a dark background and keeps cards light", () => {
      const p = sanitizeTheme({
        ...valid,
        palette: { ...valid.palette, background: "#101820", surface: "#202830" },
      })!.palette;
      expect(contrast(p.ink, p.background)).toBeGreaterThanOrEqual(4.5);
      expect(p.surface).toBe("#FFFFFF");
    });
  });
});

describe("themeVars", () => {
  it("maps the palette to CSS variables", () => {
    const vars = themeVars(sanitizeTheme(valid)!);
    expect(vars["--ev-bg"]).toBe("#EEF4FB");
    expect(vars["--ev-accent"]).toBe("#3E68A8");
  });
});

describe("parseEventInput theme", () => {
  it("sanitizes the theme and drops an unusable one", () => {
    expect(parseEventInput({ title: "x", theme: valid })!.theme?.name).toBe("Snowshoe Winter");
    expect(parseEventInput({ title: "x", theme: { icons: [] } })!.theme).toBeNull();
    expect(parseEventInput({ title: "x", themePrompt: "  icy blues  " })!.themePrompt).toBe("icy blues");
  });
});
