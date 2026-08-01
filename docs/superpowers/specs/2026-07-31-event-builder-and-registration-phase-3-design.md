# Event Builder and Registration, Phase 3

Date: 2026-07-31
Status: Approved pending Tyler's spec review
Branch: `feat/event-builder-phase-3`
Builds on: Phase 1 (subscriber management) and Phase 2 (announcement sending)

## Problem

The featured event lives in `data/featured-event.ts`, a hardcoded file only a
developer can change. The admin composer's "Prefill from featured event"
button reads it, the homepage announcement bar and the `/events` hero render
it, and updating any of it requires a code change and a deploy. Annie cannot
create her own events, and event sign-ups run through an external Google Form
that collects registrations outside the system.

Phase 3 makes events first-class: created and published from the admin, driving
every surface that reads them today, and, in its second part, taking
registrations in-house with capacity limits and branded confirmation emails.

## Scope shape: two parts, built in order

- **Part A, event builder.** Events move to the database. Admin list, editor
  with live preview, duplicate-from-past, draft/publish. The public site and
  the composer prefill read the featured event from the database.
  `data/featured-event.ts` is deleted.
- **Part B, registration and hero art.** A featured event without an external
  signup URL takes registrations on `/events`: session picker with capacity,
  guest count, confirmation email with payment instructions and a cancel link,
  admin registrant view with CSV export, and a subscriber side effect. Part B
  also carries two Part A follow-ups from Tyler's live review: the hero art
  system (a default brand SVG of mountains and tiles replacing the
  Bloom-specific flowers, with an optional per-event image upload that
  replaces the decor), and a date picker on the editor's date field that
  auto-writes the human label.

Part B depends on Part A. Each part gets its own implementation plan; Part A
ships working on its own.

## Goals

- Annie can create, edit, duplicate, and publish events without a developer
- Draft events are invisible to the public until an explicit Publish
- The site features the earliest published event that has not yet ended, and
  hides event surfaces automatically after it ends, exactly as today
- Publishing reflects on the live site immediately, not an hour later
- The composer prefill reads the same database event
- Registration (Part B): per-session capacity with sold-out handling, seats
  1 to 4 per registration, branded confirmation email with per-event payment
  instructions and a cancellation link, per-registration owner notification,
  registrant list with per-session counts and CSV export in the admin,
  side-effect subscribe with an event tag
- Sessions live in their own table so registrations can reference them
- Hero art (Part B): a default mountains-and-tiles SVG in the brand palette
  when an event has no image; an admin-uploaded image (Supabase Storage,
  first use in the project) replaces the decor when present
- Editor polish (Part B): the date field gains a picker that fills the
  human-readable label, which stays editable for ranges and phrasing

## Non-goals

- Online payment (Stripe). Registration reserves seats; the confirmation email
  carries per-event payment instructions. Payment is its own later phase.
- Per-event public pages. One event is active at a time; `/events` remains the
  page. The events list with history exists only in the admin.
- Waitlists when sold out, attendee check-in, reminders, or calendar invites.
- Editing the static event-type cards on `/events` (Girls Night In, lessons,
  charity). Those are site content, not event instances.
- Login accounts for registrants. Registration is a form plus a tokenized
  cancel link, the same identity model as subscribers (see the Phase 1 spec's
  subscriber vs user reasoning; it applies unchanged).
- Concurrency-proof capacity. Two registrations racing for the last seat can
  both succeed (check-then-insert). Accepted at this scale; Annie resolves the
  rare overage by hand. Revisit only if events sell out in minutes.

## Context and decisions

**Why an event list and not a single editable slot.** Chosen by Tyler. Events
accumulate as history, and Duplicate turns "same as last year, new date" into
one click. The featured event is derived (earliest published, not yet ended),
so there is no manual "make this the current one" state to forget.

**Why draft/publish.** A half-typed event must never appear on the homepage.
Draft is the default state; Publish is an explicit admin action and the only
thing that exposes an event publicly. Unpublish exists for mistakes.

**Why sessions are a table, not a JSON column.** Part B registrations must
reference a specific session and count seats against its capacity. A JSON
blob would make that a parsing exercise with no referential integrity. The
composer's session fields stay plain JSON inside `sends.fields` because sent
emails are snapshots; live events are not.

