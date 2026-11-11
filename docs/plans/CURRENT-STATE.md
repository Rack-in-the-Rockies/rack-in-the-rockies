# Current State

Last updated: 2026-11-11

Orientation doc for a cold session (including Claude Code on the web) picking up
this repo with no prior context. Derived from repo contents, git history, a
passing test, lint, and build run, and the notes carried in session memory.
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

## What is shipped

Four phases are built, merged, and live. Specs and plans are in
`docs/superpowers/`, and they remain the best explanation of *why* each piece
works the way it does.

| Phase | What it does | Driving docs |
| --- | --- | --- |
| 1, subscriber management | Subscribers table, consent notices, unsubscribe and resubscribe, role-gated `/admin` | [spec](../superpowers/specs/2026-07-30-subscriber-management-phase-1-design.md), [plan](../superpowers/plans/2026-07-30-subscriber-management-phase-1.md) |
| 2, announcement sending | Composer, React Email templates, batched send pipeline, send history, Resend webhooks | [spec](../superpowers/specs/2026-07-30-announcement-sending-phase-2-design.md), [plan](../superpowers/plans/2026-07-30-announcement-sending-phase-2.md) |
| 3A, event builder | Events and sessions in Postgres, admin editor with live preview, image upload, themes | [spec](../superpowers/specs/2026-07-31-event-builder-and-registration-phase-3-design.md), [plan](../superpowers/plans/2026-07-31-event-builder-phase-3a.md) |
| 3B, registration | Public registration form, capacity, confirmation email, cancel page, registrant CSV | [plan](../superpowers/plans/2026-07-31-event-registration-phase-3b.md) |

Since then: an admin Team page
([spec](../superpowers/specs/2026-08-01-admin-team-page-design.md)), a "Design
with AI" banner designer, winter event theming, and shop additions.

Code map:

| Area | Files |
| --- | --- |
| Subscribers | `lib/subscribers.ts`, `lib/subscriber-rules.ts`, `app/api/subscribe/`, `app/api/unsubscribe/`, `app/unsubscribe/`, `app/resubscribe/` |
| Sending | `lib/sends.ts`, `lib/send-rules.ts`, `emails/`, `app/admin/(gated)/compose/`, `app/admin/(gated)/sends/`, `app/api/webhooks/resend/` |
| Events | `lib/events.ts`, `lib/event-rules.ts`, `lib/event-theme.ts`, `app/admin/(gated)/events/`, `components/event-hero-*-decor.tsx` |
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
| Phase 2 P2, Resend webhook plus `RESEND_WEBHOOK_SECRET` | **Done.** The Resend webhook for `https://rackintherockies.com/api/webhooks/resend` is enabled for `email.bounced`, `email.complained`, and `email.delivered`. The secret is set in Vercel Production and Preview, and an unsigned request gets `401 Invalid signature` (verified 2026-11-11) |
| Phase 2 P3, webhook test event returns 2xx | **Done, with real traffic.** Resend's log shows real `email.delivered` events from admin invite emails answered `200 {"received":true}` on the first attempt, so signature verification works end to end in production (verified 2026-11-11) |
| Phase 2 P4, migrations applied | **Done.** All 8 local migrations match the remote history (verified 2026-11-11) |
| Phase 2 P5, test send, Gmail render, one-click unsubscribe flips the row | **Render check done** 2026-11-11: an event announcement test send reached the Gmail inbox (not spam) with correct branding and footer. The unsubscribe-flip check is **blocked by P1**: test sends carry the token `test`, which matches no subscriber. Gmail's own sender-line Unsubscribe link did not appear, which is normal for a new low-volume sender; the `List-Unsubscribe` headers are set on test and real sends alike |
| Auth email templates pasted into the Supabase dashboard | **Unverified.** Free-tier projects cannot edit templates on the default mailer, which is why custom SMTP via Resend is configured |

## Open decisions

- **The full mailing address (P1).** Deferred until the business has one.
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

**Auth emails hit the send webhook too.** Supabase auth email (magic links,
invites) goes out through Resend SMTP, so its delivery events reach
`/api/webhooks/resend` even though they belong to no send. The handler accepts
them and returns 200. Expect them in the Resend webhook log; they are not a
fault.

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

Carried from session memory rather than re-verified: the Supabase and Resend
configuration traps above, and the M7 normalization requirement.

Also verified 2026-11-11: `ANTHROPIC_API_KEY` and `RESEND_WEBHOOK_SECRET` are
set in Vercel Production (`vercel env ls --environment production`); the
webhook endpoint returns 401 to unsigned requests; all migrations are in sync.

Also verified 2026-11-11 from the Resend dashboard: the webhook entry exists,
is enabled for all three events, and has delivered real events successfully.

Unverified: whether the
`supabase/config.toml` auth settings and email templates have been pushed to
the remote project; and the size and contents of the owner's spreadsheet list.
