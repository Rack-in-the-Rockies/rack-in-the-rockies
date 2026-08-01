import { supabaseAdmin } from "@/lib/supabase/admin";
import { isValidEmail, normalizeEmail } from "@/lib/subscriber-rules";
import type { TeamRole } from "@/lib/team-rules";

export type TeamMember = {
  id: string;
  email: string;
  displayName: string | null;
  role: TeamRole;
  lastSignInAt: string | null;
};

/** Everyone with a login, admins first. Server-side only (auth admin API). */
export async function listTeam(): Promise<TeamMember[]> {
  const client = supabaseAdmin();
  const { data: usersData, error: usersError } = await client.auth.admin.listUsers({
    perPage: 100,
  });
  if (usersError) throw usersError;
  const { data: profiles, error: profilesError } = await client
    .from("profiles")
    .select("id, role, display_name");
  if (profilesError) throw profilesError;
  const byId = new Map(
    (profiles as { id: string; role: TeamRole; display_name: string | null }[]).map((p) => [
      p.id,
      p,
    ])
  );
  return usersData.users
    .map((u) => {
      const profile = byId.get(u.id);
      return {
        id: u.id,
        email: u.email ?? "",
        displayName: profile?.display_name ?? null,
        role: profile?.role ?? "member",
        lastSignInAt: u.last_sign_in_at ?? null,
      };
    })
    .sort((a, b) => (a.role === b.role ? a.email.localeCompare(b.email) : a.role === "admin" ? -1 : 1));
}

export async function countAdmins(): Promise<number> {
  const { count, error } = await supabaseAdmin()
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("role", "admin");
  if (error) throw error;
  return count ?? 0;
}

export type InviteResult =
  | { outcome: "invited"; email: string }
  | { outcome: "exists" }
  | { outcome: "invalid" };

/**
 * One action instead of two: sends the Supabase invite (branded template)
 * and grants the admin role on the trigger-created profile. Forgetting the
 * grant is what produced the silent sign-in loop during Annie's onboarding.
 */
export async function inviteAdmin(rawEmail: string): Promise<InviteResult> {
  const email = normalizeEmail(rawEmail);
  if (!isValidEmail(email)) return { outcome: "invalid" };
  const client = supabaseAdmin();
  const { data, error } = await client.auth.admin.inviteUserByEmail(email);
  if (error) {
    // Already-registered is an expected condition, not a failure.
    if (error.status === 422 || /already/i.test(error.message)) {
      return { outcome: "exists" };
    }
    throw error;
  }
  const { error: roleError } = await client
    .from("profiles")
    .update({ role: "admin" })
    .eq("id", data.user.id);
  if (roleError) throw roleError;
  return { outcome: "invited", email };
}

export async function setRole(id: string, role: TeamRole): Promise<void> {
  const { error } = await supabaseAdmin().from("profiles").update({ role }).eq("id", id);
  if (error) throw error;
}
