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
- Transactional email via Resend (`resend` 6.9.4)
- Deployed on Vercel, project `rack-in-the-rockies` (link lives in the
  gitignored `.vercel/`)
- Content lives in typed modules under `data/`, not a CMS

Read `AGENTS.md` before writing code. Two rules there are load-bearing and are
repeated in the gotchas section below.

## Branch and deploy state

| Branch | Commit | Where it lives | Status |
| --- | --- | --- | --- |
| `main` | `9c0c10b` + this doc | pushed, deployed to production | Carries this doc and nothing else beyond `9c0c10b` |
| `feat/newsletter-signup` | `ac1c833` | pushed | 3 commits ahead of `main`, not merged |
| `mahjong-in-bloom` | `39277b4` | local only, **stale** | Superseded, safe to delete |

Production is whatever is on `main`. There is no staging branch. `origin` has
`main` and `feat/newsletter-signup`.

This doc lives on both `main` and `feat/newsletter-signup`. All other in-flight
work lives only on `feat/newsletter-signup`, so **check that branch out before
concluding something is missing.**

`mahjong-in-bloom` is a leftover. Its single commit is patch-identical to
`39ef510`, which is already on `main`, and `main` has moved several commits past
it. It carries no unique work. It is kept only because deleting branches was out
of scope for the sweep that produced this doc.

## Active workstreams

### 1. Subscriber management, Phase 1: spec approved, zero implementation

**Driving spec:** `docs/superpowers/specs/2026-07-30-subscriber-management-phase-1-design.md`

