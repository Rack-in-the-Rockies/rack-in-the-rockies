import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/subscribers", () => ({
  unsubscribeByToken: vi.fn(async () => ({ outcome: "unsubscribed" })),
}));

import { POST, GET } from "@/app/api/unsubscribe/route";
import { unsubscribeByToken } from "@/lib/subscribers";

beforeEach(() => vi.clearAllMocks());

describe("one-click unsubscribe", () => {
  it("POST unsubscribes by token and returns 200", async () => {
    const res = await POST(
      new Request("http://localhost/api/unsubscribe?token=tok-1", { method: "POST" })
    );
    expect(res.status).toBe(200);
    expect(unsubscribeByToken).toHaveBeenCalledWith("tok-1");
  });

  it("POST without a token is a 200 no-op", async () => {
    const res = await POST(new Request("http://localhost/api/unsubscribe", { method: "POST" }));
    expect(res.status).toBe(200);
    expect(unsubscribeByToken).not.toHaveBeenCalled();
  });

  it("GET redirects to the human-facing page", async () => {
    const res = await GET(new Request("http://localhost/api/unsubscribe?token=tok-1"));
    expect(res.status).toBeGreaterThanOrEqual(300);
    expect(res.status).toBeLessThan(400);
    expect(res.headers.get("location")).toBe("http://localhost/unsubscribe?token=tok-1");
  });
});
