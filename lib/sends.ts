import {
  chunkIntoBatches,
  idempotencyKey,
  isRetryableSendError,
  RETRY_DELAYS_MS,
  THROTTLE_MS,
  parseAnnouncement,
  type Announcement,
} from "@/lib/send-rules";
import { renderAnnouncement } from "@/emails/render";
import { BUSINESS_EMAIL, BUSINESS_NAME, SITE_URL } from "@/lib/business";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { Resend } from "resend";
import type { AudienceMember } from "@/lib/subscribers";

export type SendStatus = "sending" | "sent" | "partial" | "failed";
export type RecipientStatus =
  | "pending"
  | "sent"
  | "failed"
  | "delivered"
  | "bounced"
  | "complained";

export type SendRowState = {
  id: string;
  template: string;
  subject: string;
  fields: unknown;
  audience: { tags: string[] };
  status: SendStatus;
  total_count: number;
  sent_count: number;
  failed_count: number;
  created_by: string;
  completed_at: string | null;
  created_at?: string;
};

export type SendRecipient = {
  id: string;
  send_id: string;
  subscriber_id: string;
  email: string;
  chunk_index: number;
  resend_email_id: string | null;
  status: RecipientStatus;
  error: string | null;
  /** Joined from subscribers for rendering. */
  unsubscribe_token: string;
};

export type OutgoingEmail = {
  from: string;
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo: string;
  headers: Record<string, string>;
};

export type BatchSendResult =
  | { ok: true; ids: string[] }
  | { ok: false; retryable: boolean; message: string };

export type EmailSender = {
  sendBatch(emails: OutgoingEmail[], idempotencyKey: string): Promise<BatchSendResult>;
  sendOne(email: OutgoingEmail): Promise<{ ok: true } | { ok: false; message: string }>;
};

export type SendDb = {
  insertSend(row: {
    template: string;
    subject: string;
    fields: unknown;
    audience: { tags: string[] };
    total_count: number;
    created_by: string;
  }): Promise<string>;
  insertRecipients(
    rows: { send_id: string; subscriber_id: string; email: string; chunk_index: number }[]
  ): Promise<void>;
  updateSend(id: string, patch: Partial<SendRowState>): Promise<void>;
  updateRecipient(id: string, patch: Partial<SendRecipient>): Promise<void>;
  listUnsentRecipients(sendId: string): Promise<SendRecipient[]>;
  recipientStatusCounts(sendId: string): Promise<Record<string, number>>;
};

export type SendDeps = {
  db: SendDb;
  sender: EmailSender;
  sleep: (ms: number) => Promise<void>;
  buildEmail: (
    a: Announcement,
    r: { email: string; unsubscribe_token: string }
  ) => Promise<OutgoingEmail>;
};

/** Snapshot the audience and freeze chunk membership. Returns the send id. */
export async function createSend(
  a: Announcement,
  audience: { tags: string[] },
  createdBy: string,
  members: AudienceMember[],
  db: SendDb
): Promise<string> {
  const sendId = await db.insertSend({
    template: a.template,
    subject: a.fields.subject,
    fields: a.fields,
    audience,
    total_count: members.length,
    created_by: createdBy,
  });
  const chunks = chunkIntoBatches(members);
  const rows = chunks.flatMap((chunk, chunkIndex) =>
    chunk.map((m) => ({
      send_id: sendId,
      subscriber_id: m.id,
      email: m.email,
      chunk_index: chunkIndex,
    }))
  );
  await db.insertRecipients(rows);
  return sendId;
}

/**
 * Runs (or resumes) a send. Only pending/failed recipients are attempted,
 * grouped by their frozen chunk_index so idempotency keys stay paired with
 * identical payloads. One bad chunk never strands the rest.
 */