That file is on `feat/newsletter-signup` only. It does not exist on `main`, so
the path above will not resolve from a checkout of `main`.
[View it on the branch.](https://github.com/Rack-in-the-Rockies/rack-in-the-rockies/blob/feat/newsletter-signup/docs/superpowers/specs/2026-07-30-subscriber-management-phase-1-design.md)

**The pushed spec may be behind.** At the time this doc was written the spec had
substantial uncommitted local revisions in progress: a second `public.profiles`
table with a roles model to support a planned scoring app, and removal of the
per-subscriber `consent_text` and `consented_at` snapshot in favor of relying on
the git history of the consent constant. None of that is pushed. If the pushed
spec still describes a single table, it predates those revisions and Tyler's
local copy is authoritative.

This is the main in-flight workstream and the reason `feat/newsletter-signup`
exists. The spec is thorough and marked "Approved, ready for implementation
planning". **No code from it has been written yet.** The branch contains the
spec and the older signup UI, nothing else.

The spec's premise is that three things are half-built and in conflict:

1. `components/newsletter-signup.tsx` posts directly to a Kit (ConvertKit) URL
   that is still a `REPLACE_ME` placeholder
2. `app/api/contact/route.ts` silently adds every form submitter to a Resend
   audience with no consent notice and no unsubscribe path
3. The owner's real contact list lives in a spreadsheet, connected to neither

Phase 1 replaces all three with a Supabase-backed `subscribers` table, one
server-side write path in `lib/subscribers.ts`, a `/api/subscribe` route, a
token-based `/unsubscribe` page, and an `/admin` portal. Phase 1 explicitly does
not send any email; that is Phase 2.

**Next steps, in order:**

1. Write an implementation plan from the spec. The spec is a design doc, not a
   task list.
2. Create the Supabase project and the `subscribers` migration. Use
   `supabase migration new`, do not hand-author migration filenames.
3. Build `lib/subscribers.ts` and its tests first. The resubscribe status matrix
   in the spec is the part most likely to be got wrong, and the spec lists the
   exact cases to cover.
4. Then `/api/subscribe`, then the form changes, then `/unsubscribe`, then
   `/admin`.
5. Run the two data migrations (spreadsheet CSV, existing Resend audience) last.

**Blocked on nothing in the repo.** Whether the Supabase project has been
created outside the repo is **unverified**. There is no Supabase dependency in
`package.json` and no Supabase keys in `.env.local.example`, so assume it does
not exist yet.

### 2. Newsletter signup UI: done but non-functional, unshipped

**Commit:** `1e695d0` on `feat/newsletter-signup`

`components/newsletter-signup.tsx` is built and placed in two spots: the footer
(above the link columns) and the homepage (between the Learn/Trips split and the
final CTA). It has idle/sending/sent/error states and a `light` variant for dark
backgrounds.

**It does not work.** `KIT_FORM_URL` at
`components/newsletter-signup.tsx:8` is
`https://app.kit.com/forms/REPLACE_ME/subscriptions`. Submissions go nowhere and
the component reports an error to the user.

Do not fix this by filling in a Kit URL. The Phase 1 spec explicitly rejects Kit
and instructs removing `KIT_FORM_URL` and the direct third-party POST entirely,
replacing it with a POST to `/api/subscribe`. This component is superseded by
workstream 1 and should change as part of it.

Because this is unshipped, production currently shows no signup form at all,
which is the correct state given the form would not work.

The same commit also points the footer Instagram link at
`instagram.com/rackintherockies2026`. That part is good and is only unshipped
because it shares a commit with the signup work.

### 3. Mahjong in Bloom event: shipped, now expired

**Files:** `data/featured-event.ts`, `components/featured-event-hero.tsx`,
`components/event-announcement-bar.tsx`

Shipped to `main` and live. The featured-event system auto-hides the hero and
homepage announcement bar after `endsAt` passes, and pages revalidate hourly.

`endsAt` is `2026-07-28T20:00:00-06:00`, which is in the past. **The site is
currently showing no featured event.** If there is a next event, updating
`data/featured-event.ts` is a one-file change. If there is not, the current
state is correct and needs nothing.

### 4. Compliance pages: required by Phase 1, do not exist

The Phase 1 spec requires `/terms` and `/privacy`, linked from the footer, both
stating the business's physical mailing address. Neither route exists under
`app/`, and the footer has no link to either. This is a hard dependency of
workstream 1, not optional polish, and the mailing address is an input only the
owner can supply.

## Open decisions

- **Business mailing address for `/terms` and `/privacy`.** Required by the
  Phase 1 spec and by Phase 2 sends. Not present anywhere in the repo.
- **Whether a next featured event exists.** See workstream 3. If yes,
  `data/featured-event.ts` needs new values.
- **Whether `mahjong-in-bloom` can be deleted.** It carries no unique work. The
  answer is almost certainly yes, but the branch is left alone until confirmed.
- **Whether `feat/newsletter-signup` should merge to `main` before Phase 1 is
  built.** Merging ships a signup form that does not work. Leaving it unmerged
  means the Instagram link fix stays unshipped too. Splitting the Instagram fix
  into its own commit onto `main` is the obvious resolution but has not been
  done.

## Gotchas

Things a cold session will get wrong without being told.

**This is not the Next.js in your training data.** `AGENTS.md` says version
16.2.1 has breaking changes to APIs, conventions, and file structure. Read the
relevant guide in `node_modules/next/dist/docs/` before writing route handlers,
middleware, or auth code. Do not write App Router APIs from memory.

**No em dashes or en dashes in user-facing copy, ever.** This is an `AGENTS.md`
rule and it has already been enforced repo-wide once, in commit `7386c6a`. It
covers page text, button labels, metadata descriptions, and data files. Time
ranges use a plain hyphen: `4:45 - 8:00 PM`.

**`app/api/contact/route.ts` writes to a Resend audience today.** The
`resend.contacts.create` call is guarded by `RESEND_AUDIENCE_ID` being set and
its failure is swallowed by `.catch(() => {})` so the form never fails. That
audience likely holds real contacts collected without a consent notice, which is
exactly why the spec has a `resend-migration` source. Do not delete this code
path before migrating the data out of it.

**The signup component is a client component posting cross-origin.** It uses
`"use client"` and `fetch` straight from the browser to a third-party host. Phase
1 removes this. Do not build on it.

**`SUPABASE_SECRET_KEY` must never be `NEXT_PUBLIC_` prefixed.** The spec's RLS
design deliberately grants no policies to `anon` or `authenticated` and relies
entirely on server-side access with the secret key. Prefixing that variable
would expose the whole subscriber table.

**Admin authorization must not read `user_metadata`.** It is user-editable in
Supabase. The spec calls for a server-side email allowlist instead.

**Secrets are not in the repo and should stay that way.** `.gitignore` covers
`.env*` except `.env*.example`, plus `.vercel/`, `.next/`, and `.DS_Store`.
`.env.local.example` holds placeholder values only.

## Verification notes

Verified from repo contents and git history: branch and deploy state, all file
paths and line references, the `REPLACE_ME` placeholder, the Resend audience
write, the absent `/terms` and `/privacy` routes, the expired `endsAt`, the
`mahjong-in-bloom` patch-id match, dependency versions.

Unverified and assumed: whether a Supabase project exists outside the repo,
whether `RESEND_AUDIENCE_ID` is actually set in the Vercel environment and
therefore whether the audience write is live in production, and the size and
contents of the owner's spreadsheet list.
