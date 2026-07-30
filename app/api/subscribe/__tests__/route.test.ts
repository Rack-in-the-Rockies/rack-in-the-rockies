import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/subscribers", () => ({ subscribe: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({
  subscribeLimiter: { allow: vi.fn(() => true) },
}));

import { POST } from "@/app/api/subscribe/route";
import { subscribe } from "@/lib/subscribers";
import { subscribeLimiter } from "@/lib/rate-limit";

const mockSubscribe = vi.mocked(subscribe);
const mockAllow = vi.mocked(subscribeLimiter.allow);

function post(body: unknown, ip = "1.2.3.4") {
  return POST(
    new Request("http://localhost/api/subscribe", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": ip },
      body: JSON.stringify(body),
    })
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockAllow.mockReturnValue(true);
  mockSubscribe.mockResolvedValue({ outcome: "created" });
});

describe("POST /api/subscribe", () => {
  it("subscribes with a server-set newsletter source", async () => {
    const res = await post({ email: "a@b.co" });
    expect(res.status).toBe(200);
    expect(mockSubscribe).toHaveBeenCalledWith(
      expect.objectContaining({ email: "a@b.co", source: "newsletter" })
    );
  });

  it("ignores a client-supplied source", async () => {
    await post({ email: "a@b.co", source: "booking" });
    expect(mockSubscribe).toHaveBeenCalledWith(
      expect.objectContaining({ source: "newsletter" })
    );
  });

  it("returns the same success shape for created, updated, and blocked", async () => {
    const bodies: string[] = [];
    for (const outcome of ["created", "updated", "blocked"] as const) {
      mockSubscribe.mockResolvedValueOnce({ outcome });
      const res = await post({ email: "a@b.co" });
      expect(res.status).toBe(200);
      bodies.push(JSON.stringify(await res.json()));
    }
    expect(new Set(bodies).size).toBe(1); // not an address-status oracle
  });

  it("rejects invalid email with 400", async () => {
    mockSubscribe.mockResolvedValueOnce({ outcome: "invalid" });
    const res = await post({ email: "junk" });
    expect(res.status).toBe(400);
  });

  it("swallows honeypot submissions with a fake success and no write", async () => {
    const res = await post({ email: "a@b.co", website: "http://spam.example" });
    expect(res.status).toBe(200);
    expect(mockSubscribe).not.toHaveBeenCalled();
  });

  it("rate limits per IP with 429", async () => {
    mockAllow.mockReturnValueOnce(false);
    const res = await post({ email: "a@b.co" });
    expect(res.status).toBe(429);
    expect(mockSubscribe).not.toHaveBeenCalled();
  });

  it("handles malformed JSON with 400", async () => {
    const res = await POST(
      new Request("http://localhost/api/subscribe", {
        method: "POST",
        body: "not json",
      })
    );
    expect(res.status).toBe(400);
  });

  it("returns 500 generic on subscriber-store failure", async () => {
    mockSubscribe.mockRejectedValueOnce(new Error("supabase down: secret detail"));
    const res = await post({ email: "a@b.co" });
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("secret detail");
  });
});
