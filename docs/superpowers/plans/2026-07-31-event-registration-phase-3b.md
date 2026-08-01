# Event Registration and Hero Art (Phase 3, Part B) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** In-house event registration (session picker with capacity, guest count, branded confirmation with payment instructions and cancel link, admin registrant view with CSV, subscriber side effect) plus the Part A follow-ups: default mountains-and-tiles hero art, per-event image upload replacing the decor, and a date picker feeding the date label, per Part B of `docs/superpowers/specs/2026-07-31-event-builder-and-registration-phase-3-design.md` (as amended on this branch).

**Architecture:** Pure decision logic in `lib/registration-rules.ts` (validation, seat math, can-register, slug tag, date label formatting, upload validation); `lib/registrations.ts` holds straight Supabase I/O. Session editing switches from replace-on-save to id-preserving sync because registrations reference sessions. The email shell gains a transactional footer variant reused by the confirmation email. Uploads go server-side to a public-read `event-images` Storage bucket.

**Tech Stack:** Next.js 16.2.1 (server actions accept `FormData` with `File`), Supabase (Postgres + first Storage use; bucket created in the migration), Resend via the existing `EmailSender` adapters, vitest 4.

**Read the amended spec first.** Sections "Hero art decisions", "Part B: hero art and editor polish", and everything under registration are the authority.

Copy rule everywhere: no em dashes, no en dashes. Time ranges use a hyphen.

**Known facts (verified, do not re-derive):**
- Node 20 in this shell breaks `supabase-js` scripts (no native WebSocket); one-off data scripts use plain `fetch` against PostgREST. The Next app itself is unaffected.
- `emails/layout.tsx` `EmailShell` currently requires `unsubscribeUrl`; marketing templates pass it. Making it optional with a conditional footer block keeps all existing tests green.
- `lib/subscribers.ts` `subscribe()` treats `source === "newsletter"` as the only explicit path; any new source is non-explicit and can never resurrect. Adding `event-registration` to the `SubscribeSource` union and the DB check constraint is sufficient.
- Registration cannot exist for drafts: `/api/register` resolves the event through a published-and-current check, and `deleteDraftEvent` additionally refuses when registrations exist (an unpublished-then-deleted event must not cascade-delete registration history).
- `new Date("2026-07-28")` parses as UTC midnight and formats as July 27 in Denver; date-only strings must be split and constructed as local dates.

---

## Manual prerequisites (Tyler)

None. Migration and bucket creation run during execution; no new env vars. Tyler merges the PR and, when a real event uses in-house registration, leaves that event's sign-up link field empty.

---

## File structure

```
supabase/migrations/<ts>_registration.sql   new: event_registrations, events image cols, source constraint, storage bucket
lib/registration-rules.ts                   new: pure rules incl. formatDateLabel, validateImageUpload, slugTag
lib/__tests__/registration-rules.test.ts    new
lib/event-rules.ts                          modify: EventSessionInput gains id; parse/duplicate handle it; EventInput gains imageUrl/imageAlt
lib/__tests__/event-rules.test.ts           modify: fixtures gain id/image fields; duplicate clears session ids
lib/subscriber-rules.ts                     modify: SubscribeSource union + "event-registration"
lib/events.ts                               modify: syncSessions (id-preserving), image cols, guarded deleteDraftEvent
lib/registrations.ts                        new: insert/lookup/cancel/list/seat counts
lib/__tests__/registrations.test.ts         new (pure orchestration with injected db, Phase 1 pattern)
emails/layout.tsx                           modify: unsubscribeUrl optional; transactional footer when absent
emails/registration-confirmation.tsx        new
emails/__tests__/registration-confirmation.test.tsx  new
app/api/register/route.ts                   new: POST register, GET seat counts
app/api/register/__tests__/route.test.ts    new
app/cancel-registration/page.tsx            new: token page with explicit confirm button
app/cancel-registration/actions.ts          new: cancel server action (token-authorized, no admin)
components/event-hero-default-decor.tsx     new: mountains + tiles SVG
components/event-hero-decor.tsx             DELETE (Bloom flowers, dead code)
components/featured-event-hero.tsx          modify: image treatment vs default decor
components/registration-form.tsx            new: client form on /events
app/events/page.tsx                         modify: mount RegistrationForm
app/robots.ts                               modify: disallow /cancel-registration
app/admin/(gated)/events/event-editor.tsx   modify: date picker, image upload, alt field
app/admin/(gated)/events/actions.ts         modify: uploadEventImageAction
app/admin/(gated)/events/__tests__/actions.test.ts  modify: upload action tests
app/admin/(gated)/events/[id]/page.tsx      modify: registrants section for in-house events
app/admin/events/[id]/registrants.csv/route.ts      new: CSV export (requireAdmin inside)
```

---

### Task 1: Migration

- [ ] **Step 1.1: Create** — `supabase migration new registration_phase_3b`

- [ ] **Step 1.2: Write the migration SQL** (full contents)

```sql
-- Phase 3 Part B: registration + hero art. Spec:
-- docs/superpowers/specs/2026-07-31-event-builder-and-registration-phase-3-design.md

alter table public.events
  add column image_url text,
  add column image_alt text;

create table public.event_registrations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  session_id uuid not null references public.event_sessions (id) on delete cascade,
  first_name text not null,
  last_name text,
  email text not null,
  seats integer not null default 1 check (seats between 1 and 4),
  status text not null default 'confirmed' check (status in ('confirmed', 'cancelled')),
  cancel_token uuid not null unique default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index event_registrations_session_id_idx on public.event_registrations (session_id);
create index event_registrations_event_id_idx on public.event_registrations (event_id);
create index event_registrations_email_idx on public.event_registrations (email);

create trigger event_registrations_set_updated_at
  before update on public.event_registrations
  for each row execute function public.set_updated_at();

alter table public.event_registrations enable row level security;
revoke all on public.event_registrations from anon, authenticated;

-- Registrants are side-effect subscribed with their own provenance value.
alter table public.subscribers drop constraint subscribers_source_check;
alter table public.subscribers add constraint subscribers_source_check
  check (source in ('newsletter', 'contact', 'booking', 'trips-waitlist', 'import', 'resend-migration', 'event-registration'));

-- Public-read bucket for event hero images. Writes happen server-side with
-- the secret key (bypasses storage RLS), so no write policies are needed.
insert into storage.buckets (id, name, public)
values ('event-images', 'event-images', true)
on conflict (id) do nothing;
```

- [ ] **Step 1.3: Push** — `supabase db push` (link first if the worktree lost it). Verify: applies cleanly.

- [ ] **Step 1.4: Commit** — `git add supabase/migrations/ && git commit -m "feat: registrations schema, event image columns, event-images bucket"`

---

### Task 2: Pure rules (TDD)

**Files:** create `lib/registration-rules.ts` + test; modify `lib/event-rules.ts` + its test; modify `lib/subscriber-rules.ts`.