export async function runSend(sendId: string, a: Announcement, deps: SendDeps): Promise<void> {
  const { db, sender, sleep, buildEmail } = deps;
  const unsent = await db.listUnsentRecipients(sendId);

  const byChunk = new Map<number, SendRecipient[]>();
  for (const r of unsent) {
    const list = byChunk.get(r.chunk_index) ?? [];
    list.push(r);
    byChunk.set(r.chunk_index, list);
  }

  for (const [chunkIndex, recipients] of [...byChunk.entries()].sort((x, y) => x[0] - y[0])) {
    const emails = await Promise.all(recipients.map((r) => buildEmail(a, r)));
    const key = idempotencyKey(sendId, chunkIndex);

    let result = await sender.sendBatch(emails, key);
    for (
      let attempt = 0;
      !result.ok && result.retryable && attempt < RETRY_DELAYS_MS.length;
      attempt++
    ) {
      await sleep(RETRY_DELAYS_MS[attempt]);
      result = await sender.sendBatch(emails, key);
    }

    if (result.ok) {
      const ids = result.ids;
      await Promise.all(
        recipients.map((r, i) =>
          db.updateRecipient(r.id, {
            status: "sent",
            resend_email_id: ids[i] ?? null,
            error: null,
          })
        )
      );
    } else {
      const message = result.message;
      await Promise.all(
        recipients.map((r) => db.updateRecipient(r.id, { status: "failed", error: message }))
      );
    }
    await sleep(THROTTLE_MS);
  }

  const counts = await db.recipientStatusCounts(sendId);
  const failed = counts.failed ?? 0;
  const pending = counts.pending ?? 0;
  const total = Object.values(counts).reduce((sum, n) => sum + n, 0);
  const accepted = total - failed - pending;
  const status: SendStatus =
    failed === 0 && pending === 0 ? "sent" : accepted === 0 ? "failed" : "partial";
  await db.updateSend(sendId, {
    status,
    sent_count: accepted,
    failed_count: failed,
    completed_at: new Date().toISOString(),
  });
}

// ---------------------------------------------------------------------------
// Live adapters
// ---------------------------------------------------------------------------

