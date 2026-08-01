"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { canChangeRole } from "@/lib/team-rules";
import { countAdmins, inviteAdmin, setRole } from "@/lib/team";

export type TeamActionResult = { ok: string } | { error: string };

export async function inviteAdminAction(formData: FormData): Promise<TeamActionResult> {
  await requireAdmin();
  const email = String(formData.get("email") ?? "");
  try {
    const result = await inviteAdmin(email);
    if (result.outcome === "invalid") return { error: "Enter a valid email address." };
    if (result.outcome === "exists") {
      return {
        error:
          "That email already has an account. Use its Make admin button below instead.",
      };
    }
    revalidatePath("/admin/team");
    return { ok: `Invite sent to ${result.email}. They arrive as an admin.` };
  } catch (error) {
    console.error("inviteAdminAction failed", error);
    return { error: "The invite could not be sent. Try again in a minute." };
  }
}

export async function setRoleAction(formData: FormData): Promise<TeamActionResult> {
  const { userId } = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const role = String(formData.get("role") ?? "");
  if (role !== "admin" && role !== "member") return { error: "Unknown role." };
  if (!id) return { error: "Unknown user." };

  const refusal = canChangeRole({
    actorId: userId,
    targetId: id,
    targetNewRole: role,
    adminCount: await countAdmins(),
  });
  if (refusal) return { error: refusal };

  try {
    await setRole(id, role);
    revalidatePath("/admin/team");
    return { ok: "Role updated." };
  } catch (error) {
    console.error("setRoleAction failed", error);
    return { error: "The role change failed. Try again." };
  }
}