- [ ] **Step 2.1: Write the failing tests** — `lib/__tests__/registration-rules.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  parseRegistrationInput,
  validateRegistration,
  seatsRemaining,
  canRegister,
  slugTag,
  formatDateLabel,
  validateImageUpload,
} from "@/lib/registration-rules";

const valid = {
  eventId: "evt-1",
  sessionId: "sess-1",
  firstName: "Annie",
  lastName: "Chen",
  email: "annie@example.com",
  seats: 2,
};

describe("parseRegistrationInput", () => {
  it("coerces and clamps", () => {
    const parsed = parseRegistrationInput({ ...valid, seats: "2", junk: true });
    expect(parsed).toMatchObject({ firstName: "Annie", seats: 2 });
    expect(parseRegistrationInput(null)).toBeNull();
  });
});

describe("validateRegistration", () => {
  it("accepts a complete registration", () => {
    expect(validateRegistration(parseRegistrationInput(valid)!)).toEqual([]);
  });
  it("requires name, valid email, and seats in bounds", () => {
    expect(validateRegistration({ ...parseRegistrationInput(valid)!, firstName: " " }).length).toBe(1);
    expect(validateRegistration({ ...parseRegistrationInput(valid)!, email: "nope" }).length).toBe(1);
    expect(validateRegistration({ ...parseRegistrationInput(valid)!, seats: 0 }).length).toBe(1);
    expect(validateRegistration({ ...parseRegistrationInput(valid)!, seats: 5 }).length).toBe(1);
  });
});

describe("seatsRemaining", () => {
  it("computes remaining and treats null capacity as unlimited", () => {
    expect(seatsRemaining(24, 20)).toBe(4);
    expect(seatsRemaining(24, 30)).toBe(0);
    expect(seatsRemaining(null, 500)).toBeNull();
  });
});

describe("canRegister", () => {
  it("allows within capacity and unlimited sessions", () => {
    expect(canRegister({ capacity: 24, taken: 20, seats: 4 })).toEqual({ ok: true });
    expect(canRegister({ capacity: null, taken: 999, seats: 4 })).toEqual({ ok: true });
  });
  it("refuses when the request does not fit", () => {
    const result = canRegister({ capacity: 24, taken: 22, seats: 3 });
    expect(result.ok).toBe(false);
  });
});

describe("slugTag", () => {
  it("slugifies titles", () => {
    expect(slugTag("Mahjong in Bloom")).toBe("mahjong-in-bloom");
    expect(slugTag("  Fall Fest! 2026  ")).toBe("fall-fest-2026");
  });
});

describe("formatDateLabel", () => {
  it("formats a date-only string as local prose (no UTC off-by-one)", () => {
    expect(formatDateLabel("2026-07-28")).toBe("July 28, 2026");
    expect(formatDateLabel("")).toBe("");
    expect(formatDateLabel("junk")).toBe("");
  });
});

describe("validateImageUpload", () => {
  it("accepts jpeg/png/webp under 5 MB", () => {
    expect(validateImageUpload({ type: "image/jpeg", size: 1024 })).toBeNull();
    expect(validateImageUpload({ type: "image/webp", size: 4_000_000 })).toBeNull();
  });
  it("rejects other types and oversize files with plain language", () => {
    expect(validateImageUpload({ type: "image/gif", size: 10 })).toMatch(/jpeg, png, or webp/i);
    expect(validateImageUpload({ type: "image/png", size: 6_000_000 })).toMatch(/5 MB/);
  });
});
```

- [ ] **Step 2.2: Verify failure**, then implement `lib/registration-rules.ts`:

```ts
import { isValidEmail, normalizeEmail } from "@/lib/subscriber-rules";

export const MAX_SEATS = 4;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

export type RegistrationInput = {
  eventId: string;
  sessionId: string;
  firstName: string;
  lastName: string | null;
  email: string;
  seats: number;
};

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

export function parseRegistrationInput(input: unknown): RegistrationInput | null {
  if (typeof input !== "object" || input === null) return null;
  const f = input as Record<string, unknown>;
  const seatsNum = typeof f.seats === "number" ? f.seats : parseInt(str(f.seats), 10);
  return {
    eventId: str(f.eventId),
    sessionId: str(f.sessionId),
    firstName: str(f.firstName).trim(),
    lastName: str(f.lastName).trim() || null,
    email: normalizeEmail(str(f.email)),
    seats: Number.isInteger(seatsNum) ? seatsNum : 0,
  };
}

export function validateRegistration(input: RegistrationInput): string[] {
  const errors: string[] = [];
  if (!input.firstName) errors.push("Add your first name.");
  if (!isValidEmail(input.email)) errors.push("Add a valid email address.");
  if (input.seats < 1 || input.seats > MAX_SEATS) {
    errors.push(`Seats must be between 1 and ${MAX_SEATS}.`);
  }
  return errors;
}

/** null capacity means unlimited; remaining is never negative. */
export function seatsRemaining(capacity: number | null, taken: number): number | null {
  if (capacity === null) return null;
  return Math.max(0, capacity - taken);
}

export function canRegister(args: {
  capacity: number | null;
  taken: number;
  seats: number;
}): { ok: true } | { ok: false; remaining: number } {
  const remaining = seatsRemaining(args.capacity, args.taken);
  if (remaining === null || args.seats <= remaining) return { ok: true };
  return { ok: false, remaining };
}

/** Event tag for the subscriber side effect: slugified title. */
export function slugTag(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * "2026-07-28" to "July 28, 2026". Date-only strings must be built as LOCAL
 * dates: new Date("2026-07-28") is UTC midnight, which is the previous day
 * in Denver.
 */
export function formatDateLabel(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return "";
  const d = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(d);
}

/** Returns a plain-language error, or null when the file is acceptable. */
export function validateImageUpload(file: { type: string; size: number }): string | null {
  if (!IMAGE_TYPES.includes(file.type)) return "Images must be jpeg, png, or webp.";
  if (file.size > MAX_IMAGE_BYTES) return "Images must be under 5 MB.";
  return null;
}
```

- [ ] **Step 2.3: Extend `lib/subscriber-rules.ts`** — in the `SubscribeSource` union, add `"event-registration"`:

```ts
export type SubscribeSource =
  | "newsletter"
  | "contact"
  | "booking"
  | "trips-waitlist"
  | "event-registration";
```

- [ ] **Step 2.4: Extend `lib/event-rules.ts`** for session ids and image fields:
  - `EventSessionInput` gains `id: string | null` (existing session rows keep their database id; new rows use null).
  - `EventInput` gains `imageUrl: string | null` and `imageAlt: string | null`.
  - `parseEventInput`: sessions map gains `id: nullableStr(row.id)`; top level gains `imageUrl: nullableStr(f.imageUrl)` and `imageAlt: nullableStr(f.imageAlt)`.
  - `duplicateTransform` clears image AND session ids (a duplicate gets fresh rows):

```ts
export function duplicateTransform(source: EventInput): EventInput {
  return {
    ...source,
    dateLabel: "",
    endsAt: "",
    bannerText: "",
    sessions: source.sessions.map((s) => ({ ...s, id: null })),
  };
}
```

- [ ] **Step 2.5: Update `lib/__tests__/event-rules.test.ts`** — the `complete` fixture's session gains `id: null` and the fixture gains `imageUrl: null, imageAlt: null`; add to the duplicate describe:

```ts
  it("clears session ids and keeps images cleared fields intact", () => {
    const dup = duplicateTransform({
      ...complete,
      imageUrl: "https://x/img.jpg",
      sessions: [{ ...complete.sessions[0], id: "sess-1" }],
    });
    expect(dup.sessions[0].id).toBeNull();
    expect(dup.imageUrl).toBe("https://x/img.jpg");
  });
```

(The image intentionally survives duplication: "same as last year" usually
reuses the art. Clearing it is one click in the editor.)

- [ ] **Step 2.6: Run** — `npx vitest run lib` — all PASS (fix fixture fallout in the parse tests: parsed sessions now include `id: null`).

- [ ] **Step 2.7: Commit** — `git add lib/ && git commit -m "feat: registration rules, session ids, image fields, event-registration source"`

---

### Task 3: Session sync and image columns in `lib/events.ts`