**Why the preview renders the real hero component.** The site's
`FeaturedEventHero` is refactored to take the event as a prop, and the admin
editor imports and renders that same component with the in-progress form
state. Preview and production cannot drift, and there is no second template to
maintain. This mirrors Phase 2's composer preview principle (what Annie sees
is what ships) with even less machinery.

**Title accent convention.** The hero hand-styled "Mahjong in Bloom" with the
last word in gradient italic. With admin-entered titles, the hero
automatically styles the final word of any title that has more than one word;
single-word titles render plain. No styling fields for Annie.

**Cache flush on publish.** The site revalidates hourly (`app/layout.tsx`).
Publish, unpublish, and edits to a published event call
`revalidatePath("/", "layout")` so changes appear immediately. Draft saves do
not touch the cache.

**Why cancel confirms and unsubscribe does not.** Phase 1 deliberately made
unsubscribe a one-click GET, accepting that email scanners may trigger it,
because the cost of an accidental unsubscribe is low and recoverable. An
accidentally cancelled registration frees a seat someone wanted, so the cancel
link lands on a page showing the registration with an explicit "Cancel my
registration" button that POSTs. The asymmetry is intentional.

**Hero art decisions (Tyler, from live review of Part A).** The flower decor
was drawn for Mahjong in Bloom and wrongly decorates every event. Default art
becomes a hand-drawn SVG of mountain silhouettes and floating mahjong tiles
in the site palette, ornamental and screen-reader-hidden like the flowers
were; the flower component is deleted as dead code. An uploaded event image
REPLACES the decor entirely (one visual slot, hard to make ugly) rather than
adding a photo block beside it. Uploads land in a public-read Supabase
Storage bucket (`event-images`), written server-side through the secret key
so the bucket needs no client write policies; jpeg/png/webp up to 5 MB,
randomized filenames. Replaced images are not garbage-collected; accepted at
this scale. `events` gains nullable `image_url` and `image_alt` columns; alt
falls back to the event title when blank.

**Registration email is transactional.** The confirmation is a receipt, not
marketing: it reuses the branded email shell but with a footer of business
name and contact email only, no unsubscribe link or postal address required.
The announcement footer rules from Phase 2 are unchanged for marketing sends.

**New subscriber source.** Registrants are side-effect subscribed with source
`event-registration`, added to the `subscribers.source` check constraint. Like
inquiry sources, it can never resurrect an unsubscribed, bounced, or
complained record, and the write must never block the registration itself.
The subscriber gains a tag of the event's slugified title (union semantics).

## Data model

One migration per part, via `supabase migration new`. RLS enabled on all new
tables with no grants to `anon` or `authenticated`, matching every other
table: all reads and writes are server-side.

### Part A: `public.events`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` primary key | default `gen_random_uuid()` |
| `title` | `text` not null | |
| `partner` | `text` | nullable, renders "at {partner}" when present |
| `date_label` | `text` not null | human copy, e.g. "July 28, 2026" |
| `ends_at` | `timestamptz` not null | auto-hide moment |
| `location` | `text` not null | |
| `blurb` | `text` not null | |
| `banner_text` | `text` not null | homepage announcement bar copy |
| `external_signup_url` | `text` | nullable; Part A: null hides the CTA; Part B: null means in-house registration |
| `payment_instructions` | `text` | nullable; used by Part B confirmation email |
| `status` | `text` not null | default `draft`, check in (`draft`, `published`) |
| `created_by` | `uuid` not null | FK to `public.profiles(id)` |
| `created_at` / `updated_at` | `timestamptz` | trigger-maintained |

### Part A: `public.event_sessions`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` primary key | |
| `event_id` | `uuid` not null | FK to events, cascade on delete |
| `name` | `text` not null | |
| `time_label` | `text` not null | e.g. "4:45 - 8:00 PM" (hyphen, per copy rules) |
| `price_label` | `text` not null | e.g. "$60" |
| `capacity` | `integer` | nullable = unlimited |
| `sort_order` | `integer` not null | default 0 |

Index on `event_id`.

### Part B: `public.event_registrations`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` primary key | |
| `event_id` | `uuid` not null | FK to events, cascade |
| `session_id` | `uuid` not null | FK to event_sessions, cascade |
| `first_name` | `text` not null | |
| `last_name` | `text` | nullable |
| `email` | `text` not null | normalized by the same helper as subscribers |
| `seats` | `integer` not null | default 1, check between 1 and 4 |
| `status` | `text` not null | default `confirmed`, check in (`confirmed`, `cancelled`) |
| `cancel_token` | `uuid` not null unique | default `gen_random_uuid()` |
| `created_at` / `updated_at` | `timestamptz` | trigger-maintained |

