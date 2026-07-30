# Subscriber Management Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Collect and manage event-announcement subscribers in the project's own Supabase Postgres, with consent capture, one-click unsubscribe, and an admin portal, per `docs/superpowers/specs/2026-07-30-subscriber-management-phase-1-design.md`.

**Architecture:** Every subscriber write flows through `lib/subscribers.ts`, which holds the resubscribe rules and takes an injectable `SubscriberDb` so the rules are unit-testable without a database. Public routes (`/api/subscribe`, `/unsubscribe`) and the server-rendered `/admin` portal (Supabase Auth magic link, role from `public.profiles`) all call that one module. RLS locks `subscribers` completely; server code uses the secret key.

**Tech Stack:** Next.js 16.2.1 App Router (NOTE: `proxy.ts` not middleware, `await cookies()`, `await searchParams`), Supabase (`@supabase/supabase-js`, `@supabase/ssr`), Tailwind 4, vitest (added by this plan), Supabase CLI 2.75.0.

**Read the spec first.** It is the authority on behavior. This plan is the authority on file layout and sequencing.

---

## Manual prerequisites (Tyler, not the executing engineer)

These require dashboard access and cannot be scripted here. Tasks below note which of these block them. None block Tasks 1-9.

- [ ] **M1.** Create a Supabase project (dashboard or `supabase projects create`). Record the project ref.
- [ ] **M2.** `supabase login && supabase link --project-ref <ref>` in the repo.
- [ ] **M3.** Copy the project's URL, publishable key, and secret key into `.env.local`, and add the same three to Vercel project env vars (secret key as server-only, never `NEXT_PUBLIC_`).
- [ ] **M4.** Dashboard → Auth → Sign In / Up: disable "Allow new users to sign up".
- [ ] **M5.** Dashboard → Auth → Email Templates → Magic Link: set the body link to `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next=/admin` and set Site URL to `https://rackintherockies.com` (plus `http://localhost:3000` in additional redirect URLs for dev).
- [ ] **M6.** After Task 2 is pushed: Dashboard → Auth → Users → invite the two admin users (Tyler, site owner). Then in SQL editor: `update public.profiles set role = 'admin' where id in (select id from auth.users where email in ('<tyler>', '<owner>'));`
- [ ] **M7.** Data migration per spec "Migrations" section: normalize (lowercase, trim, dedupe) the spreadsheet CSV and the Resend audience export, upload via dashboard CSV import with `source` column set to `import` / `resend-migration`, then run the duplicate check from the spec.
- [ ] **M8.** Supply the full business mailing address for `lib/business.ts` before Phase 2 sending begins. Phase 1 pages ship with "Denver, Colorado" (the locale already published in the footer), which is fine for the website but NOT sufficient for CAN-SPAM email footers in Phase 2.

---

## File structure

```
vitest.config.ts                          new: test runner config
supabase/migrations/<ts>_subscribers.sql  new: profiles + subscribers + RLS (via `supabase migration new`)
lib/consent.ts                            new: THE consent constant, nothing else (audit trail module)
lib/business.ts                           new: business name/address/contact constants
lib/subscriber-rules.ts                   new: pure logic: normalize, validate, decide, unionTags, deriveContactSource
lib/subscribers.ts                        new: subscribe/unsubscribe/resubscribe/list + SubscriberDb interface + supabase impl
lib/rate-limit.ts                         new: injectable-clock in-memory limiter
lib/supabase/admin.ts                     new: secret-key client (server only)
lib/supabase/server.ts                    new: SSR cookie client (publishable key)
lib/supabase/proxy.ts                     new: session refresh helper used by proxy.ts
lib/auth.ts                               new: requireAdmin()
proxy.ts                                  new: Next 16 proxy, matcher /admin/:path*
app/api/subscribe/route.ts                new: public signup endpoint
app/api/contact/route.ts                  modify: replace resend.contacts.create with subscribe()
app/auth/confirm/route.ts                 new: magic link verifyOtp handler
app/unsubscribe/page.tsx                  new: GET-mutating unsubscribe + changed-your-mind link
app/resubscribe/page.tsx                  new: token resubscribe landing
app/admin/login/page.tsx                  new: magic link request form
app/admin/login/actions.ts                new: sendMagicLink server action
app/admin/layout.tsx                      new: requireAdmin + chrome
app/admin/page.tsx                        new: subscriber list (search/filter/counts)
app/admin/actions.ts                      new: adminResubscribe server action (re-checks role)
app/terms/page.tsx                        new
app/privacy/page.tsx                      new
components/consent-notice.tsx             new: renders CONSENT_NOTICE + terms/privacy links
components/newsletter-signup.tsx          modify: point at /api/subscribe, add honeypot, add notice
components/contact-form.tsx               modify: add ConsentNotice
components/booking-form.tsx               modify: add ConsentNotice
components/waitlist-form.tsx              modify: add ConsentNotice (light)
components/footer.tsx                     modify: Terms + Privacy links
app/sitemap.ts                            modify: add /terms, /privacy
app/robots.ts                             modify: disallow /admin, /unsubscribe, /resubscribe
.env.local.example                        modify: Supabase vars
tests: lib/__tests__/*.test.ts, app/api/subscribe/__tests__/route.test.ts
```

Copy rule for ALL user-facing strings in every task: no em dashes, no en dashes (AGENTS.md).

---

### Task 1: Test tooling

**Files:**
- Create: `vitest.config.ts`
- Modify: `package.json` (scripts + devDependency)

- [ ] **Step 1.1: Install vitest**

```bash
npm install -D vitest
```

- [ ] **Step 1.2: Create `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname) },
  },
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts", "app/**/*.test.ts"],
  },
});
```

- [ ] **Step 1.3: Add script to `package.json`** — in `"scripts"`, add `"test": "vitest run"`.

- [ ] **Step 1.4: Verify the runner works**

Run: `npx vitest run`
Expected: exits 0 with "No test files found" (passWithNoTests is not set; if it exits 1 for no files, add `passWithNoTests: true` to the `test` block and rerun).

- [ ] **Step 1.5: Commit**

```bash
git add vitest.config.ts package.json package-lock.json
git commit -m "chore: add vitest"
```

---

### Task 2: Database migration

**Files:**
- Create: `supabase/` scaffolding + one migration (filename generated by CLI, never hand-authored)

- [ ] **Step 2.1: Scaffold and create the migration file**

```bash
supabase init
supabase migration new subscriber_management_phase_1
```

`supabase init` may report it already exists if `.vercel`-linked tooling created config; that is fine. The migration file appears under `supabase/migrations/`.

- [ ] **Step 2.2: Write the migration SQL** (full contents of the generated file)