- [ ] **Step 3.1: Replace `replaceSessions` with `syncSessions`** and wire image columns. In `toRowPatch`, add `image_url: input.imageUrl, image_alt: input.imageAlt`. In `toEventInput`, add `imageUrl: e.image_url, imageAlt: e.image_alt`, and the session map gains `id: s.id`. Add `image_url: string | null; image_alt: string | null;` to `EventRow`. Then:

```ts
export class SessionInUseError extends Error {
  constructor() {
    super("A session with registrations cannot be removed. Cancel its registrations first.");
  }
}

/**
 * Id-preserving session sync: registrations reference session rows, so
 * update-in-place by id, insert new rows, and delete removed rows only when
 * nothing references them.
 */
async function syncSessions(eventId: string, sessions: EventInput["sessions"]) {
  const client = supabaseAdmin();
  const { data: existingRows, error: listError } = await client
    .from("event_sessions")
    .select("id")
    .eq("event_id", eventId);
  if (listError) throw listError;
  const keptIds = new Set(sessions.map((s) => s.id).filter(Boolean));
  const removedIds = (existingRows as { id: string }[]).map((r) => r.id).filter((id) => !keptIds.has(id));

  if (removedIds.length > 0) {
    const { count, error: regError } = await client
      .from("event_registrations")
      .select("id", { count: "exact", head: true })
      .in("session_id", removedIds);
    if (regError) throw regError;
    if ((count ?? 0) > 0) throw new SessionInUseError();
    const { error: delError } = await client.from("event_sessions").delete().in("id", removedIds);
    if (delError) throw delError;
  }

  for (const [i, s] of sessions.entries()) {
    const row = {
      event_id: eventId,
      name: s.name.trim(),
      time_label: s.timeLabel.trim(),
      price_label: s.priceLabel.trim(),
      capacity: s.capacity,
      sort_order: i,
    };
    if (s.id) {
      const { error } = await client.from("event_sessions").update(row).eq("id", s.id);
      if (error) throw error;
    } else {
      const { error } = await client.from("event_sessions").insert(row);
      if (error) throw error;
    }
  }
}
```

Both `createEvent` and `updateEvent` call `syncSessions` where they called `replaceSessions`.

- [ ] **Step 3.2: Guard `deleteDraftEvent`**:

```ts
export async function deleteDraftEvent(id: string): Promise<void> {
  const client = supabaseAdmin();
  const { count, error: regError } = await client
    .from("event_registrations")
    .select("id", { count: "exact", head: true })
    .eq("event_id", id);
  if (regError) throw regError;
  if ((count ?? 0) > 0) {
    throw new Error("This event has registrations and cannot be deleted.");
  }
  const { error } = await client.from("events").delete().eq("id", id).eq("status", "draft");
  if (error) throw error;
}
```

- [ ] **Step 3.3: Surface `SessionInUseError` in `saveEventAction`/`publishEventAction`** (`app/admin/(gated)/events/actions.ts`): wrap the `createEvent`/`updateEvent` calls in try/catch and return `{ error: error instanceof Error ? error.message : "Something went wrong." }` on failure, so the editor shows the plain-language message instead of a crash.

- [ ] **Step 3.4: Run suite, commit** — `npx vitest run` PASS; `git add lib/events.ts app/admin/ && git commit -m "feat: id-preserving session sync with registration guards"`

---

### Task 4: `lib/registrations.ts` (TDD with injected db)

- [ ] **Step 4.1: Write the failing tests** — `lib/__tests__/registrations.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import {
  register,
  cancelByToken,
  type RegistrationDb,
  type RegistrationRow,
} from "@/lib/registrations";

function memory(seed: RegistrationRow[] = []) {
  const rows = [...seed];
  const db: RegistrationDb = {
    async seatsTaken(sessionId) {
      return rows
        .filter((r) => r.session_id === sessionId && r.status === "confirmed")
        .reduce((sum, r) => sum + r.seats, 0);
    },
    async insert(row) {
      const full: RegistrationRow = {
        id: `reg-${rows.length + 1}`,
        status: "confirmed",
        cancel_token: `tok-${rows.length + 1}`,
        ...row,
      };
      rows.push(full);
      return full;
    },
    async findByToken(token) {
      return rows.find((r) => r.cancel_token === token) ?? null;
    },
    async updateStatus(id, status) {
      const row = rows.find((r) => r.id === id);
      if (row) row.status = status;
    },
  };
  return { db, rows };
}

const input = {
  eventId: "evt-1",
  sessionId: "sess-1",
  firstName: "Annie",
  lastName: null,
  email: "annie@example.com",
  seats: 2,
};

function seeded(seats: number): RegistrationRow {
  return {
    id: "reg-0",
    event_id: "evt-1",
    session_id: "sess-1",
    first_name: "Prior",
    last_name: null,
    email: "prior@example.com",
    seats,
    status: "confirmed",
    cancel_token: "tok-0",
  };
}

describe("register", () => {
  it("inserts when capacity fits and returns the row", async () => {
    const { db, rows } = memory([seeded(20)]);
    const result = await register(input, { capacity: 24 }, db);
    expect(result.outcome).toBe("registered");
    expect(rows).toHaveLength(2);
  });
  it("refuses when the session is full, naming remaining seats", async () => {
    const { db, rows } = memory([seeded(23)]);
    const result = await register(input, { capacity: 24 }, db);
    expect(result.outcome).toBe("sold_out");
    expect(result.outcome === "sold_out" && result.remaining).toBe(1);
    expect(rows).toHaveLength(1);
  });
  it("ignores capacity when unlimited and rejects invalid input", async () => {
    const { db } = memory([seeded(500)]);
    expect((await register(input, { capacity: null }, db)).outcome).toBe("registered");
    expect(
      (await register({ ...input, email: "junk" }, { capacity: null }, db)).outcome
    ).toBe("invalid");
  });
});

describe("cancelByToken", () => {
  it("cancels and frees seats; unknown and repeat cancels are neutral", async () => {
    const { db, rows } = memory([seeded(3)]);
    expect((await cancelByToken("tok-0", db)).outcome).toBe("cancelled");
    expect(rows[0].status).toBe("cancelled");
    expect(await db.seatsTaken("sess-1")).toBe(0);
    expect((await cancelByToken("tok-0", db)).outcome).toBe("already_cancelled");
    expect((await cancelByToken("nope", db)).outcome).toBe("not_found");
  });
});
```

- [ ] **Step 4.2: Verify failure, implement `lib/registrations.ts`**:

