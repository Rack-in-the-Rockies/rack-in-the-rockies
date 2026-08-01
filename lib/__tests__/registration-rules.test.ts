import { describe, it, expect } from "vitest";
import {
  parseRegistrationInput,
  validateRegistration,
  seatsRemaining,
  canRegister,
  slugTag,
  formatDateLabel,
  validateImageUpload,
} from "@/lib/registration-rules";

const valid = {
  eventId: "evt-1",
  sessionId: "sess-1",
  firstName: "Annie",
  lastName: "Chen",
  email: "annie@example.com",
  seats: 2,
};

describe("parseRegistrationInput", () => {
  it("coerces and clamps", () => {
    const parsed = parseRegistrationInput({ ...valid, seats: "2", junk: true });
    expect(parsed).toMatchObject({ firstName: "Annie", seats: 2 });
    expect(parseRegistrationInput(null)).toBeNull();
  });
});

describe("validateRegistration", () => {
  it("accepts a complete registration", () => {
    expect(validateRegistration(parseRegistrationInput(valid)!)).toEqual([]);
  });
  it("requires name, valid email, and seats in bounds", () => {
    expect(validateRegistration({ ...parseRegistrationInput(valid)!, firstName: "" }).length).toBe(1);
    expect(validateRegistration({ ...parseRegistrationInput(valid)!, email: "nope" }).length).toBe(1);
    expect(validateRegistration({ ...parseRegistrationInput(valid)!, seats: 0 }).length).toBe(1);
    expect(validateRegistration({ ...parseRegistrationInput(valid)!, seats: 5 }).length).toBe(1);
  });
});

describe("seatsRemaining", () => {
  it("computes remaining and treats null capacity as unlimited", () => {
    expect(seatsRemaining(24, 20)).toBe(4);
    expect(seatsRemaining(24, 30)).toBe(0);
    expect(seatsRemaining(null, 500)).toBeNull();
  });
});

describe("canRegister", () => {
  it("allows within capacity and unlimited sessions", () => {
    expect(canRegister({ capacity: 24, taken: 20, seats: 4 })).toEqual({ ok: true });
    expect(canRegister({ capacity: null, taken: 999, seats: 4 })).toEqual({ ok: true });
  });
  it("refuses when the request does not fit", () => {
    const result = canRegister({ capacity: 24, taken: 22, seats: 3 });
    expect(result.ok).toBe(false);
  });
});

describe("slugTag", () => {
  it("slugifies titles", () => {
    expect(slugTag("Mahjong in Bloom")).toBe("mahjong-in-bloom");
    expect(slugTag("  Fall Fest! 2026  ")).toBe("fall-fest-2026");
  });
});

describe("formatDateLabel", () => {
  it("formats a date-only string as local prose (no UTC off-by-one)", () => {
    expect(formatDateLabel("2026-07-28")).toBe("July 28, 2026");
    expect(formatDateLabel("")).toBe("");
    expect(formatDateLabel("junk")).toBe("");
  });
});

describe("validateImageUpload", () => {
  it("accepts jpeg/png/webp under 5 MB", () => {
    expect(validateImageUpload({ type: "image/jpeg", size: 1024 })).toBeNull();
    expect(validateImageUpload({ type: "image/webp", size: 4_000_000 })).toBeNull();
  });
  it("rejects other types and oversize files with plain language", () => {
    expect(validateImageUpload({ type: "image/gif", size: 10 })).toMatch(/jpeg, png, or webp/i);
    expect(validateImageUpload({ type: "image/png", size: 6_000_000 })).toMatch(/5 MB/);
  });
});
