import { describe, it, expect } from "vitest";
import {
  selectFeaturedEvent,
  splitTitleAccent,
  parseEventInput,
  validateEventInput,
  duplicateTransform,
  type EventInput,
} from "@/lib/event-rules";

const now = new Date("2026-08-01T12:00:00-06:00");

function row(overrides: Record<string, unknown>) {
  return { status: "published", ends_at: "2026-09-01T20:00:00-06:00", ...overrides };
}

describe("selectFeaturedEvent", () => {
  it("picks the earliest-ending published upcoming event", () => {
    const later = row({ id: "later", ends_at: "2026-10-01T20:00:00-06:00" });
    const sooner = row({ id: "sooner", ends_at: "2026-08-15T20:00:00-06:00" });
    expect(selectFeaturedEvent([later, sooner], now)?.id).toBe("sooner");
  });
  it("excludes drafts and ended events", () => {
    const draft = row({ id: "draft", status: "draft" });
    const ended = row({ id: "ended", ends_at: "2026-07-28T20:00:00-06:00" });
    expect(selectFeaturedEvent([draft, ended], now)).toBeNull();
  });
  it("excludes events with no end date and handles empty lists", () => {
    expect(selectFeaturedEvent([row({ id: "x", ends_at: null })], now)).toBeNull();
    expect(selectFeaturedEvent([], now)).toBeNull();
  });
});

describe("splitTitleAccent", () => {
  it("splits before the last word", () => {
    expect(splitTitleAccent("Mahjong in Bloom")).toEqual({ lead: "Mahjong in ", accent: "Bloom" });
  });
  it("renders single-word and padded titles plain", () => {
    expect(splitTitleAccent("Bloom")).toEqual({ lead: "Bloom", accent: "" });
    expect(splitTitleAccent("  Bloom  ")).toEqual({ lead: "Bloom", accent: "" });
  });
});

const complete: EventInput = {
  title: "Mahjong in Bloom",
  partner: "Tee Lee Floral",
  dateLabel: "July 28, 2026",
  endsAt: "2026-07-28T20:00:00-06:00",
  location: "Olde Town Arvada",
  blurb: "An evening of tiles and blooms.",
  bannerText: "Mahjong in Bloom: July 28 at Tee Lee Floral",
  externalSignupUrl: "https://forms.example.com/x",
  paymentInstructions: null,
  imageUrl: null,
  imageAlt: null,
  decor: "mountains",
  sessions: [{ id: null, name: "Intro", timeLabel: "4:45 - 8:00 PM", priceLabel: "$60", capacity: 24 }],
};

describe("parseEventInput", () => {
  it("coerces a raw form payload, dropping empty session rows", () => {
    const parsed = parseEventInput({
      ...complete,
      partner: "",
      capacityJunk: "ignored",
      sessions: [
        { name: "Intro", timeLabel: "4:45 - 8:00 PM", priceLabel: "$60", capacity: "24" },
        { name: "", timeLabel: "", priceLabel: "", capacity: "" },
      ],
    });
    expect(parsed).not.toBeNull();
    expect(parsed!.partner).toBeNull();
    expect(parsed!.sessions).toHaveLength(1);
    expect(parsed!.sessions[0].capacity).toBe(24);
  });
  it("treats blank or invalid capacity as unlimited", () => {
    const parsed = parseEventInput({
      ...complete,
      sessions: [{ name: "Intro", timeLabel: "6 PM", priceLabel: "$30", capacity: "lots" }],
    });
    expect(parsed!.sessions[0].capacity).toBeNull();
  });
  it("preserves numeric capacity from editor state", () => {
    const parsed = parseEventInput({
      ...complete,
      sessions: [{ name: "Intro", timeLabel: "6 PM", priceLabel: "$30", capacity: 24 }],
    });
    expect(parsed!.sessions[0].capacity).toBe(24);
  });
  it("rejects non-objects", () => {
    expect(parseEventInput("nope")).toBeNull();
    expect(parseEventInput(null)).toBeNull();
  });
});

describe("validateEventInput", () => {
  it("a draft needs only a title and a parseable end date if given", () => {
    expect(
      validateEventInput(
        { ...complete, dateLabel: "", location: "", blurb: "", bannerText: "", endsAt: "" },
        { forPublish: false }
      )
    ).toEqual([]);
    expect(
      validateEventInput({ ...complete, title: " " }, { forPublish: false }).length
    ).toBe(1);
    expect(
      validateEventInput({ ...complete, endsAt: "not a date" }, { forPublish: false }).length
    ).toBe(1);
  });
  it("publishing requires the full set", () => {
    const errors = validateEventInput(
      { ...complete, dateLabel: "", location: "", blurb: "", bannerText: "", endsAt: "" },
      { forPublish: true, now }
    );
    expect(errors.length).toBeGreaterThanOrEqual(5);
  });
  it("publishing requires the end to be in the future", () => {
    const errors = validateEventInput(
      { ...complete, endsAt: "2026-07-28T20:00:00-06:00" },
      { forPublish: true, now }
    );
    expect(errors.some((e) => e.toLowerCase().includes("already"))).toBe(true);
  });
  it("signup links must be web links, and session rows complete", () => {
    expect(
      validateEventInput(
        { ...complete, endsAt: "2099-10-01T20:00:00-06:00", externalSignupUrl: "javascript:x" },
        { forPublish: true, now }
      ).length
    ).toBe(1);
    expect(
      validateEventInput(
        {
          ...complete,
          endsAt: "2099-10-01T20:00:00-06:00",
          externalSignupUrl: null,
          sessions: [{ name: "Intro", timeLabel: "", priceLabel: "", capacity: null }],
        },
        { forPublish: true, now }
      ).length
    ).toBe(1);
  });
});

describe("duplicateTransform", () => {
  it("copies content, clears dates and banner, keeps sessions", () => {
    const dup = duplicateTransform(complete);
    expect(dup.title).toBe("Mahjong in Bloom");
    expect(dup.dateLabel).toBe("");
    expect(dup.endsAt).toBe("");
    expect(dup.bannerText).toBe("");
    expect(dup.sessions).toEqual(complete.sessions);
  });
  it("clears session ids and keeps the image", () => {
    const dup = duplicateTransform({
      ...complete,
      imageUrl: "https://x/img.jpg",
      sessions: [{ ...complete.sessions[0], id: "sess-1" }],
    });
    expect(dup.sessions[0].id).toBeNull();
    expect(dup.imageUrl).toBe("https://x/img.jpg");
  });
});

describe("decor", () => {
  it("parses blooms and defaults everything else to mountains", () => {
    expect(parseEventInput({ ...complete, decor: "blooms" })!.decor).toBe("blooms");
    expect(parseEventInput({ ...complete, decor: "confetti" })!.decor).toBe("mountains");
    expect(parseEventInput({ ...complete, decor: undefined })!.decor).toBe("mountains");
  });
});