```ts
import {
  canRegister,
  validateRegistration,
  type RegistrationInput,
} from "@/lib/registration-rules";
import { supabaseAdmin } from "@/lib/supabase/admin";

export type RegistrationRow = {
  id: string;
  event_id: string;
  session_id: string;
  first_name: string;
  last_name: string | null;
  email: string;
  seats: number;
  status: "confirmed" | "cancelled";
  cancel_token: string;
  created_at?: string;
};

export type RegistrationDb = {
  seatsTaken(sessionId: string): Promise<number>;
  insert(row: Omit<RegistrationRow, "id" | "status" | "cancel_token">): Promise<RegistrationRow>;
  findByToken(token: string): Promise<RegistrationRow | null>;
  updateStatus(id: string, status: "confirmed" | "cancelled"): Promise<void>;
};

export type RegisterResult =
  | { outcome: "registered"; registration: RegistrationRow }
  | { outcome: "sold_out"; remaining: number }
  | { outcome: "invalid"; errors: string[] };

export async function register(
  input: RegistrationInput,
  session: { capacity: number | null },
  db: RegistrationDb = liveDb()
): Promise<RegisterResult> {
  const errors = validateRegistration(input);
  if (errors.length) return { outcome: "invalid", errors };

  const taken = await db.seatsTaken(input.sessionId);
  const check = canRegister({ capacity: session.capacity, taken, seats: input.seats });
  if (!check.ok) return { outcome: "sold_out", remaining: check.remaining };

  const registration = await db.insert({
    event_id: input.eventId,
    session_id: input.sessionId,
    first_name: input.firstName,
    last_name: input.lastName,
    email: input.email,
    seats: input.seats,
  });
  return { outcome: "registered", registration };
}

export type CancelResult = {
  outcome: "cancelled" | "already_cancelled" | "not_found";
  registration?: RegistrationRow;
};

export async function cancelByToken(
  token: string,
  db: RegistrationDb = liveDb()
): Promise<CancelResult> {
  const row = await db.findByToken(token);
  if (!row) return { outcome: "not_found" };
  if (row.status === "cancelled") return { outcome: "already_cancelled", registration: row };
  await db.updateStatus(row.id, "cancelled");
  return { outcome: "cancelled", registration: row };
}

const COLUMNS =
  "id, event_id, session_id, first_name, last_name, email, seats, status, cancel_token, created_at";

function liveDb(): RegistrationDb {
  const client = supabaseAdmin();
  return {
    async seatsTaken(sessionId) {
      const { data, error } = await client
        .from("event_registrations")
        .select("seats")
        .eq("session_id", sessionId)
        .eq("status", "confirmed")
        .limit(10000);
      if (error) throw error;
      return (data as { seats: number }[]).reduce((sum, r) => sum + r.seats, 0);
    },
    async insert(row) {
      const { data, error } = await client
        .from("event_registrations")
        .insert(row)
        .select(COLUMNS)
        .single();
      if (error) throw error;
      return data as RegistrationRow;
    },
    async findByToken(token) {
      const { data, error } = await client
        .from("event_registrations")
        .select(COLUMNS)
        .eq("cancel_token", token)
        .maybeSingle();
      if (error) throw error;
      return (data as RegistrationRow) ?? null;
    },
    async updateStatus(id, status) {
      const { error } = await client
        .from("event_registrations")
        .update({ status })
        .eq("id", id);
      if (error) throw error;
    },
  };
}

// Admin/read helpers (straight queries, no rules).

export async function sessionSeatCounts(eventId: string): Promise<Map<string, number>> {
  const { data, error } = await supabaseAdmin()
    .from("event_registrations")
    .select("session_id, seats")
    .eq("event_id", eventId)
    .eq("status", "confirmed")
    .limit(10000);
  if (error) throw error;
  const counts = new Map<string, number>();
  for (const r of data as { session_id: string; seats: number }[]) {
    counts.set(r.session_id, (counts.get(r.session_id) ?? 0) + r.seats);
  }
  return counts;
}

export async function listRegistrants(eventId: string): Promise<RegistrationRow[]> {
  const { data, error } = await supabaseAdmin()
    .from("event_registrations")
    .select(COLUMNS)
    .eq("event_id", eventId)
    .order("created_at", { ascending: false })
    .limit(10000);
  if (error) throw error;
  return data as RegistrationRow[];
}
```

- [ ] **Step 4.3: Run, commit** — `npx vitest run lib/__tests__/registrations.test.ts` PASS, then `git add lib/registrations.ts lib/__tests__/registrations.test.ts && git commit -m "feat: registration write path with capacity checks and cancel"`

---

### Task 5: Transactional email shell + confirmation email (TDD)

- [ ] **Step 5.1: Modify `emails/layout.tsx`** — make `unsubscribeUrl` optional (`unsubscribeUrl?: string`). The footer section becomes: when `unsubscribeUrl` is present, render exactly the current three lines (attribution, unsubscribe, address line); when absent, render the transactional footer only:

```tsx
            <Text style={footerText}>
              {BUSINESS_NAME} &middot; {BUSINESS_EMAIL}
            </Text>
```

Existing marketing templates pass `unsubscribeUrl`, so nothing changes for them; `npx vitest run emails` must still pass after this step alone.

- [ ] **Step 5.2: Write the failing test** — `emails/__tests__/registration-confirmation.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { renderRegistrationConfirmation } from "@/emails/registration-confirmation";

const args = {
  event: { title: "Fall Fest", dateLabel: "October 1, 2026", location: "Denver", paymentInstructions: "Venmo @rack or cash at the door." },
  session: { name: "Intro", timeLabel: "6:00 - 8:00 PM", priceLabel: "$30" },
  firstName: "Annie",
  seats: 2,
  cancelUrl: "https://rackintherockies.com/cancel-registration?token=tok-1",
};

describe("renderRegistrationConfirmation", () => {
  it("contains the receipt details, payment instructions, and cancel link", async () => {
    const { subject, html, text } = await renderRegistrationConfirmation(args);
    expect(subject).toBe("You're registered: Fall Fest");
    for (const needle of ["Fall Fest", "October 1, 2026", "Denver", "Intro", "6:00 - 8:00 PM", "$30", "2 seats", "Venmo @rack", args.cancelUrl]) {
      expect(html).toContain(needle);
    }
    expect(text).toContain(args.cancelUrl);
  });
  it("is transactional: no unsubscribe, no address placeholder, no dashes", async () => {
    const { html, text } = await renderRegistrationConfirmation({ ...args, event: { ...args.event, paymentInstructions: null } });
    expect(html).not.toContain("Unsubscribe");
    expect(html).not.toContain("[Mailing address not set]");
    expect(text).not.toMatch(/[–—]/);
  });
});
```

- [ ] **Step 5.3: Implement `emails/registration-confirmation.tsx`**:

```tsx
import { render } from "@react-email/render";
import { Button, Section, Text } from "@react-email/components";
import { EmailShell } from "@/emails/layout";
import { emailTheme as t } from "@/emails/theme";

export type ConfirmationArgs = {
  event: {
    title: string;
    dateLabel: string;
    location: string;
    paymentInstructions: string | null;
  };
  session: { name: string; timeLabel: string; priceLabel: string };
  firstName: string;
  seats: number;
  cancelUrl: string;
};

const body = { color: t.textMid, fontSize: "15px", lineHeight: "23px", margin: "0 0 16px" };

function ConfirmationEmail({ event, session, firstName, seats, cancelUrl }: ConfirmationArgs) {
  return (
    <EmailShell preheader={`You're in: ${event.title}, ${event.dateLabel}`}>
      <Text
        style={{
          color: t.textDark,
          fontFamily: t.fontDisplay,
          fontSize: "26px",
          fontWeight: 700,
          lineHeight: "32px",
          margin: "0 0 12px",
        }}
      >
        You&apos;re registered!
      </Text>
      <Text style={body}>
        {firstName}, your {seats === 1 ? "seat is" : `${seats} seats are`} saved for {event.title}.
      </Text>
      <Section
        style={{ backgroundColor: t.cream, borderRadius: "12px", padding: "14px 18px", margin: "0 0 18px" }}
      >
        <Text style={{ color: t.textDark, fontSize: "14px", fontWeight: 600, margin: "0 0 2px" }}>
          {session.name} &middot; {session.priceLabel}
        </Text>
        <Text style={{ color: t.textLight, fontSize: "13px", margin: "0 0 2px" }}>
          {event.dateLabel} &middot; {session.timeLabel}
        </Text>
        <Text style={{ color: t.textLight, fontSize: "13px", margin: 0 }}>{event.location}</Text>
      </Section>
      {event.paymentInstructions && (
        <Text style={body}>
          <strong>How to pay:</strong> {event.paymentInstructions}
        </Text>
      )}
      <Text style={{ color: t.textLight, fontSize: "12px", lineHeight: "18px", margin: 0 }}>
        Plans changed? You can{" "}
        <a href={cancelUrl} style={{ color: t.textMid, textDecoration: "underline" }}>
          cancel your registration
        </a>{" "}
        and free the {seats === 1 ? "seat" : "seats"} for someone else.
      </Text>
    </EmailShell>
  );
}

