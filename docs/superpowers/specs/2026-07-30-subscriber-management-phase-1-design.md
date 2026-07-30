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
- A visible consent notice at the point of collection
- Working one-click unsubscribe and a supported path back
- An admin portal the site owner can log into without developer tooling
- A roles model that later supports authenticated user tools, such as the
  planned scoring app, without reworking this table
- Existing contacts loaded from the spreadsheet and the Resend audience

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
- The scoring app and any other authenticated user tooling. Phase 1 defines the
  `profiles` and role model those will need, and creates admin users, but builds
  no member-facing feature and does not open public signup.
- Optimizing role checks by projecting `role` into JWT claims via a custom access
  token hook. A `profiles` lookup per request is fine at this scale. Revisit only
  if the scoring app makes it measurably hot.

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
deliverability risk is the "you are receiving this because" line in the footer of
every Phase 2 send. This is not legal advice.

**Why no per-subscriber consent snapshot.** An earlier draft stored
`consent_text` and `consented_at` on every row. Both were cut. `consented_at` is
identical to `created_at` at insert and diverges only on resubscribe, where
`updated_at` is an adequate proxy. `consent_text` was meant to record which
wording a given person saw, since the copy will be reworded eventually, but that
is already reconstructable: the consent line lives in a single exported constant
that has to exist anyway for rendering, that constant is versioned in git, and
`created_at` identifies which revision was live. `git log` on one file is the
audit trail. If an explicit marker is ever wanted, a short `consent_version`
string is the cheap middle ground, but it is not built now.

**Why profiles are separate from subscribers.** A subscriber is an email address
that agreed to hear about events, and most will never authenticate. A user is a
login identity. Merging them would leave a meaningless role value on the large
majority of subscriber rows and would set up a second identity store competing
with Supabase Auth. They are linked, not merged. This matters now rather than
later because a scoring app and other authenticated user tools are planned, and
retrofitting an identity model onto a table holding real subscriber data is
considerably worse than defining it up front.

**Communication type.** These are event announcements, sent irregularly, not a
recurring newsletter. Copy should promise that specifically. Irregular cadence
means long gaps where recipients forget the sender, which raises the importance
of clear attribution in Phase 2 sends.

## Data model

Two tables in a new Supabase project, plus Supabase's own `auth.users`.

```
auth.users            Supabase Auth. Owns login. Managed by Supabase, no columns added.
   │
   │ 1:1, created by trigger
   ▼
public.profiles       id (FK to auth.users), role, display_name
   ▲
   │ nullable FK, set only when one person is both
   │
public.subscribers    the email list
```

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
| `user_id` | `uuid` nullable | FK to `public.profiles(id)`, null for most rows |
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

`user_id` is null for essentially every row in Phase 1. It exists so the scoring
app can associate a player's account with their subscription later without a
migration on a table that will hold real data by then. Nothing in Phase 1 writes
it.

Indexes: unique on `email`, unique on `unsubscribe_token`, plus indexes on
`status` and `source` to support admin filtering.

### `public.profiles`

One row per authenticated user, keyed to Supabase Auth.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` primary key | FK to `auth.users(id)`, cascade on delete |
| `role` | `text` not null | default `member`, checked against `admin` and `member` |
| `display_name` | `text` | nullable |
| `created_at` | `timestamptz` not null | default `now()` |
| `updated_at` | `timestamptz` not null | maintained by trigger |

A trigger on `auth.users` insert creates the matching profile row.

Three constraints on this that are painful to retrofit and easy to get wrong:

- **`role` must not live in `user_metadata`.** Supabase's `raw_user_meta_data`
  is editable by the user it belongs to and can surface in `auth.jwt()`, so a
  role stored there is self-assignable. Authorization reads from this table.
- **The trigger hardcodes `'member'`.** The default role must never be derived
  from anything client-supplied, including metadata passed at signup. Signups are
  disabled in Phase 1, so this looks academic, but the moment the scoring app
  opens registration this default is the only thing standing between a stranger
  and `/admin`.
- **Any `security definer` role-check helper lives in a private schema**, not
  `public`, so it is not reachable through the Data API.

Phase 1 populates this table with admin users only, created manually.

### Row Level Security

RLS is enabled on both tables.

`subscribers` has **no policies granted to `anon` or `authenticated`**, and those
roles are not granted table access. This is deliberate rather than an oversight.
The public never reads subscriber data, and the admin portal renders server-side.
All access goes through server code using the Supabase secret key, which must
never be exposed to the browser and must not be placed in a `NEXT_PUBLIC_`
variable. RLS stays enabled as defense in depth so that any future accidental
exposure of the table through the Data API fails closed.

`profiles` does need real policies, since the scoring app will eventually read it
from authenticated clients. A user may select and update their own row
(`auth.uid() = id`), and may not change their own `role`. Admin reads go through
server code. Note that a Postgres `UPDATE` policy also requires a `SELECT` policy
on the same row, or updates silently affect zero rows with no error raised.

## Architecture

```
newsletter-signup.tsx ────→ POST /api/subscribe ──┐
                                                  │
