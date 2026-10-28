import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import * as z from "zod/v4";
import {
  ACCENT_FONTS,
  ICON_SIZE,
  MAX_ICONS,
  MIN_ICONS,
  TILE_LAYOUTS,
  sanitizeTheme,
  type EventTheme,
} from "@/lib/event-theme";

const MODEL = "claude-opus-5-5";
export const MAX_DESCRIPTION = 600;

// Numeric and length limits are enforced by sanitizeTheme after parsing;
// structured outputs schemas cannot express them.
const paint = z.string().describe('A #RRGGBB hex color, or "none"');
const strokeWidth = z.number().describe("0 to 4; 1.5 to 2.5 reads well at tile size");

const Shape = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("path"),
    d: z.string().describe("SVG path data using only M L H V C S Q T A Z commands and numbers"),
    fill: paint,
    stroke: paint,
    strokeWidth,
  }),
  z.object({ kind: z.literal("circle"), cx: z.number(), cy: z.number(), r: z.number(), fill: paint, stroke: paint, strokeWidth }),
  z.object({
    kind: z.literal("ellipse"),
    cx: z.number(),
    cy: z.number(),
    rx: z.number(),
    ry: z.number(),
    rotate: z.number().describe("Degrees, around the ellipse center"),
    fill: paint,
    stroke: paint,
    strokeWidth,
  }),
  z.object({
    kind: z.literal("rect"),
    x: z.number(),
    y: z.number(),
    width: z.number(),
    height: z.number(),
    rx: z.number(),
    fill: paint,
    stroke: paint,
    strokeWidth,
  }),
  z.object({ kind: z.literal("line"), x1: z.number(), y1: z.number(), x2: z.number(), y2: z.number(), stroke: paint, strokeWidth }),
]);

const ThemeSchema = z.object({
  name: z.string().describe("A short name for the design, like 'Snowshoe Winter'"),
  palette: z.object({
    background: z.string().describe("Light page background, #RRGGBB"),
    surface: z.string().describe("Near-white card and form field color, #RRGGBB"),
    ink: z.string().describe("Dark title color, #RRGGBB"),
    body: z.string().describe("Body text color, readable on the background, #RRGGBB"),
    accent: z.string().describe("Buttons, prices, and the title accent; white text sits on it, #RRGGBB"),
    accentSoft: z.string().describe("Pale tint of the accent for glows and the badge, #RRGGBB"),
    tileFace: z.string().describe("Mahjong tile face, usually white or ivory, #RRGGBB"),
    tileEdge: z.string().describe("Tile edge and shadow color, #RRGGBB"),
  }),
  accentFont: z.enum(ACCENT_FONTS),
  layout: z.enum(TILE_LAYOUTS),
  dateIcon: z.string().describe("One emoji shown next to the date"),
  icons: z.array(z.object({ label: z.string(), shapes: z.array(Shape) })),
});

const SYSTEM = `You design the hero banner for events on Rack in the Rockies, a mahjong community site in Denver, Colorado. You return a design recipe that the site renders with its own components, so your choices are: a color palette, a font for the title accent, how decorative mahjong tiles are arranged, and the small illustrations painted on those tiles.

How the banner is built:
- The title is centered. Its last word is the "accent": "script" sets it in a handwritten script on its own line, "serif-italic" in an elegant italic, "sans-bold" in a bold sans. Script suits cozy, celebratory, or romantic events; italic suits most; sans-bold suits sporty or modern ones.
- "frame" surrounds the text with rows of tiles above and below and columns at the sides, like a save-the-date card. "corners" places one tile near each corner. "scattered" floats tiles loosely around the edges. Frame is the most decorative.
- Each tile is a rounded white tile (tileFace) with a colored edge (tileEdge). Your icon is drawn on a ${ICON_SIZE} x ${ICON_SIZE} canvas centered on the tile face. Keep shapes inside roughly 4 to 36 on both axes.

Drawing icons:
- Draw ${MIN_ICONS} to ${MAX_ICONS} distinct icons that capture the event's theme, the way a watercolor flyer would: objects, seasonal motifs, and mahjong touches (a wind letter, a bamboo stalk, a dot circle) mixed in.
- Each icon is 3 to 20 simple shapes. Favor bold, recognizable silhouettes over fine detail: the tiles render about 50 pixels wide. Use 2 to 3 palette colors per icon, with white highlights where they help.
- Coordinates are absolute numbers on the canvas. Check that each shape actually lands where you intend and that the pieces of an object connect.

Palette:
- The background must be light (the site around the banner is light) and the title ink dark. Body text must be readable on the background. White text sits on the accent, so it must be deep enough.
- Choose colors that match the description; for a seasonal or holiday event, lean into its classic colors.

Respect the admin's description above all. If it names specific objects, colors, or a mood, use them.`;

function describeEvent(event: EventContext): string {
  const lines = [
    `Title: ${event.title || "(not set yet)"}`,
    event.dateLabel && `Date: ${event.dateLabel}`,
    event.location && `Location: ${event.location}`,
    event.blurb && `About: ${event.blurb}`,
  ].filter(Boolean);
  return lines.join("\n");
}

export type EventContext = { title: string; dateLabel: string; location: string; blurb: string };

export class ThemeDesignError extends Error {}

export async function designEventTheme(description: string, event: EventContext): Promise<EventTheme> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new ThemeDesignError(
      "AI design is not set up yet. Add ANTHROPIC_API_KEY to the site's environment variables."
    );
  }

  const client = new Anthropic();
  const response = await client.beta.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    // If the request is declined, the API retries it on a fallback model.
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "medium", format: betaZodOutputFormat(ThemeSchema) },
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: `Event details:\n${describeEvent(event)}\n\nThe admin describes the look they want:\n${description}`,
      },
    ],
  });

  if (response.stop_reason === "refusal") {
    throw new ThemeDesignError("Claude could not design this one. Try rewording the description.");
  }
  if (response.stop_reason === "max_tokens" || !response.parsed_output) {
    throw new ThemeDesignError("The design came back incomplete. Try again.");
  }
  const theme = sanitizeTheme(response.parsed_output);
  if (!theme) throw new ThemeDesignError("The design came back without enough tile art. Try again.");
  return theme;
}
