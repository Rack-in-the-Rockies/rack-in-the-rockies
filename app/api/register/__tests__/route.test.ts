import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/events", () => ({ getFeaturedEvent: vi.fn() }));
vi.mock("@/lib/registrations", () => ({
  register: vi.fn(),
  sessionSeatCounts: vi.fn(async () => new Map([["sess-1", 20]])),
}));
vi.mock("@/lib/subscribers", () => ({
  subscribe: vi.fn(async () => ({ outcome: "created" })),
}));
vi.mock("@/lib/sends", () => ({
  liveSender: vi.fn(() => ({ sendOne: vi.fn(async () => ({ ok: true })), sendBatch: vi.fn() })),
}));
vi.mock("@/emails/registration-confirmation", () => ({
  renderRegistrationConfirmation: vi.fn(async () => ({ subject: "s", html: "<p/>", text: "t" })),
}));
vi.mock("@/lib/rate-limit", () => ({
  registerLimiter: { allow: vi.fn(() => true) },
}));

import { POST, GET } from "@/app/api/register/route";
import { getFeaturedEvent } from "@/lib/events";
import { register } from "@/lib/registrations";
import { subscribe } from "@/lib/subscribers";
import { registerLimiter } from "@/lib/rate-limit";

const event = {
  id: "evt-1",
  title: "Fall Fest",
  date_label: "October 1, 2026",
  location: "Denver",
  payment_instructions: null,
  external_signup_url: null,
  status: "published",
  ends_at: "2099-01-01T00:00:00Z",
  sessions: [{ id: "sess-1", name: "Intro", time_label: "6 PM", price_label: "$30", capacity: 24 }],
};

function post(body: unknown) {
  return POST(
    new Request("http://localhost/api/register", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": "1.2.3.4" },
      body: JSON.stringify(body),
    })
  );
}

const validBody = {
  eventId: "evt-1",
  sessionId: "sess-1",
  firstName: "Annie",
  email: "annie@example.com",
  seats: 2,
};

beforeEach(() => {
  vi.clearAllMocks();
  (getFeaturedEvent as ReturnType<typeof vi.fn>).mockResolvedValue(event);
  (register as ReturnType<typeof vi.fn>).mockResolvedValue({
    outcome: "registered",
    registration: {
      cancel_token: "tok-1",
      first_name: "Annie",
      last_name: null,
      seats: 2,
      email: "annie@example.com",
    },
  });
  (registerLimiter.allow as ReturnType<typeof vi.fn>).mockReturnValue(true);
});

describe("POST /api/register", () => {
  it("registers, emails, and subscribes with the event tag", async () => {
    const res = await post(validBody);
    expect(res.status).toBe(200);
    expect(register).toHaveBeenCalled();
    expect(subscribe).toHaveBeenCalledWith(
      expect.objectContaining({ source: "event-registration", tags: ["fall-fest"] })
    );
  });

  it("swallows honeypot submissions with fake success and no write", async () => {
    const res = await post({ ...validBody, website: "spam" });
    expect(res.status).toBe(200);
    expect(register).not.toHaveBeenCalled();
  });

  it("rate limits per IP", async () => {
    (registerLimiter.allow as ReturnType<typeof vi.fn>).mockReturnValue(false);
    expect((await post(validBody)).status).toBe(429);
  });

  it("refuses when there is no matching current event or session", async () => {
    expect((await post({ ...validBody, eventId: "other" })).status).toBe(400);
    expect((await post({ ...validBody, sessionId: "other" })).status).toBe(400);
    (getFeaturedEvent as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    expect((await post(validBody)).status).toBe(400);
  });

  it("refuses events that use an external form", async () => {
    (getFeaturedEvent as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...event,
      external_signup_url: "https://forms.example.com",
    });
    expect((await post(validBody)).status).toBe(400);
  });

  it("returns sold-out with the session named", async () => {
    (register as ReturnType<typeof vi.fn>).mockResolvedValue({ outcome: "sold_out", remaining: 1 });
    const res = await post(validBody);
    expect(res.status).toBe(409);
    expect(JSON.stringify(await res.json())).toContain("Intro");
  });

  it("registration survives email and subscribe failures", async () => {
    (subscribe as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("db down"));
    const res = await post(validBody);
    expect(res.status).toBe(200);
  });
});

describe("GET /api/register", () => {
  it("reports remaining seats per session", async () => {
    const res = await GET(new Request("http://localhost/api/register?eventId=evt-1"));
    const body = await res.json();
    expect(body.sessions).toEqual([{ id: "sess-1", remaining: 4 }]);
  });
  it("is a 404 for a non-current event", async () => {
    const res = await GET(new Request("http://localhost/api/register?eventId=other"));
    expect(res.status).toBe(404);
  });
});
