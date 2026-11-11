# Current State

Last updated: 2026-11-11

Orientation doc for a cold session (including Claude Code on the web) picking up
this repo with no prior context. Derived from repo contents, git history, a
passing test, lint, and build run, the live Supabase project and Vercel
deployments (read through their connectors), and the notes carried in session
memory.
Anything not verifiable that way is marked **unverified**.

## What this project is

`rack-in-the-rockies` is the site for Rack in the Rockies, a Colorado mahjong
events business. It is a Next.js app that has grown a real back office: a
subscriber list, an announcement email pipeline, an event builder, and
in-house event registration.

- Next.js 16.2.1, React 19.2.4, Tailwind CSS 4, TypeScript
- Supabase (Postgres + Auth) for all application data, `@supabase/ssr`
- Resend for transactional and announcement email, React Email for templates
- `@anthropic-ai/sdk` + `zod` for the AI event banner designer
- Vitest, `npm test`
- Vercel, project `rack-in-the-rockies`, auto-deploys `main` to
  rackintherockies.com

Read `AGENTS.md` before writing code. Its two rules are load-bearing and are
repeated under Gotchas.

## Branch and deploy state

`main` is the trunk and deploys straight to production. Work lands through
GitHub PRs, not local merges. As of this writing 14 PRs have merged.

On 2026-11-11 the repo was cleaned up: 9 stale local branches, 10 merged remote
branches, and an abandoned worktree under `.claude/worktrees/` were all deleted
after verifying each was fully merged. Expect `main` plus only genuinely active
branches. If you find a `claude/*` branch, check for an open PR before assuming
it is junk.