Indexes on `session_id`, `event_id`, `email`. Seats taken for a session =
sum of `seats` over its `confirmed` registrations.

Part B also alters the `subscribers.source` check constraint to add
`event-registration`, adds nullable `image_url` and `image_alt` columns to
`public.events`, and creates the public-read `event-images` Storage bucket.

### Featured event derivation

The featured event is: `status = 'published' and ends_at > now()`, ordered by
`ends_at` ascending, limit 1. No stored "featured" flag.

## Architecture

```
admin /admin/events ──▶ lib/events.ts ──▶ Supabase (events, event_sessions)
        │  editor renders FeaturedEventHero(event) as live preview
        ▼  publish/save ──▶ revalidatePath("/", "layout")

site layout bar ─┐
/events hero ────┼──▶ getFeaturedEvent() ─┐
composer prefill ┘                        │
                                          ▼
/events registration form ──▶ POST /api/register ──▶ event_registrations
                                    │                     │
                                    ├──▶ confirmation + owner emails (Resend)
                                    └──▶ subscribe() side effect (non-blocking)
/cancel-registration?token= ──▶ confirm page ──▶ cancel action, seats freed
```

Module layout follows the Phase 1/2 pattern: pure decision logic separated
from I/O.

- `lib/event-rules.ts` (pure): featured-event selection from a row list plus a
  clock; title accent split (last word); event field validation with
  plain-language errors; duplicate transform (copies fields and sessions,
  clears dates and banner copy back to draft); slugified event tag. Part B
  adds: registration validation, seats-remaining math, and the
  can-register decision (published, session belongs to event, capacity).
- `lib/events.ts`: Supabase reads and writes. `getFeaturedEvent()`,
  `listEvents()`, `getEvent(id)`, `createEvent`, `updateEvent`,
  `setEventStatus`, `duplicateEvent`. Part B adds registration inserts,
  seat counts, registrant list, and cancellation. Straight queries, no
  injectable interface: like `listSubscribers`, these hold no business rules.

## Components

### Part A: admin events

- `/admin/events`: table of all events (title, date label, status badge,
  sessions count, ends-at), newest first. Actions: Edit, Duplicate. New Event
  button. Nav gains an Events link.
- `/admin/events/new` and `/admin/events/[id]`: one editor (client component):
  structured fields matching the data model, a sessions repeater (name, time,
  price, capacity), and a live preview rendering the refactored
  `FeaturedEventHero` with current form state, styled into a scaled container.
  Buttons: Save draft, Publish (with confirmation showing where it will
  appear), Unpublish for published events, Delete for drafts only.
- Server actions (`requireAdmin` first, per the Phase 1 rule): save, publish,
  unpublish, duplicate, delete-draft. Validation server-side via
  `lib/event-rules.ts`; the editor shows the errors.
- Publish and any save of a published event call
  `revalidatePath("/", "layout")`.

### Part A: site changes

- `FeaturedEventHero` and `EventAnnouncementBar` take the event as a prop and
  render nothing when it is null. The pages that use them await
  `getFeaturedEvent()`. The hero renders the title with the last-word accent
  convention and shows the CTA only when `external_signup_url` is present
  (until Part B).
- `app/admin/(gated)/compose/page.tsx` prefill reads `getFeaturedEvent()`
  instead of the data file. No featured event: the prefill button is hidden.
- `data/featured-event.ts` is deleted. The current Mahjong in Bloom event is
  seeded into the database as a published past event so Duplicate has a
  starting point and history is not empty.

### Part B: registration form on `/events`

Rendered when the featured event has no `external_signup_url` and has at
least one session:

- Session picker showing name, time, price, and remaining seats; a full
  session renders "Sold out" and cannot be selected. Fields: first name, last
  name (optional), email, seats (1 to 4), plus the standard honeypot. The
  consent notice from Phase 1 renders next to the submit button (the
  registration also subscribes them).
- `POST /api/register` accepts `{ eventId, sessionId, firstName, lastName?,
  email, seats, website }`. Server-side: rate limit per IP (shared limiter
  pattern), honeypot fake-success, email validation, event must be published
  and current, session must belong to the event, seats within bounds and
  within remaining capacity. Sold-out and validation failures return
  plain-language errors; success returns a generic confirmation. Then, in
  order: insert the registration, send the confirmation email to the
  registrant and the notification email to `CONTACT_EMAIL`, and run the
  subscribe side effect. Email and subscribe failures are logged and never
  fail an inserted registration.
