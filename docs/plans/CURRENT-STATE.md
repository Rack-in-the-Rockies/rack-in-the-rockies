# Current State

Last updated: 2026-07-30

Orientation doc for a cold session (including Claude Code on the web) picking up
this repo with no prior context. Everything here is derived from repo contents,
git history, and the Vercel CLI. Anything not verifiable that way is marked
**unverified**.

## What this project is

`rack-in-the-rockies` is the marketing site for Rack in the Rockies, a Colorado
mahjong events business. It is a Next.js app, not a Salesforce or backend
project.

- Next.js 16.2.1, React 19.2.4, Tailwind CSS 4, TypeScript
- Supabase (Postgres + Auth) for subscriber data, `@supabase/ssr`
- Transactional email via Resend (`resend` 6.9.4)
- Vitest for tests, `npm test`
- App Router, all marketing pages server-rendered for SEO
- Deployed on Vercel, project `rack-in-the-rockies` (link lives in the
  gitignored `.vercel/`)
- Content lives in typed modules under `data/`, not a CMS

Read `AGENTS.md` before writing code. Two rules there are load-bearing and are
repeated in the gotchas section below.

## Branch and deploy state

**`main` is the only branch, locally and on `origin`.** There is no feature
branch and no staging branch. Everything described in this doc is on `main` and
deployed to production.

`feat/newsletter-signup` carried all of Phase 1. It was merged into `main` on
2026-07-30 (merge commit `b673b49`) and then deleted from both local and
`origin`. `mahjong-in-bloom` was deleted the same day as a redundant duplicate.
Both are noted only so a stale reference elsewhere does not send anyone hunting
for a branch that is meant to be gone.

That history matters for one practical reason: **older notes and commit messages
refer to files "on the branch". Those paths are all on `main` now.**

## Active workstreams

### 1. Subscriber management, Phase 1: shipped, finishing setup

The dominant workstream. Both driving documents are on `main`:

- [`docs/superpowers/specs/2026-07-30-subscriber-management-phase-1-design.md`](../superpowers/specs/2026-07-30-subscriber-management-phase-1-design.md),
  the design and the reasoning behind it
- [`docs/superpowers/plans/2026-07-30-subscriber-management-phase-1.md`](../superpowers/plans/2026-07-30-subscriber-management-phase-1.md),
  the task-by-task implementation plan and the M1 to M8 manual prerequisites

**Code complete, merged, and live.** 34 tests pass across 4 files, `npm run
lint` is clean, and the latest production deployment is Ready (all verified
2026-07-30).

What exists:

| Area | Files |
| --- | --- |
| Schema | `supabase/migrations/20260730225236_subscriber_management_phase_1.sql`, `profiles` + `subscribers` + RLS |
| Auth config | `supabase/config.toml`, `supabase/templates/magic-link.html` |
| Pure logic | `lib/subscriber-rules.ts`, `lib/rate-limit.ts` |
| Write path | `lib/subscribers.ts`, the single entry point every caller uses |
| Supabase clients | `lib/supabase/{admin,server,proxy}.ts` |
| Auth | `lib/auth.ts`, `proxy.ts`, `app/auth/confirm/route.ts` |
| Public endpoint | `app/api/subscribe/route.ts`, honeypot and rate limit |
| Subscriber pages | `app/unsubscribe/`, `app/resubscribe/` |
| Admin | `app/admin/(gated)/`, `app/admin/login/`, `app/admin/actions.ts` |
| Compliance | `app/terms/`, `app/privacy/`, `lib/business.ts`, `lib/consent.ts` |
| Forms | `components/consent-notice.tsx`, all four forms route through `subscribe()` |

Both problems the spec was written to fix are resolved in production: the Kit
`REPLACE_ME` placeholder is gone (the signup component posts to
`/api/subscribe`), and `resend.contacts.create` is gone from
`app/api/contact/route.ts`.

**Setup status.** The plan's checkboxes are all still unticked, but the work
behind several of them is done. Actual state:

| Step | Status |
| --- | --- |
| M1 create project | **Done.** `supabase/.temp/` holds a project ref |
| M2 link CLI | **Done.** `linked-project.json` present |
| M3 env vars | **Done.** `.env.local` exists, and all three Supabase vars are in Vercel Production |
| M4 close signups | **Done as code**, `enable_signup = false` under `[auth]` |
| M5 magic link template | **Done as code**, `site_url` plus `[auth.email.template.magic_link]` |
| M6 invite and promote admins | **Outstanding**, and the last thing blocking admin access |
| M7 import existing lists | **Outstanding** |
| M8 mailing address | **Outstanding**, not a Phase 1 blocker |

M4 and M5 were handled as config in the repo rather than dashboard clicks, which
is better but means they only take effect where that config has been applied.
Whether it has been pushed to the remote project is **unverified**: nothing in
the repo records a successful config push.

