# Subscriber Management, Phase 1

Date: 2026-07-30
Status: Approved, ready for implementation planning
Branch: `feat/newsletter-signup`

## Problem

Rack in the Rockies needs to announce events to an audience by email. Today there
is no working way to do that.

Three things are half-built and in conflict:

1. `components/newsletter-signup.tsx:8` posts from the browser to a Kit
   (ConvertKit) form URL that is still a `REPLACE_ME` placeholder. Signups on the
   homepage and in the footer go nowhere.
2. `app/api/contact/route.ts:71` silently adds every contact, booking, and trips
   waitlist submitter to a Resend audience, with no consent notice and no
   unsubscribe path.
3. The site owner's actual list of people lives in a spreadsheet, disconnected
   from both.

## Goals

Phase 1 delivers correct collection and management of subscribers. It does not
send anything.

- One server-side write path for every email the site collects
- Subscriber records owned in the project's own Postgres, not a vendor
- A visible consent notice at the point of collection, recorded per subscriber
- Working one-click unsubscribe and a supported path back
- An admin portal the site owner can log into without developer tooling
- Existing contacts imported from the spreadsheet and the Resend audience

## Non-goals

Explicitly out of scope for Phase 1:

- Sending email of any kind to the list
- The announcement composer, templates, and preview (Phase 2)
- Send pipeline, batching, rate limiting, `List-Unsubscribe` headers (Phase 2)
- Bounce and complaint webhooks (Phase 2, when there is sending to react to)
- Syncing subscribers to Resend so the site owner can send from Resend's editor
  in the interim. Considered and rejected: the interim capability can wait for
  Phase 2, and skipping it avoids throwaway code and a two-store sync problem.
- Open and click tracking, segments beyond simple tags, automations, sequences
- Any general CRM capability such as notes, tasks, or relationship history

Resend continues to handle transactional email (the inquiry notifications to the
site owner) unchanged. It is no longer used for contact storage.

## Context and decisions

**Why not a hosted platform (Kit, Mailchimp, Beehiiv).** Considered seriously.
Kit was the leading candidate and the existing signup component was already aimed
at it. Rejected in favor of building on Supabase for data ownership, no
per-subscriber cost, a single branded login for the site owner at the site's own
domain, and the option to grow real CRM features later without adding a vendor.

**Why a template composer and not an editor (Phase 2).** The site owner is not a
developer. A constrained composer with fixed templates and structured fields
produces on-brand output by construction and is a fraction of the work of a drag
and drop builder. Recorded here because it shapes what Phase 1's data model
needs to support.

**Why a consent notice and not a checkbox.** Product decision. An unchecked
opt-in box is the stricter option and was recommended, but a visible notice at
the point of submission plus published terms is legally sufficient under CAN-SPAM
in the US, which does not require opt-in. The mitigation for the resulting
deliverability risk is `consent_text` snapshotting (below) and, in Phase 2, a
"you are receiving this because" line in the footer of every send. This is not
legal advice.

**Communication type.** These are event announcements, sent irregularly, not a
recurring newsletter. Copy should promise that specifically. Irregular cadence
means long gaps where recipients forget the sender, which raises the importance
of clear attribution in Phase 2 sends.

## Data model

A single table in a new Supabase project.

### `public.subscribers`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` primary key | default `gen_random_uuid()` |
| `email` | `text` not null unique | normalized to lowercase and trimmed by the helper |
| `first_name` | `text` | nullable |
| `last_name` | `text` | nullable |
| `status` | `text` not null | default `subscribed`, checked against the four values below |
| `source` | `text` not null | provenance, see below |
| `tags` | `text[]` not null | default `{}` |
| `unsubscribe_token` | `uuid` not null unique | default `gen_random_uuid()` |
| `consented_at` | `timestamptz` not null | updated on each fresh consent |
| `consent_text` | `text` | verbatim snapshot of the clause shown |
| `created_at` | `timestamptz` not null | default `now()` |
| `updated_at` | `timestamptz` not null | maintained by trigger |

`status` is one of `subscribed`, `unsubscribed`, `bounced`, `complained`.
`bounced` and `complained` are unreachable in Phase 1 (nothing sends yet) but are
defined now so Phase 2 does not require a migration.

`source` is one of `newsletter`, `contact`, `booking`, `trips-waitlist`,
`import`, `resend-migration`.

`email` uniqueness is enforced by the database on an already-normalized value.
Normalization happens in `lib/subscribers.ts` rather than via the `citext`
extension, because there is exactly one write path and this avoids an extension
dependency.

`consent_text` exists specifically because of the notice-clause decision. It
stores the exact wording a person saw, alongside `consented_at`. If a complaint
ever arrives, the record shows what was agreed to and when.

Indexes: unique on `email`, unique on `unsubscribe_token`, plus indexes on
`status` and `source` to support admin filtering.

### Row Level Security

RLS is enabled on `subscribers` with **no policies granted to `anon` or
`authenticated`**, and those roles are not granted table access.

