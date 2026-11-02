---
name: close-out
description: End-of-session audit. Reviews everything the session did, verifies it is committed, pushed, merged, deployed, migrated, and documented, surfaces any decisions only the user can make (with options and a recommendation), and ends with a clear verdict on whether the session is safe to archive. Use when the user says "close out", "wrap up", "are we done", "can I archive this", or invokes /close-out.
---

# Close-out

The goal is one honest answer to one question: **can this session be archived
without losing work or leaving something half-done?** Cloud sessions run in an
ephemeral container. Anything that exists only in the container, only in the
chat, or only in your head is gone once it is archived.

Work through the phases in order. Phases 1 to 4 are read-only: gather facts,
do not fix anything yet. Fixes come in phase 5, and only with the user's go-ahead
for anything outward-facing.

## Phase 1: Reconstruct the session

Re-read the conversation from the start and build an inventory. For each item,
note what was asked, what was done, and what evidence exists that it was done.

- **Requests:** every distinct thing the user asked for, including small
  side questions.
- **Code changes:** files created, edited, or deleted.
- **Side effects outside the repo:** database writes (`execute_sql`,
  `apply_migration`), Supabase auth or settings changes, Vercel env vars or
  deploys, emails sent or drafted, invites, calendar events, GitHub comments,
  PRs, artifacts published, scheduled tasks or reminders created, PR
  subscriptions.
- **Open offers:** anything you said you "can do if you'd like" or "could
  follow up on". These are easy to forget and the user may assume they happened.
- **Questions you asked that were never answered.**
- **Answers you gave that rested on assumptions** you never verified.

A session that was only a question (no changes) still gets a close-out: check
for open offers and unverified claims, then it is usually archivable.

## Phase 2: Verify the state of every change

Check real state with tools. Never report something as done from memory.

### Git

Run and read:

```bash
git status -sb
git fetch origin
git log --oneline origin/main..HEAD
git log --oneline HEAD..origin/main
git stash list
```

Flag:
- Uncommitted or untracked files (decide per file: commit, or intentionally discard).
- Commits not pushed to the session's designated branch.
- Stashes.
- Work on the wrong branch.
- The branch being behind `main` in a way that will conflict.

### Pull request

Use the GitHub MCP tools (`list_pull_requests`, `pull_request_read`) for the
session branch:
- Does a PR exist? If the work is meant to ship and none exists, that is a
  decision for the user (do not open one unasked).
- Is it open, merged, or closed? Mergeable? Conflicts?
- CI and checks: green, red, pending?
- Unresolved review comments?
- If merged, confirm the merge commit is on `origin/main`.

### Checks the repo expects

If code changed, run the fast checks on it and report actual results:

```bash
npm run lint
npm test
```

Run `npm run build` too when the change touched routing, config, or server
code. A failing check is a blocker, not a footnote.

### Deploy (Vercel)

If anything merged to `main`, use the Vercel MCP tools to confirm the
production deployment for that commit is `READY`, not `ERROR` or still
building. If the change needs new env vars, confirm they exist in the right
environments (`filter_project_envs`); never print secret values.

### Database (Supabase)

- Compare `supabase/migrations/` against `list_migrations` on the live
  project. Every applied migration needs a matching file in the repo, with a
  matching version, and every committed migration that is meant to be live
  should be applied.
- Any schema or data change made with `execute_sql` during the session must
  either be captured in a migration file or be explicitly noted as a one-off
  data fix. Schema drift that lives only in the live database is a blocker.
- Run `get_advisors` (security) if the session changed tables, policies, or
  functions.

### Other side effects

For each external action from phase 1, confirm it landed (the email sent,
the invite exists, the artifact published, the reminder scheduled) or note
that it is still pending on the user.

## Phase 3: Documentation

Ask: would a cold session next week understand what changed and why?

- `docs/plans/CURRENT-STATE.md` is the orientation doc for this repo. If the
  session shipped a feature, changed branch or deploy state, added a workstream,
  or changed a gotcha, it needs an update (including its "Last updated" date).
- Specs and plans live in `docs/superpowers/specs/` and `docs/superpowers/plans/`.
  A new feature with non-obvious design choices should have its reasoning
  written down somewhere in the repo, not only in this chat.
- `AGENTS.md` holds rules for future agents. If the session uncovered a rule
  that would have prevented a mistake (a gotcha, a convention), propose adding it.
- Knowledge that is not code (an ops answer, a diagnosis, a runbook step like
  "new admins must be invited from /admin/team") is worth keeping if it is
  likely to come up again. Propose where it should live; do not add docs for
  their own sake.
- User-facing copy added this session must follow the copy style rule in
  `AGENTS.md` (no em or en dashes). Grep the diff for them.

## Phase 4: Decisions only the user can make

Collect everything that needs the user. Typical ones: merge this PR or not,
open a PR, discard vs keep an uncommitted experiment, apply a migration to
production, send a reply to a customer, follow up on an open offer, whether to
document something.

For **each** decision, present it like this:

```
### Decision N: <short question>
Why it matters: <one or two sentences, including what happens if ignored>
Options:
  A. <option> - <consequence>
  B. <option> - <consequence>
  C. <option> - <consequence> (only if real)
Recommendation: <letter>, because <reason>.
```

Rules:
- Recommend exactly one option and say why. Do not hedge.
- Only list options you would actually carry out.
- Do not invent decisions to look thorough. If something has an obvious right
  answer and is inside what the user already authorized, just do it in phase 5
  and report it.
- If there are 1 to 4 decisions, you may also use AskUserQuestion so the user
  can answer quickly, recommended option first.

## Phase 5: Fix what you can

Things you may do without asking, because they are inside normal session
authority: commit and push to the session's designated branch, add a missing
migration file that mirrors an already-applied change, update docs, run checks.

Things that need the user's explicit yes: opening or merging a PR, applying a
migration to production, sending anything to another person, deleting work,
changing production settings or env vars.

After fixing, re-verify (re-run `git status`, re-check the PR, and so on).
Do not trust that a push or merge worked without looking.

## Phase 6: The report and verdict

Keep it short and scannable. Use this structure:

```
## Close-out

**What this session did**
- <one line per request, with outcome>

**State**
| Item | Status | Evidence |
|---|---|---|
| Code committed and pushed | done / not done / n.a. | <branch, commit sha> |
| PR | merged / open / none / n.a. | <link> |
| Checks (lint, test, build) | pass / fail / not run | <counts> |
| Deploy | ready / failed / n.a. | <deployment> |
| Database migrations | in sync / drift / n.a. | <detail> |
| Docs | updated / needed / n.a. | <file> |
| External actions | done / pending | <detail> |

**Fixed during close-out**
- <what you did just now, if anything>

**Decisions for you**
<decision blocks from phase 4, or "None.">

**Verdict**
```

The verdict is one of exactly three, worded plainly:

- **Ready to archive.** Everything is saved where it belongs and nothing is
  waiting on you. Only say this if every row above is done or n.a. and you
  verified each one with a tool this turn.
- **Ready to archive once you decide N.** Nothing will be lost, but the listed
  decisions are open. Say what happens to each if they archive anyway.
- **Not ready to archive.** Name the specific thing that would be lost or
  broken (for example "3 commits exist only in this container") and what it
  takes to fix it.

If something could not be checked (a tool was unavailable, a connector failed),
say so in the table and do not give the first verdict. "I could not verify X"
is better than a false all-clear.

Write the report in plain language. Use links for PRs (full GitHub URL) and
`file:line` for code. No em or en dashes.
