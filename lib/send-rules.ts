export type TemplateKey = "event-announcement" | "general-update";

export type EventSessionField = { name: string; time: string; price: string };

export type EventAnnouncementFields = {
  subject: string;
  preheader?: string;
  headline: string;
  dateLabel: string;
  time?: string;
  location: string;
  intro: string;
  sessions: EventSessionField[];
  ctaLabel?: string;
  ctaUrl?: string;
  closingNote?: string;
};

export type GeneralUpdateFields = {
  subject: string;
  preheader?: string;
  headline?: string;
  body: string;
  ctaLabel?: string;
  ctaUrl?: string;
};

export type Announcement =
  | { template: "event-announcement"; fields: EventAnnouncementFields }
  | { template: "general-update"; fields: GeneralUpdateFields };

/** Resend's batch endpoint accepts at most 100 emails per call. */
export const BATCH_SIZE = 100;
/** Resend's default rate limit is 2 requests per second. */
export const THROTTLE_MS = 600;
/** Backoff before retry attempts 2 and 3 of a chunk. */
export const RETRY_DELAYS_MS = [1000, 2000];

export function chunkIntoBatches<T>(items: T[], size: number = BATCH_SIZE): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

/**
 * Stable per-chunk key. Chunk membership is frozen at snapshot time
 * (send_recipients.chunk_index), so a reused key always accompanies an
 * identical payload, which is what makes Resend's dedup safe to lean on.
 */
export function idempotencyKey(sendId: string, chunkIndex: number): string {
  return `send-${sendId}-chunk-${chunkIndex}`;
}

export type SendErrorInfo = { statusCode: number | null; name?: string };

const RETRYABLE_ERROR_NAMES = new Set([
  "rate_limit_exceeded",
  "concurrent_idempotent_requests",
  "application_error",
  "internal_server_error",
]);

export function isRetryableSendError(error: SendErrorInfo): boolean {
  if (error.name && RETRYABLE_ERROR_NAMES.has(error.name)) return true;
  if (error.statusCode === 429) return true;
  if (error.statusCode !== null && error.statusCode >= 500) return true;
  return false;
}

export type WebhookOutcome = {
  recipientStatus: "delivered" | "bounced" | "complained" | null;
  subscriberAction: "bounce" | "complain" | null;
};

/**
 * Which writes a webhook event triggers. Only permanent bounces change the
 * subscriber; transient bounces record the recipient outcome and nothing
 * else. Complaints always reach the subscriber (complained outranks all).
 */
export function mapWebhookEvent(type: string, bounceType?: string): WebhookOutcome {
  switch (type) {
    case "email.delivered":
      return { recipientStatus: "delivered", subscriberAction: null };
    case "email.complained":
      return { recipientStatus: "complained", subscriberAction: "complain" };
    case "email.bounced": {
      const permanent = (bounceType ?? "").toLowerCase() === "permanent";
      return { recipientStatus: "bounced", subscriberAction: permanent ? "bounce" : null };
    }
    default:
      return { recipientStatus: null, subscriberAction: null };
  }
}

export function splitParagraphs(body: string): string[] {
  return body
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/** Shape coercion only; business validation lives in validateAnnouncement. */
export function parseAnnouncement(input: unknown): Announcement | null {
  if (typeof input !== "object" || input === null) return null;
  const { template, fields } = input as { template?: unknown; fields?: unknown };
  if (typeof fields !== "object" || fields === null) return null;
  const f = fields as Record<string, unknown>;

  if (template === "event-announcement") {
    const rawSessions = Array.isArray(f.sessions) ? f.sessions : [];
    const sessions = rawSessions
      .map((s) => {
        const row = (typeof s === "object" && s !== null ? s : {}) as Record<string, unknown>;
        return { name: str(row.name), time: str(row.time), price: str(row.price) };
      })
      .filter((s) => s.name || s.time || s.price);
    return {
      template,
      fields: {
        subject: str(f.subject),
        preheader: str(f.preheader) || undefined,
        headline: str(f.headline),
        dateLabel: str(f.dateLabel),
        time: str(f.time) || undefined,
        location: str(f.location),
        intro: str(f.intro),
        sessions,
        ctaLabel: str(f.ctaLabel) || undefined,
        ctaUrl: str(f.ctaUrl) || undefined,
        closingNote: str(f.closingNote) || undefined,
      },
    };
  }

  if (template === "general-update") {
    return {
      template,
      fields: {
        subject: str(f.subject),
        preheader: str(f.preheader) || undefined,
        headline: str(f.headline) || undefined,
        body: str(f.body),
        ctaLabel: str(f.ctaLabel) || undefined,
        ctaUrl: str(f.ctaUrl) || undefined,
      },
    };
  }

  return null;
}

function isWebUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/** Plain-language errors; the composer's audience is non-technical. */
export function validateAnnouncement(a: Announcement): string[] {
  const errors: string[] = [];
  const f = a.fields;
  if (!f.subject.trim()) errors.push("Add a subject line.");

  const cta = { label: f.ctaLabel?.trim() ?? "", url: f.ctaUrl?.trim() ?? "" };
  if (cta.label || cta.url) {
    if (!cta.label || !cta.url) {
      errors.push("The button needs both a label and a link.");
    } else if (!isWebUrl(cta.url)) {
      errors.push("The button link must start with http:// or https://.");
    }
  }

  if (a.template === "event-announcement") {
    if (!a.fields.headline.trim()) errors.push("Add a headline.");
    if (!a.fields.dateLabel.trim()) errors.push("Add the event date.");
    if (!a.fields.location.trim()) errors.push("Add the location.");
    if (!a.fields.intro.trim()) errors.push("Add an intro paragraph.");
    for (const s of a.fields.sessions) {
      if (!s.name.trim() || !s.time.trim() || !s.price.trim()) {
        errors.push("Each session needs a name, a time, and a price. Remove empty rows.");
        break;
      }
    }
  } else {
    if (splitParagraphs(a.fields.body).length === 0) errors.push("Write at least one paragraph.");
  }
  return errors;
}
