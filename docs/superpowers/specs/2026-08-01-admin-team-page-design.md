# Admin Team Page

Date: 2026-08-01
Status: Approved by Tyler (chat), compact spec for a small feature
Branch: `feat/admin-team`

## Problem

Granting the admin role is a database-level change with no UI. Inviting an
admin is two disconnected steps (dashboard invite, then a SQL role grant),
and forgetting the second produces a silent sign-in loop, exactly what
happened with Annie's onboarding.

## Design

**`/admin/team`** (nav link after Sends):

- Table/cards of every login: email, display name, role badge, last sign-in.
- **Invite an admin**: email input; one action sends the Supabase invite
  (which uses the branded invite template) AND sets the new profile's role to
  `admin`. The two-step dance becomes one button.
- **Role toggle** per person: Make admin / Make member.

**Guardrails** (pure rules, unit tested):
- An admin cannot change their own role.
- The last admin cannot be demoted.
- Inviting an email that already has an account reports it plainly instead
  of erroring.
- Every server action calls `requireAdmin()` first (house rule).

**Modules**
- `lib/team-rules.ts`: `canChangeRole({ actorId, targetId, targetNewRole, adminCount })`
  returning `null` or a plain-language refusal.
- `lib/team.ts`: `listTeam()` (auth admin users + profiles join),
  `inviteAdmin(email)` (auth admin invite + role grant),
  `setRole(id, role)`. All server-side via the secret key.
- `app/admin/(gated)/team/page.tsx` + `actions.ts`.

## Non-goals

Deleting users, editing emails or display names, any password concept, more
roles than `admin`/`member`, member-facing surfaces. Pagination (the team is
single digits; `listUsers` default page of 50 is plenty for years).

## Testing

- Rules: self-change refused; last-admin demotion refused; promoting a
  member allowed; demoting a non-last admin allowed.
- Actions: reject without admin session; invite grants admin on the new
  profile; existing-account invite reports without throwing.
