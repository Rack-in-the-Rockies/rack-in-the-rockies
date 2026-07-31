# Announcement Sending Phase 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the admin compose and send templated event announcements to the subscriber list through Resend, with delivery hygiene (webhooks, one-click unsubscribe, compliant footer), a tracked batched pipeline with resume, send history, and the admin list improvements from Tyler's cleanup list, per `docs/superpowers/specs/2026-07-30-announcement-sending-phase-2-design.md`.

**Architecture:** Pure decision logic in `lib/send-rules.ts`; the pipeline orchestrator `lib/sends.ts` takes injectable `SendDb` / `EmailSender` / renderer so everything is unit-testable without Supabase or Resend (the Phase 1 `SubscriberDb` pattern). React Email templates in `emails/` render per-recipient HTML. Webhooks and status write-backs flow through `lib/subscribers.ts`, which remains the single subscriber write path.

**Tech Stack:** Next.js 16.2.1 App Router (`await searchParams`, `proxy.ts`, server actions), Supabase (secret-key server client), Resend SDK 6.9.4 (`batch.send` with `idempotencyKey`, `webhooks.verify`), React Email (`@react-email/components` ^1.0.12, `@react-email/render` ^2.1.0), vitest 4.

**Read the spec first.** It is the authority on behavior. This plan is the authority on file layout and sequencing.

**Verified SDK facts** (from `node_modules/resend/dist/index.d.mts`, do not re-derive from memory):
- `resend.batch.send(emails, { idempotencyKey })` where each email is `CreateEmailOptions` minus `attachments`/`scheduledAt`; per-email `headers: Record<string, string>` IS supported. Response is `{ data: { data: { id: string }[] } | null, error: { message, statusCode: number | null, name } | null }`.
- `resend.webhooks.verify({ payload, headers: { id, timestamp, signature }, webhookSecret })` returns a typed event and THROWS on invalid signature. `payload` must be the raw body string.
- Bounce events: `{ type: 'email.bounced', data: { email_id, to: string[], ..., bounce: { message, subType, type } } }`. Other email events carry `data.email_id` and `data.to` without `bounce`.
- Retryable error names include `rate_limit_exceeded`, `concurrent_idempotent_requests`, `application_error`, `internal_server_error`.

Copy rule for ALL user-facing strings and email copy in every task: no em dashes, no en dashes (AGENTS.md). Time ranges use a hyphen.

---

## Manual prerequisites (Tyler, not the executing engineer)

None of these block Tasks 1-12. Real sends stay blocked until P1.

- [ ] **P1.** Set `BUSINESS_MAILING_ADDRESS` in `lib/business.ts` to the full physical mailing address (Phase 1 M8). This is the entire unblock for real sends.
- [ ] **P2.** Resend dashboard → Webhooks: create a webhook for `https://rackintherockies.com/api/webhooks/resend` with events `email.bounced`, `email.complained`, `email.delivered`. Copy the signing secret into `RESEND_WEBHOOK_SECRET` in `.env.local` and Vercel (server-only).
- [ ] **P3.** After deploy: send a test event from the Resend webhook dashboard, confirm 2xx.
- [ ] **P4.** `supabase db push` if the executing engineer could not (requires the linked project), then run the migration verification query in Task 2.
- [ ] **P5.** First real-world check: test send to self from `/admin/compose`, verify rendering in Gmail, and verify Gmail's native unsubscribe control flips the test row to `unsubscribed`.

---

## File structure

```
supabase/migrations/<ts>_announcement_sending.sql  new: sends + send_recipients + GIN tags index (via `supabase migration new`)
lib/business.ts                    modify: add SITE_URL, BUSINESS_MAILING_ADDRESS (null until P1)
lib/send-rules.ts                  new: pure logic: field types, parse/validate, chunking, retry, idempotency keys, webhook mapping
lib/subscriber-rules.ts            modify: add csvField/subscribersToCsv (pure)
lib/subscribers.ts                 modify: markBounced, markComplained, addTagById, removeTagById, listTags, countAudience, listAudience, exportSubscribers, listSubscribers pagination + tag filter
lib/sends.ts                       new: SendDb/EmailSender interfaces, createSend, runSend, listSends, getSendDetail, markRecipientOutcome, live adapters
lib/auth.ts                        modify: requireAdmin also returns email
emails/theme.ts                    new: palette constants mirroring app/globals.css
emails/layout.tsx                  new: EmailShell (header, content, compliant footer)
emails/event-announcement.tsx      new
emails/general-update.tsx          new
emails/render.tsx                  new: renderAnnouncement -> { subject, html, text }
app/api/webhooks/resend/route.ts   new: signature-verified status write-back
app/api/unsubscribe/route.ts       new: RFC 8058 one-click POST + GET redirect
app/admin/(gated)/compose/page.tsx      new
app/admin/(gated)/compose/actions.ts    new: preview/count/test/send server actions
app/admin/(gated)/compose/composer.tsx  new: client component
app/admin/(gated)/sends/page.tsx        new: history list
app/admin/(gated)/sends/[id]/page.tsx   new: detail + Resume
app/admin/(gated)/sends/actions.ts      new: resume server action
app/admin/(gated)/layout.tsx       modify: nav links
app/admin/(gated)/page.tsx         modify: tag filter, pagination, tag editing, badges
app/admin/actions.ts               modify: addTag/removeTag server actions
app/admin/export/route.ts          new: CSV export (requireAdmin inside)
vitest.config.ts                   modify: esbuild jsx automatic (for emails/*.tsx tests)
.env.local.example                 modify: RESEND_WEBHOOK_SECRET
tests: lib/__tests__/send-rules.test.ts, lib/__tests__/subscribers-phase2.test.ts,
       lib/__tests__/sends.test.ts, emails/__tests__/render.test.tsx,
       app/api/webhooks/resend/__tests__/route.test.ts,
       app/api/unsubscribe/__tests__/route.test.ts,
       app/admin/(gated)/compose/__tests__/actions.test.ts
```

---

### Task 1: Dependencies, env example, vitest JSX

**Files:**
- Modify: `package.json`, `.env.local.example`, `vitest.config.ts`

- [ ] **Step 1.1: Install React Email**

```bash
npm install @react-email/components @react-email/render
```

- [ ] **Step 1.2: Append to `.env.local.example`**

```
# Server only. Signing secret from the Resend webhook dashboard entry.
RESEND_WEBHOOK_SECRET=whsec_xxxx
```

- [ ] **Step 1.3: Modify `vitest.config.ts`** so email component tests compile (the project tsconfig uses `jsx: preserve`, which esbuild cannot execute). Full new contents:

```ts
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname) },
  },
  esbuild: { jsx: "automatic" },
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts", "app/**/*.test.ts", "emails/**/*.test.tsx"],
  },
});
```

- [ ] **Step 1.4: Verify** — `npx vitest run` still passes (existing Phase 1 suite).

- [ ] **Step 1.5: Commit**

```bash
git add package.json package-lock.json .env.local.example vitest.config.ts
git commit -m "chore: add react-email deps, webhook secret env, vitest jsx"
```

---

### Task 2: Database migration

**Files:**
- Create: one migration under `supabase/migrations/` (filename generated by CLI, never hand-authored)

- [ ] **Step 2.1: Create the migration file**

```bash
supabase migration new announcement_sending_phase_2
```

- [ ] **Step 2.2: Write the migration SQL** (full contents of the generated file)

```sql
-- Phase 2 announcement sending. Spec:
-- docs/superpowers/specs/2026-07-30-announcement-sending-phase-2-design.md

create table public.sends (
  id uuid primary key default gen_random_uuid(),
  template text not null check (template in ('event-announcement', 'general-update')),
  subject text not null,
  fields jsonb not null,
  audience jsonb not null,
  status text not null default 'sending'
    check (status in ('sending', 'sent', 'partial', 'failed')),
  total_count integer not null,
  sent_count integer not null default 0,
  failed_count integer not null default 0,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

-- Recipient snapshot. chunk_index is assigned once at snapshot time so a
-- resumed chunk reuses its idempotency key against an identical payload.
create table public.send_recipients (
  id uuid primary key default gen_random_uuid(),
  send_id uuid not null references public.sends (id) on delete cascade,
  subscriber_id uuid not null references public.subscribers (id) on delete cascade,
  email text not null,
  chunk_index integer not null,
  resend_email_id text,
  status text not null default 'pending'
    check (status in ('pending', 'sent', 'failed', 'delivered', 'bounced', 'complained')),
  error text,
  updated_at timestamptz not null default now(),
  unique (send_id, subscriber_id)
);

create index send_recipients_send_id_idx on public.send_recipients (send_id);
create index send_recipients_resend_email_id_idx on public.send_recipients (resend_email_id);

-- Tag filtering (admin list + audience selection) needs array containment.
create index subscribers_tags_idx on public.subscribers using gin (tags);

create trigger send_recipients_set_updated_at
  before update on public.send_recipients
  for each row execute function public.set_updated_at();

-- Fail closed, like subscribers: server-side secret-key access only.
alter table public.sends enable row level security;
alter table public.send_recipients enable row level security;
revoke all on public.sends from anon, authenticated;
revoke all on public.send_recipients from anon, authenticated;
```

- [ ] **Step 2.3: Push and verify** — requires the linked Supabase project; if unavailable, commit and record P4 as pending.

```bash
supabase db push
```

Verification query (SQL editor or `psql`): `select count(*) from public.sends;` returns 0, and the Advisors page shows no new errors.

- [ ] **Step 2.4: Commit**

```bash
git add supabase/
git commit -m "feat: sends and send_recipients schema with RLS, gin index on tags"
```

---

### Task 3: Business constants

**Files:**
- Modify: `lib/business.ts`

- [ ] **Step 3.1: Replace `lib/business.ts`** with:

```ts
export const BUSINESS_NAME = "Rack in the Rockies";
export const BUSINESS_EMAIL = "hello@rackintherockies.com";
// Locale only, for website copy.
export const BUSINESS_LOCATION = "Denver, Colorado";
/** Canonical origin for links embedded in emails. No trailing slash. */
export const SITE_URL = "https://rackintherockies.com";
/**
 * CAN-SPAM requires a physical mailing address in every announcement email.
 * While this is null, real sends are refused server-side (see lib/sends.ts)
 * and test sends render a visible placeholder. Manual step P1 in the Phase 2
 * plan: replace null with the full address string to unblock sending.
 */
export const BUSINESS_MAILING_ADDRESS: string | null = null;
```

- [ ] **Step 3.2: Verify and commit** — `npx vitest run` passes, `npm run build` passes.

```bash
git add lib/business.ts
git commit -m "feat: mailing address constant (null until supplied) and site url"
```

---

### Task 4: Pure send rules (TDD)

**Files:**
- Create: `lib/send-rules.ts`, `lib/__tests__/send-rules.test.ts`

