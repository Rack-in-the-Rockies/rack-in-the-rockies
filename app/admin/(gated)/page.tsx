import { listSubscribers, type SubscriberRow } from "@/lib/subscribers";
import { adminResubscribe } from "@/app/admin/actions";

const STATUSES = ["subscribed", "unsubscribed", "bounced", "complained"] as const;
const SOURCES = [
  "newsletter",
  "contact",
  "booking",
  "trips-waitlist",
  "import",
  "resend-migration",
] as const;

export default async function AdminSubscribersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; source?: string }>;
}) {
  const { q, status, source } = await searchParams;
  const rows = await listSubscribers({ search: q, status, source });

  const counts = new Map<string, number>();
  for (const row of rows) counts.set(row.status, (counts.get(row.status) ?? 0) + 1);

  return (
    <main>
      <h1 className="font-display text-xl font-bold text-text-dark mb-1">Subscribers</h1>
      <p className="text-xs text-text-mid mb-4">
        {rows.length} shown
        {STATUSES.filter((s) => counts.get(s)).map(
          (s) => ` · ${counts.get(s)} ${s}`
        )}
      </p>

      <form className="flex flex-wrap gap-2 mb-4" method="GET">
        <input
          name="q"
          defaultValue={q ?? ""}
          placeholder="Search email or name"
          className="px-3 py-2 rounded-xl border border-coral/10 bg-white text-sm"
        />
        <select
          name="status"
          defaultValue={status ?? ""}
          className="px-3 py-2 rounded-xl border border-coral/10 bg-white text-sm"
        >
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          name="source"
          defaultValue={source ?? ""}
          className="px-3 py-2 rounded-xl border border-coral/10 bg-white text-sm"
        >
          <option value="">All sources</option>
          {SOURCES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="px-4 py-2 rounded-pill bg-text-dark text-white text-sm font-semibold"
        >
          Filter
        </button>
      </form>

      <div className="overflow-x-auto rounded-2xl border border-coral/10 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-text-mid border-b border-coral/10">
              <th className="px-4 py-2">Email</th>
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Source</th>
              <th className="px-4 py-2">Tags</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <SubscriberTr key={row.id} row={row} />
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-text-mid">
                  No subscribers match.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}

function SubscriberTr({ row }: { row: SubscriberRow }) {
  const canResubscribe = row.status === "unsubscribed" || row.status === "bounced";
  const isComplained = row.status === "complained";
  return (
    <tr className="border-b border-coral/5 last:border-0">
      <td className="px-4 py-2">{row.email}</td>
      <td className="px-4 py-2">{[row.first_name, row.last_name].filter(Boolean).join(" ")}</td>
      <td className="px-4 py-2">{row.status}</td>
      <td className="px-4 py-2">{row.source}</td>
      <td className="px-4 py-2 text-xs text-text-mid">{row.tags.join(", ")}</td>
      <td className="px-4 py-2 text-right">
        {(canResubscribe || isComplained) && (
          <form action={adminResubscribe} className="inline">
            <input type="hidden" name="id" value={row.id} />
            <input type="hidden" name="force" value={isComplained ? "true" : "false"} />
            <button
              type="submit"
              className={`text-xs underline hover:no-underline ${
                isComplained ? "text-red-500" : "text-tangerine"
              }`}
              title={
                isComplained
                  ? "This person reported our email as spam. Only resubscribe if they asked you to directly."
                  : "Set status back to subscribed"
              }
            >
              {isComplained ? "Force resubscribe" : "Resubscribe"}
            </button>
          </form>
        )}
      </td>
    </tr>
  );
}
