import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const parse = vi.fn();
vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    beta = { messages: { parse } };
  },
}));

import { designEventTheme, ThemeDesignError } from "@/lib/theme-designer";

const event = { title: "Snowshoe Mahjong", dateLabel: "January 21, 2027", location: "TBD", blurb: "" };
const icon = {
  label: "Snowflake",
  shapes: [{ kind: "circle", cx: 20, cy: 20, r: 8, fill: "#5B84C4", stroke: "none", strokeWidth: 0 }],
};
const output = {
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
  icons: [icon, icon, icon, icon],
};

beforeEach(() => {
  parse.mockReset();
  vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
});
afterEach(() => vi.unstubAllEnvs());

describe("designEventTheme", () => {
  it("explains how to set up a missing API key", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    await expect(designEventTheme("icy blues", event)).rejects.toThrow(/ANTHROPIC_API_KEY/);
    expect(parse).not.toHaveBeenCalled();
  });

  it("sends the event details and description, and returns a sanitized theme", async () => {
    parse.mockResolvedValue({ stop_reason: "end_turn", parsed_output: { ...output, layout: "spiral" } });
    const theme = await designEventTheme("icy blues and mittens", event);
    expect(theme.layout).toBe("corners");
    const request = parse.mock.calls[0][0];
    expect(request.model).toBe("claude-opus-5-5");
    expect(request.fallbacks).toBe("default");
    expect(request.messages[0].content).toContain("Snowshoe Mahjong");
    expect(request.messages[0].content).toContain("icy blues and mittens");
  });

  it("turns refusals, truncation, and unusable output into friendly errors", async () => {
    parse.mockResolvedValueOnce({ stop_reason: "refusal", parsed_output: null });
    await expect(designEventTheme("x", event)).rejects.toThrow(ThemeDesignError);
    parse.mockResolvedValueOnce({ stop_reason: "max_tokens", parsed_output: null });
    await expect(designEventTheme("x", event)).rejects.toThrow(/incomplete/);
    parse.mockResolvedValueOnce({ stop_reason: "end_turn", parsed_output: { ...output, icons: [icon] } });
    await expect(designEventTheme("x", event)).rejects.toThrow(/tile art/);
  });
});
