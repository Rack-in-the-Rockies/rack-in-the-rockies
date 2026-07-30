import { describe, it, expect } from "vitest";
import {
  normalizeEmail,
  isValidEmail,
  decideSubscribeAction,
  unionTags,
  deriveContactSource,
} from "@/lib/subscriber-rules";

describe("normalizeEmail", () => {
  it("lowercases and trims", () => {
    expect(normalizeEmail("  Annie@Example.COM ")).toBe("annie@example.com");
  });
});

describe("isValidEmail", () => {
  it("accepts a plain address", () => {
    expect(isValidEmail("a@b.co")).toBe(true);
  });
  it("rejects junk", () => {
    for (const bad of ["", "no-at-sign", "a@b", "a b@c.co", "a@b c.co"]) {
      expect(isValidEmail(bad), bad).toBe(false);
    }
  });
});

// The spec's resubscribe matrix, every cell. explicit=true covers the signup
// form AND token resubscribe; explicit=false covers inquiry forms.
describe("decideSubscribeAction", () => {
  it("creates when no record exists, regardless of path", () => {
    expect(decideSubscribeAction(null, true)).toBe("create");
    expect(decideSubscribeAction(null, false)).toBe("create");
  });
  it("updates a subscribed record from either path", () => {
    expect(decideSubscribeAction("subscribed", true)).toBe("update");
    expect(decideSubscribeAction("subscribed", false)).toBe("update");
  });
  it("resubscribes unsubscribed and bounced only on the explicit path", () => {
    expect(decideSubscribeAction("unsubscribed", true)).toBe("resubscribe");
    expect(decideSubscribeAction("bounced", true)).toBe("resubscribe");
    expect(decideSubscribeAction("unsubscribed", false)).toBe("blocked");
    expect(decideSubscribeAction("bounced", false)).toBe("blocked");
  });
  it("never resurrects complained, even explicitly", () => {
    expect(decideSubscribeAction("complained", true)).toBe("blocked");
    expect(decideSubscribeAction("complained", false)).toBe("blocked");
  });
});

describe("unionTags", () => {
  it("unions without duplicates, preserving existing order", () => {
    expect(unionTags(["beginner", "booking"], ["booking", "trips"])).toEqual([
      "beginner",
      "booking",
      "trips",
    ]);
  });
  it("handles empty sides", () => {
    expect(unionTags([], ["a"])).toEqual(["a"]);
    expect(unionTags(["a"], [])).toEqual(["a"]);
  });
});

// Source derivation for /api/contact. Client input is untrusted: anything
// not recognized falls back to 'contact'.
describe("deriveContactSource", () => {
  it("maps the waitlist marker", () => {
    expect(deriveContactSource({ source: "trips-waitlist" })).toBe("trips-waitlist");
  });
  it("maps event inquiries to booking", () => {
    expect(deriveContactSource({ eventType: "birthday" })).toBe("booking");
  });
  it("defaults to contact and ignores unrecognized client values", () => {
    expect(deriveContactSource({})).toBe("contact");
    expect(deriveContactSource({ source: "newsletter" })).toBe("contact");
    expect(deriveContactSource({ source: "import" })).toBe("contact");
  });
});
