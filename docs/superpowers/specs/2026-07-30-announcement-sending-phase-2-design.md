# Announcement Sending, Phase 2

Date: 2026-07-30
Status: Approved pending Tyler's spec review
Branch: `claude/xenodochial-swanson-a60d1c`
Builds on: `docs/superpowers/specs/2026-07-30-subscriber-management-phase-1-design.md`

## Problem

Phase 1 collects and manages subscribers but sends nothing. The site owner
(Annie, non-technical) has no way to announce an event to the list. Phase 2
makes sending possible, safely: delivery hygiene first, then a constrained
composer, a tracked send pipeline, and a send history.

Tyler's admin cleanup list, gathered during brainstorming, folds in here: tag
filtering and tag editing in the admin (tags matter more than sources for
choosing an audience), list pagination, CSV export, and general UI polish
before Annie is onboarded.

## Goals

- Bounce and complaint webhooks from Resend write back to `subscribers.status`
  before the first real send ever happens
- `List-Unsubscribe` and `List-Unsubscribe-Post` (RFC 8058 one-click) headers
  on every announcement email
- A compliant footer on every announcement: attribution line, unsubscribe link,
  business name and physical mailing address
- A template-based composer at `/admin/compose`: event announcement and general
  update templates, structured fields, one-click prefill from the featured
  event, live preview, test send to self
- Audience selection: all subscribed, or filtered by tags, with a visible
  recipient count before sending
- A batched, rate-limit-respecting send pipeline through Resend with retry on
  transient failure and a resume path for partial sends
- A `sends` history at `/admin/sends` with per-send delivery, bounce, and
  complaint counts
- Admin list improvements: filter by tag, add and remove tags per subscriber,
  pagination past the current 500 cap, CSV export, friendlier UI

## Non-goals

- A drag and drop or freeform email editor. Fixed templates are a deliberate
  Phase 1 decision, reaffirmed here.
- Open and click tracking. Resend offers both; neither changes what Annie would
  do next, and both add tracking domains to every link.
- Scheduled sends (`scheduled_at`). Sends happen when the button is pressed.
- Saved drafts. The composer is a single sitting; prefill makes re-entry cheap.
- Automations, sequences, A/B tests, segments beyond tag filters.
- Queue or cron infrastructure. The inline pipeline below is sized to this
  list (hundreds of addresses). Revisit only past roughly 10k subscribers.
- Auto-resurrecting `complained` subscribers, in any flow. Unchanged hard rule.
- Editing or re-sending a completed send. A new announcement is a new send.

## Context and decisions

**Why inline batched sending and not a queue.** The Send action runs the whole
pipeline inside one server action: snapshot recipients, then one Resend batch
call per 100 recipients, writing outcomes as it goes. A 1,000-recipient send is
10 API calls, finishing in seconds, far inside the 300s function limit. Chosen
over a cron-drained queue for zero new infrastructure and immediate feedback in
the composer. The failure mode (function dies mid-send) is covered by the
resume path, not by a queue.

**Why per-recipient rendering.** Every email embeds that recipient's
`unsubscribe_token` in both the footer link and the `List-Unsubscribe` header,
so HTML is rendered per recipient. Resend's batch endpoint accepts fully
distinct emails per entry, so this costs nothing extra.

**Idempotency.** Every batch call carries an `Idempotency-Key` of
`send-<sendId>-chunk-<n>`, stable across retries. A retried or resumed chunk
whose original call actually succeeded is deduplicated by Resend (keys live 24
hours), so retry and resume are safe against double delivery within a send.
For a reused key to be valid its payload must be identical to the original
call, so chunk membership is assigned once, at snapshot time, and stored on
each recipient row (`chunk_index`). Resume regroups by stored chunk, never by
re-chunking whatever happens to be left, which keeps every reused key paired
with its original payload.
Double-clicking Send twice would create two distinct send rows and is prevented
in the UI by an explicit confirmation step and a disabled in-flight button, not
by idempotency keys. Accepted residual risk at this scale.

**The mailing address guard.** CAN-SPAM requires a physical mailing address in
every announcement. Tyler has not supplied one yet (Phase 1 plan, M8), so
`lib/business.ts` gains `BUSINESS_MAILING_ADDRESS: string | null`, currently
`null`. While it is null, real sends are refused, server-side, with a clear
message in the composer telling Tyler exactly what to do. Test sends to self
still work and render a visible `[Mailing address not set]` placeholder in the
footer so the gap is impossible to miss. Filling in the constant is the entire
unblock; no schema or code change.

