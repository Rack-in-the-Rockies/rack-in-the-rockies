import { requireAdmin } from "@/lib/auth";
import { listTeam } from "@/lib/team";
import { TeamManager } from "@/app/admin/(gated)/team/team-manager";

export default async function TeamPage() {
  const [{ userId }, members] = await Promise.all([requireAdmin(), listTeam()]);

  return (
    <main>
      <h1 className="font-display text-xl font-bold text-text-dark mb-1">Team</h1>
      <p className="text-xs text-text-mid mb-4">
        Who can sign in to this admin. Admins see everything here; members
        cannot sign in to the admin at all (member accounts exist for future
        features).
      </p>
      <TeamManager members={members} selfId={userId} />
    </main>
  );
}