```sql
-- Phase 1 subscriber management. Spec:
-- docs/superpowers/specs/2026-07-30-subscriber-management-phase-1-design.md

create schema if not exists private;

-- profiles: one row per authenticated user. Role lives HERE, never in
-- user_metadata (user_metadata is self-editable).
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null default 'member' check (role in ('admin', 'member')),
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  first_name text,
  last_name text,
  status text not null default 'subscribed'
    check (status in ('subscribed', 'unsubscribed', 'bounced', 'complained')),
  source text not null
    check (source in ('newsletter', 'contact', 'booking', 'trips-waitlist', 'import', 'resend-migration')),
  tags text[] not null default '{}',
  unsubscribe_token uuid not null unique default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index subscribers_status_idx on public.subscribers (status);
create index subscribers_source_idx on public.subscribers (source);

-- updated_at maintenance
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger subscribers_set_updated_at
  before update on public.subscribers
  for each row execute function public.set_updated_at();

-- Auto-create a profile per auth user. SECURITY DEFINER, therefore in the
-- private schema (spec requirement: not reachable via the Data API).
-- Role is NOT taken from metadata; the column default 'member' applies.
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, new.raw_user_meta_data ->> 'display_name');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- RLS
alter table public.subscribers enable row level security;
alter table public.profiles enable row level security;

-- subscribers: fail closed. No policies, no grants. Server code uses the
-- secret key which bypasses RLS.
revoke all on public.subscribers from anon, authenticated;

-- profiles: user may read own row and update own display_name only.
-- Column-level grant is what makes role immutable to its owner; RLS cannot
-- compare old and new values.
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (display_name) on public.profiles to authenticated;

create policy "read own profile" on public.profiles
  for select to authenticated
  using ((select auth.uid()) = id);

create policy "update own profile" on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);
```

- [ ] **Step 2.3: Push and verify** — BLOCKED on M1-M3. If not yet done, commit the migration and continue; return here later.

```bash
supabase db push
```

Expected: migration applies cleanly. Then verify with MCP `get_advisors` or `supabase db advisors` (CLI 2.75.0 predates `db advisors`; use the dashboard Advisors page if so) and confirm zero errors on the two tables.

- [ ] **Step 2.4: Commit**

```bash
git add supabase/
git commit -m "feat: add profiles and subscribers schema with RLS"
```

---

### Task 3: Consent and business constants

**Files:**
- Create: `lib/consent.ts`, `lib/business.ts`

- [ ] **Step 3.1: Create `lib/consent.ts`** — exactly this, nothing else in the file. This module is the consent audit trail; its git history must stay clean of unrelated changes.

```ts
/**
 * The consent notice rendered next to every submit button that collects an
 * email address. This file is the audit trail for what wording was live when:
 * `git log` on this one file, joined with subscribers.created_at, answers
 * "what did this person agree to". Rewording this is a meaningful change,
 * not a copy tweak. Say so in the commit message.
 */
export const CONSENT_NOTICE =
  "By submitting, you agree to receive emails from Rack in the Rockies. Unsubscribe anytime.";
```

- [ ] **Step 3.2: Create `lib/business.ts`**

```ts
export const BUSINESS_NAME = "Rack in the Rockies";
export const BUSINESS_EMAIL = "hello@rackintherockies.com";
// Locale only. The full mailing address is required before Phase 2 sends
// (CAN-SPAM). See manual step M8 in the Phase 1 plan.
export const BUSINESS_LOCATION = "Denver, Colorado";
```

- [ ] **Step 3.3: Commit**

```bash
git add lib/consent.ts lib/business.ts
git commit -m "feat: add consent notice constant as its own audit-trail module"
```

---

### Task 4: Pure subscriber rules (TDD)

**Files:**
- Create: `lib/subscriber-rules.ts`, `lib/__tests__/subscriber-rules.test.ts`

- [ ] **Step 4.1: Write the failing tests** — `lib/__tests__/subscriber-rules.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  normalizeEmail,
  isValidEmail,
  decideSubscribeAction,
  unionTags,
  deriveContactSource,
} from "@/lib/subscriber-rules";

describe("normalizeEmail", () => {
  it("lowercases and trims", () => {
    expect(normalizeEmail("  Annie@Example.COM ")).toBe("annie@example.com");
  });
});

describe("isValidEmail", () => {
  it("accepts a plain address", () => {
    expect(isValidEmail("a@b.co")).toBe(true);
  });
  it("rejects junk", () => {
    for (const bad of ["", "no-at-sign", "a@b", "a b@c.co", "a@b c.co"]) {
      expect(isValidEmail(bad), bad).toBe(false);
    }
  });
});

// The spec's resubscribe matrix, every cell. explicit=true covers the signup
// form AND token resubscribe; explicit=false covers inquiry forms.
describe("decideSubscribeAction", () => {
  it("creates when no record exists, regardless of path", () => {
    expect(decideSubscribeAction(null, true)).toBe("create");
    expect(decideSubscribeAction(null, false)).toBe("create");
  });
  it("updates a subscribed record from either path", () => {
    expect(decideSubscribeAction("subscribed", true)).toBe("update");
    expect(decideSubscribeAction("subscribed", false)).toBe("update");
  });
  it("resubscribes unsubscribed and bounced only on the explicit path", () => {
    expect(decideSubscribeAction("unsubscribed", true)).toBe("resubscribe");
    expect(decideSubscribeAction("bounced", true)).toBe("resubscribe");
    expect(decideSubscribeAction("unsubscribed", false)).toBe("blocked");
    expect(decideSubscribeAction("bounced", false)).toBe("blocked");
  });
  it("never resurrects complained, even explicitly", () => {
    expect(decideSubscribeAction("complained", true)).toBe("blocked");
    expect(decideSubscribeAction("complained", false)).toBe("blocked");
  });
});

describe("unionTags", () => {
  it("unions without duplicates, preserving existing order", () => {
    expect(unionTags(["beginner", "booking"], ["booking", "trips"])).toEqual([
      "beginner",
      "booking",
      "trips",
    ]);
  });
  it("handles empty sides", () => {
    expect(unionTags([], ["a"])).toEqual(["a"]);
    expect(unionTags(["a"], [])).toEqual(["a"]);
  });
});

// Source derivation for /api/contact. Client input is untrusted: anything
// not recognized falls back to 'contact'.
describe("deriveContactSource", () => {
  it("maps the waitlist marker", () => {
    expect(deriveContactSource({ source: "trips-waitlist" })).toBe("trips-waitlist");
  });
  it("maps event inquiries to booking", () => {
    expect(deriveContactSource({ eventType: "birthday" })).toBe("booking");
  });
  it("defaults to contact and ignores unrecognized client values", () => {
    expect(deriveContactSource({})).toBe("contact");
    expect(deriveContactSource({ source: "newsletter" })).toBe("contact");
    expect(deriveContactSource({ source: "import" })).toBe("contact");
  });
});
```

- [ ] **Step 4.2: Run to verify failure**

Run: `npx vitest run lib/__tests__/subscriber-rules.test.ts`
Expected: FAIL, cannot resolve `@/lib/subscriber-rules`.

- [ ] **Step 4.3: Implement `lib/subscriber-rules.ts`**

