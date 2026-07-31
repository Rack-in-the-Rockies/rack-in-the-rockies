import { describe, it, expect } from "vitest";
import {
  chunkIntoBatches,
  idempotencyKey,
  isRetryableSendError,
  mapWebhookEvent,
  splitParagraphs,
  parseAnnouncement,
  validateAnnouncement,
  type Announcement,
} from "@/lib/send-rules";

describe("chunkIntoBatches", () => {
  it("handles empty, exact, and overflow sizes", () => {
    expect(chunkIntoBatches([])).toEqual([]);
    expect(chunkIntoBatches([1]).length).toBe(1);
    expect(chunkIntoBatches(Array(100).fill(0)).length).toBe(1);
    const chunks = chunkIntoBatches(Array(250).fill(0));
    expect(chunks.map((c) => c.length)).toEqual([100, 100, 50]);
  });
});

describe("idempotencyKey", () => {
  it("is stable and chunk-scoped", () => {
    expect(idempotencyKey("abc", 0)).toBe("send-abc-chunk-0");
    expect(idempotencyKey("abc", 2)).toBe("send-abc-chunk-2");
  });
});

describe("isRetryableSendError", () => {
  it("retries rate limits and server errors", () => {
    expect(isRetryableSendError({ statusCode: 429, name: "rate_limit_exceeded" })).toBe(true);
    expect(isRetryableSendError({ statusCode: 500, name: "internal_server_error" })).toBe(true);
    expect(isRetryableSendError({ statusCode: null, name: "application_error" })).toBe(true);
    expect(isRetryableSendError({ statusCode: null, name: "concurrent_idempotent_requests" })).toBe(true);
  });
  it("does not retry validation-class errors", () => {
    expect(isRetryableSendError({ statusCode: 422, name: "validation_error" })).toBe(false);
    expect(isRetryableSendError({ statusCode: 400, name: "invalid_parameter" })).toBe(false);
    expect(isRetryableSendError({ statusCode: null, name: "missing_api_key" })).toBe(false);
  });
});

describe("mapWebhookEvent", () => {
  it("maps delivered to a recipient update only", () => {
    expect(mapWebhookEvent("email.delivered")).toEqual({
      recipientStatus: "delivered",
      subscriberAction: null,
    });
  });
  it("maps complaints to recipient and subscriber", () => {
    expect(mapWebhookEvent("email.complained")).toEqual({
      recipientStatus: "complained",
      subscriberAction: "complain",
    });
  });
  it("only permanent bounces touch the subscriber", () => {
    expect(mapWebhookEvent("email.bounced", "Permanent")).toEqual({
      recipientStatus: "bounced",
      subscriberAction: "bounce",
    });
    expect(mapWebhookEvent("email.bounced", "permanent")).toEqual({
      recipientStatus: "bounced",
      subscriberAction: "bounce",
    });
    expect(mapWebhookEvent("email.bounced", "Transient")).toEqual({
      recipientStatus: "bounced",
      subscriberAction: null,
    });
  });
  it("ignores everything else", () => {
    for (const type of ["email.opened", "email.sent", "contact.created", "junk"]) {
      expect(mapWebhookEvent(type)).toEqual({ recipientStatus: null, subscriberAction: null });
    }
  });
});

describe("splitParagraphs", () => {
  it("splits on blank lines and trims", () => {
    expect(splitParagraphs("one\n\ntwo\n \nthree")).toEqual(["one", "two", "three"]);
    expect(splitParagraphs("  solo  ")).toEqual(["solo"]);
    expect(splitParagraphs("")).toEqual([]);
  });
});

const validEvent: Announcement = {
  template: "event-announcement",
  fields: {
    subject: "Mahjong in Bloom",
    headline: "Mahjong in Bloom",
    dateLabel: "July 28, 2026",
    location: "Olde Town Arvada",
    intro: "An evening of tiles and blooms.",
    sessions: [{ name: "Intro", time: "4:45 - 8:00 PM", price: "$60" }],
    ctaLabel: "Sign Up",
    ctaUrl: "https://example.com/signup",
  },
};

describe("parseAnnouncement", () => {
  it("coerces a raw payload into a typed announcement, dropping empty session rows", () => {
    const parsed = parseAnnouncement({
      template: "event-announcement",
      fields: {
        ...validEvent.fields,
        sessions: [
          { name: "Intro", time: "4:45 - 8:00 PM", price: "$60" },
          { name: "", time: "", price: "" },
        ],
        junk: "ignored",
      },
    });
    expect(parsed).not.toBeNull();
    expect(parsed!.template).toBe("event-announcement");
    if (parsed!.template === "event-announcement") {
      expect(parsed!.fields.sessions).toHaveLength(1);
    }
  });
  it("rejects unknown templates and non-objects", () => {
    expect(parseAnnouncement({ template: "html-blast", fields: {} })).toBeNull();
    expect(parseAnnouncement("nope")).toBeNull();
    expect(parseAnnouncement(null)).toBeNull();
  });
});

describe("validateAnnouncement", () => {
  it("accepts a complete event announcement", () => {
    expect(validateAnnouncement(validEvent)).toEqual([]);
  });
  it("requires the event basics", () => {
    const errors = validateAnnouncement({
      template: "event-announcement",
      fields: { ...validEvent.fields, subject: " ", headline: "", dateLabel: "", location: "", intro: "" },
    } as Announcement);
    expect(errors.length).toBeGreaterThanOrEqual(5);
  });
  it("requires the button label and link together, with a web link", () => {
    const noUrl = validateAnnouncement({
      template: "event-announcement",
      fields: { ...validEvent.fields, ctaLabel: "Sign Up", ctaUrl: "" },
    } as Announcement);
    expect(noUrl.some((e) => e.toLowerCase().includes("button"))).toBe(true);
    const badScheme = validateAnnouncement({
      template: "event-announcement",
      fields: { ...validEvent.fields, ctaUrl: "javascript:alert(1)" },
    } as Announcement);
    expect(badScheme.length).toBeGreaterThan(0);
  });
  it("requires an incomplete session row to be finished", () => {
    const errors = validateAnnouncement({
      template: "event-announcement",
      fields: { ...validEvent.fields, sessions: [{ name: "Intro", time: "", price: "" }] },
    } as Announcement);
    expect(errors.length).toBeGreaterThan(0);
  });
  it("validates the general update", () => {
    expect(
      validateAnnouncement({
        template: "general-update",
        fields: { subject: "Hello", body: "First paragraph." },
      })
    ).toEqual([]);
    expect(
      validateAnnouncement({
        template: "general-update",
        fields: { subject: "", body: "  " },
      }).length
    ).toBe(2);
  });
});
