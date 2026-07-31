import { describe, it, expect, vi } from "vitest";
import {
  createSend,
  runSend,
  type SendDb,
  type SendDeps,
  type SendRecipient,
  type OutgoingEmail,
  type SendRowState,
} from "@/lib/sends";
import type { Announcement } from "@/lib/send-rules";

const announcement: Announcement = {
  template: "general-update",
  fields: { subject: "Hi", body: "Hello." },
};

function fakeEmail(to: string): OutgoingEmail {
  return {
    from: "Rack in the Rockies <hello@rackintherockies.com>",
    to,
    subject: "Hi",
    html: "<p>Hello.</p>",
    text: "Hello.",
    replyTo: "hello@rackintherockies.com",
    headers: { "List-Unsubscribe": `<https://x/api/unsubscribe?token=${to}>` },
  };
}

function memory(seedRecipients: SendRecipient[] = []) {
  const sends = new Map<string, SendRowState>();
  const recipients = [...seedRecipients];
  let nextId = 1;
  const db: SendDb = {
    async insertSend(row) {
      const id = `send-${nextId++}`;
      sends.set(id, {
        id,
        status: "sending",
        completed_at: null,
        sent_count: 0,
        failed_count: 0,
        ...row,
      });
      return id;
    },
    async insertRecipients(rows) {
      for (const r of rows) {
        recipients.push({
          id: `rcpt-${recipients.length + 1}`,
          resend_email_id: null,
          status: "pending",
          error: null,
          unsubscribe_token: `tok-${r.subscriber_id}`,
          ...r,
        });
      }
    },
    async updateSend(id, patch) {
      Object.assign(sends.get(id)!, patch);
    },
    async updateRecipient(id, patch) {
      Object.assign(recipients.find((r) => r.id === id)!, patch);
    },
    async listUnsentRecipients(sendId) {
      return recipients.filter(
        (r) => r.send_id === sendId && (r.status === "pending" || r.status === "failed")
      );
    },
    async recipientStatusCounts(sendId) {
      const counts: Record<string, number> = {};
      for (const r of recipients.filter((r) => r.send_id === sendId)) {
        counts[r.status] = (counts[r.status] ?? 0) + 1;
      }
      return counts;
    },
  };
  return { db, sends, recipients };
}

function deps(db: SendDb, sender: SendDeps["sender"]): SendDeps {
  return {
    db,
    sender,
    sleep: vi.fn(async () => {}),
    buildEmail: async (_a, r) => fakeEmail(r.email),
  };
}

function members(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    id: `sub-${i}`,
    email: `person${i}@example.com`,
    unsubscribe_token: `tok-${i}`,
  }));
}

const okSender = () =>
  vi.fn(async (emails: OutgoingEmail[]) => ({
    ok: true as const,
    ids: emails.map((e, i) => `re-${e.to}-${i}`),
  }));

describe("createSend", () => {
  it("snapshots recipients with positional chunk assignment", async () => {
    const { db, recipients } = memory();
    const sendId = await createSend(announcement, { tags: [] }, "admin-1", members(250), db);
    expect(sendId).toBe("send-1");
    expect(recipients).toHaveLength(250);
    expect(recipients[0].chunk_index).toBe(0);
    expect(recipients[99].chunk_index).toBe(0);
    expect(recipients[100].chunk_index).toBe(1);
    expect(recipients[249].chunk_index).toBe(2);
  });
});