**Webhook status writes respect the Phase 1 rules.** `complained` outranks
everything and is never downgraded. A bounce only moves `subscribed` to
`bounced`; it never touches `unsubscribed` or `complained`. All status writes
go through `lib/subscribers.ts`, which stays the single write path.

**Admin tag editing may remove tags.** Phase 1's "tags are unioned, never
replaced" rule exists so automated form writes cannot erase each other. It
stays fully in force for those paths. A human admin is authoritative: the admin
UI can add and remove tags, otherwise typos are permanent.

**Tag audience semantics.** Filtering by multiple tags matches subscribers
having ANY of the selected tags, in the admin list and in audience selection
alike. "Any" is what "send this to the booking folks and the trips folks"
means; requiring ALL tags would silently select almost nobody.

**Palette duplication is deliberate.** Email clients cannot read
`app/globals.css`, so `emails/theme.ts` mirrors the site tokens (coral
`#FF6B6B`, tangerine `#FF8E53`, golden `#FFC857`, blush `#FFE8E0`, cream
`#FFF9F5`, warm white `#FFFCFA`, text colors) as plain constants with a comment
pointing at the source of truth. Fonts fall back to email-safe stacks: Georgia
for display, system sans for body.

## Data model

One new migration (via `supabase migration new`), two tables plus one index on
an existing table. RLS enabled on both new tables with no policies and no
grants to `anon` or `authenticated`, exactly like `subscribers`: all access is
server-side through the secret key, and the tables fail closed.

### `public.sends`

One row per real send. Test sends do not create rows.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` primary key | default `gen_random_uuid()` |
| `template` | `text` not null | `event-announcement` or `general-update` |
| `subject` | `text` not null | as sent |
| `fields` | `jsonb` not null | the structured composer fields, as rendered |
| `audience` | `jsonb` not null | filter snapshot, e.g. `{"tags": ["booking"]}` or `{"tags": []}` for all subscribed |
| `status` | `text` not null | `sending`, `sent`, `partial`, `failed` |
| `total_count` | `integer` not null | recipients snapshotted at send time |
| `sent_count` | `integer` not null default 0 | accepted by Resend, written by the pipeline |
| `failed_count` | `integer` not null default 0 | gave up after retries, written by the pipeline |
| `created_by` | `uuid` not null | FK to `public.profiles(id)` |
| `created_at` | `timestamptz` not null | default `now()` |
| `completed_at` | `timestamptz` | null while `sending` |

`status` meanings: `sending` is in progress (or died mid-flight; see resume),
`sent` means every recipient was accepted by Resend, `partial` means some
recipients failed after retries, `failed` means none succeeded.

Only the pipeline, a single writer, updates `sent_count` and `failed_count`.
Delivered, bounced, and complained counts are NOT stored on `sends`: webhooks
arrive concurrently, and read-modify-write counters would lose updates. Those
counts are computed from `send_recipients` statuses at read time, where they
are always consistent with the rows beneath them.

### `public.send_recipients`

One row per recipient per send, snapshotted when Send is pressed.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` primary key | default `gen_random_uuid()` |
| `send_id` | `uuid` not null | FK to `public.sends(id)` on delete cascade |
| `subscriber_id` | `uuid` not null | FK to `public.subscribers(id)` on delete cascade |
| `email` | `text` not null | snapshot at send time |
| `chunk_index` | `integer` not null | batch chunk assigned at snapshot time; see Idempotency |
| `resend_email_id` | `text` | Resend's id, set when the batch call returns |
| `status` | `text` not null default `pending` | `pending`, `sent`, `failed`, `delivered`, `bounced`, `complained` |
| `error` | `text` | last failure detail, server-side only |
| `updated_at` | `timestamptz` not null | maintained by trigger |

Unique on `(send_id, subscriber_id)`. Index on `resend_email_id` (webhook
lookup) and on `send_id`.

Recipient `status` progresses `pending` to `sent` when Resend accepts, then to
`delivered`, `bounced`, or `complained` as webhooks arrive. `failed` is
terminal for pipeline failures. Webhook updates are idempotent writes; svix
retries the same event harmlessly.

