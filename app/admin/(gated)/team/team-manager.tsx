"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { inviteAdminAction, setRoleAction } from "@/app/admin/(gated)/team/actions";
import type { TeamMember } from "@/lib/team";

const ROLE_STYLES: Record<string, string> = {
  admin: "bg-green-100 text-green-700",
  member: "bg-blush text-text-mid",
};

export function TeamManager({ members, selfId }: { members: TeamMember[]; selfId: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [notice, setNotice] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  function run(fn: () => Promise<{ ok: string } | { error: string }>) {
    setNotice(null);
    startTransition(async () => {
      const result = await fn();
      if ("ok" in result) {
        setNotice({ kind: "ok", text: result.ok });
        setEmail("");
        router.refresh();
      } else {
        setNotice({ kind: "error", text: result.error });
      }
    });
  }

  return (
    <div className="space-y-4">
      <form
        className="flex flex-col gap-2 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          const data = new FormData();
          data.set("email", email);
          run(() => inviteAdminAction(data));
        }}
      >
        <input
          type="email"
          required
          placeholder="new-admin@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full sm:max-w-xs px-3 py-2 rounded-xl border border-coral/10 bg-white text-sm"
        />
        <button
          type="submit"
          disabled={isPending}
          className="px-4 py-2 rounded-pill bg-text-dark text-white text-sm font-semibold disabled:opacity-50"
        >
          Invite an admin
        </button>
      </form>
      <p className="text-xs text-text-mid -mt-2">
        One step: they get the invite email and arrive with admin access already granted.
      </p>

      {notice && (
        <p className={`text-sm ${notice.kind === "ok" ? "text-tangerine" : "text-red-500"}`}>
          {notice.text}
        </p>
      )}

      <div className="space-y-2">
        {members.map((m) => {
          const isSelf = m.id === selfId;
          const nextRole = m.role === "admin" ? "member" : "admin";
          return (
            <div
              key={m.id}
              className="rounded-2xl border border-coral/10 bg-white p-3 flex flex-wrap items-center gap-x-3 gap-y-2"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-text-dark break-all">
                  {m.email}
                  {isSelf && <span className="ml-1 text-xs font-normal text-text-light">(you)</span>}
                </p>
                <p className="text-xs text-text-light">
                  {m.displayName ? `${m.displayName} · ` : ""}
                  {m.lastSignInAt
                    ? `last signed in ${new Date(m.lastSignInAt).toLocaleDateString()}`
                    : "never signed in"}
                </p>
              </div>
              <span
                className={`px-2 py-0.5 rounded-pill text-xs font-semibold ${ROLE_STYLES[m.role]}`}
              >
                {m.role}
              </span>
              {!isSelf && (
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => {
                    const data = new FormData();
                    data.set("id", m.id);
                    data.set("role", nextRole);
                    run(() => setRoleAction(data));
                  }}
                  className="text-xs text-tangerine underline hover:no-underline disabled:opacity-50"
                >
                  {nextRole === "admin" ? "Make admin" : "Make member"}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