export async function liveBuildEmail(
  a: Announcement,
  r: { email: string; unsubscribe_token: string }
): Promise<OutgoingEmail> {
  const rendered = await renderAnnouncement(a, {
    unsubscribeToken: r.unsubscribe_token,
    baseUrl: SITE_URL,
  });
  return {
    from: `${BUSINESS_NAME} <${BUSINESS_EMAIL}>`,
    to: r.email,
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
    replyTo: BUSINESS_EMAIL,
    headers: {
      "List-Unsubscribe": `<${SITE_URL}/api/unsubscribe?token=${encodeURIComponent(r.unsubscribe_token)}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
  };
}

let _resend: Resend | null = null;
function getResend(): Resend {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY);
  return _resend;
}

export function liveSender(): EmailSender {
  return {
    async sendBatch(emails, key) {
      const { data, error } = await getResend().batch.send(
        emails.map((e) => ({
          from: e.from,
          to: e.to,
          subject: e.subject,
          html: e.html,
          text: e.text,
          replyTo: e.replyTo,
          headers: e.headers,
        })),
        { idempotencyKey: key }
      );
      if (error) {
        return {
          ok: false,
          retryable: isRetryableSendError({ statusCode: error.statusCode, name: error.name }),
          message: `${error.name}: ${error.message}`,
        };
      }
      return { ok: true, ids: (data?.data ?? []).map((d) => d.id) };
    },
    async sendOne(email) {
      const { error } = await getResend().emails.send({
        from: email.from,
        to: email.to,
        subject: email.subject,
        html: email.html,
        text: email.text,
        replyTo: email.replyTo,
        headers: email.headers,
      });
      return error ? { ok: false, message: `${error.name}: ${error.message}` } : { ok: true };
    },
  };
}

const RECIPIENT_COLUMNS =
  "id, send_id, subscriber_id, email, chunk_index, resend_email_id, status, error, subscribers (unsubscribe_token)";

type JoinedRecipient = Omit<SendRecipient, "unsubscribe_token"> & {
  subscribers: { unsubscribe_token: string } | null;
};

function flattenRecipient(r: JoinedRecipient): SendRecipient {
  return { ...r, unsubscribe_token: r.subscribers?.unsubscribe_token ?? "" };
}

export function liveSendDb(): SendDb {
  const client = supabaseAdmin();
  return {
    async insertSend(row) {
      const { data, error } = await client.from("sends").insert(row).select("id").single();
      if (error) throw error;
      return (data as { id: string }).id;
    },
    async insertRecipients(rows) {
      const { error } = await client.from("send_recipients").insert(rows);
      if (error) throw error;
    },
    async updateSend(id, patch) {
      const { error } = await client.from("sends").update(patch).eq("id", id);
      if (error) throw error;
    },
    async updateRecipient(id, patch) {
      const { error } = await client.from("send_recipients").update(patch).eq("id", id);
      if (error) throw error;
    },
    async listUnsentRecipients(sendId) {
      const { data, error } = await client
        .from("send_recipients")
        .select(RECIPIENT_COLUMNS)
        .eq("send_id", sendId)
        .in("status", ["pending", "failed"])
        .order("chunk_index", { ascending: true })
        .limit(10000);
      if (error) throw error;
      return (data as unknown as JoinedRecipient[]).map(flattenRecipient);
    },
    async recipientStatusCounts(sendId) {
      const { data, error } = await client
        .from("send_recipients")
        .select("status")
        .eq("send_id", sendId)
        .limit(10000);
      if (error) throw error;
      const counts: Record<string, number> = {};
      for (const row of data as { status: string }[]) {
        counts[row.status] = (counts[row.status] ?? 0) + 1;
      }
      return counts;
    },
  };
}

export function liveSendDeps(): SendDeps {
  return {
    db: liveSendDb(),
    sender: liveSender(),
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    buildEmail: liveBuildEmail,
  };
}

// ---------------------------------------------------------------------------
// Read paths and webhook write (straight to Supabase; no business rules here)
// ---------------------------------------------------------------------------

export type SendSummary = SendRowState & {
  delivered_count: number;
  bounced_count: number;
  complained_count: number;
};

function withDerivedCounts(send: SendRowState, counts: Record<string, number>): SendSummary {
  return {
    ...send,
    delivered_count: counts.delivered ?? 0,
    bounced_count: counts.bounced ?? 0,
    complained_count: counts.complained ?? 0,
  };
}

export async function listSends(): Promise<SendSummary[]> {
  const client = supabaseAdmin();
  const { data, error } = await client
    .from("sends")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  const sends = data as SendRowState[];
  if (sends.length === 0) return [];
  const { data: rcpts, error: rcptError } = await client
    .from("send_recipients")
    .select("send_id, status")
    .in(
      "send_id",
      sends.map((s) => s.id)
    )
    .limit(10000);
  if (rcptError) throw rcptError;
  const bySend = new Map<string, Record<string, number>>();
  for (const r of rcpts as { send_id: string; status: string }[]) {
    const counts = bySend.get(r.send_id) ?? {};
    counts[r.status] = (counts[r.status] ?? 0) + 1;
    bySend.set(r.send_id, counts);
  }
  return sends.map((s) => withDerivedCounts(s, bySend.get(s.id) ?? {}));
}

export async function getSendDetail(id: string): Promise<{
  send: SendSummary;
  announcement: Announcement | null;
  recipients: { id: string; email: string; status: RecipientStatus }[];
  resumable: boolean;
} | null> {
  const client = supabaseAdmin();
  const { data, error } = await client.from("sends").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const send = data as SendRowState;
  const { data: rcpts, error: rcptError } = await client
    .from("send_recipients")
    .select("id, email, status")
    .eq("send_id", id)
    .order("email", { ascending: true })
    .limit(10000);
  if (rcptError) throw rcptError;
  const recipients = rcpts as { id: string; email: string; status: RecipientStatus }[];
  const counts: Record<string, number> = {};
  for (const r of recipients) counts[r.status] = (counts[r.status] ?? 0) + 1;
  return {
    send: withDerivedCounts(send, counts),
    announcement: parseAnnouncement({ template: send.template, fields: send.fields }),
    recipients,
    resumable: (counts.pending ?? 0) + (counts.failed ?? 0) > 0,
  };
}

/** Webhook write: last write wins; svix replays are harmless. */
export async function markRecipientOutcome(
  resendEmailId: string,
  status: "delivered" | "bounced" | "complained"
): Promise<void> {
  const { error } = await supabaseAdmin()
    .from("send_recipients")
    .update({ status })
    .eq("resend_email_id", resendEmailId);
  if (error) throw error;
}