```ts
export type SubscriberStatus = "subscribed" | "unsubscribed" | "bounced" | "complained";
export type SubscribeSource = "newsletter" | "contact" | "booking" | "trips-waitlist";
export type SubscribeAction = "create" | "update" | "resubscribe" | "blocked";

export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * The spec's resubscribe matrix. `explicit` is true for the signup form and
 * for token resubscribe (the person is asking), false for inquiry-form side
 * effects. Admin paths do not go through this function.
 */
export function decideSubscribeAction(
  current: SubscriberStatus | null,
  explicit: boolean
): SubscribeAction {
  if (current === null) return "create";
  if (current === "subscribed") return "update";
  if (current === "complained") return "blocked";
  // unsubscribed or bounced
  return explicit ? "resubscribe" : "blocked";
}

/** Union, never replace: no write path may erase what another recorded. */
export function unionTags(existing: string[], incoming: string[]): string[] {
  return [...new Set([...existing, ...incoming])];
}

export function deriveContactSource(body: {
  source?: unknown;
  eventType?: unknown;
}): SubscribeSource {
  if (body.source === "trips-waitlist") return "trips-waitlist";
  if (typeof body.eventType === "string" && body.eventType) return "booking";
  return "contact";
}
```

- [ ] **Step 4.4: Run to verify pass**

Run: `npx vitest run lib/__tests__/subscriber-rules.test.ts`
Expected: PASS, all tests.

- [ ] **Step 4.5: Commit**

```bash
git add lib/subscriber-rules.ts lib/__tests__/subscriber-rules.test.ts
git commit -m "feat: pure subscriber rules implementing the resubscribe matrix"
```

---

### Task 5: Supabase clients and env example

**Files:**
- Create: `lib/supabase/admin.ts`, `lib/supabase/server.ts`
- Modify: `.env.local.example`

- [ ] **Step 5.1: Install packages**

```bash
npm install @supabase/supabase-js @supabase/ssr
```

- [ ] **Step 5.2: Create `lib/supabase/admin.ts`**

```ts
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let _client: SupabaseClient | null = null;

/**
 * Secret-key client. Bypasses RLS. Server only: the secret key must never
 * reach the browser, which is also why this module throws if imported there.
 */
export function supabaseAdmin(): SupabaseClient {
  if (typeof window !== "undefined") {
    throw new Error("supabaseAdmin must not be imported in client code");
  }
  if (!_client) {
    _client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SECRET_KEY!,
      { auth: { persistSession: false } }
    );
  }
  return _client;
}
```

- [ ] **Step 5.3: Create `lib/supabase/server.ts`** (Next 16: `cookies()` is async)

```ts
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/** Cookie-based client for the authenticated admin session. */
export async function supabaseServer() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component; the proxy refreshes sessions.
          }
        },
      },
    }
  );
}
```

- [ ] **Step 5.4: Replace `.env.local.example`** with:

```
RESEND_API_KEY=re_xxxxxxxxxxxx
CONTACT_EMAIL=annie@example.com
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxxx
# Server only. Never expose, never prefix with NEXT_PUBLIC_.
SUPABASE_SECRET_KEY=sb_secret_xxxx
```

- [ ] **Step 5.5: Commit**

```bash
git add lib/supabase/ .env.local.example package.json package-lock.json
git commit -m "feat: add supabase admin and SSR clients"
```

---

### Task 6: `lib/subscribers.ts` (TDD, injected db)

**Files:**
- Create: `lib/subscribers.ts`, `lib/__tests__/subscribers.test.ts`

Design: functions take a `SubscriberDb` (four small methods). Tests inject an in-memory implementation, so the rules are tested with zero mocking of Supabase chains. The real implementation is a thin adapter at the bottom of the module.

- [ ] **Step 6.1: Write the failing tests** — `lib/__tests__/subscribers.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  subscribe,
  unsubscribeByToken,
  resubscribeByToken,
  resubscribeById,
  type SubscriberDb,
  type SubscriberRow,
} from "@/lib/subscribers";

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

describe("subscribe", () => {
  it("creates a new subscriber with a normalized email", async () => {
    const { db, rows } = memoryDb();
    const result = await subscribe(
      { email: " Annie@Example.com ", source: "newsletter" },
      db
    );
    expect(result.outcome).toBe("created");
    expect(rows[0].email).toBe("annie@example.com");
    expect(rows[0].status).toBe("subscribed");
  });

  it("rejects an invalid email without touching the db", async () => {
    const { db, rows } = memoryDb();
    const result = await subscribe({ email: "nope", source: "newsletter" }, db);
    expect(result.outcome).toBe("invalid");
    expect(rows).toHaveLength(0);
  });

  it("updates names and unions tags on an existing subscribed record", async () => {
    const { db, rows } = memoryDb([row({ tags: ["beginner"] })]);
    const result = await subscribe(
      {
        email: "annie@example.com",
        lastName: "Chen",
        tags: ["booking"],
        source: "booking",
      },
      db
    );
    expect(result.outcome).toBe("updated");
    expect(rows[0].last_name).toBe("Chen");
    expect(rows[0].tags).toEqual(["beginner", "booking"]);
    // A later write must not erase the other path's tags: union, not replace.
  });

  it("resubscribes an unsubscribed record only via the newsletter source", async () => {
    const { db, rows } = memoryDb([row({ status: "unsubscribed" })]);
    const viaInquiry = await subscribe(
      { email: "annie@example.com", source: "contact" },
      db
    );
    expect(viaInquiry.outcome).toBe("blocked");
    expect(rows[0].status).toBe("unsubscribed");

    const viaSignup = await subscribe(
      { email: "annie@example.com", source: "newsletter" },
      db
    );
    expect(viaSignup.outcome).toBe("resubscribed");
    expect(rows[0].status).toBe("subscribed");
  });

  it("never resurrects a complained record, from any source", async () => {
    const { db, rows } = memoryDb([row({ status: "complained" })]);
    for (const source of ["newsletter", "contact", "booking", "trips-waitlist"] as const) {
      const result = await subscribe({ email: "annie@example.com", source }, db);
      expect(result.outcome).toBe("blocked");
    }
    expect(rows[0].status).toBe("complained");
  });
});

describe("unsubscribeByToken", () => {
  it("unsubscribes by token", async () => {
    const { db, rows } = memoryDb([row({})]);
    const result = await unsubscribeByToken("tok-1", db);
    expect(result.outcome).toBe("unsubscribed");
    expect(rows[0].status).toBe("unsubscribed");
  });
  it("reports unknown tokens without throwing", async () => {
    const { db } = memoryDb();
    const result = await unsubscribeByToken("nope", db);
    expect(result.outcome).toBe("not_found");
  });
});

describe("resubscribeByToken", () => {
  it("resubscribes an unsubscribed record", async () => {
    const { db, rows } = memoryDb([row({ status: "unsubscribed" })]);
    const result = await resubscribeByToken("tok-1", db);
    expect(result.outcome).toBe("resubscribed");
    expect(rows[0].status).toBe("subscribed");
  });
  it("stays blocked at complained, matching the matrix", async () => {
    const { db, rows } = memoryDb([row({ status: "complained" })]);
    const result = await resubscribeByToken("tok-1", db);
    expect(result.outcome).toBe("blocked");
    expect(rows[0].status).toBe("complained");
  });
});

describe("resubscribeById", () => {
  it("resubscribes unsubscribed without force", async () => {
    const { db, rows } = memoryDb([row({ status: "unsubscribed" })]);
    const result = await resubscribeById("id-1", { force: false }, db);
    expect(result.outcome).toBe("resubscribed");
    expect(rows[0].status).toBe("subscribed");
  });
  it("requires force for complained", async () => {
    const { db, rows } = memoryDb([row({ status: "complained" })]);
    const blocked = await resubscribeById("id-1", { force: false }, db);
    expect(blocked.outcome).toBe("blocked");
    expect(rows[0].status).toBe("complained");

    const forced = await resubscribeById("id-1", { force: true }, db);
    expect(forced.outcome).toBe("resubscribed");
    expect(rows[0].status).toBe("subscribed");
  });
});
```