- [ ] **Step 4.1: Write the failing tests** — `lib/__tests__/send-rules.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  chunkIntoBatches,
  idempotencyKey,
  isRetryableSendError,
  mapWebhookEvent,
  splitParagraphs,
  parseAnnouncement,
  validateAnnouncement,
  type Announcement,
} from "@/lib/send-rules";

describe("chunkIntoBatches", () => {
  it("handles empty, exact, and overflow sizes", () => {
    expect(chunkIntoBatches([])).toEqual([]);
    expect(chunkIntoBatches([1]).length).toBe(1);
    expect(chunkIntoBatches(Array(100).fill(0)).length).toBe(1);
    const chunks = chunkIntoBatches(Array(250).fill(0));
    expect(chunks.map((c) => c.length)).toEqual([100, 100, 50]);
  });
});

describe("idempotencyKey", () => {
  it("is stable and chunk-scoped", () => {
    expect(idempotencyKey("abc", 0)).toBe("send-abc-chunk-0");
    expect(idempotencyKey("abc", 2)).toBe("send-abc-chunk-2");
  });
});

describe("isRetryableSendError", () => {
  it("retries rate limits and server errors", () => {
    expect(isRetryableSendError({ statusCode: 429, name: "rate_limit_exceeded" })).toBe(true);
    expect(isRetryableSendError({ statusCode: 500, name: "internal_server_error" })).toBe(true);
    expect(isRetryableSendError({ statusCode: null, name: "application_error" })).toBe(true);
    expect(isRetryableSendError({ statusCode: null, name: "concurrent_idempotent_requests" })).toBe(true);
  });
  it("does not retry validation-class errors", () => {
    expect(isRetryableSendError({ statusCode: 422, name: "validation_error" })).toBe(false);
    expect(isRetryableSendError({ statusCode: 400, name: "invalid_parameter" })).toBe(false);
    expect(isRetryableSendError({ statusCode: null, name: "missing_api_key" })).toBe(false);
  });
});

describe("mapWebhookEvent", () => {
  it("maps delivered to a recipient update only", () => {
    expect(mapWebhookEvent("email.delivered")).toEqual({
      recipientStatus: "delivered",
      subscriberAction: null,
    });
  });
  it("maps complaints to recipient and subscriber", () => {
    expect(mapWebhookEvent("email.complained")).toEqual({
      recipientStatus: "complained",
      subscriberAction: "complain",
    });
  });
  it("only permanent bounces touch the subscriber", () => {
    expect(mapWebhookEvent("email.bounced", "Permanent")).toEqual({
      recipientStatus: "bounced",
      subscriberAction: "bounce",
    });
    expect(mapWebhookEvent("email.bounced", "permanent")).toEqual({
      recipientStatus: "bounced",
      subscriberAction: "bounce",
    });
    expect(mapWebhookEvent("email.bounced", "Transient")).toEqual({
      recipientStatus: "bounced",
      subscriberAction: null,
    });
  });
  it("ignores everything else", () => {
    for (const type of ["email.opened", "email.sent", "contact.created", "junk"]) {
      expect(mapWebhookEvent(type)).toEqual({ recipientStatus: null, subscriberAction: null });
    }
  });
});

describe("splitParagraphs", () => {
  it("splits on blank lines and trims", () => {
    expect(splitParagraphs("one\n\ntwo\n \nthree")).toEqual(["one", "two", "three"]);
    expect(splitParagraphs("  solo  ")).toEqual(["solo"]);
    expect(splitParagraphs("")).toEqual([]);
  });
});

const validEvent: Announcement = {
  template: "event-announcement",
  fields: {
    subject: "Mahjong in Bloom",
    headline: "Mahjong in Bloom",
    dateLabel: "July 28, 2026",
    location: "Olde Town Arvada",
    intro: "An evening of tiles and blooms.",
    sessions: [{ name: "Intro", time: "4:45 - 8:00 PM", price: "$60" }],
    ctaLabel: "Sign Up",
    ctaUrl: "https://example.com/signup",
  },
};

describe("parseAnnouncement", () => {
  it("coerces a raw payload into a typed announcement, dropping empty session rows", () => {
    const parsed = parseAnnouncement({
      template: "event-announcement",
      fields: {
        ...validEvent.fields,
        sessions: [
          { name: "Intro", time: "4:45 - 8:00 PM", price: "$60" },
          { name: "", time: "", price: "" },
        ],
        junk: "ignored",
      },
    });
    expect(parsed).not.toBeNull();
    expect(parsed!.template).toBe("event-announcement");
    if (parsed!.template === "event-announcement") {
      expect(parsed!.fields.sessions).toHaveLength(1);
    }
  });
  it("rejects unknown templates and non-objects", () => {
    expect(parseAnnouncement({ template: "html-blast", fields: {} })).toBeNull();
    expect(parseAnnouncement("nope")).toBeNull();
    expect(parseAnnouncement(null)).toBeNull();
  });
});

describe("validateAnnouncement", () => {
  it("accepts a complete event announcement", () => {
    expect(validateAnnouncement(validEvent)).toEqual([]);
  });
  it("requires the event basics", () => {
    const errors = validateAnnouncement({
      template: "event-announcement",
      fields: { ...validEvent.fields, subject: " ", headline: "", dateLabel: "", location: "", intro: "" },
    } as Announcement);
    expect(errors.length).toBeGreaterThanOrEqual(5);
  });
  it("requires the button label and link together, with a web link", () => {
    const noUrl = validateAnnouncement({
      template: "event-announcement",
      fields: { ...validEvent.fields, ctaLabel: "Sign Up", ctaUrl: "" },
    } as Announcement);
    expect(noUrl.some((e) => e.toLowerCase().includes("button"))).toBe(true);
    const badScheme = validateAnnouncement({
      template: "event-announcement",
      fields: { ...validEvent.fields, ctaUrl: "javascript:alert(1)" },
    } as Announcement);
    expect(badScheme.length).toBeGreaterThan(0);
  });
  it("requires an incomplete session row to be finished", () => {
    const errors = validateAnnouncement({
      template: "event-announcement",
      fields: { ...validEvent.fields, sessions: [{ name: "Intro", time: "", price: "" }] },
    } as Announcement);
    expect(errors.length).toBeGreaterThan(0);
  });
  it("validates the general update", () => {
    expect(
      validateAnnouncement({
        template: "general-update",
        fields: { subject: "Hello", body: "First paragraph." },
      })
    ).toEqual([]);
    expect(
      validateAnnouncement({
        template: "general-update",
        fields: { subject: "", body: "  " },
      }).length
    ).toBe(2);
  });
});
```

- [ ] **Step 4.2: Run to verify failure** — `npx vitest run lib/__tests__/send-rules.test.ts` — FAIL, cannot resolve `@/lib/send-rules`.

- [ ] **Step 4.3: Implement `lib/send-rules.ts`**

```ts
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
```

- [ ] **Step 4.4: Run to verify pass** — `npx vitest run lib/__tests__/send-rules.test.ts` — PASS.

- [ ] **Step 4.5: Commit**

```bash
git add lib/send-rules.ts lib/__tests__/send-rules.test.ts
git commit -m "feat: pure send rules: chunking, retry, idempotency, webhook mapping, validation"
```

---

### Task 5: Subscriber write-backs, tags, audience, CSV (TDD)

**Files:**
- Create: `lib/__tests__/subscribers-phase2.test.ts`
- Modify: `lib/subscribers.ts`, `lib/subscriber-rules.ts`

- [ ] **Step 5.1: Write the failing tests** — `lib/__tests__/subscribers-phase2.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  markBounced,
  markComplained,
  addTagById,
  removeTagById,
  type SubscriberDb,
  type SubscriberRow,
} from "@/lib/subscribers";
import { csvField, subscribersToCsv } from "@/lib/subscriber-rules";

function memoryDb(seed: SubscriberRow[] = []) {
  const rows = [...seed];
  const db: SubscriberDb = {
    async findByEmail(email) {
      return rows.find((r) => r.email === email) ?? null;
    },
    async findByToken(token) {
      return rows.find((r) => r.unsubscribe_token === token) ?? null;
    },
    async findById(id) {
      return rows.find((r) => r.id === id) ?? null;
    },
    async insert(row) {
      rows.push({
        id: `id-${rows.length + 1}`,
        unsubscribe_token: `tok-${rows.length + 1}`,
        status: "subscribed",
        tags: [],
        first_name: null,
        last_name: null,
        ...row,
      } as SubscriberRow);
    },
    async updateById(id, patch) {
      const row = rows.find((r) => r.id === id);
      if (row) Object.assign(row, patch);
    },
  };
  return { db, rows };
}

function row(overrides: Partial<SubscriberRow>): SubscriberRow {
  return {
    id: "id-1",
    email: "annie@example.com",
    first_name: "Annie",
    last_name: null,
    status: "subscribed",
    source: "newsletter",
    tags: [],
    unsubscribe_token: "tok-1",
    ...overrides,
  };
}

describe("markBounced", () => {
  it("moves subscribed to bounced, normalizing the email", async () => {
    const { db, rows } = memoryDb([row({})]);
    const result = await markBounced(" Annie@Example.com ", db);
    expect(result.outcome).toBe("bounced");
    expect(rows[0].status).toBe("bounced");
  });
  it("never touches unsubscribed or complained, and reports unknowns", async () => {
    for (const status of ["unsubscribed", "complained", "bounced"] as const) {
      const { db, rows } = memoryDb([row({ status })]);
      const result = await markBounced("annie@example.com", db);
      expect(result.outcome).toBe("skipped");
      expect(rows[0].status).toBe(status);
    }
    const { db } = memoryDb();
    expect((await markBounced("ghost@example.com", db)).outcome).toBe("not_found");
  });
});

describe("markComplained", () => {
  it("sets complained from every prior status", async () => {
    for (const status of ["subscribed", "unsubscribed", "bounced"] as const) {
      const { db, rows } = memoryDb([row({ status })]);
      const result = await markComplained("annie@example.com", db);
      expect(result.outcome).toBe("complained");
      expect(rows[0].status).toBe("complained");
    }
  });
  it("is idempotent on an already complained row", async () => {
    const { db } = memoryDb([row({ status: "complained" })]);
    expect((await markComplained("annie@example.com", db)).outcome).toBe("skipped");
  });
});

describe("tag editing", () => {
  it("adds without duplicating and trims", async () => {
    const { db, rows } = memoryDb([row({ tags: ["booking"] })]);
    await addTagById("id-1", "  trips ", db);
    await addTagById("id-1", "booking", db);
    expect(rows[0].tags).toEqual(["booking", "trips"]);
  });
  it("ignores empty tags", async () => {
    const { db, rows } = memoryDb([row({ tags: ["booking"] })]);
    const result = await addTagById("id-1", "   ", db);
    expect(result.outcome).toBe("invalid");
    expect(rows[0].tags).toEqual(["booking"]);
  });
  it("removes a tag", async () => {
    const { db, rows } = memoryDb([row({ tags: ["booking", "trips"] })]);
    await removeTagById("id-1", "booking", db);
    expect(rows[0].tags).toEqual(["trips"]);
  });
  it("reports unknown ids", async () => {
    const { db } = memoryDb();
    expect((await addTagById("nope", "x", db)).outcome).toBe("not_found");
    expect((await removeTagById("nope", "x", db)).outcome).toBe("not_found");
  });
});

describe("csv", () => {
  it("escapes commas, quotes, and newlines", () => {
    expect(csvField("plain")).toBe("plain");
    expect(csvField('a "b", c')).toBe('"a ""b"", c"');
    expect(csvField("line1\nline2")).toBe('"line1\nline2"');
    expect(csvField(null)).toBe("");
  });
  it("renders a header plus one line per subscriber", () => {
    const csv = subscribersToCsv([
      row({ tags: ["a", "b"], created_at: "2026-07-30T00:00:00Z" }),
    ]);
    const lines = csv.trimEnd().split("\n");
    expect(lines[0]).toBe("email,first_name,last_name,status,source,tags,created_at");
    expect(lines[1]).toBe('annie@example.com,Annie,,subscribed,newsletter,"a, b",2026-07-30T00:00:00Z');
  });
});
```