### `public.subscribers`

No schema change. Add a GIN index on `tags` to support tag filtering.

## Architecture

```
/admin/compose ──▶ preview (server render) ──▶ test send to self
      │
      ▼ Send (server action, requireAdmin + address guard)
snapshot audience ──▶ send_recipients rows ──▶ chunks of 100
      │                                            │
      ▼                                            ▼
   sends row                          resend.batch.send + headers
                                                   │ email ids
                                                   ▼
Resend ──▶ POST /api/webhooks/resend ──▶ send_recipients outcome
                    │              (counts derived at read time)
                    ▼
        lib/subscribers.ts status write-back (bounced / complained)

/admin/sends, /admin/sends/[id] ──▶ history, per-recipient outcomes, Resume
```

New modules, following the Phase 1 pattern of pure rules plus an injectable
boundary:

- `lib/send-rules.ts`: pure functions. Chunking, retry/backoff decisions,
  webhook event to status-transition mapping, audience filter to query terms,
  idempotency key construction. Fully unit-tested, no I/O.
- `lib/sends.ts`: orchestrator. `createSend`, `runSend`, `resumeSend`,
  `listSends`, `getSend`. Takes an injectable `SendDb` (persistence) and
  `EmailSender` (Resend adapter) so the pipeline is testable with fakes,
  mirroring `SubscriberDb`.
- `lib/subscribers.ts` additions: `markBounced(email)`, `markComplained(email)`
  implementing the status rules above; `listTags()` for the tag pickers;
  `listSubscribers` grows tag filtering and pagination (offset plus total
  count); `countAudience(filter)` for the composer's recipient count.
- `emails/`: React Email templates. `theme.ts` (palette constants),
  `layout.tsx` (shared shell and footer), `event-announcement.tsx`,
  `general-update.tsx`, `render.ts` (template plus fields plus recipient to
  final HTML and subject).

## Components

### Webhook: `POST /api/webhooks/resend`

- Verifies the svix signature with the Resend SDK's `resend.webhooks.verify`
  against the raw request body and `RESEND_WEBHOOK_SECRET`. Invalid signature:
  401, no processing. This endpoint is otherwise public; the signature is the
  only authentication.
- Handles `email.bounced`, `email.complained`, `email.delivered`. Any other
  event type returns 200 unprocessed, so enabling extra events in the Resend
  dashboard cannot break the endpoint.
- Recipient rows are found by `resend_email_id`. Subscriber status write-back
  goes by the event's recipient email through `lib/subscribers.ts`. An event
  that matches no recipient row (for example a bounce on a transactional
  contact-form email) still applies the subscriber status write-back if the
  email is on the list, and is otherwise a 200 no-op.
- Bounce handling distinguishes permanent from transient using the bounce
  detail in the payload. Only permanent bounces set subscriber status
  `bounced`; transient bounces record the recipient-row outcome but leave the
  subscriber alone. The exact payload field is confirmed against Resend's
  current docs at implementation time.
- Always returns quickly; no long work in the handler.

### Unsubscribe headers and one-click endpoint

Every announcement email includes:

- `List-Unsubscribe: <https://rackintherockies.com/api/unsubscribe?token=...>`
- `List-Unsubscribe-Post: List-Unsubscribe=One-Click`

New route `app/api/unsubscribe/route.ts`:

- `POST` is the RFC 8058 one-click target: unsubscribes by token via the
  existing `unsubscribeByToken`, returns 200 with no body. No confirmation
  step, by design.
- `GET` redirects to `/unsubscribe?token=...`, the existing human-facing page,
  for any client that opens the header URL directly.

The human-facing footer link continues to point at `/unsubscribe?token=...`
(the page), unchanged from Phase 1.

### Email templates

Two templates sharing one layout shell (brand header, content area, footer).
Rendered with React Email components and inline styles from `emails/theme.ts`.

**Event announcement** fields: subject, preheader (optional), headline, date
label, time (optional), location, intro paragraph, sessions (repeating name /
time / price rows, optional), CTA label and URL, closing note (optional).

**General update** fields: subject, preheader (optional), headline (optional),
body paragraphs (textarea, split on blank lines), CTA label and URL (optional).

Footer, on every announcement:

- Attribution: "You are receiving this because you signed up for event
  announcements from Rack in the Rockies."
- Unsubscribe link (per-recipient token)
- `BUSINESS_NAME`, `BUSINESS_MAILING_ADDRESS` (or the placeholder in test
  sends while null)

Copy rule: no em dashes, no en dashes anywhere in template output (AGENTS.md).
Time ranges use a hyphen, matching the site.

### Composer: `/admin/compose`

Server-rendered page with a client form component. Flow, in one screen:

1. Template picker (two cards: Event announcement, General update)
2. Structured fields for the chosen template. For the event template, a
   "Prefill from featured event" button loads `data/featured-event.ts` values
   (title, date label, location, blurb, sessions, signup URL) into the fields;
   everything stays editable.
3. Live preview: debounced server action renders the current fields through
   the real template (with a sample recipient token) and returns HTML shown in
   a sandboxed iframe via `srcDoc`. What Annie sees is byte-for-byte what
   sends, minus the per-recipient token.
4. Test send to self: sends one email to the logged-in admin's address,
   subject prefixed `[Test]`, through the same rendering and the same Resend
   send path. Creates no `sends` row. Allowed while the mailing address is
   null (placeholder shows in footer).
5. Audience: "Everyone subscribed" or "Only these tags" with a multi-select of
   existing tags. A live recipient count ("Will send to 214 people") always
   shows, computed server-side from `status = 'subscribed'` plus the tag
   filter.
