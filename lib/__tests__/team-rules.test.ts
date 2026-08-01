import { describe, it, expect } from "vitest";
import { canChangeRole } from "@/lib/team-rules";

describe("canChangeRole", () => {
  it("allows promoting a member and demoting a non-last admin", () => {
    expect(
      canChangeRole({ actorId: "a", targetId: "b", targetNewRole: "admin", adminCount: 1 })
    ).toBeNull();
    expect(
      canChangeRole({ actorId: "a", targetId: "b", targetNewRole: "member", adminCount: 2 })
    ).toBeNull();
  });

  it("refuses changing your own role", () => {
    const error = canChangeRole({
      actorId: "a",
      targetId: "a",
      targetNewRole: "member",
      adminCount: 3,
    });
    expect(error).toMatch(/own role/i);
  });

  it("refuses demoting the last admin", () => {
    const error = canChangeRole({
      actorId: "a",
      targetId: "b",
      targetNewRole: "member",
      adminCount: 1,
    });
    expect(error).toMatch(/last admin/i);
  });
});