export async function renderRegistrationConfirmation(args: ConfirmationArgs) {
  const element = <ConfirmationEmail {...args} />;
  return {
    subject: `You're registered: ${args.event.title}`,
    html: await render(element),
    text: await render(element, { plainText: true }),
  };
}
```

Note the plain `seats` count renders as "2 seats" via the body copy; ensure
the exact string `${seats} seats` appears (the test checks "2 seats").

- [ ] **Step 5.4: Run all email tests, commit** — `npx vitest run emails` PASS (both new and Phase 2 suites); `git add emails/ && git commit -m "feat: transactional shell variant and registration confirmation email"`

---

### Task 6: `/api/register` route (TDD)

- [ ] **Step 6.1: Write the failing tests** — `app/api/register/__tests__/route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/events", () => ({ getFeaturedEvent: vi.fn() }));
vi.mock("@/lib/registrations", () => ({
  register: vi.fn(),
  sessionSeatCounts: vi.fn(async () => new Map([["sess-1", 20]])),
}));
vi.mock("@/lib/subscribers", () => ({ subscribe: vi.fn(async () => ({ outcome: "created" })) }));
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
    registration: { cancel_token: "tok-1", first_name: "Annie", seats: 2, email: "annie@example.com" },
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
```

- [ ] **Step 6.2: Add the limiter** to `lib/rate-limit.ts` (append):

```ts
/** Shared limiter for /api/register: 10 attempts per 10 minutes per IP. */
export const registerLimiter = createRateLimiter({ limit: 10, windowMs: 600_000 });
```

- [ ] **Step 6.3: Implement `app/api/register/route.ts`**:

```ts
import { NextResponse } from "next/server";
import { getFeaturedEvent } from "@/lib/events";
import { register, sessionSeatCounts } from "@/lib/registrations";
import { parseRegistrationInput, seatsRemaining, slugTag } from "@/lib/registration-rules";
import { registerLimiter } from "@/lib/rate-limit";
import { renderRegistrationConfirmation } from "@/emails/registration-confirmation";
import { liveSender } from "@/lib/sends";
import { subscribe } from "@/lib/subscribers";
import { BUSINESS_EMAIL, BUSINESS_NAME, SITE_URL } from "@/lib/business";

/**
 * Registration only exists for the CURRENT featured event with in-house
 * signup (no external URL). Resolving through getFeaturedEvent is what
 * enforces published-and-not-ended; draft events are unreachable here.
 */
async function currentInHouseEvent(eventId: string) {
  const event = await getFeaturedEvent();
  if (!event || event.id !== eventId || event.external_signup_url) return null;
  return event;
}

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!registerLimiter.allow(ip)) {
    return NextResponse.json({ error: "Too many requests. Try again in a few minutes." }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  // Honeypot: bots fill every field. Fake success so they learn nothing.
  if ((body as { website?: unknown }).website) {
    return NextResponse.json({ ok: true });
  }

  const input = parseRegistrationInput(body);
  if (!input) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const event = await currentInHouseEvent(input.eventId);
  const session = event?.sessions.find((s) => s.id === input.sessionId);
  if (!event || !session) {
    return NextResponse.json(
      { error: "This event is not taking registrations right now." },
      { status: 400 }
    );
  }

  try {
    const result = await register(input, { capacity: session.capacity });
    if (result.outcome === "invalid") {
      return NextResponse.json({ errors: result.errors }, { status: 400 });
    }
    if (result.outcome === "sold_out") {
      return NextResponse.json(
        {
          error:
            result.remaining > 0
              ? `${session.name} only has ${result.remaining} ${result.remaining === 1 ? "seat" : "seats"} left.`
              : `${session.name} is sold out.`,
        },
        { status: 409 }
      );
    }

    // Emails and the subscribe side effect must never fail an inserted
    // registration; they are logged and the user still sees success.
    const registration = result.registration;
    try {
      const rendered = await renderRegistrationConfirmation({
        event: {
          title: event.title,
          dateLabel: event.date_label,
          location: event.location,
          paymentInstructions: event.payment_instructions,
        },
        session: { name: session.name, timeLabel: session.time_label, priceLabel: session.price_label },
        firstName: registration.first_name,
        seats: registration.seats,
        cancelUrl: `${SITE_URL}/cancel-registration?token=${encodeURIComponent(registration.cancel_token)}`,
      });
      const sender = liveSender();
      await sender.sendOne({
        from: `${BUSINESS_NAME} <${BUSINESS_EMAIL}>`,
        to: registration.email,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
        replyTo: BUSINESS_EMAIL,
        headers: {},
      });
      if (process.env.CONTACT_EMAIL) {
        await sender.sendOne({
          from: `${BUSINESS_NAME} <${BUSINESS_EMAIL}>`,
          to: process.env.CONTACT_EMAIL,
          subject: `New registration: ${event.title}`,
          html: `<p>${registration.first_name} ${registration.last_name ?? ""} registered ${registration.seats} ${registration.seats === 1 ? "seat" : "seats"} for ${session.name}.</p><p>${registration.email}</p>`,
          text: `${registration.first_name} ${registration.last_name ?? ""} registered ${registration.seats} seat(s) for ${session.name}. ${registration.email}`,
          replyTo: registration.email,
          headers: {},
        });
      }
    } catch (emailError) {
      console.error("registration emails failed", emailError);
    }
    try {
      await subscribe({
        email: registration.email,
        firstName: registration.first_name,
        lastName: registration.last_name ?? undefined,
        source: "event-registration",
        tags: [slugTag(event.title)],
      });
    } catch (subscribeError) {
      console.error("registration subscribe side effect failed", subscribeError);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("registration failed", error);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}

/** Fresh remaining-seat counts for the form (the page itself caches hourly). */
export async function GET(req: Request) {
  const eventId = new URL(req.url).searchParams.get("eventId") ?? "";
  const event = await currentInHouseEvent(eventId);
  if (!event) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const counts = await sessionSeatCounts(event.id);
  return NextResponse.json({
    sessions: event.sessions.map((s) => ({
      id: s.id,
      remaining: seatsRemaining(s.capacity, counts.get(s.id) ?? 0),
    })),
  });
}
```

- [ ] **Step 6.4: Run, commit** — `npx vitest run app/api/register` PASS; `git add app/api/register lib/rate-limit.ts && git commit -m "feat: registration endpoint with capacity, emails, subscribe side effect"`

---

### Task 7: Cancel page

- [ ] **Step 7.1: Create `app/cancel-registration/actions.ts`** (token-authorized; deliberately NOT admin-gated):

```ts
"use server";

import { cancelByToken } from "@/lib/registrations";

export async function cancelRegistration(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  if (token) {
    await cancelByToken(token);
  }
}
```

- [ ] **Step 7.2: Create `app/cancel-registration/page.tsx`** — shows the registration and requires an explicit button press (unlike unsubscribe, an accidental cancel harms: it frees a seat someone wanted):

```tsx
import type { Metadata } from "next";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { cancelRegistration } from "@/app/cancel-registration/actions";

export const metadata: Metadata = {
  title: "Cancel Registration | Rack in the Rockies",
  robots: { index: false, follow: false },
};

type Row = {
  first_name: string;
  seats: number;
  status: string;
  events: { title: string; date_label: string } | null;
  event_sessions: { name: string; time_label: string } | null;
};

async function lookup(token: string): Promise<Row | null> {
  const { data, error } = await supabaseAdmin()
    .from("event_registrations")
    .select("first_name, seats, status, events (title, date_label), event_sessions (name, time_label)")
    .eq("cancel_token", token)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as Row) ?? null;
}

export default async function CancelRegistrationPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; done?: string }>;
}) {
  const { token, done } = await searchParams;
  const row = token ? await lookup(token) : null;

  return (
    <main className="min-h-[60vh] flex items-center justify-center px-6">
      <div className="max-w-md text-center">
        {!row ? (
          <>
            <h1 className="font-display text-2xl font-bold text-text-dark mb-2">
              We couldn&apos;t find that registration
            </h1>
            <p className="text-sm text-text-mid">
              The link may be incomplete. If you need a hand, write to
              hello@rackintherockies.com.
            </p>
          </>
        ) : row.status === "cancelled" || done ? (
          <>
            <h1 className="font-display text-2xl font-bold text-text-dark mb-2">
              Registration cancelled
            </h1>
            <p className="text-sm text-text-mid">
              Your {row.seats === 1 ? "seat is" : "seats are"} released. We hope
              to see you at another event soon.
            </p>
          </>
        ) : (
          <>
            <h1 className="font-display text-2xl font-bold text-text-dark mb-2">
              Cancel your registration?
            </h1>
            <p className="text-sm text-text-mid mb-4">
              {row.first_name}, this releases {row.seats}{" "}
              {row.seats === 1 ? "seat" : "seats"} for {row.events?.title} (
              {row.event_sessions?.name}, {row.events?.date_label}).
            </p>
            <form action={cancelRegistration}>
              <input type="hidden" name="token" value={token} />
              <button
                type="submit"
                className="px-5 py-2.5 rounded-pill bg-text-dark text-white text-sm font-semibold"
              >
                Yes, cancel my registration
              </button>
            </form>
          </>
        )}
      </div>
    </main>
  );
}
```

(The form posts the server action and the page re-renders; the `cancelled`
status branch then shows. `done` is a belt-and-suspenders param, unused by
the action but harmless.)

- [ ] **Step 7.3: Add `/cancel-registration` to the disallow list in `app/robots.ts`.** Read the file; append the path to the existing `disallow` array.

- [ ] **Step 7.4: Verify build renders the page, commit** — `git add app/cancel-registration app/robots.ts && git commit -m "feat: registration cancel page with explicit confirmation"`

---

### Task 8: Hero art

- [ ] **Step 8.1: Create `components/event-hero-default-decor.tsx`** — ornamental mountains and tiles in the palette, same contract as the flowers (absolute, `aria-hidden`, non-interactive):

```tsx
/**
 * Default decorative art for event heroes: layered mountain silhouettes and
 * floating mahjong tiles in the brand palette. Purely ornamental: hidden
 * from screen readers, non-interactive. Shown when an event has no image.
 */