- [ ] **Step 5.2: Run to verify failure** — `npx vitest run lib/__tests__/subscribers-phase2.test.ts` — FAIL, missing exports.

- [ ] **Step 5.3: Append to `lib/subscriber-rules.ts`** (do not modify existing exports):

```ts
/** RFC 4180 field escaping. */
export function csvField(value: string | null | undefined): string {
  const s = value ?? "";
  return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}

export function subscribersToCsv(
  rows: Array<{
    email: string;
    first_name: string | null;
    last_name: string | null;
    status: string;
    source: string;
    tags: string[];
    created_at?: string;
  }>
): string {
  const header = "email,first_name,last_name,status,source,tags,created_at";
  const lines = rows.map((r) =>
    [
      csvField(r.email),
      csvField(r.first_name),
      csvField(r.last_name),
      csvField(r.status),
      csvField(r.source),
      csvField(r.tags.join(", ")),
      csvField(r.created_at ?? ""),
    ].join(",")
  );
  return [header, ...lines].join("\n") + "\n";
}
```

- [ ] **Step 5.4: Add the write-backs and tag editing to `lib/subscribers.ts`** (insert after `resubscribeById`):

```ts
export type MarkResult = { outcome: "bounced" | "complained" | "skipped" | "not_found" };
export type TagResult = { outcome: "updated" | "invalid" | "not_found" };

/**
 * Webhook write-back for permanent bounces. Only a currently subscribed
 * record moves to bounced: unsubscribed stays unsubscribed and complained
 * is never downgraded.
 */
export async function markBounced(
  email: string,
  db: SubscriberDb = liveDb()
): Promise<MarkResult> {
  const row = await db.findByEmail(normalizeEmail(email));
  if (!row) return { outcome: "not_found" };
  if (row.status !== "subscribed") return { outcome: "skipped" };
  await db.updateById(row.id, { status: "bounced" });
  return { outcome: "bounced" };
}

/** Webhook write-back for complaints. Complained outranks every status. */
export async function markComplained(
  email: string,
  db: SubscriberDb = liveDb()
): Promise<MarkResult> {
  const row = await db.findByEmail(normalizeEmail(email));
  if (!row) return { outcome: "not_found" };
  if (row.status === "complained") return { outcome: "skipped" };
  await db.updateById(row.id, { status: "complained" });
  return { outcome: "complained" };
}

// Admin tag editing. Add stays a union; remove is deliberately allowed for
// humans (the union-only rule protects automated write paths, not admins).
export async function addTagById(
  id: string,
  tag: string,
  db: SubscriberDb = liveDb()
): Promise<TagResult> {
  const clean = tag.trim();
  if (!clean) return { outcome: "invalid" };
  const row = await db.findById(id);
  if (!row) return { outcome: "not_found" };
  await db.updateById(id, { tags: unionTags(row.tags, [clean]) });
  return { outcome: "updated" };
}

export async function removeTagById(
  id: string,
  tag: string,
  db: SubscriberDb = liveDb()
): Promise<TagResult> {
  const row = await db.findById(id);
  if (!row) return { outcome: "not_found" };
  await db.updateById(id, { tags: row.tags.filter((t) => t !== tag) });
  return { outcome: "updated" };
}
```

- [ ] **Step 5.5: Replace `listSubscribers` and `ListFilters` in `lib/subscribers.ts`** with the paginated, tag-aware version, and add the audience/tag/export helpers below it:

```ts
export type ListFilters = {
  search?: string;
  status?: string;
  source?: string;
  tags?: string[];
  page?: number;
};

export const PAGE_SIZE = 100;

export type SubscriberList = {
  rows: SubscriberRow[];
  total: number;
  page: number;
  pageCount: number;
};

// Admin read path. Goes straight to Supabase rather than through SubscriberDb:
// it needs query composition (ilike, overlaps, ranges) that the small
// interface should not grow, and no business rules live here.
export async function listSubscribers(filters: ListFilters): Promise<SubscriberList> {
  const page = Math.max(1, filters.page ?? 1);
  const from = (page - 1) * PAGE_SIZE;
  const client = supabaseAdmin();
  let q = client
    .from("subscribers")
    .select(
      "id, email, first_name, last_name, status, source, tags, unsubscribe_token, created_at",
      { count: "exact" }
    )
    .order("created_at", { ascending: false })
    .range(from, from + PAGE_SIZE - 1);
  if (filters.status) q = q.eq("status", filters.status);
  if (filters.source) q = q.eq("source", filters.source);
  if (filters.tags && filters.tags.length > 0) q = q.overlaps("tags", filters.tags);
  if (filters.search) {
    const s = filters.search.replaceAll("%", "").replaceAll(",", "");
    q = q.or(`email.ilike.%${s}%,first_name.ilike.%${s}%,last_name.ilike.%${s}%`);
  }
  const { data, error, count } = await q;
  if (error) throw error;
  const total = count ?? 0;
  return {
    rows: data as SubscriberRow[],
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  };
}

/** Every distinct tag in use, for filter and audience pickers. */
export async function listTags(): Promise<string[]> {
  const { data, error } = await supabaseAdmin().from("subscribers").select("tags").limit(10000);
  if (error) throw error;
  const all = new Set<string>();
  for (const row of data as { tags: string[] }[]) {
    for (const tag of row.tags) all.add(tag);
  }
  return [...all].sort();
}

/** Recipient count for the composer. Empty tags means all subscribed. */
export async function countAudience(tags: string[]): Promise<number> {
  const client = supabaseAdmin();
  let q = client
    .from("subscribers")
    .select("id", { count: "exact", head: true })
    .eq("status", "subscribed");
  if (tags.length > 0) q = q.overlaps("tags", tags);
  const { count, error } = await q;
  if (error) throw error;
  return count ?? 0;
}

export type AudienceMember = {
  id: string;
  email: string;
  unsubscribe_token: string;
};

/**
 * The full audience snapshot for a send. Pages through Supabase's 1000-row
 * response cap; ordering by id keeps pages stable while iterating.
 */
export async function listAudience(tags: string[]): Promise<AudienceMember[]> {
  const client = supabaseAdmin();
  const members: AudienceMember[] = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    let q = client
      .from("subscribers")
      .select("id, email, unsubscribe_token")
      .eq("status", "subscribed")
      .order("id", { ascending: true })
      .range(from, from + pageSize - 1);
    if (tags.length > 0) q = q.overlaps("tags", tags);
    const { data, error } = await q;
    if (error) throw error;
    members.push(...(data as AudienceMember[]));
    if ((data?.length ?? 0) < pageSize) break;
  }
  return members;
}

/** All rows matching the filters, for CSV export. Same paging approach. */
export async function exportSubscribers(
  filters: Omit<ListFilters, "page">
): Promise<SubscriberRow[]> {
  const client = supabaseAdmin();
  const rows: SubscriberRow[] = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    let q = client
      .from("subscribers")
      .select("id, email, first_name, last_name, status, source, tags, unsubscribe_token, created_at")
      .order("created_at", { ascending: false })
      .range(from, from + pageSize - 1);
    if (filters.status) q = q.eq("status", filters.status);
    if (filters.source) q = q.eq("source", filters.source);
    if (filters.tags && filters.tags.length > 0) q = q.overlaps("tags", filters.tags);
    if (filters.search) {
      const s = filters.search.replaceAll("%", "").replaceAll(",", "");
      q = q.or(`email.ilike.%${s}%,first_name.ilike.%${s}%,last_name.ilike.%${s}%`);
    }
    const { data, error } = await q;
    if (error) throw error;
    rows.push(...(data as SubscriberRow[]));
    if ((data?.length ?? 0) < pageSize) break;
  }
  return rows;
}
```

Note: `app/admin/(gated)/page.tsx` now fails to compile because `listSubscribers` returns a `SubscriberList`. That page is rewritten in Task 12; until then run targeted tests rather than `npm run build`.

- [ ] **Step 5.6: Run to verify pass** — `npx vitest run lib/__tests__/subscribers-phase2.test.ts` and then the full `npx vitest run` — all PASS.

- [ ] **Step 5.7: Commit**

```bash
git add lib/subscribers.ts lib/subscriber-rules.ts lib/__tests__/subscribers-phase2.test.ts
git commit -m "feat: bounce/complaint write-backs, tag editing, audience queries, csv"
```

---

### Task 6: Email templates (TDD)

**Files:**
- Create: `emails/theme.ts`, `emails/layout.tsx`, `emails/event-announcement.tsx`, `emails/general-update.tsx`, `emails/render.tsx`, `emails/__tests__/render.test.tsx`