Each Claude Code session develops on its own `claude/<adjective>-<name>-<suffix>`
branch and opens a PR into `main`. Older PRs used `feat/*` and `fix/*` names
(PRs #3 to #9). Remote branches as of the evening of 2026-11-11:

| Branch | State |
| --- | --- |
| `main` | Trunk. Head `ad44630`, deployed to production, deployment Ready |
| `claude/bold-fermi-ptacmj` | One commit ahead of `main` ("Fix type errors in test files", `d8f2f01`), **no open PR**. Either open one or delete it; nobody should build on it blind |
| `claude/festive-noether-r9c67n` | The session branch that carried this doc update |

Production deploys come from `main` only. The most recent production deploys are
PR #12 (close-out skill), PR #13 (event uploads and start time), PR #14 (admin
login hint), and the direct-to-main commits `3f470a1` (this doc's rewrite) and
`ad44630` (send-pipeline state, migration rename).

## What is shipped

Four phases are built, merged, and live. Specs and plans are in
`docs/superpowers/`, and they remain the best explanation of *why* each piece
works the way it does.

| Phase | What it does | Driving docs |
| --- | --- | --- |
| 1, subscriber management | Subscribers table, consent notices, unsubscribe and resubscribe, role-gated `/admin` | [spec](../superpowers/specs/2026-07-30-subscriber-management-phase-1-design.md), [plan](../superpowers/plans/2026-07-30-subscriber-management-phase-1.md) |
| 2, announcement sending | Composer, React Email templates, batched send pipeline, send history, Resend webhooks | [spec](../superpowers/specs/2026-07-30-announcement-sending-phase-2-design.md), [plan](../superpowers/plans/2026-07-30-announcement-sending-phase-2.md) |
| 3A, event builder | Events and sessions in Postgres, admin editor with live preview, featured event derived from the database | [spec](../superpowers/specs/2026-07-31-event-builder-and-registration-phase-3-design.md), [plan](../superpowers/plans/2026-07-31-event-builder-phase-3a.md) |
| 3B, registration | Public registration form, capacity, confirmation email, cancel page, registrant CSV, hero art, `event-images` storage bucket | [plan](../superpowers/plans/2026-07-31-event-registration-phase-3b.md) |

Since then: an admin Team page
([spec](../superpowers/specs/2026-08-01-admin-team-page-design.md)), a "Design
with AI" banner designer, winter event theming, shop additions, and the November
event editor fix (PR #13). The event pieces are detailed below.

### Events, from static file to database

The featured event used to live in `data/featured-event.ts`. That file is gone.
Events are now rows in Postgres, managed by admins at `/admin/events`
(`app/admin/(gated)/events/`), and every public surface reads them through
`getFeaturedEvent()` in `lib/events.ts`.

- **Phase 3A (PR #4, 2026-07-31).** `public.events` and `public.event_sessions`
  (migration `20260731234735_events_phase_3a.sql`). Events are `draft` or
  `published`. The featured event is derived, never flagged: the earliest-ending
  published event whose `ends_at` is still in the future
  (`selectFeaturedEvent` in `lib/event-rules.ts`, mirrored by the query in
  `getFeaturedEvent()`). That lookup fails soft and renders no event on a
  database error. Saving a live event calls `revalidatePath("/", "layout")`;
  public pages otherwise revalidate hourly. Drafts save permissively, publishing
  runs the full `validateEventInput` checks.
- **Phase 3B (PR #5, 2026-07-31).** `public.event_registrations` (migration
  `20260801001927_registration_phase_3b.sql`), plus `events.image_url` and
  `image_alt`, a new `event-registration` subscriber source, and the public-read
  `event-images` storage bucket. Registration is a form on `/events`
  (`components/registration-form.tsx`, `app/api/register/`), 1 to 4 seats,
  capacity checked per session, confirmation email with a tokenized cancel link
  (`app/cancel-registration/`), and a registrants CSV per event. The form only
  shows when the featured event has sessions and no `external_signup_url`.
  Capacity is check-then-insert and can oversell under a race; the spec accepts
  that. No payments: the confirmation carries `payment_instructions`.
- **Event decor (PRs #6 and #10).** `events.decor` picks the hero art when there
  is no uploaded image: `mountains` (default), `blooms` (Mahjong in Bloom's
  flowers, migration `20260801012715_event_decor.sql`), and `winter` (icy blue
  palette, snowflake, mitten, and teacup tiles, a blue registration form,
  migration `20261028231912_event_decor_winter.sql`). Components are
  `components/event-hero-{default,bloom,winter}-decor.tsx`.
- **Design with AI (PR #11, 2026-10-28).** An editor panel sends the admin's
  description to Claude (`lib/theme-designer.ts`) and gets back a design recipe:
  palette, accent font, tile layout, and vector tile icons. `lib/event-theme.ts`
  sanitizes it on save and on read (hex colors only, geometry-only shapes,
  WCAG contrast enforced). Stored in `events.theme` (jsonb) and
  `events.theme_prompt`; a theme overrides `decor`, and an uploaded image still
  replaces the tile art. Rendered by `components/event-hero-custom-decor.tsx`
  through `--ev-*` CSS variables. Needs `ANTHROPIC_API_KEY`; setup and cost are
  in `docs/ai-event-designer.md`. The editor pages set `maxDuration = 180`.
- **November fix (PR #13, 2026-11-02).** Two problems. First, image uploads went
  through a server action, which caps request bodies at 1 MB, so most photos
  failed. `createEventImageUploadAction` now only validates type and size and
  returns a one-time signed upload URL; the browser uploads straight to Supabase
  Storage with `uploadToSignedUrl`. The bucket itself now enforces 5 MB and
  jpeg, png, or webp. Second, events gained `starts_at` (migration
  `20261102222514_event_starts_at.sql`) with a Starts picker beside Ends.
  Publishing requires it, the end must come after the start, and picking a
  start pre-fills `date_label` and a default end three hours later.
  `date_label` stays free text for how the date reads in print.

**What is live now** (live database, 2026-11-11): two published events.
Mahjong in Bloom ended 2026-07-28 and stays in the admin list as history.
**Shuffles for Snowshoes** is the featured event: `winter` decor, ends
2027-01-21 at 7:49 PM Mountain, uses an external sign-up link, and has no
sessions, so the site shows the external link rather than the registration
form. No `event_registrations` rows exist yet, and no event has a `theme` or
uploaded image.

Code map:

| Area | Files |
| --- | --- |
| Subscribers | `lib/subscribers.ts`, `lib/subscriber-rules.ts`, `app/api/subscribe/`, `app/api/unsubscribe/`, `app/unsubscribe/`, `app/resubscribe/` |
| Sending | `lib/sends.ts`, `lib/send-rules.ts`, `emails/`, `app/admin/(gated)/compose/`, `app/admin/(gated)/sends/`, `app/api/webhooks/resend/` |
| Events | `lib/events.ts`, `lib/event-rules.ts`, `lib/event-theme.ts`, `app/admin/(gated)/events/`, `components/featured-event-hero.tsx`, `components/event-announcement-bar.tsx`, `components/event-hero-*-decor.tsx` |
| Registration | `lib/registrations.ts`, `lib/registration-rules.ts`, `app/api/register/`, `app/cancel-registration/`, `app/admin/events/[id]/registrants.csv/` |
| Admin and auth | `lib/auth.ts`, `lib/team.ts`, `lib/team-rules.ts`, `proxy.ts`, `app/admin/login/`, `app/auth/confirm/`, `app/admin/(gated)/team/` |
| AI designer | `lib/theme-designer.ts`, `docs/ai-event-designer.md` |
| Compliance | `app/terms/`, `app/privacy/`, `lib/business.ts`, `lib/consent.ts` |

Schema lives in `supabase/migrations/` (8 migrations, latest
`20261102222514_event_starts_at.sql`). Auth config is code in
`supabase/config.toml` plus `supabase/templates/`.

## The one thing blocking the most value

**`BUSINESS_MAILING_ADDRESS` in `lib/business.ts` is still `null`, and that is
deliberate for now.** As of 2026-11-11 the business does not have a mailing
address yet, so this is deferred, not forgotten. Do not prompt Tyler for it or
invent a placeholder.

CAN-SPAM requires a physical mailing address in every announcement email. While
that constant is null, `sendAction` in `app/admin/(gated)/compose/actions.ts`
refuses real sends. **Test sends are not blocked:** `testSendAction` in the same
file sends to the logged-in admin, and the footer renders
`[Mailing address not set]`.

The send pipeline has never run: the live database has 0 rows in `sends` and 0
in `send_recipients` (verified 2026-11-11). This is Phase 1's M8 and Phase 2's
P1.

## Outstanding manual steps

These need dashboard access or a decision, so a coding session cannot clear
them. The checkboxes in the plan files are stale; this table is the real state.

| Step | Status |
| --- | --- |
| Phase 1 M1 to M5, Supabase project, link, env vars, closed signups, magic link template | **Done** |
| Phase 1 M6, invite and promote admins | **Done.** Invites go through `/admin/team`, no SQL needed. Several `profiles` rows have `role = 'admin'` and sign-in works in production (verified from the live database 2026-11-11) |
| Phase 1 M7, import the spreadsheet and old Resend audience | **Outstanding** |
| Phase 2 P1, mailing address | **Deferred** until the business has an address. Blocks real sends only |
| Phase 2 P2, Resend webhook plus `RESEND_WEBHOOK_SECRET` | **Secret done.** Set in Vercel Production and Preview since late July, and the live endpoint answers an unsigned request with `401 Invalid signature` rather than `500 Not configured` (verified 2026-11-11). Whether the webhook entry exists in the Resend dashboard with the right three events is **unverified** |
| Phase 2 P3, webhook test event returns 2xx | **Outstanding.** Doable now, independent of P1 |
| Phase 2 P4, migrations applied | **Done.** All 8 local migrations match the remote history (verified 2026-11-11) |
| Phase 2 P5, test send, Gmail render, one-click unsubscribe flips the row | **Render check doable now** via a test send. The unsubscribe-flip check is **blocked by P1**: test sends carry the token `test`, which matches no subscriber, so only a real send can exercise it |
| Auth email templates pasted into the Supabase dashboard | **Unverified.** Free-tier projects cannot edit templates on the default mailer, which is why custom SMTP via Resend is configured |

## Open decisions

Re-checked 2026-11-11. Resolved since July and dropped: the two admin addresses
(M6 is done, four `profiles` rows are admins), whether a next featured event
exists (Shuffles for Snowshoes is live through 2027-01-21), and whether
`ANTHROPIC_API_KEY` is set in production (it is, see Verification notes).

- **The full mailing address (P1).** Deferred until the business has one.
- **Shuffles for Snowshoes has no start time.** It was published before PR #13,
  so `starts_at` is null. Nothing breaks on the site, but the next save of that
  event as published will be refused with "Pick when the event starts." Whoever
  edits it next should set Starts.
- **`claude/bold-fermi-ptacmj`.** Unmerged commit, no PR. Decide whether to
  open a PR or delete the branch.
- **The site owner's onboarding.** Tyler was deliberately holding her admin
  invite until cleanup he had not yet enumerated. Worth asking whether that
  list still exists, since the Team page now makes the invite a one-click
  action.
- **M7 normalization.** Dashboard CSV imports bypass `lib/subscribers.ts`, so
  the CSV must be lowercased, trimmed, and deduped *before* upload or the
  unique index will reject rows and casing will leak in.
- **`RESEND_AUDIENCE_ID` is legacy.** Unused by code since the Phase 1
  migration. It is the export source for M7, so remove it from Vercel only
  after that import is done.

## Gotchas

Things a cold session will get wrong without being told.

**This is not the Next.js in your training data.** `AGENTS.md` says 16.2.1 has
breaking changes to APIs, conventions, and file structure. Read the relevant
guide in `node_modules/next/dist/docs/` before writing route handlers,
middleware, or auth code. Routing middleware is a root `proxy.ts`, not
`middleware.ts`, matched to `/admin/:path*` only.

**No em dashes or en dashes in user-facing copy, ever.** An `AGENTS.md` rule,
already enforced repo-wide once in commit `7386c6a`. It covers page text,
button labels, metadata descriptions, and data files. Time ranges use a plain
hyphen: `4:45 - 8:00 PM`.

**Never send a file upload through a server action.** Next.js server actions
cap request bodies at 1 MB by default, and a larger body fails before your code
runs. That is what broke event photo uploads until PR #13. Use the pattern in
`createEventImageUploadAction` (`app/admin/(gated)/events/actions.ts`): the
action calls `requireAdmin()`, validates the file's type and size, and returns a
one-time signed upload URL from `createSignedUploadUrl`; the browser then
uploads straight to Supabase Storage with `uploadToSignedUrl`
(`app/admin/(gated)/events/event-editor.tsx`). Enforce the same limits on the
bucket, as `20261102222514_event_starts_at.sql` does for `event-images`. Do not
raise `serverActions.bodySizeLimit` instead.

**Two different things are called "events".** `data/events.ts` is a static
catalog of what the business offers (private parties, lessons, charity) used for
marketing cards. `lib/events.ts` is the database-backed scheduled events with
sessions, themes, and registration. `data/featured-event.ts` is gone; the
featured event comes from `getFeaturedEvent()`.

**Admin login never creates accounts.** `/admin/login` calls `signInWithOtp`
with `shouldCreateUser: false`, so an address with no account gets no email and
Supabase logs `422: Signups not allowed for otp`. The page still says "If that
address has access, a link is on its way" on purpose, so it never reveals which
emails have accounts. The fix for "I requested access but got no email" is
always: an existing admin invites that exact address from `/admin/team`. If an
invite link expires, the Team page cannot re-send it, because the address
already has an account. Trying `/admin/login` is the first thing to attempt but
is **unverified**; Supabase may send its default confirm-signup email instead of
the magic link. Failing that, delete the user in the dashboard and re-invite.

**Never flip `[auth.email] enable_signup` in `supabase/config.toml`.** It maps
to the email *provider* toggle, not signups, and setting it false disables
sign-in entirely (magic links return 422). To close signups while keeping
login: `[auth] enable_signup = false` globally, plus `shouldCreateUser: false`
in the app. There is a warning comment at that line.

**`requireAdmin()` must be called inside every admin server action.** The
layout check only protects rendering; actions are directly invokable by POST.
Role comes from `public.profiles.role`, never `user_metadata`, which is
user-editable.

**`SUPABASE_SECRET_KEY` must never be `NEXT_PUBLIC_` prefixed.** RLS is enabled
with no policies for `anon` or `authenticated`, so all access runs server-side
through the secret key.

**Every subscriber write goes through `lib/subscribers.ts`.** No caller talks to
Supabase directly. That keeps the resubscribe rules auditable in one place.
`complained` is a hard stop that no client-supplied field can resurrect.

**`lib/consent.ts` is an audit trail, not a constants file.** No per-subscriber
`consent_text` is stored. The wording lives alone in that module and its git
history, paired with a row's `created_at`, is the record of what was agreed to.
Editing it rewrites the meaning of past consent.

**The inquiry forms must never fail on a subscriber write.**
`app/api/contact/route.ts` sends the notification email first, then writes the
subscriber inside its own `try/catch` that only logs. Preserve that ordering.

**The Supabase connector records migrations under its own timestamp.** When a
migration is applied through the connector instead of `supabase db push`, the
remote history gets a different version than the local filename. The remote
version then has no local file, and `supabase db push` refuses to run until they
match. Fix by renaming the local file to the remote version (commits `68f13a9`
and the event_theme rename both did this). Check with
`supabase migration list --linked`.

**End sessions with `/close-out`.** The project skill at
`.claude/skills/close-out/SKILL.md` audits git, PR, deploy, migrations, and docs
and says whether the session is safe to archive.

## Local setup traps

Hit for real, each costing a debugging round.

**Run `npm install` after pulling.** On 2026-11-11 a stale `node_modules` from
July made 5 test files fail with "Cannot find package `@react-email/render`" and
"`@anthropic-ai/sdk`", which look like code faults but are just a missing
install.

**Git worktrees are not Supabase-linked.** Run
`supabase link --project-ref <ref>` inside a new worktree before `supabase db
push`. The ref is in `.env.local` and `supabase/.temp/project-ref`.

**A worktree under `.claude/worktrees/` poisons lint.** `eslint.config.mjs` does
not ignore it, so a checkout living there gets linted too. On 2026-11-11 one
produced 20,001 problems; removing the worktree brought lint back to clean. If
lint output looks absurd, check `git worktree list` first.

**Local Node breaks `supabase-js` scripts.** PATH prefers node@20, which has no
native WebSocket. Use `/opt/homebrew/bin/node`, or plain `fetch` against
PostgREST for one-off scripts. Vercel runs Node 24 and is unaffected.

**`supabase projects api-keys` truncates the secret key.** It returns a masked
value that fails with "Invalid API key". Pass `--reveal`.

**Auth config deploys with `supabase config push`**, and the whole `[auth]`
section applies atomically. Export `RESEND_API_KEY` first, since
`config.toml` references it for SMTP.

## Verification notes

Verified 2026-11-11 in this repo: the branch and worktree state; the code map
and migration list; `BUSINESS_MAILING_ADDRESS` is `null` on `main`; the webhook
route exists and reads `RESEND_WEBHOOK_SECRET`; `data/featured-event.ts` is
gone while `data/events.ts` remains in use; `npm test` passes 162 tests across
21 files; `npm run lint` is clean; `npm run build` succeeds.

Verified again later on 2026-11-11 from a fresh clone, the Supabase connector,
and the Vercel connector: `npm test` passes 162 tests across 21 files and
`npm run lint` is clean; all 8 migrations are applied to the hosted project; four `profiles` rows,
all `role = 'admin'`; two subscribers; zero sends and zero registrations; the
two events and their fields described under "What is live now"; the
`event-images` bucket is public with a 5 MB limit and jpeg, png, webp only; the
latest production deployment (`ad44630`) is Ready; the remote branch list and
that no PR is open.

Carried from session memory rather than re-verified: the Supabase and Resend
configuration traps above, and the M7 normalization requirement.

Also verified 2026-11-11: `ANTHROPIC_API_KEY` and `RESEND_WEBHOOK_SECRET` are
set in Vercel Production (`vercel env ls --environment production`); the
webhook endpoint returns 401 to unsigned requests; all migrations are in sync.

Unverified: whether the Resend dashboard webhook exists with the right events;
whether the
`supabase/config.toml` auth settings and email templates have been pushed to
the remote project; and the size and contents of the owner's spreadsheet list.