function Tile({ className, rotate }: { className?: string; rotate: number }) {
  return (
    <svg
      viewBox="0 0 40 52"
      className={className}
      style={{ transform: `rotate(${rotate}deg)` }}
      aria-hidden="true"
    >
      <rect x="1" y="1" width="38" height="50" rx="6" fill="#FFFCFA" stroke="#FFE8E0" strokeWidth="2" />
      <circle cx="20" cy="20" r="7" fill="none" stroke="#FF6B6B" strokeWidth="2.5" />
      <circle cx="20" cy="20" r="2.5" fill="#FF8E53" />
      <rect x="13" y="33" width="14" height="3" rx="1.5" fill="#FFC857" />
      <rect x="13" y="39" width="14" height="3" rx="1.5" fill="#FFC857" opacity="0.6" />
    </svg>
  );
}

function MountainRange({ className, flip }: { className?: string; flip?: boolean }) {
  return (
    <svg
      viewBox="0 0 320 140"
      className={className}
      style={flip ? { transform: "scaleX(-1)" } : undefined}
      aria-hidden="true"
      preserveAspectRatio="none"
    >
      <path d="M0 140 L70 40 L110 90 L170 10 L230 100 L280 55 L320 140 Z" fill="#FF6B6B" opacity="0.10" />
      <path d="M0 140 L50 80 L120 30 L190 110 L250 60 L320 140 Z" fill="#FF8E53" opacity="0.12" />
      <path d="M155 30 L170 10 L185 32 L170 26 Z" fill="#FFFCFA" opacity="0.8" />
    </svg>
  );
}

export function EventHeroDefaultDecor() {
  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden" aria-hidden="true">
      <MountainRange className="absolute -bottom-1 left-0 w-[55%] max-w-md" />
      <MountainRange className="absolute -bottom-1 right-0 w-[45%] max-w-sm" flip />
      <Tile className="absolute left-[6%] top-[14%] w-9 opacity-70 md:w-11" rotate={-12} />
      <Tile className="absolute right-[8%] top-[22%] w-8 opacity-60 md:w-10" rotate={10} />
      <Tile className="absolute right-[16%] bottom-[30%] hidden w-9 opacity-50 md:block" rotate={-6} />
    </div>
  );
}
```

- [ ] **Step 8.2: Modify `components/featured-event-hero.tsx`** — replace the `EventHeroDecor` import with `EventHeroDefaultDecor`, destructure `image_url` and `image_alt` from the event, and swap the decor line for:

```tsx
      {event.image_url ? (
        <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden" aria-hidden="false">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={event.image_url}
            alt={event.image_alt ?? event.title}
            className="absolute -right-6 top-1/2 hidden w-72 -translate-y-1/2 rotate-3 rounded-2xl border-4 border-white object-cover shadow-xl lg:block xl:w-80"
          />
        </div>
      ) : (
        <EventHeroDefaultDecor />
      )}
```

(Plain `img`, not `next/image`: the source is a runtime Supabase URL and the
optimizer would need remote-pattern config for one decorative slot.)

- [ ] **Step 8.3: Delete `components/event-hero-decor.tsx`** — `rm components/event-hero-decor.tsx` (grep first that nothing else imports it).

- [ ] **Step 8.4: Verify, commit** — `npx vitest run && npm run build` PASS; `git add -A && git commit -m "feat: default mountains-and-tiles hero art with optional event image"`

---

### Task 9: Editor polish + upload action (TDD)

- [ ] **Step 9.1: Add upload action tests** to `app/admin/(gated)/events/__tests__/actions.test.ts` — extend the `@/lib/events` mock unchanged; add a storage mock and describe block:

```ts
vi.mock("@/lib/supabase/admin", () => {
  const upload = vi.fn(async () => ({ data: { path: "abc.png" }, error: null }));
  const getPublicUrl = vi.fn(() => ({ data: { publicUrl: "https://cdn.example/abc.png" } }));
  return {
    supabaseAdmin: vi.fn(() => ({ storage: { from: vi.fn(() => ({ upload, getPublicUrl })) } })),
    __storage: { upload, getPublicUrl },
  };
});
```

and:

```ts
import { uploadEventImageAction } from "@/app/admin/(gated)/events/actions";