- [ ] **Step 6.1: Write the failing tests** — `emails/__tests__/render.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { renderAnnouncement } from "@/emails/render";
import type { Announcement } from "@/lib/send-rules";

const event: Announcement = {
  template: "event-announcement",
  fields: {
    subject: "Mahjong in Bloom",
    preheader: "Tiles and blooms in Olde Town Arvada",
    headline: "Mahjong in Bloom",
    dateLabel: "July 28, 2026",
    location: "Olde Town Arvada",
    intro: "An evening of tiles and blooms.",
    sessions: [{ name: "Introduction to Mahjong", time: "4:45 - 8:00 PM", price: "$60" }],
    ctaLabel: "Sign Up",
    ctaUrl: "https://example.com/signup",
    closingNote: "Seats are limited.",
  },
};

const update: Announcement = {
  template: "general-update",
  fields: {
    subject: "A note from Annie",
    body: "First paragraph.\n\nSecond paragraph.",
  },
};

const opts = { unsubscribeToken: "tok-123", baseUrl: "https://rackintherockies.com" };

describe("renderAnnouncement", () => {
  it("renders the event template with sessions, cta, and compliance footer", async () => {
    const { subject, html, text } = await renderAnnouncement(event, opts);
    expect(subject).toBe("Mahjong in Bloom");
    expect(html).toContain("Mahjong in Bloom");
    expect(html).toContain("Introduction to Mahjong");
    expect(html).toContain("https://example.com/signup");
    expect(html).toContain("https://rackintherockies.com/unsubscribe?token=tok-123");
    expect(html).toContain("You are receiving this because you signed up");
    expect(html).toContain("[Mailing address not set]");
    expect(text).toContain("https://rackintherockies.com/unsubscribe?token=tok-123");
  });

  it("omits the sessions block when there are none", async () => {
    const bare: Announcement = {
      ...event,
      fields: { ...event.fields, sessions: [], ctaLabel: undefined, ctaUrl: undefined },
    };
    const { html } = await renderAnnouncement(bare, opts);
    expect(html).not.toContain("Introduction to Mahjong");
  });

  it("renders the general update paragraphs", async () => {
    const { html } = await renderAnnouncement(update, opts);
    expect(html).toContain("First paragraph.");
    expect(html).toContain("Second paragraph.");
  });

  it("contains no em or en dashes in the plain text output", async () => {
    for (const a of [event, update]) {
      const { text } = await renderAnnouncement(a, opts);
      expect(text).not.toMatch(/[–—]/);
    }
  });
});
```

- [ ] **Step 6.2: Run to verify failure** — `npx vitest run emails` — FAIL, cannot resolve `@/emails/render`.

- [ ] **Step 6.3: Create `emails/theme.ts`**

```ts
/**
 * Mirrors the @theme tokens in app/globals.css. Email clients cannot read
 * CSS variables, so these are duplicated deliberately; if the site palette
 * changes, change both.
 */
export const emailTheme = {
  coral: "#FF6B6B",
  tangerine: "#FF8E53",
  golden: "#FFC857",
  blush: "#FFE8E0",
  cream: "#FFF9F5",
  warmWhite: "#FFFCFA",
  textDark: "#2D2424",
  textMid: "#6B5454",
  textLight: "#9A8585",
  fontDisplay: "Georgia, 'Times New Roman', serif",
  fontBody:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif",
} as const;
```

- [ ] **Step 6.4: Create `emails/layout.tsx`**

```tsx
import {
  Body,
  Container,
  Head,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import {
  BUSINESS_EMAIL,
  BUSINESS_MAILING_ADDRESS,
  BUSINESS_NAME,
} from "@/lib/business";
import { emailTheme as t } from "@/emails/theme";

const footerText = {
  color: t.textLight,
  fontSize: "12px",
  lineHeight: "18px",
  margin: "0 0 6px",
};

export function EmailShell({
  preheader,
  unsubscribeUrl,
  children,
}: {
  preheader?: string;
  unsubscribeUrl: string;
  children: React.ReactNode;
}) {
  return (
    <Html lang="en">
      <Head />
      {preheader ? <Preview>{preheader}</Preview> : null}
      <Body style={{ backgroundColor: t.cream, fontFamily: t.fontBody, margin: 0 }}>
        <Container style={{ maxWidth: "560px", margin: "0 auto", padding: "24px 16px" }}>
          <Section
            style={{
              backgroundColor: t.warmWhite,
              borderRadius: "16px",
              border: `1px solid ${t.blush}`,
              overflow: "hidden",
            }}
          >
            <Section
              style={{
                backgroundColor: t.coral,
                background: `linear-gradient(90deg, ${t.coral}, ${t.tangerine})`,
                padding: "18px 32px",
              }}
            >
              <Text
                style={{
                  color: "#FFFFFF",
                  fontFamily: t.fontDisplay,
                  fontSize: "20px",
                  fontWeight: 700,
                  margin: 0,
                }}
              >
                {BUSINESS_NAME}
              </Text>
            </Section>
            <Section style={{ padding: "28px 32px" }}>{children}</Section>
          </Section>
          <Section style={{ padding: "20px 12px 0", textAlign: "center" as const }}>
            <Text style={footerText}>
              You are receiving this because you signed up for event announcements
              from {BUSINESS_NAME}.
            </Text>
            <Text style={footerText}>
              <Link href={unsubscribeUrl} style={{ color: t.textMid, textDecoration: "underline" }}>
                Unsubscribe
              </Link>
            </Text>
            <Text style={footerText}>
              {BUSINESS_NAME} &middot; {BUSINESS_MAILING_ADDRESS ?? "[Mailing address not set]"}{" "}
              &middot; {BUSINESS_EMAIL}
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
```

- [ ] **Step 6.5: Create `emails/event-announcement.tsx`**

```tsx
import { Button, Column, Row, Section, Text } from "@react-email/components";
import { EmailShell } from "@/emails/layout";
import { emailTheme as t } from "@/emails/theme";
import type { EventAnnouncementFields } from "@/lib/send-rules";

const body = { color: t.textMid, fontSize: "15px", lineHeight: "23px", margin: "0 0 16px" };

export function EventAnnouncementEmail({
  fields,
  unsubscribeUrl,
}: {
  fields: EventAnnouncementFields;
  unsubscribeUrl: string;
}) {
  const when = [fields.dateLabel, fields.time].filter(Boolean).join(", ");
  return (
    <EmailShell preheader={fields.preheader} unsubscribeUrl={unsubscribeUrl}>
      <Text
        style={{
          color: t.textDark,
          fontFamily: t.fontDisplay,
          fontSize: "26px",
          fontWeight: 700,
          lineHeight: "32px",
          margin: "0 0 6px",
        }}
      >
        {fields.headline}
      </Text>
      <Text style={{ color: t.tangerine, fontSize: "14px", fontWeight: 600, margin: "0 0 18px" }}>
        {when} &middot; {fields.location}
      </Text>
      <Text style={body}>{fields.intro}</Text>

      {fields.sessions.length > 0 && (
        <Section
          style={{
            backgroundColor: t.cream,
            borderRadius: "12px",
            padding: "14px 18px",
            margin: "0 0 18px",
          }}
        >
          {fields.sessions.map((s, i) => (
            <Row key={i} style={{ marginBottom: i < fields.sessions.length - 1 ? "8px" : "0" }}>
              <Column>
                <Text style={{ color: t.textDark, fontSize: "14px", fontWeight: 600, margin: 0 }}>
                  {s.name}
                </Text>
                <Text style={{ color: t.textLight, fontSize: "13px", margin: 0 }}>{s.time}</Text>
              </Column>
              <Column style={{ textAlign: "right" as const, verticalAlign: "top" }}>
                <Text style={{ color: t.coral, fontSize: "14px", fontWeight: 700, margin: 0 }}>
                  {s.price}
                </Text>
              </Column>
            </Row>
          ))}
        </Section>
      )}

      {fields.ctaLabel && fields.ctaUrl && (
        <Section style={{ textAlign: "center" as const, margin: "0 0 18px" }}>
          <Button
            href={fields.ctaUrl}
            style={{
              backgroundColor: t.coral,
              borderRadius: "28px",
              color: "#FFFFFF",
              fontSize: "15px",
              fontWeight: 600,
              padding: "12px 32px",
            }}
          >
            {fields.ctaLabel}
          </Button>
        </Section>
      )}

      {fields.closingNote && <Text style={{ ...body, margin: 0 }}>{fields.closingNote}</Text>}
    </EmailShell>
  );
}
```

- [ ] **Step 6.6: Create `emails/general-update.tsx`**

```tsx
import { Button, Section, Text } from "@react-email/components";
import { EmailShell } from "@/emails/layout";
import { emailTheme as t } from "@/emails/theme";
import { splitParagraphs, type GeneralUpdateFields } from "@/lib/send-rules";

export function GeneralUpdateEmail({
  fields,
  unsubscribeUrl,
}: {
  fields: GeneralUpdateFields;
  unsubscribeUrl: string;
}) {
  return (
    <EmailShell preheader={fields.preheader} unsubscribeUrl={unsubscribeUrl}>
      {fields.headline && (
        <Text
          style={{
            color: t.textDark,
            fontFamily: t.fontDisplay,
            fontSize: "26px",
            fontWeight: 700,
            lineHeight: "32px",
            margin: "0 0 18px",
          }}
        >
          {fields.headline}
        </Text>
      )}
      {splitParagraphs(fields.body).map((p, i) => (
        <Text
          key={i}
          style={{ color: t.textMid, fontSize: "15px", lineHeight: "23px", margin: "0 0 16px" }}
        >
          {p}
        </Text>
      ))}
      {fields.ctaLabel && fields.ctaUrl && (
        <Section style={{ textAlign: "center" as const }}>
          <Button
            href={fields.ctaUrl}
            style={{
              backgroundColor: t.coral,
              borderRadius: "28px",
              color: "#FFFFFF",
              fontSize: "15px",
              fontWeight: 600,
              padding: "12px 32px",
            }}
          >
            {fields.ctaLabel}
          </Button>
        </Section>
      )}
    </EmailShell>
  );
}
```

- [ ] **Step 6.7: Create `emails/render.tsx`**

```tsx
import { render } from "@react-email/render";
import { EventAnnouncementEmail } from "@/emails/event-announcement";
import { GeneralUpdateEmail } from "@/emails/general-update";
import type { Announcement } from "@/lib/send-rules";

export type RenderedEmail = { subject: string; html: string; text: string };

/**
 * The one place announcement HTML is produced: composer preview, test sends,
 * and the real pipeline all call this, so what Annie previews is what sends.
 */
export async function renderAnnouncement(
  a: Announcement,
  opts: { unsubscribeToken: string; baseUrl: string }
): Promise<RenderedEmail> {
  const unsubscribeUrl = `${opts.baseUrl}/unsubscribe?token=${encodeURIComponent(opts.unsubscribeToken)}`;
  const element =
    a.template === "event-announcement" ? (
      <EventAnnouncementEmail fields={a.fields} unsubscribeUrl={unsubscribeUrl} />
    ) : (
      <GeneralUpdateEmail fields={a.fields} unsubscribeUrl={unsubscribeUrl} />
    );
  const html = await render(element);
  const text = await render(element, { plainText: true });
  return { subject: a.fields.subject, html, text };
}
```

- [ ] **Step 6.8: Run to verify pass** — `npx vitest run emails` — PASS.

- [ ] **Step 6.9: Commit**

```bash
git add emails/
git commit -m "feat: react-email templates in the site palette with compliance footer"
```

---

### Task 7: Send pipeline (TDD)

**Files:**
- Create: `lib/sends.ts`, `lib/__tests__/sends.test.ts`

- [ ] **Step 7.1: Write the failing tests** — `lib/__tests__/sends.test.ts`:

```ts
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
```

- [ ] **Step 7.2: Run to verify failure** — `npx vitest run lib/__tests__/sends.test.ts` — FAIL, cannot resolve `@/lib/sends`.