- [ ] **Step 6.2: Run to verify failure**

Run: `npx vitest run lib/__tests__/subscribers.test.ts`
Expected: FAIL, cannot resolve `@/lib/subscribers`.

- [ ] **Step 6.3: Implement `lib/subscribers.ts`**

```ts
import {
  decideSubscribeAction,
  isValidEmail,
  normalizeEmail,
  unionTags,
  type SubscribeSource,
  type SubscriberStatus,
} from "@/lib/subscriber-rules";
import { supabaseAdmin } from "@/lib/supabase/admin";

export type SubscriberRow = {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  status: SubscriberStatus;
  source: string;
  tags: string[];
  unsubscribe_token: string;
};

/** Small persistence interface so the rules are testable without Supabase. */
export type SubscriberDb = {
  findByEmail(email: string): Promise<SubscriberRow | null>;
  findByToken(token: string): Promise<SubscriberRow | null>;
  findById(id: string): Promise<SubscriberRow | null>;
  insert(row: {
    email: string;
    first_name: string | null;
    last_name: string | null;
    source: string;
    tags: string[];
  }): Promise<void>;
  updateById(id: string, patch: Partial<SubscriberRow>): Promise<void>;
};

export type SubscribeInput = {
  email: string;
  firstName?: string;
  lastName?: string;
  source: SubscribeSource;
  tags?: string[];
};

export type SubscribeResult = {
  outcome: "created" | "updated" | "resubscribed" | "blocked" | "invalid";
};
export type TokenResult = {
  outcome: "unsubscribed" | "resubscribed" | "blocked" | "not_found";
};

export async function subscribe(
  input: SubscribeInput,
  db: SubscriberDb = liveDb()
): Promise<SubscribeResult> {
  const email = normalizeEmail(input.email ?? "");
  if (!isValidEmail(email)) return { outcome: "invalid" };

  const existing = await db.findByEmail(email);
  const explicit = input.source === "newsletter";
  const action = decideSubscribeAction(existing?.status ?? null, explicit);

  switch (action) {
    case "create":
      await db.insert({
        email,
        first_name: input.firstName?.trim() || null,
        last_name: input.lastName?.trim() || null,
        source: input.source,
        tags: input.tags ?? [],
      });
      return { outcome: "created" };
    case "update":
    case "resubscribe": {
      const patch: Partial<SubscriberRow> = {
        tags: unionTags(existing!.tags, input.tags ?? []),
      };
      if (input.firstName?.trim()) patch.first_name = input.firstName.trim();
      if (input.lastName?.trim()) patch.last_name = input.lastName.trim();
      if (action === "resubscribe") patch.status = "subscribed";
      await db.updateById(existing!.id, patch);
      return { outcome: action === "resubscribe" ? "resubscribed" : "updated" };
    }
    case "blocked":
      return { outcome: "blocked" };
  }
}

export async function unsubscribeByToken(
  token: string,
  db: SubscriberDb = liveDb()
): Promise<TokenResult> {
  const row = await db.findByToken(token);
  if (!row) return { outcome: "not_found" };
  if (row.status !== "unsubscribed") {
    await db.updateById(row.id, { status: "unsubscribed" });
  }
  return { outcome: "unsubscribed" };
}

export async function resubscribeByToken(
  token: string,
  db: SubscriberDb = liveDb()
): Promise<TokenResult> {
  const row = await db.findByToken(token);
  if (!row) return { outcome: "not_found" };
  // Own-token resubscribe is explicit intent, but complained stays blocked:
  // a complaint followed by a token replay is indistinguishable from a bot.
  if (row.status === "complained") return { outcome: "blocked" };
  await db.updateById(row.id, { status: "subscribed" });
  return { outcome: "resubscribed" };
}

export async function resubscribeById(
  id: string,
  opts: { force: boolean },
  db: SubscriberDb = liveDb()
): Promise<TokenResult> {
  const row = await db.findById(id);
  if (!row) return { outcome: "not_found" };
  if (row.status === "complained" && !opts.force) return { outcome: "blocked" };
  await db.updateById(row.id, { status: "subscribed" });
  return { outcome: "resubscribed" };
}

export type ListFilters = {
  search?: string;
  status?: string;
  source?: string;
};

// Admin read path. Goes straight to Supabase rather than through SubscriberDb:
// it needs query composition (ilike, ordering) that a four-method interface
// should not grow, and no business rules live here.
export async function listSubscribers(filters: ListFilters): Promise<SubscriberRow[]> {
  const client = supabaseAdmin();
  let q = client
    .from("subscribers")
    .select(
      "id, email, first_name, last_name, status, source, tags, unsubscribe_token, created_at"
    )
    .order("created_at", { ascending: false })
    .limit(500);
  if (filters.status) q = q.eq("status", filters.status);
  if (filters.source) q = q.eq("source", filters.source);
  if (filters.search) {
    const s = filters.search.replaceAll("%", "").replaceAll(",", "");
    q = q.or(`email.ilike.%${s}%,first_name.ilike.%${s}%,last_name.ilike.%${s}%`);
  }
  const { data, error } = await q;
  if (error) throw error;
  return data as SubscriberRow[];
}

const SELECT_COLUMNS =
  "id, email, first_name, last_name, status, source, tags, unsubscribe_token";

function liveDb(): SubscriberDb {
  const client = supabaseAdmin();
  async function findOne(column: string, value: string) {
    const { data, error } = await client
      .from("subscribers")
      .select(SELECT_COLUMNS)
      .eq(column, value)
      .maybeSingle();
    if (error) throw error;
    return (data as SubscriberRow) ?? null;
  }
  return {
    findByEmail: (email) => findOne("email", email),
    findByToken: (token) => findOne("unsubscribe_token", token),
    findById: (id) => findOne("id", id),
    async insert(row) {
      const { error } = await client.from("subscribers").insert(row);
      if (error) throw error;
    },
    async updateById(id, patch) {
      const { error } = await client.from("subscribers").update(patch).eq("id", id);
      if (error) throw error;
    },
  };
}
```

`SubscriberRow` needs `created_at?: string` added to its type for `listSubscribers`'s select (optional, since `SubscriberDb` reads do not fetch it). In the test file's `memoryDb`, add `findById: async (id) => rows.find((r) => r.id === id) ?? null` alongside the other methods; the Step 6.1 test code already exercises it through `resubscribeById`.

- [ ] **Step 6.4: Run to verify pass**

Run: `npx vitest run lib/__tests__/subscribers.test.ts`
Expected: PASS, all tests.

- [ ] **Step 6.5: Run the whole suite and commit**

```bash
npx vitest run
git add lib/subscribers.ts lib/__tests__/subscribers.test.ts
git commit -m "feat: subscriber write path with injected persistence"
```

---

### Task 7: Rate limiter (TDD)

**Files:**
- Create: `lib/rate-limit.ts`, `lib/__tests__/rate-limit.test.ts`