describe("uploadEventImageAction", () => {
  function fileForm(type: string, size: number) {
    const form = new FormData();
    const file = new File([new Uint8Array(size)], "photo.png", { type });
    form.set("file", file);
    return form;
  }

  it("verifies the admin session and uploads valid images", async () => {
    const result = await uploadEventImageAction(fileForm("image/png", 1024));
    expect(requireAdmin).toHaveBeenCalled();
    expect("url" in result && result.url).toBe("https://cdn.example/abc.png");
  });

  it("rejects wrong types and oversize files", async () => {
    expect("error" in (await uploadEventImageAction(fileForm("image/gif", 10)))).toBe(true);
    expect("error" in (await uploadEventImageAction(fileForm("image/png", 6 * 1024 * 1024)))).toBe(true);
  });

  it("rejects a missing file", async () => {
    expect("error" in (await uploadEventImageAction(new FormData()))).toBe(true);
  });
});
```

(Adjust `requireAdmin` call-count assertions in the existing "every action
re-verifies" test if it uses `toHaveBeenCalledTimes`; simplest is to leave
that test as is since it runs in its own `it` with `beforeEach` clearing.)

- [ ] **Step 9.2: Implement `uploadEventImageAction`** in `app/admin/(gated)/events/actions.ts`:

```ts
import { validateImageUpload } from "@/lib/registration-rules";
import { supabaseAdmin } from "@/lib/supabase/admin";

const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export async function uploadEventImageAction(
  formData: FormData
): Promise<{ url: string } | { error: string }> {
  await requireAdmin();
  const file = formData.get("file");
  if (!(file instanceof File)) return { error: "Choose an image file first." };
  const invalid = validateImageUpload({ type: file.type, size: file.size });
  if (invalid) return { error: invalid };

  const path = `${crypto.randomUUID()}.${EXTENSIONS[file.type]}`;
  const storage = supabaseAdmin().storage.from("event-images");
  const { error } = await storage.upload(path, await file.arrayBuffer(), {
    contentType: file.type,
  });
  if (error) {
    console.error("event image upload failed", error);
    return { error: "The upload failed. Try again." };
  }
  return { url: storage.getPublicUrl(path).data.publicUrl };
}
```

- [ ] **Step 9.3: Editor changes** in `app/admin/(gated)/events/event-editor.tsx`:
  - `EMPTY` gains `imageUrl: null, imageAlt: null`, and sessions created by "Add a session" gain `id: null`.
  - `previewEvent` gains `image_url: form.imageUrl, image_alt: form.imageAlt`, and its session map passes `id: s.id ?? \`preview-${i}\``.
  - Next to the "Date, as it should read" field, add a picker that writes the label:

```tsx
            <input
              type="date"
              aria-label="Pick the event date"
              className={`${inputCls} mt-1`}
              onChange={(e) => {
                const label = formatDateLabel(e.target.value);
                if (label) set({ dateLabel: label });
              }}
            />
```

  with `import { formatDateLabel } from "@/lib/registration-rules";` and a
  helper line under it: `<p className="text-[11px] text-text-light mt-1">Pick a date to fill the label, then edit it freely (ranges, phrasing).</p>`
  - After the sign-up link field, add the image block:

```tsx
        <div>
          <label className={labelCls}>Event image (optional; replaces the default mountain art)</label>
          {form.imageUrl ? (
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={form.imageUrl} alt="" className="h-16 w-16 rounded-xl object-cover border border-coral/10" />
              <input
                className={inputCls}
                placeholder="Describe the image for screen readers"
                value={form.imageAlt ?? ""}
                onChange={(e) => set({ imageAlt: e.target.value || null })}
              />
              <button
                type="button"
                className="text-xs text-red-500 underline hover:no-underline"
                onClick={() => set({ imageUrl: null, imageAlt: null })}
              >
                Remove
              </button>
            </div>
          ) : (
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="text-sm text-text-mid"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setNotice(null);
                startTransition(async () => {
                  const data = new FormData();
                  data.set("file", file);
                  const result = await uploadEventImageAction(data);
                  if ("url" in result) set({ imageUrl: result.url });
                  else setNotice({ kind: "error", lines: [result.error] });
                });
              }}
            />
          )}
        </div>
```

  with `uploadEventImageAction` added to the actions import.

- [ ] **Step 9.4: Run, verify, commit** — `npx vitest run "app/admin/(gated)/events"` PASS, `npm run build` PASS; `git add app/admin/ && git commit -m "feat: editor date picker, image upload with alt text"`

---

### Task 10: Registration form on /events + admin registrants + CSV

- [ ] **Step 10.1: Create `components/registration-form.tsx`** (client):