contact-form.tsx ──────┐                          ├──→ lib/subscribers.ts ──→ Supabase
booking-form.tsx ──────┼──→ POST /api/contact ────┤            ▲
waitlist-form.tsx ─────┘    (also emails owner)   │            │
                                                  │            │
   /unsubscribe?token= ───────────────────────────┘            │
   /admin (list, resubscribe) ─────────────────────────────────┘
```

The three inquiry forms keep posting to `/api/contact`, which is what sends the
notification to the owner. That route then calls `subscribe()` as a side effect.
Only the explicit signup component uses `/api/subscribe`.

Every path that writes a subscriber goes through `lib/subscribers.ts`. No caller
talks to Supabase directly. This is what makes the vendor choice reversible and
what keeps the resubscribe rules in one auditable place.

### `lib/subscribers.ts`

The module's public surface:

- `subscribe(input)` where input is `{ email, firstName?, lastName?, source, tags? }`.
  Normalizes the email, then upserts according to the resubscribe rules below.
  Returns a discriminated result indicating created, updated, blocked, or
  invalid. Never throws on an expected condition such as a blocked resubscribe.
- `unsubscribeByToken(token)`
- `resubscribeByToken(token)` for the "changed your mind" link
- `resubscribeById(id, { force })` for admin use, where `force` is required to
  override `complained`
- `listSubscribers(filters)` for the admin view

### Resubscribe rules

The principle is that intent must be explicit. A person filling out a booking
inquiry is asking to book an event, not asking to rejoin a list they left.

| Current status | Explicit signup or own token | Inquiry forms | Admin |
| --- | --- | --- | --- |
| none (new) | create as `subscribed` | create as `subscribed` | create |
| `subscribed` | update names, union tags | update names, union tags | edit |
| `unsubscribed` | resubscribe | no change | resubscribe |
| `bounced` | resubscribe | no change | resubscribe |
| `complained` | **blocked**, no change | no change | override, requires `force` |

The first column covers both the signup form (`source: newsletter`) and
`resubscribeByToken` from the unsubscribe confirmation page. Both are explicit
requests, and both still stop at `complained`: a spam complaint followed by a
token resubscribe is indistinguishable from a bot replaying a leaked URL, so
that path goes through the admin override only.

Tag updates are a union, never a replacement. A person who signed up for news
and later inquires about a trip accumulates both facts; neither write path may
erase what the other recorded.

Resubscribing sets `status` to `subscribed`. `created_at` is preserved, so the
original signup date is not lost, and `updated_at` records when they returned.

`complained` is the one hard stop. That person marked mail as spam. Automatically
re-adding them risks the sending domain's reputation, which is shared with the
transactional email that carries booking confirmations. The owner can override
from the admin when they know the story, behind an explicit confirmation.

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

One exported constant, imported by all four forms so the wording cannot drift
between them:

> By submitting, you agree to receive emails from Rack in the Rockies.
> Unsubscribe anytime.

It renders visibly adjacent to each submit button, not only in the linked terms.
Buried terms are the ones that get challenged.

This constant is the consent audit trail. It must live in its own small module
with no unrelated exports, so that `git log` on that one file yields a clean
history of what was shown and when. Rewording it is a meaningful change, not a
copy tweak, and the commit message should say so.

Per `AGENTS.md`, no em dashes or en dashes in this or any other user-facing copy.

### `/unsubscribe`

- `GET /unsubscribe?token=<uuid>` looks up by `unsubscribe_token` and sets
  `status` to `unsubscribed` without requiring a login or a confirmation step.
  One click is what mail clients expect.
- Unknown or missing token renders a neutral "we could not find that
  subscription" page rather than an error.
- The confirmation page includes a "changed your mind?" link that resubscribes
  via the same token, subject to the resubscribe matrix (`complained` stays
  blocked).
- The page is not indexed.
- Known tradeoff, accepted deliberately: a GET that mutates can be triggered by
  email link scanners on behalf of someone who never clicked. This matches
  common industry practice for unsubscribe landing pages, the resubscribe link
  is the recovery path, and Phase 2's `List-Unsubscribe-Post` header (which
  mail clients use for their native unsubscribe button) is POST-based and
  immune. Do not "fix" this by adding a confirmation step.

### Admin portal

Route group under `/admin`, server-rendered.

**Authentication.** Supabase Auth magic link.
- Public signups disabled in the Supabase Auth configuration. Admin users are
  created manually, which also creates their profile via the trigger. Their role
  is then set to `admin` by hand.
- The admin layout checks `profiles.role = 'admin'` for the authenticated session
  before rendering anything, and redirects otherwise.
- **The layout check protects rendering only.** Server actions and route
  handlers are directly invokable via POST without the layout ever running, so
  every admin mutation (Resubscribe, the `complained` override) re-verifies the
  session and `profiles.role = 'admin'` itself before touching data. A single
  `requireAdmin()` helper, called at the top of each action, keeps this
  uniform.
- Authorization must not read from `user_metadata`, which is user-editable in
  Supabase.
- This replaces the env-var email allowlist of an earlier draft. Changing who has
  access is now a database update rather than a redeploy.

**`/admin`, subscriber list.**
- Table of subscribers with email, name, status, source, tags, signup date
- Search by email or name
- Filter by status and by source
- Counts by status
- Per-row Resubscribe action, with a distinct confirmation warning when the
  current status is `complained`

No CSV import UI. See Migrations.

## Migrations

Two one-time data moves, both performed manually through the Supabase dashboard
rather than through application code. Building an import UI for an operation that
runs twice is not worth it.

1. The owner's spreadsheet, exported to CSV and uploaded to the `subscribers`
   table via the dashboard's CSV import. Rows get `source: "import"`.
2. The existing Resend audience. `app/api/contact/route.ts` has been writing to
   it, so it likely holds real contacts. Export via the Resend API to CSV and
   upload the same way with `source: "resend-migration"`.

**Both uploads bypass `lib/subscribers.ts`, and therefore bypass email
normalization.** Before uploading, the CSV must be lowercased and trimmed on the
email column and deduped, or `Owner@example.com` and `owner@example.com` will
land as two distinct rows, and any true duplicate will abort the batch partway
through on the unique constraint. Run a normalizing `UPDATE` and a duplicate
check in the SQL editor immediately after each upload to confirm.

`unsubscribe_token`, `status`, and `created_at` all have defaults, so the CSV
needs only the email and name columns.

Provenance for imported rows is weaker than for form signups, since these people
never saw the consent notice. That is unavoidable and is recorded honestly in
`source` rather than disguised.

After migration 2, `RESEND_AUDIENCE_ID` is no longer read by application code.

## Environment variables

Added to `.env.local.example`:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY`, server only, never prefixed `NEXT_PUBLIC_`

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
- A request to `/api/subscribe` carrying a `source` field in its body is ignored,
  and the stored record is `newsletter`. A `complained` address cannot be
  resurrected by any client-supplied field.
- Admin access control: unauthenticated request redirected; authenticated session
  whose profile role is `member` rejected; role read from `profiles` and not from
  `user_metadata`; an admin mutation invoked directly without a session, and with
  a `member` session, is rejected even though the layout never rendered.
- Tag union: a subscriber with tags from one source keeps them after a write
  from another source.
- Token resubscribe on a `complained` record is blocked.
- Profile creation trigger: a new `auth.users` row produces exactly one profile
  with role `member`, and a signup that attempts to supply `role` in its metadata
  still lands as `member`.
- `profiles` RLS: a user can read and update their own row, cannot read another
  user's row, and cannot change their own `role`.

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