- [ ] **Step 7.1: Write the failing tests** — `lib/__tests__/rate-limit.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { createRateLimiter } from "@/lib/rate-limit";

describe("createRateLimiter", () => {
  it("allows up to the limit within the window, then refuses", () => {
    const limiter = createRateLimiter({ limit: 3, windowMs: 60_000 });
    const t = 1_000_000;
    expect(limiter.allow("1.2.3.4", t)).toBe(true);
    expect(limiter.allow("1.2.3.4", t + 1)).toBe(true);
    expect(limiter.allow("1.2.3.4", t + 2)).toBe(true);
    expect(limiter.allow("1.2.3.4", t + 3)).toBe(false);
  });
  it("tracks keys independently", () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 60_000 });
    expect(limiter.allow("a", 0)).toBe(true);
    expect(limiter.allow("b", 0)).toBe(true);
  });
  it("resets after the window passes", () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 60_000 });
    expect(limiter.allow("a", 0)).toBe(true);
    expect(limiter.allow("a", 59_999)).toBe(false);
    expect(limiter.allow("a", 60_001)).toBe(true);
  });
});
```

- [ ] **Step 7.2: Run to verify failure** — `npx vitest run lib/__tests__/rate-limit.test.ts` — FAIL, module missing.

- [ ] **Step 7.3: Implement `lib/rate-limit.ts`**

```ts
/**
 * In-memory sliding-window limiter. Per-instance only: on Fluid Compute each
 * warm instance has its own map, so this is best-effort abuse damping, not a
 * hard guarantee. Fine at this site's scale; revisit with a shared store if
 * that ever changes.
 */
export function createRateLimiter({ limit, windowMs }: { limit: number; windowMs: number }) {
  const hits = new Map<string, number[]>();
  return {
    allow(key: string, now: number = Date.now()): boolean {
      const cutoff = now - windowMs;
      const recent = (hits.get(key) ?? []).filter((t) => t > cutoff);
      if (recent.length >= limit) {
        hits.set(key, recent);
        return false;
      }
      recent.push(now);
      hits.set(key, recent);
      return true;
    },
  };
}

/** Shared limiter for /api/subscribe: 5 attempts per 10 minutes per IP. */
export const subscribeLimiter = createRateLimiter({ limit: 5, windowMs: 600_000 });
```

- [ ] **Step 7.4: Run to verify pass, then commit**

```bash
npx vitest run lib/__tests__/rate-limit.test.ts
git add lib/rate-limit.ts lib/__tests__/rate-limit.test.ts
git commit -m "feat: in-memory rate limiter"
```

---

### Task 8: `POST /api/subscribe` (TDD)

**Files:**
- Create: `app/api/subscribe/route.ts`, `app/api/subscribe/__tests__/route.test.ts`

- [ ] **Step 8.1: Write the failing tests** — `app/api/subscribe/__tests__/route.test.ts`:

```ts
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
```

- [ ] **Step 8.2: Run to verify failure** — `npx vitest run app/api/subscribe` — FAIL, module missing.

- [ ] **Step 8.3: Implement `app/api/subscribe/route.ts`**

```ts
import { NextResponse } from "next/server";
import { subscribe } from "@/lib/subscribers";
import { subscribeLimiter } from "@/lib/rate-limit";

const OK = { ok: true };

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!subscribeLimiter.allow(ip)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body.email !== "string") {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  // Honeypot: bots fill every field. Fake success so they learn nothing.
  if (body.website) {
    return NextResponse.json(OK);
  }

  try {
    // source is hardcoded: this endpoint is the explicit signup path and the
    // only source allowed to resurrect unsubscribed/bounced records. Client
    // input must not be able to choose it.
    const result = await subscribe({
      email: body.email,
      firstName: typeof body.firstName === "string" ? body.firstName : undefined,
      lastName: typeof body.lastName === "string" ? body.lastName : undefined,
      source: "newsletter",
    });
    if (result.outcome === "invalid") {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 });
    }
    // created, updated, resubscribed, blocked all look identical from outside.
    return NextResponse.json(OK);
  } catch (error) {
    console.error("subscribe failed", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
```

- [ ] **Step 8.4: Run to verify pass, run full suite, commit**

```bash
npx vitest run
git add app/api/subscribe/
git commit -m "feat: public subscribe endpoint with honeypot and rate limit"
```

---

### Task 9: Wire the four forms and the contact route

**Files:**
- Create: `components/consent-notice.tsx`
- Modify: `components/newsletter-signup.tsx`, `components/contact-form.tsx`, `components/booking-form.tsx`, `components/waitlist-form.tsx`, `app/api/contact/route.ts`

- [ ] **Step 9.1: Create `components/consent-notice.tsx`**

```tsx
import Link from "next/link";
import { CONSENT_NOTICE } from "@/lib/consent";

export function ConsentNotice({ light }: { light?: boolean }) {
  return (
    <p className={`text-[11px] leading-snug ${light ? "text-white/40" : "text-text-light"}`}>
      {CONSENT_NOTICE}{" "}
      <Link href="/terms" className="underline hover:no-underline">
        Terms
      </Link>{" "}
      &middot;{" "}
      <Link href="/privacy" className="underline hover:no-underline">
        Privacy
      </Link>
    </p>
  );
}
```

- [ ] **Step 9.2: Rewrite `components/newsletter-signup.tsx`** — keep the exact visual structure, statuses, and copy of the current file, with these changes: delete the `KIT_FORM_URL` constant and its TODO comment; submit as JSON to `/api/subscribe`; input `name` becomes `email`; add a visually hidden honeypot input; render `<ConsentNotice light={light} />` directly below the form. The `handleSubmit` and form body become:

```tsx
  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("sending");
    const form = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: form.get("email"),
          website: form.get("website"),
        }),
      });
      setStatus(res.ok ? "sent" : "error");
    } catch {
      setStatus("error");
    }
  }
```

and inside the `<form>`, before the email input:

```tsx
          <input
            type="text"
            name="website"
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
            className="absolute -left-[9999px] h-0 w-0 opacity-0"
          />
```

(the email input keeps its styling, `type="email"`, `required`, placeholder, aria-label; only `name` changes from `email_address` to `email`). Add `import { ConsentNotice } from "@/components/consent-notice";` and render `<ConsentNotice light={light} />` after the form/sent block, inside the outer `<div>` with a `mt-2` wrapper.

- [ ] **Step 9.3: Add the notice to the three inquiry forms.** In each of `contact-form.tsx`, `booking-form.tsx`, `waitlist-form.tsx`: add `import { ConsentNotice } from "@/components/consent-notice";` and render it immediately BEFORE the submit `<button>` (directly above the button element inside the form). `waitlist-form.tsx` renders on a dark background: use `<ConsentNotice light />`. The other two use `<ConsentNotice />`. No other changes to these components.

- [ ] **Step 9.4: Modify `app/api/contact/route.ts`.** Replace the `resend.contacts.create` block (the `if (process.env.RESEND_AUDIENCE_ID) { ... }` statement) with:

```ts
    // Side-effect subscribe. Source derived server-side; inquiry sources can
    // never resurrect an unsubscribed record (see lib/subscriber-rules.ts).
    // Must never block the inquiry email that already went to the owner.
    try {
      const { subscribe } = await import("@/lib/subscribers");
      const { deriveContactSource } = await import("@/lib/subscriber-rules");
      const tags = [eventType, skillLevel].filter(
        (t): t is string => typeof t === "string" && t.length > 0
      );
      await subscribe({
        email,
        firstName: firstName || name || undefined,
        lastName: lastName || undefined,
        source: deriveContactSource(body),
        tags,
      });
    } catch (subscribeError) {
      console.error("contact subscribe side effect failed", subscribeError);
    }
```

- [ ] **Step 9.5: Verify** — `npx vitest run` passes, then `npm run build` succeeds, then start `npm run dev` and confirm the homepage newsletter form and footer form render with the notice (a POST will fail without env vars until M3; render is the check here).

- [ ] **Step 9.6: Commit**

```bash
git add components/ app/api/contact/route.ts
git commit -m "feat: route all four forms through the subscriber write path with consent notice"
```

---

### Task 10: Unsubscribe and resubscribe pages

**Files:**
- Create: `app/unsubscribe/page.tsx`, `app/resubscribe/page.tsx`

Both are server components; `searchParams` is a Promise in Next 16. Both are noindex. The GET mutation tradeoff is deliberate per spec: do not add a confirm step.

- [ ] **Step 10.1: Create `app/unsubscribe/page.tsx`**

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { unsubscribeByToken } from "@/lib/subscribers";

export const metadata: Metadata = {
  title: "Unsubscribe | Rack in the Rockies",
  robots: { index: false, follow: false },
};

export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const result = token
    ? await unsubscribeByToken(token)
    : ({ outcome: "not_found" } as const);

  return (
    <main className="min-h-[60vh] flex items-center justify-center px-6">
      <div className="max-w-md text-center">
        {result.outcome === "unsubscribed" ? (
          <>
            <h1 className="font-display text-2xl font-bold text-text-dark mb-2">
              You&apos;re unsubscribed
            </h1>
            <p className="text-sm text-text-mid mb-4">
              You won&apos;t hear from us again. No hard feelings, and thanks
              for playing.
            </p>
            <p className="text-xs text-text-light">
              Changed your mind?{" "}
              <Link
                href={`/resubscribe?token=${encodeURIComponent(token!)}`}
                className="underline hover:no-underline"
              >
                Resubscribe
              </Link>
            </p>
          </>
        ) : (
          <>
            <h1 className="font-display text-2xl font-bold text-text-dark mb-2">
              We couldn&apos;t find that subscription
            </h1>
            <p className="text-sm text-text-mid">
              The link may be incomplete. If you keep getting email you
              don&apos;t want, write to us and we&apos;ll take care of it.
            </p>
          </>
        )}
      </div>
    </main>
  );
}
```

- [ ] **Step 10.2: Create `app/resubscribe/page.tsx`**

```tsx
import type { Metadata } from "next";
import { resubscribeByToken } from "@/lib/subscribers";

export const metadata: Metadata = {
  title: "Resubscribe | Rack in the Rockies",
  robots: { index: false, follow: false },
};

export default async function ResubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const result = token
    ? await resubscribeByToken(token)
    : ({ outcome: "not_found" } as const);

  const copy =
    result.outcome === "resubscribed"
      ? {
          h: "Welcome back!",
          p: "You're on the list again. See you at the next event.",
        }
      : {
          h: "We couldn't resubscribe you",
          p: "The link may be incomplete, or this address needs a hand from us. Write to hello@rackintherockies.com and we'll sort it out.",
        };

  return (
    <main className="min-h-[60vh] flex items-center justify-center px-6">
      <div className="max-w-md text-center">
        <h1 className="font-display text-2xl font-bold text-text-dark mb-2">{copy.h}</h1>
        <p className="text-sm text-text-mid">{copy.p}</p>
      </div>
    </main>
  );
}
```

Note the `blocked` outcome intentionally renders the same neutral copy as `not_found`: no oracle, and complained recovery routes through a human.

- [ ] **Step 10.3: Verify and commit** — `npm run build` passes.

```bash
git add app/unsubscribe/ app/resubscribe/
git commit -m "feat: unsubscribe and resubscribe pages"
```

---

### Task 11: Auth plumbing

**Files:**
- Create: `lib/supabase/proxy.ts`, `proxy.ts`, `app/auth/confirm/route.ts`, `app/admin/login/page.tsx`, `app/admin/login/actions.ts`, `lib/auth.ts`

Before writing, skim `node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md` and `02-guides/authentication.md`. Next 16 uses `proxy.ts` at the project root with a named `proxy` export.

- [ ] **Step 11.1: Create `lib/supabase/proxy.ts`**

```ts
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/** Refreshes the auth session cookie on /admin requests. */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh tokens; role checks happen in requireAdmin, not here.
  await supabase.auth.getClaims();
  return response;
}
```

- [ ] **Step 11.2: Create `proxy.ts`** (project root)

```ts
import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: ["/admin/:path*"],
};
```

- [ ] **Step 11.3: Create `app/auth/confirm/route.ts`**

```ts
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { supabaseServer } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/admin";

  if (token_hash && type) {
    const supabase = await supabaseServer();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (!error) {
      redirect(next.startsWith("/") ? next : "/admin");
    }
  }
  redirect("/admin/login?error=link");
}
```

- [ ] **Step 11.4: Create `app/admin/login/actions.ts`**

```ts
"use server";

import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { isValidEmail, normalizeEmail } from "@/lib/subscriber-rules";

export async function sendMagicLink(formData: FormData) {
  const email = normalizeEmail(String(formData.get("email") ?? ""));
  if (!isValidEmail(email)) {
    redirect("/admin/login?error=email");
  }
  const supabase = await supabaseServer();
  // shouldCreateUser false: signups are closed; only invited users get links.
  await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: false },
  });
  // Always claim success: this page must not reveal which emails have accounts.
  redirect("/admin/login?sent=1");
}
```

- [ ] **Step 11.5: Create `app/admin/login/page.tsx`**

```tsx
import type { Metadata } from "next";
import { sendMagicLink } from "@/app/admin/login/actions";

export const metadata: Metadata = {
  title: "Admin Login | Rack in the Rockies",
  robots: { index: false, follow: false },
};

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; error?: string }>;
}) {
  const { sent, error } = await searchParams;

  return (
    <main className="min-h-[60vh] flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <h1 className="font-display text-2xl font-bold text-text-dark mb-1">Admin</h1>
        <p className="text-sm text-text-mid mb-4">
          Enter your email and we&apos;ll send you a sign-in link.
        </p>
        {sent ? (
          <p className="text-sm font-semibold text-tangerine">
            If that address has access, a link is on its way. Check your inbox.
          </p>
        ) : (
          <form action={sendMagicLink} className="space-y-3">
            <input
              name="email"
              type="email"
              required
              placeholder="you@email.com"
              aria-label="Email address"
              className="w-full px-4 py-2.5 rounded-xl border border-coral/10 bg-warm-white text-sm text-text-dark placeholder:text-text-light focus:outline-none focus:border-coral/30 focus:ring-1 focus:ring-coral/20"
            />
            <button
              type="submit"
              className="w-full bg-gradient-to-r from-coral to-tangerine text-white py-2.5 rounded-pill text-sm font-semibold transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-coral/30"
            >
              Send Link
            </button>
          </form>
        )}
        {error === "link" && (
          <p className="text-xs text-red-500 mt-2">
            That link didn&apos;t work. It may have expired, request a new one.
          </p>
        )}
        {error === "email" && (
          <p className="text-xs text-red-500 mt-2">Please enter a valid email.</p>
        )}
      </div>
    </main>
  );
}
```

- [ ] **Step 11.6: Create `lib/auth.ts`**

```ts
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * Verifies the session AND the admin role. Must be called by every admin
 * page AND every admin server action: the layout check only protects
 * rendering, actions are directly invokable via POST.
 *
 * Role comes from public.profiles, never from user_metadata (self-editable).
 */