This is deliberate rather than an oversight. The public never reads subscriber
data, and the admin portal renders server-side. All access goes through server
code using the Supabase secret key, which must never be exposed to the browser
and must not be placed in a `NEXT_PUBLIC_` variable. RLS stays enabled as defense
in depth so that any future accidental exposure of the table through the Data API
fails closed.

## Architecture

```
newsletter-signup.tsx ────→ POST /api/subscribe ──┐
                                                  │
contact-form.tsx ──────┐                          ├──→ lib/subscribers.ts ──→ Supabase
booking-form.tsx ──────┼──→ POST /api/contact ────┤            ▲
waitlist-form.tsx ─────┘    (also emails owner)   │            │
                                                  │            │
   /unsubscribe?token= ───────────────────────────┘            │
   /admin (import, resubscribe) ───────────────────────────────┘
```

The three inquiry forms keep posting to `/api/contact`, which is what sends the
notification to the owner. That route then calls `subscribe()` as a side effect.
Only the explicit signup component uses `/api/subscribe`.

Every path that writes a subscriber goes through `lib/subscribers.ts`. No caller
talks to Supabase directly. This is what makes the vendor choice reversible and
what keeps the resubscribe rules in one auditable place.

### `lib/subscribers.ts`

The module's public surface:

- `subscribe(input)` where input is `{ email, firstName?, lastName?, source, tags?, consentText }`.
  Normalizes the email, then upserts according to the resubscribe rules below.
  Returns a discriminated result indicating created, updated, blocked, or
  invalid. Never throws on an expected condition such as a blocked resubscribe.
- `unsubscribeByToken(token)`
- `resubscribeById(id, { force })` for admin use, where `force` is required to
  override `complained`
- `listSubscribers(filters)` for the admin view
- `importSubscribers(rows)` for CSV and Resend migration, applying the same rules

### Resubscribe rules

The principle is that intent must be explicit. A person filling out a booking
inquiry is asking to book an event, not asking to rejoin a list they left.

| Current status | Explicit signup (`source: newsletter`) | Inquiry forms | Admin |
| --- | --- | --- | --- |
| none (new) | create as `subscribed` | create as `subscribed` | create |
| `subscribed` | update names and tags | update names and tags | edit |
| `unsubscribed` | resubscribe, fresh consent recorded | no change | resubscribe |
| `bounced` | resubscribe, fresh consent recorded | no change | resubscribe |
| `complained` | **blocked**, no change | no change | override, requires `force` |

Resubscribing sets `status` to `subscribed` and writes a new `consented_at` and
`consent_text`.

`complained` is the one hard stop. That person marked mail as spam. Automatically
re-adding them risks the sending domain's reputation, which is shared with the
transactional email that carries booking confirmations. The owner can override
from
the admin when she knows the story, behind an explicit confirmation.

## Components

### `POST /api/subscribe`

Public route handler. Accepts `{ email, firstName?, lastName?, honeypot? }`.

- **`source` is not accepted from the client.** This route serves the explicit
  signup component only and hardcodes `source: "newsletter"` server-side. This
  matters because `newsletter` is the only source permitted to resurrect an
  `unsubscribed` or `bounced` record. If the client could name its own source,
  the resubscribe rules would be trivially bypassable in both directions. Inquiry
  sources are set server-side in `/api/contact` from its own request shape, which
  is likewise not client-controlled.
- Validates the email server-side. Client-side `type="email"` is not sufficient.
- Rejects any request where the honeypot field is non-empty, returning the same
  success shape as a real signup so bots learn nothing.
- Rate limits per IP.
- Always returns a generic success response for valid input, whether the record
  was created, updated, or blocked. The response must not reveal whether an
  address is already on the list or previously complained, since that would make
  the endpoint an address-status oracle.
- `consentText` is supplied by the server from a shared constant, not accepted
  from the client, so the snapshot cannot be forged.

### Form changes

`components/newsletter-signup.tsx`
- Remove `KIT_FORM_URL` and the direct third-party POST entirely
- Post to `/api/subscribe` with `source: "newsletter"`
- Add the honeypot field
- Copy stays close to the current wording, which already describes events
  accurately

`components/contact-form.tsx`, `components/booking-form.tsx`,
`components/waitlist-form.tsx`
- Add the consent line next to the submit button
- No behavior change beyond that. They continue to post to `/api/contact`.

`app/api/contact/route.ts`
- Replace the `resend.contacts.create` call at line 71 with a call to
  `subscribe()`, preserving the existing `source` derivation
- The subscribe call remains non-blocking with respect to the inquiry email to
  the owner. A subscriber write failure must not cause the form to report
  failure, matching current behavior.

### Consent copy

One shared constant, used both in the rendered forms and as the value written to
`consent_text`:

> By submitting, you agree to receive emails from Rack in the Rockies.
> Unsubscribe anytime.

