# Current State

Last updated: 2026-07-30

Orientation doc for a cold session (including Claude Code on the web) picking up
this repo with no prior context. Everything here is derived from repo contents
and git history. Anything not verifiable from the repo is marked **unverified**.

## What this project is

`rack-in-the-rockies` is the marketing site for Rack in the Rockies, a Colorado
mahjong events business. It is a Next.js app, not a Salesforce or backend
project.

- Next.js 16.2.1, React 19.2.4, Tailwind CSS 4, TypeScript
- App Router, all pages server-rendered for SEO
- Supabase (Postgres + Auth) for subscriber data, `@supabase/ssr`
- Transactional email via Resend (`resend` 6.9.4)
- Vitest for tests, `npm test`
- Deployed on Vercel, project `rack-in-the-rockies` (link lives in the
  gitignored `.vercel/`)
- Content lives in typed modules under `data/`, not a CMS

Read `AGENTS.md` before writing code. Two rules there are load-bearing and are
repeated in the gotchas section below.

## Branch and deploy state

| Branch | Commit | Where it lives | Status |
| --- | --- | --- | --- |
| `main` | `9c0c10b`, plus doc commits | pushed, deployed to production | Carries this doc and nothing else beyond `9c0c10b` |
| `feat/newsletter-signup` | `eb482ab` last code commit, plus doc commits | pushed | Ahead of `main` by all of Phase 1, not merged |

These are the only two branches, local and remote. Production is whatever is on
`main`. There is no staging branch.

**Almost all real work is on `feat/newsletter-signup`, not `main`.** Phase 1
subscriber management is fully implemented there and entirely absent from
production. If you check out `main` and conclude the work is missing, you are on
the wrong branch. Start with:

```
git checkout feat/newsletter-signup
```

A third branch, `mahjong-in-bloom`, was deleted on 2026-07-30. Its single commit
was patch-identical to `39ef510`, already on `main`, so nothing was lost. Noted
here only so a stale reference to it elsewhere does not send anyone looking.

## Active workstreams

### 1. Subscriber management, Phase 1: code complete, blocked on setup

The dominant workstream. Both driving documents live on
`feat/newsletter-signup` and neither exists on `main`, so these paths will not
resolve from a `main` checkout:

- `docs/superpowers/specs/2026-07-30-subscriber-management-phase-1-design.md`
  ([on the branch](https://github.com/Rack-in-the-Rockies/rack-in-the-rockies/blob/feat/newsletter-signup/docs/superpowers/specs/2026-07-30-subscriber-management-phase-1-design.md)),
  the design and the reasoning behind it
- `docs/superpowers/plans/2026-07-30-subscriber-management-phase-1.md`
  ([on the branch](https://github.com/Rack-in-the-Rockies/rack-in-the-rockies/blob/feat/newsletter-signup/docs/superpowers/plans/2026-07-30-subscriber-management-phase-1.md)),
  the task-by-task implementation plan, including the manual prerequisites list

**The code is written.** 17 commits took this from spec to a complete Phase 1.
All 34 tests pass across 4 test files and `npm run lint` is clean, both verified
2026-07-30.

What exists on the branch:

| Area | Files |
| --- | --- |
| Schema | `supabase/migrations/20260730225236_subscriber_management_phase_1.sql`, `profiles` + `subscribers` + RLS |
| Pure logic | `lib/subscriber-rules.ts`, `lib/rate-limit.ts` |
| Write path | `lib/subscribers.ts`, the single entry point every caller uses |
| Supabase clients | `lib/supabase/{admin,server,proxy}.ts` |
| Auth | `lib/auth.ts`, `proxy.ts`, `app/auth/confirm/route.ts` |
| Public endpoint | `app/api/subscribe/route.ts`, honeypot and rate limit |
| Subscriber pages | `app/unsubscribe/`, `app/resubscribe/` |
| Admin | `app/admin/(gated)/`, `app/admin/login/`, `app/admin/actions.ts` |
| Compliance | `app/terms/`, `app/privacy/`, `lib/business.ts`, `lib/consent.ts` |
| Forms | `components/consent-notice.tsx`, all four forms route through `subscribe()` |

The two problems the spec was written to fix are both resolved on the branch:
`KIT_FORM_URL` and its `REPLACE_ME` placeholder are gone (the signup component
now posts to `/api/subscribe`), and `resend.contacts.create` plus
`RESEND_AUDIENCE_ID` are gone from `app/api/contact/route.ts`.

**Blocked on 8 manual setup steps, none of them done.** They are M1 through M8 in
the plan's "Manual prerequisites" section and they need dashboard access, so a
coding session cannot clear them. Verified from the repo: there is no
`.env.local`, and `supabase/.temp/` contains no project ref, so the CLI is not
linked to a remote project.

In dependency order:

1. **M1, M2, M3.** Create the Supabase project, `supabase link --project-ref
   <ref>`, then put the URL, publishable key, and secret key in `.env.local` and
   in the Vercel project env vars. Nothing runs before this.
2. **M4, M5.** Disable public signup in Auth, and set the magic link email
   template and Site URL.
3. **M6.** Invite the two admin users, then promote them with the SQL in the
   plan. The admin portal is unusable until a `profiles` row has `role = 'admin'`.
4. **M7.** Import the spreadsheet CSV and the Resend audience export.
5. **M8.** Supply the full business mailing address. Not a Phase 1 blocker, but
   required before Phase 2 sends. See open decisions.

**Next steps for a coding session:** there is little code left to write. The
useful work is review of the branch, then merging it. Do not start Phase 2. It
gets its own spec once Phase 1 is live.

### 2. Newsletter signup: fixed on the branch, still broken in production

`components/newsletter-signup.tsx` appears in the footer and on the homepage.

On `feat/newsletter-signup` it posts to `/api/subscribe` and works. On `main`,
which is what production serves, it still posts to a Kit URL containing
`REPLACE_ME`, so **every signup attempt in production today fails and shows the
user an error.** That is the strongest argument for merging the branch.

### 3. Mahjong in Bloom event: shipped, now expired

**Files:** `data/featured-event.ts`, `components/featured-event-hero.tsx`,
`components/event-announcement-bar.tsx`

Live on `main`. The hero and homepage announcement bar auto-hide after `endsAt`
passes, and pages revalidate hourly.

`endsAt` is `2026-07-28T20:00:00-06:00`, which is in the past, so **the site is
currently showing no featured event.** If there is a next event, updating
`data/featured-event.ts` is a one-file change. If there is not, the current state
is correct and needs nothing.

## Open decisions

- **The full business mailing address (M8).** `lib/business.ts` ships
  `BUSINESS_LOCATION = "Denver, Colorado"`, which is fine for the website but is
  not sufficient for CAN-SPAM footers once Phase 2 sends. Only Tyler can supply
  it.
- **When to merge `feat/newsletter-signup` to `main`.** Merging fixes the broken
  production signup form and ships `/terms` and `/privacy`. But the admin portal
  and `/api/subscribe` will error until M1 through M3 give production its
  Supabase env vars, so the merge and the setup should land together.
- **Which two emails become admins (M6).** Presumed Tyler and the site owner,
  **unverified**.
- **Whether a next featured event exists.** See workstream 3.

## Gotchas

Things a cold session will get wrong without being told.

**This is not the Next.js in your training data.** `AGENTS.md` says version
16.2.1 has breaking changes to APIs, conventions, and file structure. Read the
relevant guide in `node_modules/next/dist/docs/` before writing route handlers,
middleware, or auth code. Note the repo has a root `proxy.ts`, not a
`middleware.ts`. Do not write App Router APIs from memory.

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
re-checks the role inside the server action rather than trusting the layout gate.

**Every subscriber write goes through `lib/subscribers.ts`.** No caller talks to
Supabase directly. That is what keeps the resubscribe rules auditable in one
place and the vendor choice reversible. Preserve it.

**`complained` is a hard stop.** No client-supplied field can resurrect a
complained address, and `source` is set server-side precisely so the resubscribe
rules cannot be bypassed. The tests cover this. Do not relax it.

**Secrets are not in the repo and should stay that way.** `.gitignore` covers
`.env*` except `.env*.example`, plus `.vercel/`, `.next/`, `.DS_Store`.
`supabase/.gitignore` additionally covers `.env.local`, `.env.keys`, and
`.temp/`. `.env.local.example` holds `xxxx` placeholders only.

## Verification notes

Verified from repo contents, git history, and a passing `npm test` run on
2026-07-30: branch and deploy state, the file inventory above, the removal of
`KIT_FORM_URL` and `resend.contacts.create`, the absence of `.env.local` and of a
linked Supabase project ref, the expired `endsAt`, dependency versions, and that
all 8 manual prerequisites are still unchecked in the plan.

Unverified and assumed: whether a Supabase project exists in the dashboard but
was simply never linked from this checkout, which two addresses are intended as
admins, and the size and contents of the owner's spreadsheet list.