6. Send: an explicit confirmation ("Send to 214 people? This cannot be
   undone.") then the pipeline runs. The button disables while in flight and
   the result (sent / partial with resume link) shows on completion.

Server actions (`sendAnnouncement`, `sendTest`, `previewAnnouncement`,
`countRecipients`) each call `requireAdmin()` first, per the Phase 1 rule that
the layout only protects rendering. `sendAnnouncement` also enforces the
mailing address guard server-side; the disabled UI button is not the control.

Field validation is server-side: subject and required template fields
non-empty, CTA URL must be `https?://`. The composer shows plain-language
errors; Annie is the audience.

### Send pipeline

Inside `sendAnnouncement`:

1. `requireAdmin`, address guard, field validation.
2. Snapshot the audience: select matching subscribers (`subscribed` plus tag
   filter), insert the `sends` row (`status: 'sending'`, `total_count`) and
   all `send_recipients` rows (`pending`). An empty audience is rejected
   before any row is created.
3. Chunk recipients 100 per batch. For each chunk: render each recipient's
   HTML, call `resend.batch.send` with per-email `List-Unsubscribe` headers
   and the chunk's idempotency key. Throttle to respect Resend's default 2
   requests per second. On success, write each recipient's `resend_email_id`
   and `status: 'sent'`, increment `sent_count`.
4. Transient failure (429 or 5xx): exponential backoff, up to 3 attempts per
   chunk, same idempotency key. Persistent failure: mark the chunk's
   recipients `failed` with the error, increment `failed_count`, continue with
   the next chunk. One bad chunk must not strand the rest of the list.
5. Finish: set `status` to `sent` (no failures), `partial` (some), or `failed`
   (all), and `completed_at`.

**Resume.** `/admin/sends/[id]` shows a Resume button whenever a send has
`pending` or `failed` recipients (covers both partial failures and a function
death mid-send that left `status: 'sending'`). Resume re-runs the pipeline
over only those recipients, with the same idempotency keys for unfinished
chunks, so a chunk that actually succeeded before the crash is not delivered
twice within the 24 hour key window.

### Send history: `/admin/sends` and `/admin/sends/[id]`

- List: date, subject, template, audience summary ("All subscribed" or the tag
  list), status, and counts: total, sent, failed, delivered, bounced,
  complained. Newest first.
- Detail: the send's fields summary, the counts, and the per-recipient table
  showing email and status only (raw error text stays in the database and
  server logs), plus Resume when applicable.
- Admin header nav gains: Subscribers, Compose, Sends.

### Admin list improvements

On `/admin` (subscriber list):

- **Tag filter**: multi-select of existing tags (ANY semantics), promoted to
  the primary filter position. Source filter remains, demoted visually.
- **Tag editing**: per row, add a tag (free text with suggestions from
  existing tags) and remove a tag. Server actions behind `requireAdmin`.
- **Pagination**: 100 per page with page controls and a true total count,
  replacing the silent newest-500 cap.
- **CSV export**: a route handler streaming the current filtered view
  (email, first name, last name, status, source, tags, created date) as CSV.
  Calls `requireAdmin()` itself; route handlers bypass layouts.
- **Polish**: status badges with color, readable empty states, mobile-friendly
  table, plain-language labels. No redesign, just finish.

## Environment variables

Added to `.env.local.example` and Vercel:

- `RESEND_WEBHOOK_SECRET`, server only. From the Resend dashboard when the
  webhook endpoint is created.

## Manual prerequisites (Tyler)

- **P1.** Supply the full physical mailing address and set
  `BUSINESS_MAILING_ADDRESS` in `lib/business.ts`. Real sends are blocked
  until this is done. (Phase 1 plan M8, still open.)
- **P2.** Resend dashboard: create a webhook pointing at
  `https://rackintherockies.com/api/webhooks/resend` subscribed to
  `email.bounced`, `email.complained`, `email.delivered`. Copy the signing
  secret into `RESEND_WEBHOOK_SECRET` locally and in Vercel.
- **P3.** After deploy, verify the webhook: use Resend's test-event button and
  confirm a 2xx in the webhook dashboard.
- **P4.** First real-world check: test send to self, confirm rendering in a
  real inbox (Gmail at minimum), confirm the one-click unsubscribe control
  Gmail shows actually unsubscribes the test row.

## Error handling

- Webhook: invalid signature 401; malformed payload 400; unknown event 200;
  no matching rows 200. Errors log server-side with the svix message id.
- Pipeline: per-chunk failure isolation as above. All Resend error detail goes
  to the `error` column and server logs, never to the browser.
- Composer: validation errors are field-level and plain-language. A send that
  fails entirely tells Annie nothing was sent and to try again or ask Tyler.
- Test send failures surface directly in the composer (they are low stakes and
  the user is an admin).

## Testing

TDD with vitest, fakes injected through `SendDb` and `EmailSender`, matching
the Phase 1 `SubscriberDb` pattern. No Supabase or Resend calls in tests.

- `lib/send-rules.ts`: chunking boundaries (0, 1, 100, 101, 250 recipients);
  retry decision on 429/5xx vs permanent 4xx; backoff progression; idempotency
  key stability across retries; webhook event mapping including transient vs
  permanent bounce; audience filter with empty tags, one tag, many tags.
- `lib/sends.ts`: full pipeline against fakes: happy path writes ids and
  counts; a failing chunk marks only its recipients failed and continues;
  resume touches only pending/failed recipients and reuses chunk keys; final
  status sent/partial/failed; empty audience rejected; address guard refusal.
- `lib/subscribers.ts` additions: `markComplained` from every prior status;
  `markBounced` only moves `subscribed`, never `unsubscribed` or `complained`;
  `complained` never downgraded by a later bounce; tag add/remove actions;
  pagination math; tag filter ANY semantics.
- Webhook route: bad signature 401 without processing; each handled event
  updates recipient row and subscriber correctly; unknown event 200; replayed
  event idempotent.
- One-click route: POST unsubscribes by token; GET redirects; unknown token
  neutral.
- Templates: rendered output contains the recipient's unsubscribe URL, the
  attribution line, the address (or placeholder), and no em or en dashes;
  sessions render when present and collapse when absent.
- Composer actions: every action rejects without an admin session (direct
  invocation, layout never runs); `sendAnnouncement` refuses while
  `BUSINESS_MAILING_ADDRESS` is null; test send bypasses the guard.

## Implementation notes

Per `AGENTS.md`: this Next.js version has breaking changes; read the relevant
guides under `node_modules/next/dist/docs/` before writing route handlers,
server actions, or anything auth-adjacent. Verify Resend SDK surfaces
(`batch.send` options, `webhooks.verify` signature, bounce payload shape)
against current docs at implementation time, not memory. Create the migration
with `supabase migration new`. React Email packages (`@react-email/components`,
`@react-email/render`) are new dependencies added by the plan.

## Phase 3 preview

Not specified here. Candidates that surfaced and were deliberately deferred:
scheduled sends, open/click reporting if a real need appears, saved drafts,
and the scoring app's member-facing tooling on the `profiles` foundation.
