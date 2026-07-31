import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({
  requireAdmin: vi.fn(async () => ({ userId: "admin-1", email: "tyler@example.com" })),
}));
vi.mock("@/lib/subscribers", () => ({
  countAudience: vi.fn(async () => 214),
  listAudience: vi.fn(async () => [
    { id: "sub-1", email: "a@example.com", unsubscribe_token: "tok-a" },
  ]),
}));
vi.mock("@/lib/sends", () => ({
  createSend: vi.fn(async () => "send-1"),
  runSend: vi.fn(async () => {}),
  getSendDetail: vi.fn(),
  liveSendDeps: vi.fn(() => ({
    db: {},
    sender: { sendOne: vi.fn() },
    sleep: vi.fn(),
    buildEmail: vi.fn(),
  })),
  liveSendDb: vi.fn(() => ({})),
  liveBuildEmail: vi.fn(async () => ({
    from: "x",
    to: "x",
    subject: "s",
    html: "<p/>",
    text: "t",
    replyTo: "x",
    headers: {},
  })),
  liveSender: vi.fn(() => ({
    sendOne: vi.fn(async () => ({ ok: true })),
    sendBatch: vi.fn(),
  })),
}));
vi.mock("@/emails/render", () => ({
  renderAnnouncement: vi.fn(async () => ({ subject: "s", html: "<p>preview</p>", text: "t" })),
}));

import { previewAction, countAction, sendAction } from "@/app/admin/(gated)/compose/actions";
import { requireAdmin } from "@/lib/auth";
import { createSend, runSend } from "@/lib/sends";

const validInput = {
  template: "general-update",
  fields: { subject: "Hello", body: "A paragraph." },
};

beforeEach(() => vi.clearAllMocks());

describe("composer actions", () => {
  it("every action re-verifies the admin session", async () => {
    await previewAction(validInput);
    await countAction([]);
    await sendAction(validInput, []);
    expect(requireAdmin).toHaveBeenCalledTimes(3);
  });

  it("preview renders without full validation", async () => {
    const result = await previewAction({
      template: "general-update",
      fields: { subject: "", body: "" },
    });
    expect("html" in result && result.html).toContain("preview");
  });

  it("counts the audience", async () => {
    expect(await countAction(["booking"])).toEqual({ count: 214 });
  });

  it("refuses a real send while the mailing address is null", async () => {
    const result = await sendAction(validInput, []);
    expect("error" in result && result.error).toMatch(/mailing address/i);
    expect(createSend).not.toHaveBeenCalled();
    expect(runSend).not.toHaveBeenCalled();
  });

  it("rejects invalid fields with plain-language errors", async () => {
    vi.resetModules();
    vi.doMock("@/lib/business", () => ({
      BUSINESS_NAME: "Rack in the Rockies",
      BUSINESS_EMAIL: "hello@rackintherockies.com",
      BUSINESS_LOCATION: "Denver, Colorado",
      SITE_URL: "https://rackintherockies.com",
      BUSINESS_MAILING_ADDRESS: "123 Main St, Denver, CO 80202",
    }));
    const actions = await import("@/app/admin/(gated)/compose/actions");
    const result = await actions.sendAction(
      { template: "general-update", fields: { subject: "", body: "" } },
      []
    );
    expect("errors" in result && result.errors.length).toBeGreaterThan(0);
    vi.doUnmock("@/lib/business");
  });
});

describe("sendAction with an address configured", () => {
  it("snapshots, runs, and reports", async () => {
    vi.resetModules();
    vi.doMock("@/lib/business", () => ({
      BUSINESS_NAME: "Rack in the Rockies",
      BUSINESS_EMAIL: "hello@rackintherockies.com",
      BUSINESS_LOCATION: "Denver, Colorado",
      SITE_URL: "https://rackintherockies.com",
      BUSINESS_MAILING_ADDRESS: "123 Main St, Denver, CO 80202",
    }));
    const actions = await import("@/app/admin/(gated)/compose/actions");
    const sends = await import("@/lib/sends");
    (sends.getSendDetail as ReturnType<typeof vi.fn>).mockResolvedValue({
      send: { status: "sent", sent_count: 1, failed_count: 0 },
    });
    const result = await actions.sendAction(validInput, []);
    expect(sends.createSend).toHaveBeenCalled();
    expect(sends.runSend).toHaveBeenCalledWith("send-1", expect.anything(), expect.anything());
    expect("sendId" in result && result.sendId).toBe("send-1");
    vi.doUnmock("@/lib/business");
  });
});