It renders visibly adjacent to each submit button, not only in the linked terms.
Buried terms are the ones that get challenged.

Per `AGENTS.md`, no em dashes or en dashes in this or any other user-facing copy.

### `/unsubscribe`

- `GET /unsubscribe?token=<uuid>` looks up by `unsubscribe_token` and sets
  `status` to `unsubscribed` without requiring a login or a confirmation step.
  One click is what mail clients expect.
- Unknown or missing token renders a neutral "we could not find that
  subscription" page rather than an error.
- The confirmation page includes a "changed your mind?" link that resubscribes
  via the same token.
- The page is not indexed.

### Admin portal

Route group under `/admin`, server-rendered.

**Authentication.** Supabase Auth magic link.
- Public signups disabled in the Supabase Auth configuration. Users are created
  manually.
- The admin layout additionally checks the authenticated session's email against
  an allowlist before rendering anything. Two independent locks, because the
  second costs a few lines.
- Authorization must not read from `user_metadata`, which is user-editable in
  Supabase. The allowlist is server-side configuration.

**`/admin`, subscriber list.**
- Table of subscribers with email, name, status, source, tags, signup date
- Search by email or name
- Filter by status and by source
- Counts by status
- Per-row Resubscribe action, with a distinct confirmation warning when the
  current status is `complained`

**`/admin/import`, CSV import.**
- Upload, parse, and show a preview before committing
- Dedupe against existing rows by normalized email
- Report counts of added, updated, and skipped rows after the run
- Imported rows get `source: "import"`, `consented_at` set to the import date,
  and a `consent_text` value recording that the address came from a pre-existing
  list rather than a site form. Provenance is weaker than a form signup, which is
  unavoidable, so it is recorded honestly rather than backdated.

## Migrations

Two one-time data moves, both run through `importSubscribers`:

1. The owner's spreadsheet, exported to CSV, loaded through `/admin/import`.
2. The existing Resend audience. `app/api/contact/route.ts` has been writing to
   it, so it likely holds real contacts. Export via the Resend API and load with
   `source: "resend-migration"`, with `consent_text` noting these predate the
   consent notice.

After migration 2, `RESEND_AUDIENCE_ID` is no longer read by application code.

## Environment variables

Added to `.env.local.example`:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY`, server only, never prefixed `NEXT_PUBLIC_`
- `ADMIN_ALLOWED_EMAILS`, comma separated

Existing `RESEND_API_KEY` and `CONTACT_EMAIL` are unchanged.
`RESEND_AUDIENCE_ID` is retained only until migration 2 completes.

## Compliance pages

`/terms` and `/privacy`, linked from `components/footer.tsx`. The privacy page is
the more substantive of the two here, since the live question is what happens to
a submitted email address. Both must state the business's physical mailing
address, which Phase 2 sends will also require in their footer.

## Error handling

- Subscriber writes never block the user-facing outcome of a form. An inquiry
  still reaches the owner if the subscriber write fails.
- Failed subscriber writes are logged server-side. Phase 1 has no retry queue.
- Invalid email input returns a validation error to the form.
- Duplicate signups are a success, not an error.
- Supabase connection failures surface as a generic failure to the user and a
  detailed log server-side. No vendor error text is echoed to the browser.

## Testing

- `lib/subscribers.ts` resubscribe rules: every cell of the status matrix above,
  particularly that `complained` is not cleared by an explicit signup and that
  inquiry sources never resurrect.
- Email normalization: mixed case, surrounding whitespace, and the resulting
  uniqueness collision.
- `/api/subscribe`: honeypot rejection returns a success shape; responses are
  identical for new, existing, and blocked addresses; invalid emails rejected;
  rate limit enforced.
- Unsubscribe: valid token, unknown token, already unsubscribed, resubscribe via
  the confirmation link.
- Admin access control: unauthenticated request redirected, authenticated session
  whose email is absent from the allowlist rejected.
- CSV import: dedupe against existing rows, malformed rows, counts reported.
- `consent_text` is persisted from the server constant and cannot be set from a
  client-supplied value.
- A request to `/api/subscribe` carrying a `source` field in its body is ignored,
  and the stored record is `newsletter`. A `complained` address cannot be
  resurrected by any client-supplied field.

## Implementation notes

Per `AGENTS.md`, this project's Next.js version has breaking changes relative to
common knowledge. Read the relevant guides in `node_modules/next/dist/docs/`
before writing route handlers, middleware, or auth session code. Do not assume
App Router APIs from memory.

Per the Supabase skill, verify current API surfaces against live documentation
rather than training data, and create migration files with
`supabase migration new` rather than hand-authoring filenames.

## Phase 2 preview

Not specified here. Expected scope: template-based announcement composer, React
Email rendering against the site's existing palette, preview and test send,
batched and rate-limited send pipeline, `List-Unsubscribe` headers, bounce and
complaint webhooks writing back to `status`, and send history. Phase 2 gets its
own spec once Phase 1 is live.