describe("runSend", () => {
  it("sends every chunk with stable idempotency keys and finishes sent", async () => {
    const { db, sends, recipients } = memory();
    const sendId = await createSend(announcement, { tags: [] }, "admin-1", members(250), db);
    const sender = okSender();
    await runSend(sendId, announcement, deps(db, { sendBatch: sender, sendOne: vi.fn() }));

    expect(sender).toHaveBeenCalledTimes(3);
    expect(sender.mock.calls.map((c) => c[1])).toEqual([
      "send-send-1-chunk-0",
      "send-send-1-chunk-1",
      "send-send-1-chunk-2",
    ]);
    expect(recipients.every((r) => r.status === "sent" && r.resend_email_id)).toBe(true);
    const send = sends.get(sendId)!;
    expect(send.status).toBe("sent");
    expect(send.sent_count).toBe(250);
    expect(send.failed_count).toBe(0);
    expect(send.completed_at).not.toBeNull();
  });

  it("isolates a permanently failing chunk and finishes partial", async () => {
    const { db, sends, recipients } = memory();
    const sendId = await createSend(announcement, { tags: [] }, "admin-1", members(250), db);
    const sender = vi.fn(async (emails: OutgoingEmail[], key: string) =>
      key.endsWith("chunk-1")
        ? { ok: false as const, retryable: false, message: "validation_error" }
        : { ok: true as const, ids: emails.map((_, i) => `re-${i}`) }
    );
    await runSend(sendId, announcement, deps(db, { sendBatch: sender, sendOne: vi.fn() }));

    expect(sender).toHaveBeenCalledTimes(3);
    expect(recipients.filter((r) => r.status === "failed")).toHaveLength(100);
    expect(recipients.filter((r) => r.status === "sent")).toHaveLength(150);
    expect(recipients.find((r) => r.status === "failed")!.error).toBe("validation_error");
    expect(sends.get(sendId)!.status).toBe("partial");
    expect(sends.get(sendId)!.failed_count).toBe(100);
  });

  it("retries transient failures with backoff, then succeeds", async () => {
    const { db, sends } = memory();
    const sendId = await createSend(announcement, { tags: [] }, "admin-1", members(5), db);
    const sender = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, retryable: true, message: "rate_limit_exceeded" })
      .mockResolvedValueOnce({ ok: false, retryable: true, message: "rate_limit_exceeded" })
      .mockResolvedValueOnce({ ok: true, ids: ["a", "b", "c", "d", "e"] });
    const d = deps(db, { sendBatch: sender, sendOne: vi.fn() });
    await runSend(sendId, announcement, d);

    expect(sender).toHaveBeenCalledTimes(3);
    expect(new Set(sender.mock.calls.map((c) => c[1])).size).toBe(1);
    expect(d.sleep).toHaveBeenCalledWith(1000);
    expect(d.sleep).toHaveBeenCalledWith(2000);
    expect(sends.get(sendId)!.status).toBe("sent");
  });

  it("gives up after exhausting retries and marks failed", async () => {
    const { db, sends } = memory();
    const sendId = await createSend(announcement, { tags: [] }, "admin-1", members(5), db);
    const sender = vi.fn(async () => ({
      ok: false as const,
      retryable: true,
      message: "internal_server_error",
    }));
    await runSend(sendId, announcement, deps(db, { sendBatch: sender, sendOne: vi.fn() }));
    expect(sender).toHaveBeenCalledTimes(3);
    expect(sends.get(sendId)!.status).toBe("failed");
  });

  it("resumes only unsent recipients, preserving their original chunk keys", async () => {
    const { db, sends, recipients } = memory();
    const sendId = await createSend(announcement, { tags: [] }, "admin-1", members(250), db);
    // Simulate a prior run where chunk 0 succeeded and the process died.
    for (const r of recipients.filter((r) => r.chunk_index === 0)) {
      Object.assign(r, { status: "sent", resend_email_id: "re-old" });
    }
    const sender = okSender();
    await runSend(sendId, announcement, deps(db, { sendBatch: sender, sendOne: vi.fn() }));

    expect(sender).toHaveBeenCalledTimes(2);
    expect(sender.mock.calls.map((c) => c[1]).sort()).toEqual([
      "send-send-1-chunk-1",
      "send-send-1-chunk-2",
    ]);
    expect(sends.get(sendId)!.status).toBe("sent");
    expect(sends.get(sendId)!.sent_count).toBe(250);
  });
});
