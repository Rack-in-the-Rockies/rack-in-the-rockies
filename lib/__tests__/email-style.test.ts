import { describe, it, expect } from "vitest";
import { emailStyleForEvent, parseEmailStyle, WARM_EMAIL_STYLE } from "@/lib/email-style";
import { sanitizeTheme } from "@/lib/event-theme";
import { parseAnnouncement } from "@/lib/send-rules";

const square = {
  label: "Tile",
  shapes: [{ kind: "rect", x: 4, y: 4, width: 32, height: 32, rx: 4, fill: "#FFFFFF", stroke: "#2F6B4F", strokeWidth: 2 }],
};

const theme = sanitizeTheme({
  name: "Garden Party",
  palette: {
    background: "#F4FAF2",
    surface: "#FFFFFF",
    ink: "#1F3A2B",
    body: "#3F5A49",
    accent: "#2F6B4F",
    accentSoft: "#DDEFE3",
    tileFace: "#FFFFFF",
    tileEdge: "#CFE5D6",
  },
  accentFont: "sans-bold",
  layout: "corners",
  dateIcon: "🌿",
  icons: [square, square, square, square],
})!;

describe("emailStyleForEvent", () => {
  it("uses the AI theme's palette, accent font, and date icon", () => {
    const s = emailStyleForEvent({ decor: "mountains", theme });
    expect(s.name).toBe("Garden Party");
    expect(s.background).toBe(theme.palette.background);
    expect(s.accent).toBe(theme.palette.accent);
    expect(s.border).toBe(theme.palette.tileEdge);
    expect(s.accentFont).toBe("sans-bold");
    expect(s.dateIcon).toBe("🌿");
  });

  it("falls back to the decor preset", () => {
    expect(emailStyleForEvent({ decor: "winter", theme: null }).accent).toBe("#3E68A8");
    const warm = emailStyleForEvent({ decor: "blooms", theme: null });
    expect(warm.accent).toBe(WARM_EMAIL_STYLE.accent);
    expect(warm.name).toBe("Blooms");
  });
});

describe("parseEmailStyle", () => {
  it("round-trips a derived style", () => {
    const s = emailStyleForEvent({ decor: "winter", theme: null });
    expect(parseEmailStyle(JSON.parse(JSON.stringify(s)))).toEqual(s);
  });

  it("rejects anything that is not a plain hex color", () => {
    const s = emailStyleForEvent({ decor: "winter", theme: null });
    expect(parseEmailStyle({ ...s, accent: "red; background:url(x)" })).toBeUndefined();
    expect(parseEmailStyle({ ...s, ink: undefined })).toBeUndefined();
    expect(parseEmailStyle("nope")).toBeUndefined();
  });

  it("strips markup from the name and icon and defaults the font", () => {
    const s = parseEmailStyle({ ...WARM_EMAIL_STYLE, name: "<b>Hi</b>", dateIcon: "<x>", accentFont: "comic" })!;
    expect(s.name).toBe("bHi/b");
    expect(s.dateIcon).not.toContain("<");
    expect(s.accentFont).toBe("serif-italic");
  });

  it("travels through parseAnnouncement on event announcements", () => {
    const style = emailStyleForEvent({ decor: "mountains", theme });
    const a = parseAnnouncement({ template: "event-announcement", fields: { subject: "x", style } });
    expect(a?.template === "event-announcement" && a.fields.style).toEqual(style);
  });
});