**Next step: M6.** Invite the two admin users, then promote them with the SQL in
the plan. `requireAdmin()` checks `public.profiles.role = 'admin'`, so until a
row says `admin`, `/admin` redirects to the login page for everyone, including a
successfully authenticated user. The footer now links to `/admin`, so this is
publicly reachable and worth closing out promptly.

**Do not start Phase 2.** It gets its own spec once Phase 1 is settled.

### 2. Mahjong in Bloom event: shipped, now expired

**Files:** `data/featured-event.ts`, `components/featured-event-hero.tsx`,
`components/event-announcement-bar.tsx`

Live. The hero and homepage announcement bar auto-hide after `endsAt` passes,
and pages revalidate hourly.

`endsAt` is `2026-07-28T20:00:00-06:00`, which is in the past, so **the site is
currently showing no featured event.** If there is a next event, updating
`data/featured-event.ts` is a one-file change. If there is not, the current state
is correct and needs nothing.

## Open decisions

- **The two admin addresses (M6).** Presumed Tyler and the site owner,
  **unverified**. Needed to finish admin access.
- **The full business mailing address (M8).** `lib/business.ts` ships
  `BUSINESS_LOCATION = "Denver, Colorado"`, fine for the website but not
  sufficient for CAN-SPAM footers once Phase 2 sends.
- **Whether a next featured event exists.** See workstream 2.
- **`RESEND_AUDIENCE_ID` is stale.** No longer read by any code, but still set in
  Vercel Production. Safe to remove once the M7 export is done, since that
  audience is the source for the `resend-migration` import.

## Gotchas

Things a cold session will get wrong without being told.

**This is not the Next.js in your training data.** `AGENTS.md` says version
16.2.1 has breaking changes to APIs, conventions, and file structure. Read the
relevant guide in `node_modules/next/dist/docs/` before writing route handlers,
middleware, or auth code. Note the repo has a root `proxy.ts`, not a
`middleware.ts`, matched to `/admin/:path*` only. Do not write App Router APIs
from memory.

**No em dashes or en dashes in user-facing copy, ever.** This is an `AGENTS.md`
rule and it has already been enforced repo-wide once, in commit `7386c6a`. It
covers page text, button labels, metadata descriptions, and data files. Time
ranges use a plain hyphen: `4:45 - 8:00 PM`.

**`lib/consent.ts` is an audit trail, not a constants file.** The design
deliberately stores no `consent_text` or `consented_at` per subscriber. Instead
the consent wording lives alone in that one module, and its git history is the
record of what any given subscriber agreed to, paired with their `created_at`.
Changing that file rewrites the meaning of past consent, so treat edits to it as
a data decision and not a copy tweak.

**`SUPABASE_SECRET_KEY` must never be `NEXT_PUBLIC_` prefixed.** RLS is enabled
with no policies for `anon` or `authenticated`, so all access runs server-side
through the secret key. Prefixing it would expose the whole subscriber table.

**Admin authorization reads `public.profiles.role`, never `user_metadata`.**
Supabase's `raw_user_meta_data` is user-editable. `app/admin/actions.ts`
re-checks the role inside the server action rather than trusting the layout gate,
because actions are directly invokable by POST.

**Every subscriber write goes through `lib/subscribers.ts`.** No caller talks to
Supabase directly. That is what keeps the resubscribe rules auditable in one
place and the vendor choice reversible. Preserve it.

**`complained` is a hard stop.** No client-supplied field can resurrect a
complained address, and `source` is set server-side precisely so the resubscribe
rules cannot be bypassed. The tests cover this. Do not relax it.

**The inquiry forms must never fail on a subscriber write.**
`app/api/contact/route.ts` sends the notification email first, then does the
subscriber write inside its own `try/catch` that only logs. That ordering is what
kept contact, booking, and waitlist submissions working through the window when
Phase 1 was merged but Supabase was not yet configured. Preserve it.

**Secrets are not in the repo and should stay that way.** `.gitignore` covers
`.env*` except `.env*.example`, plus `.vercel/`, `.next/`, `.DS_Store`.
`supabase/.gitignore` additionally covers `.env.local`, `.env.keys`, and
`.temp/`, which is where the project ref lives. `.env.local.example` holds
`xxxx` placeholders only.

## Verification notes

Verified 2026-07-30 from repo contents, git history, a passing `npm test` and
`npm run lint`, a clean `npm run build`, and `vercel env ls` plus `vercel ls`:
the single-branch state, the file inventory above, the removal of the Kit
placeholder and `resend.contacts.create`, the presence of `.env.local` and a
linked project ref, the three Supabase vars in Vercel Production, a Ready
production deployment, the expired `endsAt`, and that `RESEND_AUDIENCE_ID` is
unreferenced in code.

Unverified: whether the `supabase/config.toml` auth settings have been pushed to
the remote project, whether any `profiles` row yet has `role = 'admin'`, which
two addresses are intended as admins, and the size and contents of the owner's
spreadsheet list.