- [ ] **Step 7.3: Implement `lib/sends.ts`**

```ts
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
import {
  BUSINESS_EMAIL,
  BUSINESS_NAME,
  SITE_URL,
} from "@/lib/business";
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
  buildEmail: (a: Announcement, r: { email: string; unsubscribe_token: string }) => Promise<OutgoingEmail>;
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
    for (let attempt = 0; !result.ok && result.retryable && attempt < RETRY_DELAYS_MS.length; attempt++) {
      await sleep(RETRY_DELAYS_MS[attempt]);
      result = await sender.sendBatch(emails, key);
    }

    if (result.ok) {
      const ids = result.ids;
      await Promise.all(
        recipients.map((r, i) =>
          db.updateRecipient(r.id, { status: "sent", resend_email_id: ids[i] ?? null, error: null })
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
  const status: SendStatus = failed === 0 && pending === 0 ? "sent" : accepted === 0 ? "failed" : "partial";
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
    .in("send_id", sends.map((s) => s.id))
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
```

- [ ] **Step 7.4: Run to verify pass** — `npx vitest run lib/__tests__/sends.test.ts`, then the full suite — PASS.

- [ ] **Step 7.5: Commit**

```bash
git add lib/sends.ts lib/__tests__/sends.test.ts
git commit -m "feat: batched send pipeline with retry, resume, and live adapters"
```

---

### Task 8: Resend webhook route (TDD)

**Files:**
- Create: `app/api/webhooks/resend/route.ts`, `app/api/webhooks/resend/__tests__/route.test.ts`

- [ ] **Step 8.1: Write the failing tests** — `app/api/webhooks/resend/__tests__/route.test.ts`:

```ts
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
      data: { email_id: "re-2", to: ["annie@example.com"], bounce: { type: "Permanent", subType: "General", message: "" } },
    });
    await post();
    expect(markRecipientOutcome).toHaveBeenCalledWith("re-2", "bounced");
    expect(markBounced).toHaveBeenCalledWith("annie@example.com");
  });

  it("leaves the subscriber alone on a transient bounce", async () => {
    mockVerify.mockReturnValue({
      type: "email.bounced",
      data: { email_id: "re-3", to: ["annie@example.com"], bounce: { type: "Transient", subType: "General", message: "" } },
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
```

- [ ] **Step 8.2: Run to verify failure** — `npx vitest run app/api/webhooks` — FAIL, module missing.

- [ ] **Step 8.3: Implement `app/api/webhooks/resend/route.ts`**

```ts
import { NextResponse } from "next/server";
import { Resend } from "resend";
import { mapWebhookEvent } from "@/lib/send-rules";
import { markBounced, markComplained } from "@/lib/subscribers";
import { markRecipientOutcome } from "@/lib/sends";

/**
 * Resend delivery webhook. The svix signature is the only authentication on
 * this public endpoint; verification runs against the RAW body (re-serialized
 * JSON breaks the signature). Unknown events return 200 so enabling extra
 * events in the dashboard cannot break anything.
 */
export async function POST(req: Request) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) {
    console.error("RESEND_WEBHOOK_SECRET is not configured");
    return NextResponse.json({ error: "Not configured" }, { status: 500 });
  }

  const payload = await req.text();
  let event;
  try {
    event = new Resend(process.env.RESEND_API_KEY).webhooks.verify({
      payload,
      headers: {
        id: req.headers.get("svix-id") ?? "",
        timestamp: req.headers.get("svix-timestamp") ?? "",
        signature: req.headers.get("svix-signature") ?? "",
      },
      webhookSecret: secret,
    });
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  try {
    const data = event.data as { email_id?: string; to?: string[]; bounce?: { type?: string } };
    const outcome = mapWebhookEvent(event.type, data.bounce?.type);

    if (outcome.recipientStatus && data.email_id) {
      await markRecipientOutcome(data.email_id, outcome.recipientStatus);
    }
    const email = data.to?.[0];
    if (outcome.subscriberAction && email) {
      if (outcome.subscriberAction === "bounce") await markBounced(email);
      else await markComplained(email);
    }
  } catch (error) {
    // Let svix retry: a transient db failure should not ack the event.
    console.error("webhook processing failed", event.type, error);
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
```

- [ ] **Step 8.4: Run to verify pass** — `npx vitest run app/api/webhooks` — PASS.

- [ ] **Step 8.5: Commit**

```bash
git add app/api/webhooks/
git commit -m "feat: signature-verified resend webhook writing back delivery outcomes"
```

---

### Task 9: One-click unsubscribe route (TDD)

**Files:**
- Create: `app/api/unsubscribe/route.ts`, `app/api/unsubscribe/__tests__/route.test.ts`

- [ ] **Step 9.1: Write the failing tests** — `app/api/unsubscribe/__tests__/route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/subscribers", () => ({
  unsubscribeByToken: vi.fn(async () => ({ outcome: "unsubscribed" })),
}));

import { POST, GET } from "@/app/api/unsubscribe/route";
import { unsubscribeByToken } from "@/lib/subscribers";

beforeEach(() => vi.clearAllMocks());

describe("one-click unsubscribe", () => {
  it("POST unsubscribes by token and returns 200", async () => {
    const res = await POST(new Request("http://localhost/api/unsubscribe?token=tok-1", { method: "POST" }));
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
```

- [ ] **Step 9.2: Run to verify failure** — `npx vitest run app/api/unsubscribe` — FAIL, module missing.

- [ ] **Step 9.3: Implement `app/api/unsubscribe/route.ts`**

```ts
import { NextResponse } from "next/server";
import { unsubscribeByToken } from "@/lib/subscribers";

/**
 * RFC 8058 one-click target for the List-Unsubscribe header. Mail clients
 * POST here when the user presses their native unsubscribe button. No
 * confirmation step, by design. Errors still return 200: the client is a
 * mail server, and a retry storm helps nobody.
 */
export async function POST(req: Request) {
  const token = new URL(req.url).searchParams.get("token");
  if (token) {
    try {
      await unsubscribeByToken(token);
    } catch (error) {
      console.error("one-click unsubscribe failed", error);
    }
  }
  return new NextResponse(null, { status: 200 });
}

/** A human opening the header URL lands on the normal unsubscribe page. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token") ?? "";
  return NextResponse.redirect(
    new URL(`/unsubscribe?token=${encodeURIComponent(token)}`, url.origin)
  );
}
```

- [ ] **Step 9.4: Run to verify pass** — `npx vitest run app/api/unsubscribe` — PASS.

- [ ] **Step 9.5: Commit**

```bash
git add app/api/unsubscribe/
git commit -m "feat: rfc 8058 one-click unsubscribe endpoint"
```

---

### Task 10: Composer actions and UI

**Files:**
- Create: `app/admin/(gated)/compose/actions.ts`, `app/admin/(gated)/compose/__tests__/actions.test.ts`, `app/admin/(gated)/compose/composer.tsx`, `app/admin/(gated)/compose/page.tsx`
- Modify: `lib/auth.ts`

- [ ] **Step 10.1: Modify `lib/auth.ts`** — `requireAdmin` also returns the session email (needed for test sends). Replace the return type and final lines:

```ts
export async function requireAdmin(): Promise<{ userId: string; email: string }> {
  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (error || !userId) redirect("/admin/login");

  const { data: profile } = await supabaseAdmin()
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();
  if (profile?.role !== "admin") redirect("/admin/login");

  return { userId, email: String(data?.claims?.email ?? "") };
}
```

(Existing callers destructure nothing or `{ userId }`; both keep working.)

- [ ] **Step 10.2: Write the failing action tests** — `app/admin/(gated)/compose/__tests__/actions.test.ts`:

```ts
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
  liveSendDeps: vi.fn(() => ({ db: {}, sender: { sendOne: vi.fn() }, sleep: vi.fn(), buildEmail: vi.fn() })),
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
  liveSender: vi.fn(() => ({ sendOne: vi.fn(async () => ({ ok: true })), sendBatch: vi.fn() })),
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
    const result = await previewAction({ template: "general-update", fields: { subject: "", body: "" } });
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
    const result = await sendAction({ template: "general-update", fields: { subject: "", body: "" } }, []);
    expect("errors" in result && result.errors.length).toBeGreaterThan(0);
  });
});
```

Note the address-guard test works because `BUSINESS_MAILING_ADDRESS` is genuinely `null` in the repo until P1. The guard's positive path (address set, send proceeds) is covered by mocking `@/lib/business` inline:

Append this second describe block to the same test file:

```ts
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
  });
});
```

- [ ] **Step 10.3: Run to verify failure** — `npx vitest run "app/admin/(gated)/compose"` — FAIL, module missing.

- [ ] **Step 10.4: Implement `app/admin/(gated)/compose/actions.ts`**

```ts
"use server";

import { requireAdmin } from "@/lib/auth";
import { BUSINESS_MAILING_ADDRESS, SITE_URL } from "@/lib/business";
import { parseAnnouncement, validateAnnouncement } from "@/lib/send-rules";
import { countAudience, listAudience } from "@/lib/subscribers";
import { createSend, runSend, liveSendDb, liveSendDeps, liveBuildEmail, liveSender, getSendDetail } from "@/lib/sends";
import { renderAnnouncement } from "@/emails/render";

export type SendOutcome =
  | { sendId: string; status: string; sent: number; failed: number }
  | { errors: string[] }
  | { error: string };

/** Live preview. Renders whatever is typed so far; no validation gate. */
export async function previewAction(
  input: unknown
): Promise<{ html: string } | { error: string }> {
  await requireAdmin();
  const a = parseAnnouncement(input);
  if (!a) return { error: "Could not read the form. Refresh and try again." };
  const rendered = await renderAnnouncement(a, {
    unsubscribeToken: "preview",
    baseUrl: SITE_URL,
  });
  return { html: rendered.html };
}

export async function countAction(tags: string[]): Promise<{ count: number }> {
  await requireAdmin();
  return { count: await countAudience(Array.isArray(tags) ? tags.filter((t) => typeof t === "string") : []) };
}

/** Test send to the logged-in admin. Allowed while the address is unset. */
export async function testSendAction(
  input: unknown
): Promise<{ sent: string } | { errors: string[] } | { error: string }> {
  const { email } = await requireAdmin();
  const a = parseAnnouncement(input);
  if (!a) return { error: "Could not read the form. Refresh and try again." };
  const errors = validateAnnouncement(a);
  if (errors.length) return { errors };
  if (!email) return { error: "Your login has no email address; cannot test send." };

  const outgoing = await liveBuildEmail(a, { email, unsubscribe_token: "test" });
  const result = await liveSender().sendOne({
    ...outgoing,
    subject: `[Test] ${outgoing.subject}`,
  });
  if (!result.ok) {
    console.error("test send failed", result.message);
    return { error: "The test email could not be sent. Try again in a minute." };
  }
  return { sent: email };
}

export async function sendAction(input: unknown, tags: string[]): Promise<SendOutcome> {
  const { userId } = await requireAdmin();

  if (!BUSINESS_MAILING_ADDRESS) {
    return {
      error:
        "Sending is blocked until the business mailing address is set. Tyler: fill in BUSINESS_MAILING_ADDRESS in lib/business.ts (plan step P1).",
    };
  }

  const a = parseAnnouncement(input);
  if (!a) return { error: "Could not read the form. Refresh and try again." };
  const errors = validateAnnouncement(a);
  if (errors.length) return { errors };

  const cleanTags = Array.isArray(tags) ? tags.filter((t) => typeof t === "string") : [];
  const members = await listAudience(cleanTags);
  if (members.length === 0) {
    return { error: "Nobody matches this audience. Nothing was sent." };
  }

  const db = liveSendDb();
  const sendId = await createSend(a, { tags: cleanTags }, userId, members, db);
  await runSend(sendId, a, liveSendDeps());

  const detail = await getSendDetail(sendId);
  return {
    sendId,
    status: detail?.send.status ?? "sent",
    sent: detail?.send.sent_count ?? members.length,
    failed: detail?.send.failed_count ?? 0,
  };
}

export async function resumeAction(sendId: string): Promise<{ status: string } | { error: string }> {
  await requireAdmin();
  const detail = await getSendDetail(sendId);
  if (!detail || !detail.announcement) return { error: "Send not found." };
  if (!detail.resumable) return { error: "Nothing left to resume." };
  await runSend(sendId, detail.announcement, liveSendDeps());
  const after = await getSendDetail(sendId);
  return { status: after?.send.status ?? "sent" };
}
```

