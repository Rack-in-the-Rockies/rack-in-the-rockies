export type TeamRole = "admin" | "member";

/**
 * Guardrails for role changes. Returns null when allowed, otherwise a
 * plain-language refusal. Two lockout protections: you cannot change your
 * own role, and the last admin cannot be demoted.
 */
export function canChangeRole(args: {
  actorId: string;
  targetId: string;
  targetNewRole: TeamRole;
  adminCount: number;
}): string | null {
  if (args.actorId === args.targetId) {
    return "You cannot change your own role. Ask another admin.";
  }
  if (args.targetNewRole === "member" && args.adminCount <= 1) {
    return "That is the last admin. Promote someone else before demoting them.";
  }
  return null;
}
