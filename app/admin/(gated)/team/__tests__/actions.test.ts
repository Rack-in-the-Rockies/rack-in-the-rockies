import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({
  requireAdmin: vi.fn(async () => ({ userId: "admin-1", email: "tyler@example.com" })),
}));
vi.mock("@/lib/team", () => ({
  inviteAdmin: vi.fn(async () => ({ outcome: "invited", email: "annie@example.com" })),
  setRole: vi.fn(async () => {}),
  countAdmins: vi.fn(async () => 2),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { inviteAdminAction, setRoleAction } from "@/app/admin/(gated)/team/actions";
import { requireAdmin } from "@/lib/auth";
import { inviteAdmin, setRole, countAdmins } from "@/lib/team";

function form(entries: Record<string, string>) {
  const data = new FormData();
  for (const [k, v] of Object.entries(entries)) data.set(k, v);
  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
  (countAdmins as ReturnType<typeof vi.fn>).mockResolvedValue(2);
});

describe("team actions", () => {
  it("both actions re-verify the admin session", async () => {
    await inviteAdminAction(form({ email: "annie@example.com" }));
    await setRoleAction(form({ id: "other", role: "admin" }));
    expect(requireAdmin).toHaveBeenCalledTimes(2);
  });

  it("invite reports the invited and already-exists outcomes", async () => {
    expect(await inviteAdminAction(form({ email: "annie@example.com" }))).toMatchObject({
      ok: expect.stringContaining("annie@example.com"),
    });
    (inviteAdmin as ReturnType<typeof vi.fn>).mockResolvedValue({ outcome: "exists" });
    const exists = await inviteAdminAction(form({ email: "annie@example.com" }));
    expect("error" in exists && exists.error).toMatch(/already has an account/i);
    (inviteAdmin as ReturnType<typeof vi.fn>).mockResolvedValue({ outcome: "invalid" });
    expect("error" in (await inviteAdminAction(form({ email: "junk" })))).toBe(true);
  });

  it("role changes go through the guardrails", async () => {
    const self = await setRoleAction(form({ id: "admin-1", role: "member" }));
    expect("error" in self && self.error).toMatch(/own role/i);
    expect(setRole).not.toHaveBeenCalled();

    (countAdmins as ReturnType<typeof vi.fn>).mockResolvedValue(1);
    const last = await setRoleAction(form({ id: "other", role: "member" }));
    expect("error" in last && last.error).toMatch(/last admin/i);

    (countAdmins as ReturnType<typeof vi.fn>).mockResolvedValue(2);
    const ok = await setRoleAction(form({ id: "other", role: "member" }));
    expect("ok" in ok).toBe(true);
    expect(setRole).toHaveBeenCalledWith("other", "member");
  });

  it("rejects junk role values", async () => {
    const result = await setRoleAction(form({ id: "other", role: "superuser" }));
    expect("error" in result).toBe(true);
    expect(setRole).not.toHaveBeenCalled();
  });
});