export async function requireAdmin(): Promise<{ userId: string }> {
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

  return { userId };
}
```

- [ ] **Step 11.7: Verify and commit** — `npm run build` passes (proxy compiles, routes build).

```bash
git add proxy.ts lib/supabase/proxy.ts lib/auth.ts app/auth/ app/admin/login/
git commit -m "feat: magic link auth with profiles-based admin gate"
```

---

### Task 12: Admin portal

**Files:**
- Create: `app/admin/layout.tsx`, `app/admin/page.tsx`, `app/admin/actions.ts`

- [ ] **Step 12.1: Create `app/admin/actions.ts`**

```ts
"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { resubscribeById } from "@/lib/subscribers";
import { supabaseServer } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export async function adminResubscribe(formData: FormData) {
  // Re-verify here: server actions are invokable without the layout running.
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const force = formData.get("force") === "true";
  if (id) {
    await resubscribeById(id, { force });
  }
  revalidatePath("/admin");
}

export async function signOut() {
  const supabase = await supabaseServer();
  await supabase.auth.signOut();
  redirect("/admin/login");
}
```

- [ ] **Step 12.2: Create `app/admin/layout.tsx`**

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { signOut } from "@/app/admin/actions";

export const metadata: Metadata = {
  title: "Admin | Rack in the Rockies",
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return (
    <div className="min-h-screen bg-warm-white">
      <header className="border-b border-coral/10 px-6 py-3 flex items-center justify-between">
        <Link href="/admin" className="font-display font-bold text-text-dark">
          RITR Admin
        </Link>
        <form action={signOut}>
          <button type="submit" className="text-xs text-text-mid underline hover:no-underline">
            Sign out
          </button>
        </form>
      </header>
      <div className="px-6 py-6 max-w-5xl mx-auto">{children}</div>
    </div>
  );
}
```

**Gotcha:** the login page must NOT live under this layout's `requireAdmin` or nobody can ever log in. `app/admin/login/page.tsx` from Task 11 would inherit `app/admin/layout.tsx`. Fix by route groups: move gated pages to `app/admin/(gated)/layout.tsx` + `app/admin/(gated)/page.tsx`, leaving `app/admin/login/` outside the group. Apply that structure now: create `app/admin/(gated)/layout.tsx` (content above) and put the list page at `app/admin/(gated)/page.tsx`; there is no `app/admin/layout.tsx`. URLs are unchanged (`/admin`, `/admin/login`).

- [ ] **Step 12.3: Create `app/admin/(gated)/page.tsx`**

```tsx
import { listSubscribers, type SubscriberRow } from "@/lib/subscribers";
import { adminResubscribe } from "@/app/admin/actions";

const STATUSES = ["subscribed", "unsubscribed", "bounced", "complained"] as const;
const SOURCES = [
  "newsletter",
  "contact",
  "booking",
  "trips-waitlist",
  "import",
  "resend-migration",
] as const;

export default async function AdminSubscribersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; source?: string }>;
}) {
  const { q, status, source } = await searchParams;
  const rows = await listSubscribers({ search: q, status, source });

  const counts = new Map<string, number>();
  for (const row of rows) counts.set(row.status, (counts.get(row.status) ?? 0) + 1);

  return (
    <main>
      <h1 className="font-display text-xl font-bold text-text-dark mb-1">Subscribers</h1>
      <p className="text-xs text-text-mid mb-4">
        {rows.length} shown
        {STATUSES.filter((s) => counts.get(s)).map(
          (s) => ` · ${counts.get(s)} ${s}`
        )}
      </p>

      <form className="flex flex-wrap gap-2 mb-4" method="GET">
        <input
          name="q"
          defaultValue={q ?? ""}
          placeholder="Search email or name"
          className="px-3 py-2 rounded-xl border border-coral/10 bg-white text-sm"
        />
        <select name="status" defaultValue={status ?? ""} className="px-3 py-2 rounded-xl border border-coral/10 bg-white text-sm">
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select name="source" defaultValue={source ?? ""} className="px-3 py-2 rounded-xl border border-coral/10 bg-white text-sm">
          <option value="">All sources</option>
          {SOURCES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <button type="submit" className="px-4 py-2 rounded-pill bg-text-dark text-white text-sm font-semibold">
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
            {rows.map((row) => (
              <SubscriberTr key={row.id} row={row} />
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-text-mid">
                  No subscribers match.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}

function SubscriberTr({ row }: { row: SubscriberRow }) {
  const canResubscribe = row.status === "unsubscribed" || row.status === "bounced";
  const isComplained = row.status === "complained";
  return (
    <tr className="border-b border-coral/5 last:border-0">
      <td className="px-4 py-2">{row.email}</td>
      <td className="px-4 py-2">{[row.first_name, row.last_name].filter(Boolean).join(" ")}</td>
      <td className="px-4 py-2">{row.status}</td>
      <td className="px-4 py-2">{row.source}</td>
      <td className="px-4 py-2 text-xs text-text-mid">{row.tags.join(", ")}</td>
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

The `complained` warning is the `title` text plus red styling; a JS confirm dialog would need a client component and adds little over the explicit "Force resubscribe" label. `listSubscribers` needs `created_at` in `SubscriberRow` if the table shows signup date; add the column to the type and the select in Task 6's `listSubscribers` if not already present, or omit the date column. Keep whichever is consistent with what Task 6 shipped.

- [ ] **Step 12.4: Move login-page files if needed and verify** — confirm final structure: `app/admin/login/page.tsx`, `app/admin/login/actions.ts`, `app/admin/actions.ts`, `app/admin/(gated)/layout.tsx`, `app/admin/(gated)/page.tsx`. Run `npm run build`: all routes compile, `/admin` and `/admin/login` both appear.

- [ ] **Step 12.5: Commit**

```bash
git add app/admin/
git commit -m "feat: admin subscriber list with role-gated resubscribe actions"
```

---

### Task 13: Compliance pages, footer, sitemap, robots

**Files:**
- Create: `app/terms/page.tsx`, `app/privacy/page.tsx`
- Modify: `components/footer.tsx`, `app/sitemap.ts`, `app/robots.ts`

- [ ] **Step 13.1: Create `app/terms/page.tsx`**

```tsx
import type { Metadata } from "next";
import { BUSINESS_EMAIL, BUSINESS_LOCATION, BUSINESS_NAME } from "@/lib/business";

