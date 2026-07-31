import { describe, it, expect, vi, beforeEach } from "vitest";

const mockVerify = vi.fn();
vi.mock("resend", () => ({
  Resend: class {
    webhooks = { verify: mockVerify };
  },
}));
vi.mock("@/lib/subscribers", () => ({
  markBounced: vi.fn(async () => ({ outcome: "bounced" })),
  markComplained: vi.fn(async () => ({ outcome: "complained" })),
}));
vi.mock("@/lib/sends", () => ({
  markRecipientOutcome: vi.fn(async () => {}),
}));

import { POST } from "@/app/api/webhooks/resend/route";
import { markBounced, markComplained } from "@/lib/subscribers";
import { markRecipientOutcome } from "@/lib/sends";

function post(body = "{}") {
  return POST(
    new Request("http://localhost/api/webhooks/resend", {
      method: "POST",
      headers: {
        "svix-id": "msg_1",
        "svix-timestamp": "1234",
        "svix-signature": "v1,sig",
      },
      body,
    })
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.RESEND_WEBHOOK_SECRET = "whsec_test";
});

describe("POST /api/webhooks/resend", () => {
  it("rejects an invalid signature with 401 and does nothing", async () => {
    mockVerify.mockImplementation(() => {
      throw new Error("bad signature");
    });
    const res = await post();
    expect(res.status).toBe(401);
    expect(markRecipientOutcome).not.toHaveBeenCalled();
  });

  it("returns 500 when the secret is not configured", async () => {
    delete process.env.RESEND_WEBHOOK_SECRET;
    const res = await post();
    expect(res.status).toBe(500);
    expect(mockVerify).not.toHaveBeenCalled();
  });

  it("records delivery without touching the subscriber", async () => {
    mockVerify.mockReturnValue({
      type: "email.delivered",
      data: { email_id: "re-1", to: ["annie@example.com"] },
    });
    const res = await post();
    expect(res.status).toBe(200);
    expect(markRecipientOutcome).toHaveBeenCalledWith("re-1", "delivered");
    expect(markBounced).not.toHaveBeenCalled();
    expect(markComplained).not.toHaveBeenCalled();
  });

  it("marks the subscriber on a permanent bounce", async () => {
    mockVerify.mockReturnValue({
      type: "email.bounced",
      data: {
        email_id: "re-2",
        to: ["annie@example.com"],
        bounce: { type: "Permanent", subType: "General", message: "" },
      },
    });
    await post();
    expect(markRecipientOutcome).toHaveBeenCalledWith("re-2", "bounced");
    expect(markBounced).toHaveBeenCalledWith("annie@example.com");
  });

  it("leaves the subscriber alone on a transient bounce", async () => {
    mockVerify.mockReturnValue({
      type: "email.bounced",
      data: {
        email_id: "re-3",
        to: ["annie@example.com"],
        bounce: { type: "Transient", subType: "General", message: "" },
      },
    });
    await post();
    expect(markRecipientOutcome).toHaveBeenCalledWith("re-3", "bounced");
    expect(markBounced).not.toHaveBeenCalled();
  });

  it("marks complaints on recipient and subscriber", async () => {
    mockVerify.mockReturnValue({
      type: "email.complained",
      data: { email_id: "re-4", to: ["annie@example.com"] },
    });
    await post();
    expect(markRecipientOutcome).toHaveBeenCalledWith("re-4", "complained");
    expect(markComplained).toHaveBeenCalledWith("annie@example.com");
  });

  it("acknowledges unhandled events without acting", async () => {
    mockVerify.mockReturnValue({ type: "email.opened", data: { email_id: "re-5", to: [] } });
    const res = await post();
    expect(res.status).toBe(200);
    expect(markRecipientOutcome).not.toHaveBeenCalled();
  });
});