```tsx
"use client";

import { useEffect, useState, useTransition } from "react";
import { ConsentNotice } from "@/components/consent-notice";
import type { EventWithSessions } from "@/lib/events";

const inputCls =
  "w-full px-4 py-2.5 rounded-xl border border-coral/10 bg-warm-white text-sm text-text-dark placeholder:text-text-light focus:outline-none focus:border-coral/30";

type Remaining = Record<string, number | null>;

export function RegistrationForm({ event }: { event: EventWithSessions }) {
  const [remaining, setRemaining] = useState<Remaining>({});
  const [sessionId, setSessionId] = useState(event.sessions[0]?.id ?? "");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [seats, setSeats] = useState(1);
  const [website, setWebsite] = useState("");
  const [status, setStatus] = useState<"idle" | "sent">("idle");
  const [errors, setErrors] = useState<string[]>([]);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    fetch(`/api/register?eventId=${event.id}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { sessions: { id: string; remaining: number | null }[] } | null) => {
        if (!data) return;
        const map: Remaining = {};
        for (const s of data.sessions) map[s.id] = s.remaining;
        setRemaining(map);
      })
      .catch(() => {});
  }, [event.id]);

  function soldOut(id: string) {
    return remaining[id] === 0;
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setErrors([]);
    startTransition(async () => {
      try {
        const res = await fetch("/api/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ eventId: event.id, sessionId, firstName, lastName, email, seats, website }),
        });
        const body = await res.json().catch(() => ({}));
        if (res.ok) setStatus("sent");
        else setErrors(body.errors ?? [body.error ?? "Something went wrong. Please try again."]);
      } catch {
        setErrors(["Something went wrong. Please try again."]);
      }
    });
  }

  if (status === "sent") {
    return (
      <div className="mx-auto max-w-md text-center">
        <h3 className="font-display text-xl font-bold text-text-dark mb-2">You&apos;re in!</h3>
        <p className="text-sm text-text-mid">
          Check your email for your confirmation and the event details.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mx-auto max-w-md space-y-3 text-left">
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        value={website}
        onChange={(e) => setWebsite(e.target.value)}
        className="absolute -left-[9999px] h-0 w-0 opacity-0"
      />
      <div className="space-y-2">
        {event.sessions.map((s) => {
          const left = remaining[s.id];
          const full = soldOut(s.id);
          return (
            <label
              key={s.id}
              className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm ${
                full
                  ? "border-coral/5 bg-cream/50 text-text-light"
                  : sessionId === s.id
                    ? "border-coral/40 bg-white"
                    : "border-coral/10 bg-white"
              }`}
            >
              <span className="flex items-center gap-2">
                <input
                  type="radio"
                  name="session"
                  checked={sessionId === s.id}
                  disabled={full}
                  onChange={() => setSessionId(s.id)}
                />
                <span>
                  <span className="font-semibold text-text-dark">{s.name}</span>{" "}
                  <span className="text-text-mid">
                    {s.time_label} &middot; {s.price_label}
                  </span>
                </span>
              </span>
              <span className="text-xs">
                {full
                  ? "Sold out"
                  : typeof left === "number"
                    ? `${left} ${left === 1 ? "seat" : "seats"} left`
                    : ""}
              </span>
            </label>
          );
        })}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <input className={inputCls} placeholder="First name" required value={firstName} onChange={(e) => setFirstName(e.target.value)} />
        <input className={inputCls} placeholder="Last name (optional)" value={lastName} onChange={(e) => setLastName(e.target.value)} />
      </div>
      <input className={inputCls} type="email" placeholder="Email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      <div className="flex items-center gap-3">
        <label className="text-sm text-text-mid">Seats</label>
        <select className={inputCls} value={seats} onChange={(e) => setSeats(Number(e.target.value))}>
          {[1, 2, 3, 4].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </div>
      {errors.length > 0 && (
        <div className="text-sm text-red-500">
          {errors.map((line, i) => (
            <p key={i}>{line}</p>
          ))}
        </div>
      )}
      <ConsentNotice />
      <button
        type="submit"
        disabled={isPending || soldOut(sessionId)}
        className="w-full rounded-pill bg-gradient-to-r from-coral to-tangerine py-3 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-coral/30 disabled:opacity-50"
      >
        {isPending ? "Saving your seat..." : "Reserve Your Seat"}
      </button>
    </form>
  );
}
```

- [ ] **Step 10.2: Mount it.** In `components/featured-event-hero.tsx`, the CTA block becomes a three-way: external URL → existing button; no URL and `sessions.length > 0` → nothing here (the form renders below the hero); neither → nothing. In `app/events/page.tsx`, under the hero:

```tsx
      {featured && !featured.external_signup_url && featured.sessions.length > 0 && (
        <section className="bg-cream px-6 pb-14 md:px-12">
          <RegistrationForm event={featured} />
        </section>
      )}
```

with the import added. (The hero and the form section share the cream background, so the form reads as part of the hero.)

- [ ] **Step 10.3: Admin registrants.** In `app/admin/(gated)/events/[id]/page.tsx`, after the editor, for events without an external URL:

```tsx
      {!event.external_signup_url && <Registrants event={event} />}
```

with a server component in the same file:

```tsx
import { listRegistrants, sessionSeatCounts } from "@/lib/registrations";
import type { EventWithSessions } from "@/lib/events";

async function Registrants({ event }: { event: EventWithSessions }) {
  const [registrants, counts] = await Promise.all([
    listRegistrants(event.id),
    sessionSeatCounts(event.id),
  ]);
  const sessionName = new Map(event.sessions.map((s) => [s.id, s.name]));

  return (
    <section className="mt-8">
      <div className="flex items-center justify-between mb-2">
        <h2 className="font-display text-lg font-bold text-text-dark">Registrations</h2>
        {registrants.length > 0 && (
          <a
            href={`/admin/events/${event.id}/registrants.csv`}
            className="text-xs text-text-mid underline hover:no-underline"
          >
            Download CSV
          </a>
        )}
      </div>
      <p className="text-xs text-text-mid mb-3">
        {event.sessions.map((s) => {
          const taken = counts.get(s.id) ?? 0;
          return `${s.name}: ${taken}${s.capacity ? ` of ${s.capacity}` : ""} seats`;
        }).join(" · ") || "No sessions"}
      </p>
      {registrants.length === 0 ? (
        <p className="text-sm text-text-mid">No registrations yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-coral/10 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-text-mid border-b border-coral/10">
                <th className="px-4 py-2">Name</th>
                <th className="px-4 py-2">Email</th>
                <th className="px-4 py-2">Session</th>
                <th className="px-4 py-2 text-right">Seats</th>
                <th className="px-4 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {registrants.map((r) => (
                <tr key={r.id} className={`border-b border-coral/5 last:border-0 ${r.status === "cancelled" ? "text-text-light line-through" : ""}`}>
                  <td className="px-4 py-2">{[r.first_name, r.last_name].filter(Boolean).join(" ")}</td>
                  <td className="px-4 py-2">{r.email}</td>
                  <td className="px-4 py-2">{sessionName.get(r.session_id) ?? ""}</td>
                  <td className="px-4 py-2 text-right">{r.seats}</td>
                  <td className="px-4 py-2 text-xs">{r.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 10.4: CSV route** — `app/admin/events/[id]/registrants.csv/route.ts` (outside the route group; handlers bypass layouts, so `requireAdmin` lives here):

```ts
import { requireAdmin } from "@/lib/auth";
import { listRegistrants } from "@/lib/registrations";
import { getEvent } from "@/lib/events";
import { csvField } from "@/lib/subscriber-rules";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await requireAdmin();
  const { id } = await params;
  const event = await getEvent(id);
  if (!event) return new Response("Not found", { status: 404 });
  const sessionName = new Map(event.sessions.map((s) => [s.id, s.name]));
  const rows = await listRegistrants(id);
  const header = "first_name,last_name,email,session,seats,status,registered_at";
  const lines = rows.map((r) =>
    [
      csvField(r.first_name),
      csvField(r.last_name),
      csvField(r.email),
      csvField(sessionName.get(r.session_id) ?? ""),
      String(r.seats),
      csvField(r.status),
      csvField(r.created_at ?? ""),
    ].join(",")
  );
  return new Response([header, ...lines].join("\n") + "\n", {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="registrants.csv"`,
    },
  });
}
```

- [ ] **Step 10.5: Verify, commit** — `npx vitest run && npm run build` PASS; `git add -A && git commit -m "feat: public registration form, admin registrants view, csv export"`

---

### Task 11: Full verification

- [ ] **Step 11.1:** `npx vitest run` all green; `npm run lint` clean; `npm run build` clean.
- [ ] **Step 11.2: Copy check** — dash grep over `components/ app/ lib/ emails/` returns only the intentional test regexes.
- [ ] **Step 11.3: Live smoke (env permitting):** dev server; flip the seeded Bloom event: set `ends_at` future AND `external_signup_url` null via PostgREST; `/events` shows the registration form with session seat counts; POST a registration via curl with a real-looking email (use `test-registration@example.com`), confirm 200, row in `event_registrations`, and a subscriber row with source `event-registration` and the `mahjong-in-bloom` tag; open the cancel URL flow via the token from the row and confirm cancellation frees the seats; then revert `ends_at` and `external_signup_url`, and delete the test registration and test subscriber rows. Note: confirmation email will attempt a real Resend send; without `RESEND_API_KEY` locally it logs a failure and the registration still succeeds, which itself verifies the email-failure isolation.
- [ ] **Step 11.4: Report** — which verifications ran; note the Storage bucket now exists in prod and the first real upload happens through the editor after merge.

---

## Self-review notes (already applied)

- Spec coverage (Part B + amendments): schema incl. bucket and source value (Task 1), rules incl. date label and upload validation (Task 2), id-preserving sessions and delete guards (Task 3), registration write path (Task 4), transactional email (Task 5), endpoint with fresh counts (Task 6), confirm-step cancel (Task 7), hero art default + image replacement (Task 8), editor picker/upload (Task 9), public form + admin registrants + CSV (Task 10).
- Type consistency: `RegistrationInput` (Task 2) used by Tasks 4 and 6; `RegistrationRow`/`RegistrationDb` (Task 4) used by 6, 7, 10; `EventSessionInput.id` threading through parse (2), sync (3), editor (9); `ConfirmationArgs` (5) used by 6.
- Deliberate: image survives Duplicate; registration form only for the current featured event (no per-event URLs); notification email is minimal HTML, not a React Email template; `aria-hidden="false"` on the image wrapper because a real event photo is content, unlike the decor.