export const metadata: Metadata = {
  title: "Terms of Use | Rack in the Rockies",
  description: "Terms of use for the Rack in the Rockies website.",
};

export default function TermsPage() {
  return (
    <main className="max-w-2xl mx-auto px-6 py-12 space-y-6">
      <h1 className="font-display text-3xl font-bold text-text-dark">Terms of Use</h1>
      <p className="text-xs text-text-light">Last updated: July 30, 2026</p>

      <section className="space-y-2">
        <h2 className="font-display text-lg font-bold text-text-dark">Who we are</h2>
        <p className="text-sm text-text-mid">
          {BUSINESS_NAME} is a mahjong events and retail business based in {BUSINESS_LOCATION}.
          You can reach us anytime at {BUSINESS_EMAIL}.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="font-display text-lg font-bold text-text-dark">Using this site</h2>
        <p className="text-sm text-text-mid">
          This site exists to share our events, products, and services. You agree
          to use it for its intended purpose and not to interfere with its
          operation, attempt to access non-public areas, or submit false
          information through our forms.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="font-display text-lg font-bold text-text-dark">Email communications</h2>
        <p className="text-sm text-text-mid">
          When you submit a form on this site, you agree to receive emails from
          us: event announcements, updates, and replies to your inquiries. Every
          announcement email we send includes an unsubscribe link, and
          unsubscribing takes one click. Requesting a booking or contacting us
          does not re-add you to our list if you have previously unsubscribed.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="font-display text-lg font-bold text-text-dark">Bookings and events</h2>
        <p className="text-sm text-text-mid">
          Booking inquiries submitted through this site are requests, not
          confirmed reservations. We confirm every booking personally by email.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="font-display text-lg font-bold text-text-dark">Changes</h2>
        <p className="text-sm text-text-mid">
          We may update these terms as the business grows. The date above tells
          you when they last changed. Questions? Write to {BUSINESS_EMAIL}.
        </p>
      </section>
    </main>
  );
}
```

- [ ] **Step 13.2: Create `app/privacy/page.tsx`**

```tsx
import type { Metadata } from "next";
import { BUSINESS_EMAIL, BUSINESS_LOCATION, BUSINESS_NAME } from "@/lib/business";

export const metadata: Metadata = {
  title: "Privacy Policy | Rack in the Rockies",
  description: "How Rack in the Rockies handles your information.",
};

export default function PrivacyPage() {
  return (
    <main className="max-w-2xl mx-auto px-6 py-12 space-y-6">
      <h1 className="font-display text-3xl font-bold text-text-dark">Privacy Policy</h1>
      <p className="text-xs text-text-light">Last updated: July 30, 2026</p>

      <section className="space-y-2">
        <h2 className="font-display text-lg font-bold text-text-dark">What we collect</h2>
        <p className="text-sm text-text-mid">
          When you sign up for news or send us an inquiry, we collect what you
          type into the form: your name, email address, and details about the
          event you are asking about. That is the extent of it. We do not buy
          data about you, and we do not use advertising trackers.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="font-display text-lg font-bold text-text-dark">What we do with it</h2>
        <p className="text-sm text-text-mid">
          We use your email address to reply to you and, if you agreed when
          submitting, to send occasional event announcements. We tag records
          with basics like how you found us and what you were interested in, so
          our announcements stay relevant.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="font-display text-lg font-bold text-text-dark">Who else sees it</h2>
        <p className="text-sm text-text-mid">
          Your information is stored with our database provider (Supabase) and
          our email delivery provider (Resend), which process it on our behalf.
          We never sell your information, and we never share it with anyone
          else.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="font-display text-lg font-bold text-text-dark">Your choices</h2>
        <p className="text-sm text-text-mid">
          Every announcement email includes a one-click unsubscribe link. If you
          would like your information corrected or deleted entirely, email us at{" "}
          {BUSINESS_EMAIL} and we will take care of it.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="font-display text-lg font-bold text-text-dark">Contact</h2>
        <p className="text-sm text-text-mid">
          {BUSINESS_NAME}, {BUSINESS_LOCATION}. {BUSINESS_EMAIL}.
        </p>
      </section>
    </main>
  );
}
```

- [ ] **Step 13.3: Modify `components/footer.tsx`** — in the `columns` array, add to the "Connect" column's `links`:

```ts
      { href: "/terms", label: "Terms" },
      { href: "/privacy", label: "Privacy" },
```

- [ ] **Step 13.4: Modify `app/sitemap.ts`** — append to the returned array:

```ts
    { url: `${baseUrl}/terms`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.2 },
    { url: `${baseUrl}/privacy`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.2 },
```

- [ ] **Step 13.5: Modify `app/robots.ts`** — read the existing file first; add (or merge into) the rules so `/admin`, `/unsubscribe`, and `/resubscribe` are disallowed:

```ts
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/unsubscribe", "/resubscribe", "/api"],
    },
```

- [ ] **Step 13.6: Verify and commit** — `npm run build` passes; `/terms` and `/privacy` render.

```bash
git add app/terms/ app/privacy/ components/footer.tsx app/sitemap.ts app/robots.ts
git commit -m "feat: terms and privacy pages, footer links, robots exclusions"
```

---

### Task 14: Full verification

- [ ] **Step 14.1: Full test suite** — `npx vitest run` — all green.
- [ ] **Step 14.2: Lint** — `npm run lint` — clean (fix anything it flags).
- [ ] **Step 14.3: Build** — `npm run build` — clean.
- [ ] **Step 14.4: Copy check** — `grep -rn '—\|–' components/ app/ lib/ --include='*.tsx' --include='*.ts'` returns nothing (AGENTS.md rule).
- [ ] **Step 14.5: If M1-M3 are done**, run the end-to-end smoke: `npm run dev`, submit the homepage newsletter form with a test address, confirm the row in Supabase (`select email, status, source from subscribers`), visit `/unsubscribe?token=<its token>`, confirm status flips, resubscribe via the link, confirm again. Log in at `/admin/login` (after M4-M6) and confirm the list renders and filters.
- [ ] **Step 14.6: Report** — state plainly which verifications ran and which are blocked on manual prerequisites. Do not claim the auth flow works until M4-M6 exist and Step 14.5 has actually been performed.
- [ ] **Step 14.7: Commit any fixes, then final commit if needed**

---

## Self-review notes (already applied)

- Spec coverage checked section by section: data model (Task 2), write path and matrix (Tasks 4, 6), api/subscribe hardening (Task 8), form wiring and consent (Tasks 3, 9), unsubscribe/resubscribe (Task 10), auth and admin including the action-level `requireAdmin` (Tasks 11, 12), compliance pages (Task 13), migrations (manual M7 by design, per spec), env vars (Task 5).
- Known intentional deviations from a naive reading of the spec: `spec says "lib/subscribers.ts" holds the rules` — the pure decision logic lives in `lib/subscriber-rules.ts` with `lib/subscribers.ts` as the orchestrator; this is a split for testability, both files together are "the single write path". The admin `complained` warning is a labeled destructive-styled control rather than a modal dialog.
- Type consistency: `SubscriberRow`, `SubscriberDb`, `SubscribeResult`, `TokenResult` defined once in Task 6 and imported everywhere; `SubscribeSource` from Task 4 used by Task 6 and Task 9.