- [ ] **Step 10.5: Run to verify pass** — `npx vitest run "app/admin/(gated)/compose"` — PASS.

- [ ] **Step 10.6: Create `app/admin/(gated)/compose/composer.tsx`** (client component). Complete contents:

```tsx
"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import {
  countAction,
  previewAction,
  sendAction,
  testSendAction,
} from "@/app/admin/(gated)/compose/actions";
import type { TemplateKey } from "@/lib/send-rules";

type Prefill = {
  headline: string;
  dateLabel: string;
  location: string;
  intro: string;
  sessions: { name: string; time: string; price: string }[];
  ctaUrl: string;
  preheader: string;
};

type SessionRow = { name: string; time: string; price: string };

const inputCls =
  "w-full px-3 py-2 rounded-xl border border-coral/10 bg-white text-sm text-text-dark placeholder:text-text-light focus:outline-none focus:border-coral/30";
const labelCls = "block text-xs font-semibold text-text-mid mb-1";

export function Composer({
  existingTags,
  prefill,
  addressSet,
  initialCount,
}: {
  existingTags: string[];
  prefill: Prefill | null;
  addressSet: boolean;
  initialCount: number;
}) {
  const [template, setTemplate] = useState<TemplateKey>("event-announcement");
  const [event, setEvent] = useState({
    subject: "",
    preheader: "",
    headline: "",
    dateLabel: "",
    time: "",
    location: "",
    intro: "",
    ctaLabel: "",
    ctaUrl: "",
    closingNote: "",
  });
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [update, setUpdate] = useState({
    subject: "",
    preheader: "",
    headline: "",
    body: "",
    ctaLabel: "",
    ctaUrl: "",
  });
  const [tags, setTags] = useState<string[]>([]);
  const [count, setCount] = useState(initialCount);
  const [previewHtml, setPreviewHtml] = useState("");
  const [notice, setNotice] = useState<{ kind: "ok" | "error"; lines: string[] } | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [isPending, startTransition] = useTransition();
  const previewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const payload = useCallback(() => {
    return template === "event-announcement"
      ? { template, fields: { ...event, sessions } }
      : { template, fields: update };
  }, [template, event, sessions, update]);

  // Debounced live preview.
  useEffect(() => {
    if (previewTimer.current) clearTimeout(previewTimer.current);
    previewTimer.current = setTimeout(async () => {
      const result = await previewAction(payload());
      if ("html" in result) setPreviewHtml(result.html);
    }, 500);
    return () => {
      if (previewTimer.current) clearTimeout(previewTimer.current);
    };
  }, [payload]);

  async function toggleTag(tag: string) {
    const next = tags.includes(tag) ? tags.filter((t) => t !== tag) : [...tags, tag];
    setTags(next);
    setConfirming(false);
    const { count } = await countAction(next);
    setCount(count);
  }

  function applyPrefill() {
    if (!prefill) return;
    setTemplate("event-announcement");
    setEvent((prev) => ({
      ...prev,
      subject: prefill.headline,
      preheader: prefill.preheader,
      headline: prefill.headline,
      dateLabel: prefill.dateLabel,
      location: prefill.location,
      intro: prefill.intro,
      ctaLabel: "Sign Up",
      ctaUrl: prefill.ctaUrl,
    }));
    setSessions(prefill.sessions);
  }

  function handleTest() {
    setNotice(null);
    startTransition(async () => {
      const result = await testSendAction(payload());
      if ("sent" in result) setNotice({ kind: "ok", lines: [`Test email sent to ${result.sent}.`] });
      else if ("errors" in result) setNotice({ kind: "error", lines: result.errors });
      else setNotice({ kind: "error", lines: [result.error] });
    });
  }

  function handleSend() {
    setNotice(null);
    setConfirming(false);
    startTransition(async () => {
      const result = await sendAction(payload(), tags);
      if ("sendId" in result) {
        setNotice({
          kind: "ok",
          lines: [
            result.failed > 0
              ? `Sent to ${result.sent} people; ${result.failed} failed. See the send page to retry.`
              : `Sent to ${result.sent} people.`,
          ],
        });
      } else if ("errors" in result) setNotice({ kind: "error", lines: result.errors });
      else setNotice({ kind: "error", lines: [result.error] });
    });
  }

  const set = (patch: Partial<typeof event>) => setEvent((p) => ({ ...p, ...patch }));
  const setU = (patch: Partial<typeof update>) => setUpdate((p) => ({ ...p, ...patch }));

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-4">
        <div className="flex gap-2">
          {(
            [
              ["event-announcement", "Event announcement"],
              ["general-update", "General update"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTemplate(key)}
              className={`px-4 py-2 rounded-pill text-sm font-semibold border ${
                template === key
                  ? "bg-text-dark text-white border-text-dark"
                  : "bg-white text-text-mid border-coral/10"
              }`}
            >
              {label}
            </button>
          ))}
          {prefill && template === "event-announcement" && (
            <button
              type="button"
              onClick={applyPrefill}
              className="ml-auto px-4 py-2 rounded-pill text-sm font-semibold border border-coral/20 text-coral bg-white"
            >
              Prefill from featured event
            </button>
          )}
        </div>

        {template === "event-announcement" ? (
          <div className="space-y-3">
            <div>
              <label className={labelCls}>Subject line</label>
              <input className={inputCls} value={event.subject} onChange={(e) => set({ subject: e.target.value })} />
            </div>
            <div>
              <label className={labelCls}>Preview text (optional, shows after the subject in inboxes)</label>
              <input className={inputCls} value={event.preheader} onChange={(e) => set({ preheader: e.target.value })} />
            </div>
            <div>
              <label className={labelCls}>Headline</label>
              <input className={inputCls} value={event.headline} onChange={(e) => set({ headline: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Date</label>
                <input className={inputCls} placeholder="July 28, 2026" value={event.dateLabel} onChange={(e) => set({ dateLabel: e.target.value })} />
              </div>
              <div>
                <label className={labelCls}>Time (optional)</label>
                <input className={inputCls} placeholder="4:45 - 8:00 PM" value={event.time} onChange={(e) => set({ time: e.target.value })} />
              </div>
            </div>
            <div>
              <label className={labelCls}>Location</label>
              <input className={inputCls} value={event.location} onChange={(e) => set({ location: e.target.value })} />
            </div>
            <div>
              <label className={labelCls}>Intro paragraph</label>
              <textarea className={inputCls} rows={3} value={event.intro} onChange={(e) => set({ intro: e.target.value })} />
            </div>
            <div>
              <label className={labelCls}>Sessions (optional)</label>
              {sessions.map((s, i) => (
                <div key={i} className="flex gap-2 mb-2">
                  <input className={inputCls} placeholder="Name" value={s.name} onChange={(e) => setSessions(sessions.map((row, j) => (j === i ? { ...row, name: e.target.value } : row)))} />
                  <input className={inputCls} placeholder="Time" value={s.time} onChange={(e) => setSessions(sessions.map((row, j) => (j === i ? { ...row, time: e.target.value } : row)))} />
                  <input className={`${inputCls} max-w-24`} placeholder="Price" value={s.price} onChange={(e) => setSessions(sessions.map((row, j) => (j === i ? { ...row, price: e.target.value } : row)))} />
                  <button type="button" aria-label="Remove session" className="text-text-light text-sm px-1" onClick={() => setSessions(sessions.filter((_, j) => j !== i))}>
                    &times;
                  </button>
                </div>
              ))}
              <button type="button" className="text-xs text-tangerine underline hover:no-underline" onClick={() => setSessions([...sessions, { name: "", time: "", price: "" }])}>
                Add a session
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Button label (optional)</label>
                <input className={inputCls} placeholder="Sign Up" value={event.ctaLabel} onChange={(e) => set({ ctaLabel: e.target.value })} />
              </div>
              <div>
                <label className={labelCls}>Button link</label>
                <input className={inputCls} placeholder="https://" value={event.ctaUrl} onChange={(e) => set({ ctaUrl: e.target.value })} />
              </div>
            </div>
            <div>
              <label className={labelCls}>Closing note (optional)</label>
              <textarea className={inputCls} rows={2} value={event.closingNote} onChange={(e) => set({ closingNote: e.target.value })} />
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <label className={labelCls}>Subject line</label>
              <input className={inputCls} value={update.subject} onChange={(e) => setU({ subject: e.target.value })} />
            </div>
            <div>
              <label className={labelCls}>Preview text (optional)</label>
              <input className={inputCls} value={update.preheader} onChange={(e) => setU({ preheader: e.target.value })} />
            </div>
            <div>
              <label className={labelCls}>Headline (optional)</label>
              <input className={inputCls} value={update.headline} onChange={(e) => setU({ headline: e.target.value })} />
            </div>
            <div>
              <label className={labelCls}>Message (blank line between paragraphs)</label>
              <textarea className={inputCls} rows={8} value={update.body} onChange={(e) => setU({ body: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Button label (optional)</label>
                <input className={inputCls} value={update.ctaLabel} onChange={(e) => setU({ ctaLabel: e.target.value })} />
              </div>
              <div>
                <label className={labelCls}>Button link</label>
                <input className={inputCls} placeholder="https://" value={update.ctaUrl} onChange={(e) => setU({ ctaUrl: e.target.value })} />
              </div>
            </div>
          </div>
        )}

        <div className="rounded-2xl border border-coral/10 bg-white p-4 space-y-3">
          <p className="text-sm font-semibold text-text-dark">Who gets this?</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setTags([]);
                setConfirming(false);
                countAction([]).then(({ count }) => setCount(count));
              }}
              className={`px-3 py-1.5 rounded-pill text-xs font-semibold border ${
                tags.length === 0 ? "bg-text-dark text-white border-text-dark" : "bg-white text-text-mid border-coral/10"
              }`}
            >
              Everyone subscribed
            </button>
            {existingTags.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => toggleTag(tag)}
                className={`px-3 py-1.5 rounded-pill text-xs font-semibold border ${
                  tags.includes(tag) ? "bg-tangerine text-white border-tangerine" : "bg-white text-text-mid border-coral/10"
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
          <p className="text-sm text-text-mid">
            Will send to <span className="font-bold text-text-dark">{count}</span>{" "}
            {count === 1 ? "person" : "people"}.
          </p>
        </div>

        {!addressSet && (
          <p className="text-xs text-red-500">
            Real sends are blocked until the business mailing address is set in
            lib/business.ts. Test sends still work.
          </p>
        )}

        {notice && (
          <div className={`text-sm ${notice.kind === "ok" ? "text-tangerine" : "text-red-500"}`}>
            {notice.lines.map((line, i) => (
              <p key={i}>{line}</p>
            ))}
          </div>
        )}

        <div className="flex gap-2 items-center">
          <button
            type="button"
            onClick={handleTest}
            disabled={isPending}
            className="px-4 py-2 rounded-pill text-sm font-semibold border border-coral/20 text-text-dark bg-white disabled:opacity-50"
          >
            Send myself a test
          </button>
          {confirming ? (
            <>
              <button
                type="button"
                onClick={handleSend}
                disabled={isPending || !addressSet}
                className="px-4 py-2 rounded-pill text-sm font-semibold bg-gradient-to-r from-coral to-tangerine text-white disabled:opacity-50"
              >
                Yes, send to {count} {count === 1 ? "person" : "people"} now
              </button>
              <button type="button" onClick={() => setConfirming(false)} className="text-xs text-text-mid underline hover:no-underline">
                Cancel
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              disabled={isPending || !addressSet || count === 0}
              className="px-4 py-2 rounded-pill text-sm font-semibold bg-text-dark text-white disabled:opacity-50"
            >
              Send...
            </button>
          )}
          {isPending && <span className="text-xs text-text-light">Working...</span>}
          <Link href="/admin/sends" className="ml-auto text-xs text-text-mid underline hover:no-underline">
            Past sends
          </Link>
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold text-text-mid mb-2">Preview (exactly what recipients see)</p>
        <iframe
          title="Email preview"
          sandbox=""
          srcDoc={previewHtml}
          className="w-full h-[640px] rounded-2xl border border-coral/10 bg-white"
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 10.7: Create `app/admin/(gated)/compose/page.tsx`**

```tsx
import { listTags, countAudience } from "@/lib/subscribers";
import { featuredEvent } from "@/data/featured-event";
import { BUSINESS_MAILING_ADDRESS } from "@/lib/business";
import { Composer } from "@/app/admin/(gated)/compose/composer";

export default async function ComposePage() {
  const [tags, count] = await Promise.all([listTags(), countAudience([])]);

  return (
    <main>
      <h1 className="font-display text-xl font-bold text-text-dark mb-4">Compose</h1>
      <Composer
        existingTags={tags}
        initialCount={count}
        addressSet={BUSINESS_MAILING_ADDRESS !== null}
        prefill={{
          headline: featuredEvent.title,
          dateLabel: featuredEvent.dateLabel,
          location: featuredEvent.location,
          intro: featuredEvent.blurb,
          sessions: featuredEvent.sessions.map((s) => ({
            name: s.name,
            time: s.time,
            price: s.price,
          })),
          ctaUrl: featuredEvent.signupUrl,
          preheader: featuredEvent.bannerText,
        }}
      />
    </main>
  );
}
```

(The gated layout already runs `requireAdmin()` for rendering; the actions each re-verify themselves.)

- [ ] **Step 10.8: Verify** — `npx vitest run` passes. `npm run build` is still expected to fail only at `app/admin/(gated)/page.tsx` (fixed in Task 12); if it reports other errors, fix them now.

- [ ] **Step 10.9: Commit**

```bash
git add app/admin/\(gated\)/compose/ lib/auth.ts
git commit -m "feat: template composer with live preview, test send, audience picker"
```

---

### Task 11: Send history pages

**Files:**
- Create: `app/admin/(gated)/sends/page.tsx`, `app/admin/(gated)/sends/[id]/page.tsx`, `app/admin/(gated)/sends/actions.ts`
- Modify: `app/admin/(gated)/layout.tsx`

- [ ] **Step 11.1: Create `app/admin/(gated)/sends/actions.ts`**

```ts
"use server";

import { revalidatePath } from "next/cache";
import { resumeAction as resume } from "@/app/admin/(gated)/compose/actions";

export async function resumeSend(formData: FormData) {
  const sendId = String(formData.get("sendId") ?? "");
  if (sendId) {
    await resume(sendId);
    revalidatePath(`/admin/sends/${sendId}`);
    revalidatePath("/admin/sends");
  }
}
```

(`resume` itself calls `requireAdmin()`; no unauthenticated path exists.)

- [ ] **Step 11.2: Create `app/admin/(gated)/sends/page.tsx`**

```tsx
import Link from "next/link";
import { listSends } from "@/lib/sends";

function audienceLabel(audience: { tags: string[] }): string {
  return audience.tags.length === 0 ? "All subscribed" : audience.tags.join(", ");
}

const STATUS_STYLES: Record<string, string> = {
  sent: "bg-green-100 text-green-700",
  sending: "bg-golden/20 text-text-mid",
  partial: "bg-golden/30 text-text-dark",
  failed: "bg-red-100 text-red-600",
};

export default async function SendsPage() {
  const sends = await listSends();

  return (
    <main>
      <div className="flex items-center justify-between mb-4">
        <h1 className="font-display text-xl font-bold text-text-dark">Sends</h1>
        <Link href="/admin/compose" className="text-sm text-tangerine underline hover:no-underline">
          Compose a new announcement
        </Link>
      </div>

      {sends.length === 0 ? (
        <p className="text-sm text-text-mid">
          Nothing sent yet. When you send your first announcement it will show up
          here with delivery results.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-coral/10 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-text-mid border-b border-coral/10">
                <th className="px-4 py-2">Date</th>
                <th className="px-4 py-2">Subject</th>
                <th className="px-4 py-2">Audience</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2 text-right">Sent</th>
                <th className="px-4 py-2 text-right">Delivered</th>
                <th className="px-4 py-2 text-right">Bounced</th>
                <th className="px-4 py-2 text-right">Complaints</th>
              </tr>
            </thead>
            <tbody>
              {sends.map((s) => (
                <tr key={s.id} className="border-b border-coral/5 last:border-0">
                  <td className="px-4 py-2 whitespace-nowrap">
                    {s.created_at ? new Date(s.created_at).toLocaleDateString() : ""}
                  </td>
                  <td className="px-4 py-2">
                    <Link href={`/admin/sends/${s.id}`} className="underline hover:no-underline text-text-dark">
                      {s.subject}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-xs text-text-mid">{audienceLabel(s.audience)}</td>
                  <td className="px-4 py-2">
                    <span className={`px-2 py-0.5 rounded-pill text-xs font-semibold ${STATUS_STYLES[s.status] ?? ""}`}>
                      {s.status}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right">
                    {s.sent_count}/{s.total_count}
                  </td>
                  <td className="px-4 py-2 text-right">{s.delivered_count}</td>
                  <td className="px-4 py-2 text-right">{s.bounced_count}</td>
                  <td className="px-4 py-2 text-right">{s.complained_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
```

- [ ] **Step 11.3: Create `app/admin/(gated)/sends/[id]/page.tsx`** (`params` is a Promise in Next 16)

```tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSendDetail } from "@/lib/sends";
import { resumeSend } from "@/app/admin/(gated)/sends/actions";

const RECIPIENT_STYLES: Record<string, string> = {
  pending: "text-text-light",
  sent: "text-text-mid",
  delivered: "text-green-700",
  failed: "text-red-600",
  bounced: "text-red-600",
  complained: "text-red-600 font-semibold",
};

export default async function SendDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const detail = await getSendDetail(id);
  if (!detail) notFound();
  const { send, recipients, resumable } = detail;

  const counts = new Map<string, number>();
  for (const r of recipients) counts.set(r.status, (counts.get(r.status) ?? 0) + 1);

  return (
    <main>
      <p className="text-xs mb-2">
        <Link href="/admin/sends" className="text-text-mid underline hover:no-underline">
          All sends
        </Link>
      </p>
      <h1 className="font-display text-xl font-bold text-text-dark mb-1">{send.subject}</h1>
      <p className="text-xs text-text-mid mb-4">
        {send.template} &middot; {send.status} &middot; {send.sent_count}/{send.total_count} sent
        {[...counts.entries()].map(([status, n]) => ` · ${n} ${status}`)}
      </p>

      {resumable && (
        <form action={resumeSend} className="mb-4">
          <input type="hidden" name="sendId" value={send.id} />
          <button
            type="submit"
            className="px-4 py-2 rounded-pill text-sm font-semibold bg-text-dark text-white"
          >
            Resume unfinished recipients
          </button>
        </form>
      )}

      <div className="overflow-x-auto rounded-2xl border border-coral/10 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-text-mid border-b border-coral/10">
              <th className="px-4 py-2">Email</th>
              <th className="px-4 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {recipients.map((r) => (
              <tr key={r.id} className="border-b border-coral/5 last:border-0">
                <td className="px-4 py-2">{r.email}</td>
                <td className={`px-4 py-2 ${RECIPIENT_STYLES[r.status] ?? ""}`}>{r.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
```

- [ ] **Step 11.4: Modify `app/admin/(gated)/layout.tsx`** — replace the header contents so all three areas are reachable:

```tsx
        <div className="flex items-center gap-4">
          <Link href="/admin" className="font-display font-bold text-text-dark">
            RITR Admin
          </Link>
          <nav className="flex gap-3 text-sm text-text-mid">
            <Link href="/admin" className="hover:text-text-dark">
              Subscribers
            </Link>
            <Link href="/admin/compose" className="hover:text-text-dark">
              Compose
            </Link>
            <Link href="/admin/sends" className="hover:text-text-dark">
              Sends
            </Link>
          </nav>
        </div>
```

(The sign-out form stays as is on the right side of the header.)

- [ ] **Step 11.5: Verify and commit** — `npx vitest run` passes.

```bash
git add app/admin/\(gated\)/sends/ app/admin/\(gated\)/layout.tsx
git commit -m "feat: send history with per-recipient outcomes and resume"
```

---

### Task 12: Admin list improvements + CSV export

**Files:**
- Create: `app/admin/export/route.ts`
- Modify: `app/admin/(gated)/page.tsx`, `app/admin/actions.ts`

- [ ] **Step 12.1: Add tag actions to `app/admin/actions.ts`** (append; keep existing exports):

```ts
export async function adminAddTag(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const tag = String(formData.get("tag") ?? "");
  if (id && tag.trim()) {
    const { addTagById } = await import("@/lib/subscribers");
    await addTagById(id, tag);
  }
  revalidatePath("/admin");
}

export async function adminRemoveTag(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const tag = String(formData.get("tag") ?? "");
  if (id && tag) {
    const { removeTagById } = await import("@/lib/subscribers");
    await removeTagById(id, tag);
  }
  revalidatePath("/admin");
}
```

- [ ] **Step 12.2: Create `app/admin/export/route.ts`**

```ts
import { requireAdmin } from "@/lib/auth";
import { exportSubscribers } from "@/lib/subscribers";
import { subscribersToCsv } from "@/lib/subscriber-rules";

/**
 * CSV of the current filtered view. Route handlers bypass layouts, so the
 * admin check lives here, not in any parent.
 */
export async function GET(req: Request) {
  await requireAdmin();
  const params = new URL(req.url).searchParams;
  const tags = params.getAll("tag").filter(Boolean);
  const rows = await exportSubscribers({
    search: params.get("q") ?? undefined,
    status: params.get("status") ?? undefined,
    source: params.get("source") ?? undefined,
    tags,
  });
  return new Response(subscribersToCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="subscribers.csv"',
    },
  });
}
```

- [ ] **Step 12.3: Rewrite `app/admin/(gated)/page.tsx`** — full new contents:

```tsx
import Link from "next/link";
import { listSubscribers, listTags, type SubscriberRow } from "@/lib/subscribers";
import { adminAddTag, adminRemoveTag, adminResubscribe } from "@/app/admin/actions";

const STATUSES = ["subscribed", "unsubscribed", "bounced", "complained"] as const;
const SOURCES = [
  "newsletter",
  "contact",
  "booking",
  "trips-waitlist",
  "import",
  "resend-migration",
] as const;

const STATUS_STYLES: Record<string, string> = {
  subscribed: "bg-green-100 text-green-700",
  unsubscribed: "bg-blush text-text-mid",
  bounced: "bg-golden/30 text-text-dark",
  complained: "bg-red-100 text-red-600",
};

type Params = {
  q?: string;
  status?: string;
  source?: string;
  tag?: string | string[];
  page?: string;
};

function tagList(tag: string | string[] | undefined): string[] {
  if (!tag) return [];
  return Array.isArray(tag) ? tag : [tag];
}

function queryString(params: Params, page: number): string {
  const qs = new URLSearchParams();
  if (params.q) qs.set("q", params.q);
  if (params.status) qs.set("status", params.status);
  if (params.source) qs.set("source", params.source);
  for (const t of tagList(params.tag)) qs.append("tag", t);
  if (page > 1) qs.set("page", String(page));
  const s = qs.toString();
  return s ? `?${s}` : "";
}

export default async function AdminSubscribersPage({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  const params = await searchParams;
  const selectedTags = tagList(params.tag);
  const page = Math.max(1, Number(params.page) || 1);
  const [list, allTags] = await Promise.all([
    listSubscribers({
      search: params.q,
      status: params.status,
      source: params.source,
      tags: selectedTags,
      page,
    }),
    listTags(),
  ]);

  return (
    <main>
      <div className="flex items-center justify-between mb-1">
        <h1 className="font-display text-xl font-bold text-text-dark">Subscribers</h1>
        <a
          href={`/admin/export${queryString(params, 1)}`}
          className="text-xs text-text-mid underline hover:no-underline"
        >
          Download CSV
        </a>
      </div>
      <p className="text-xs text-text-mid mb-4">
        {list.total} {list.total === 1 ? "person" : "people"} match
        {list.pageCount > 1 && ` · page ${list.page} of ${list.pageCount}`}
      </p>

      <form className="flex flex-wrap gap-2 mb-2" method="GET">
        <input
          name="q"
          defaultValue={params.q ?? ""}
          placeholder="Search email or name"
          className="px-3 py-2 rounded-xl border border-coral/10 bg-white text-sm"
        />
        <select
          name="status"
          defaultValue={params.status ?? ""}
          className="px-3 py-2 rounded-xl border border-coral/10 bg-white text-sm"
        >
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          name="source"
          defaultValue={params.source ?? ""}
          className="px-3 py-2 rounded-xl border border-coral/10 bg-white text-sm"
        >
          <option value="">All sources</option>
          {SOURCES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        {allTags.length > 0 && (
          <fieldset className="flex flex-wrap items-center gap-2 px-3 py-1.5 rounded-xl border border-coral/10 bg-white">
            <legend className="sr-only">Filter by tag</legend>
            {allTags.map((tag) => (
              <label key={tag} className="flex items-center gap-1 text-xs text-text-mid">
                <input type="checkbox" name="tag" value={tag} defaultChecked={selectedTags.includes(tag)} />
                {tag}
              </label>
            ))}
          </fieldset>
        )}
        <button
          type="submit"
          className="px-4 py-2 rounded-pill bg-text-dark text-white text-sm font-semibold"
        >
          Filter
        </button>
      </form>

      <div className="overflow-x-auto rounded-2xl border border-coral/10 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-text-mid border-b border-coral/10">
              <th className="px-4 py-2">Email</th>
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Source</th>
              <th className="px-4 py-2">Tags</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {list.rows.map((row) => (
              <SubscriberTr key={row.id} row={row} />
            ))}
            {list.rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-text-mid">
                  No subscribers match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {list.pageCount > 1 && (
        <div className="flex items-center gap-3 mt-3 text-sm">
          {page > 1 && (
            <Link href={`/admin${queryString(params, page - 1)}`} className="underline hover:no-underline text-text-mid">
              Newer
            </Link>
          )}
          <span className="text-xs text-text-light">
            Page {list.page} of {list.pageCount}
          </span>
          {page < list.pageCount && (
            <Link href={`/admin${queryString(params, page + 1)}`} className="underline hover:no-underline text-text-mid">
              Older
            </Link>
          )}
        </div>
      )}
    </main>
  );
}

function SubscriberTr({ row }: { row: SubscriberRow }) {
  const canResubscribe = row.status === "unsubscribed" || row.status === "bounced";
  const isComplained = row.status === "complained";
  return (
    <tr className="border-b border-coral/5 last:border-0 align-top">
      <td className="px-4 py-2">{row.email}</td>
      <td className="px-4 py-2">{[row.first_name, row.last_name].filter(Boolean).join(" ")}</td>
      <td className="px-4 py-2">
        <span className={`px-2 py-0.5 rounded-pill text-xs font-semibold ${STATUS_STYLES[row.status] ?? ""}`}>
          {row.status}
        </span>
      </td>
      <td className="px-4 py-2 text-xs text-text-mid">{row.source}</td>
      <td className="px-4 py-2">
        <div className="flex flex-wrap items-center gap-1">
          {row.tags.map((tag) => (
            <form key={tag} action={adminRemoveTag} className="inline">
              <input type="hidden" name="id" value={row.id} />
              <input type="hidden" name="tag" value={tag} />
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-pill bg-cream text-xs text-text-mid">
                {tag}
                <button type="submit" aria-label={`Remove tag ${tag}`} className="text-text-light hover:text-red-500">
                  &times;
                </button>
              </span>
            </form>
          ))}
          <form action={adminAddTag} className="inline-flex items-center gap-1">
            <input type="hidden" name="id" value={row.id} />
            <input
              name="tag"
              placeholder="+ tag"
              className="w-16 px-1.5 py-0.5 rounded border border-coral/10 text-xs"
            />
          </form>
        </div>
      </td>
      <td className="px-4 py-2 text-right">
        {(canResubscribe || isComplained) && (
          <form action={adminResubscribe} className="inline">
            <input type="hidden" name="id" value={row.id} />
            <input type="hidden" name="force" value={isComplained ? "true" : "false"} />
            <button
              type="submit"
              className={`text-xs underline hover:no-underline ${
                isComplained ? "text-red-500" : "text-tangerine"
              }`}
              title={
                isComplained
                  ? "This person reported our email as spam. Only resubscribe if they asked you to directly."
                  : "Set status back to subscribed"
              }
            >
              {isComplained ? "Force resubscribe" : "Resubscribe"}
            </button>
          </form>
        )}
      </td>
    </tr>
  );
}
```

- [ ] **Step 12.4: Verify** — `npx vitest run` passes, `npm run build` passes end to end now (the `listSubscribers` shape change is resolved).

- [ ] **Step 12.5: Commit**

```bash
git add app/admin/
git commit -m "feat: tag filter and editing, pagination, csv export, status badges"
```

---

### Task 13: Full verification

- [ ] **Step 13.1: Full test suite** — `npx vitest run` — all green.
- [ ] **Step 13.2: Lint** — `npm run lint` — clean (fix anything it flags).
- [ ] **Step 13.3: Build** — `npm run build` — clean.
- [ ] **Step 13.4: Copy check** — `grep -rn $'—\|–' components/ app/ lib/ emails/ --include='*.tsx' --include='*.ts'` returns nothing (AGENTS.md rule).
- [ ] **Step 13.5: Smoke (env permitting)** — `npm run dev`, log in at `/admin/login`, confirm: nav shows Subscribers / Compose / Sends; `/admin/compose` renders the preview iframe and prefill works; `/admin` shows tag chips, filters, pagination; `/admin/export` downloads a CSV; `/admin/sends` shows the empty state. A real test send requires `RESEND_API_KEY` locally; a real send additionally requires P1.
- [ ] **Step 13.6: Report** — state which verifications ran and which are blocked on P1-P5. Do not claim webhook or send flows work end to end until the Ps are done.

---

## Self-review notes (already applied)

- Spec coverage: webhook (Task 8), one-click + headers (Tasks 9, 7), footer/address guard (Tasks 3, 6, 10), data model (Task 2), templates and render (Task 6), composer with preview/test/audience/prefill (Task 10), pipeline with retry/resume/idempotency (Task 7), history (Task 11), admin cleanup incl. tag filter/edit, pagination, CSV (Tasks 5, 12), env var (Task 1), manual prerequisites (header).
- Type consistency: `Announcement`/fields types defined once in Task 4 and imported everywhere; `SendDb`/`EmailSender`/`OutgoingEmail`/`SendRecipient` defined in Task 7 and used by Tasks 8, 10, 11; `AudienceMember` from Task 5 used by `createSend`.
- Intentional deviations: none from the amended spec. The spec's `previewAnnouncement`/`countRecipients` action names are `previewAction`/`countAction` here; behavior identical.