- Confirmation email (`emails/registration-confirmation.tsx`): branded shell,
  transactional footer (business name and contact email only). Contents:
  event title, date, location, session name and time, seats, price, the
  event's `payment_instructions` when present, and the cancel link.
  Subject: "You're registered: {event title}".
- `/cancel-registration?token=`: shows the registration (event, session,
  seats) with a "Cancel my registration" button posting a server action that
  sets status `cancelled`, freeing the seats. Unknown token or already
  cancelled renders a neutral page. Noindex, like the unsubscribe pages.

### Part B: hero art and editor polish

- `components/event-hero-decor.tsx` (flowers) is deleted. A new
  `components/event-hero-default-decor.tsx` renders the mountains-and-tiles
  SVG with the same ornamental contract (absolute positioning,
  `aria-hidden`, non-interactive, palette colors only).
- `FeaturedEventHero`: when `event.image_url` is present, render the image
  (soft-framed, palette-tinted treatment consistent with the current art
  direction) in place of the decor; otherwise render the default decor. Alt
  text is `image_alt` or the event title.
- Editor: an image field with upload (file input posting to a server action
  behind `requireAdmin` that validates type and size, uploads to the
  `event-images` bucket, and returns the public URL into form state), a
  thumbnail of the current image, and a remove button. Plus an alt text
  field shown only when an image is set.
- Editor date field: a date picker input beside the label field; picking a
  date writes the formatted label ("July 28, 2026") into the label field,
  which stays editable afterward. The label remains the stored value;
  nothing else changes about `date_label`.

### Part B: admin registrants

On `/admin/events/[id]` for events with in-house registration: per-session
seat counts (taken / capacity), the registrant table (name, email, session,
seats, status, registered date), and a CSV export of registrants behind
`requireAdmin`, following the Phase 2 export route pattern.

## Error handling

- Draft events are never readable through any public path, including the
  registration endpoint.
- Publishing with invalid fields is refused with the same plain-language
  errors the editor shows inline.
- A registration insert that fails cleanly reports "something went wrong" to
  the form; no vendor error text reaches the browser.
- Capacity errors name the session: "Introduction to Mahjong is sold out."
- The confirmation email failing does not cancel the registration; Annie's
  notification failing does not either. Both are logged.

## Testing

TDD with vitest, mirroring earlier phases: pure rules exhaustively, I/O
behind mocks, admin actions verified to call `requireAdmin`.

- Featured selection: drafts excluded, ended events excluded, earliest
  upcoming wins, empty list yields null.
- Title accent: multi-word splits before the last word; single-word and
  whitespace-padded titles render plain.
- Validation: required fields, `ends_at` must parse, sessions must be
  complete rows, capacity must be a positive integer when present.
- Duplicate transform: copies fields and sessions, clears `date_label`,
  `ends_at`, `banner_text`, resets status to draft.
- Registration rules (Part B): seats bounds, seats-remaining math including
  unlimited capacity, sold-out refusal, session/event mismatch refusal,
  draft/ended event refusal.
- `/api/register`: honeypot fake success, rate limit, sold-out error shape,
  success inserts before emails, email failure does not fail the request,
  subscribe side effect uses source `event-registration` and cannot
  resurrect unsubscribed or complained records.
- Cancel: valid token shows and cancels, seats return to the pool, unknown
  token neutral, double-cancel harmless.
- Admin actions: every mutation rejects without an admin session.
- Confirmation email render: contains event details, payment instructions
  when present, cancel URL, and no em or en dashes.
- Upload action: rejects wrong content types and oversize files with
  plain-language errors; rejects without an admin session; date label
  formatting helper produces "July 28, 2026" from a date value.

## Environment variables

None new. Existing Resend and Supabase configuration covers both parts.

## Manual prerequisites

None for Tyler in Part A beyond merging; the migration push and the Mahjong
in Bloom seed run during execution (the CLI is linked). Part B has none
either: registration reuses the existing Resend sending domain and
`CONTACT_EMAIL`.

## Phase preview

Later candidates, deliberately not here: Stripe payment at registration,
waitlists, event reminder emails through the Phase 2 pipeline, per-event
public pages if two events ever overlap, and the scoring app (which would
finally exercise `subscribers.user_id` and the Confirm signup template).
