import { describe, it, expect } from "vitest";
import { renderAnnouncement } from "@/emails/render";
import type { Announcement } from "@/lib/send-rules";

const event: Announcement = {
  template: "event-announcement",
  fields: {
    subject: "Mahjong in Bloom",
    preheader: "Tiles and blooms in Olde Town Arvada",
    headline: "Mahjong in Bloom",
    dateLabel: "July 28, 2026",
    location: "Olde Town Arvada",
    intro: "An evening of tiles and blooms.",
    sessions: [{ name: "Introduction to Mahjong", time: "4:45 - 8:00 PM", price: "$60" }],
    ctaLabel: "Sign Up",
    ctaUrl: "https://example.com/signup",
    closingNote: "Seats are limited.",
  },
};

const update: Announcement = {
  template: "general-update",
  fields: {
    subject: "A note from Annie",
    body: "First paragraph.\n\nSecond paragraph.",
  },
};

const opts = { unsubscribeToken: "tok-123", baseUrl: "https://rackintherockies.com" };

describe("renderAnnouncement", () => {
  it("renders the event template with sessions, cta, and compliance footer", async () => {
    const { subject, html, text } = await renderAnnouncement(event, opts);
    expect(subject).toBe("Mahjong in Bloom");
    expect(html).toContain("Mahjong in Bloom");
    expect(html).toContain("Introduction to Mahjong");
    expect(html).toContain("https://example.com/signup");
    expect(html).toContain("https://rackintherockies.com/unsubscribe?token=tok-123");
    expect(html).toContain("You are receiving this because you signed up");
    expect(html).toContain("[Mailing address not set]");
    expect(text).toContain("https://rackintherockies.com/unsubscribe?token=tok-123");
  });

  it("omits the sessions block when there are none", async () => {
    const bare: Announcement = {
      ...event,
      fields: { ...event.fields, sessions: [], ctaLabel: undefined, ctaUrl: undefined },
    };
    const { html } = await renderAnnouncement(bare, opts);
    expect(html).not.toContain("Introduction to Mahjong");
  });

  it("renders the general update paragraphs", async () => {
    const { html } = await renderAnnouncement(update, opts);
    expect(html).toContain("First paragraph.");
    expect(html).toContain("Second paragraph.");
  });

  it("contains no em or en dashes in the plain text output", async () => {
    for (const a of [event, update]) {
      const { text } = await renderAnnouncement(a, opts);
      expect(text).not.toMatch(/[–—]/);
    }
  });
});
