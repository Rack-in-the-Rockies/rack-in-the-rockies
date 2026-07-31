import Link from "next/link";
import { listEvents } from "@/lib/events";
import { DuplicateButton } from "@/app/admin/(gated)/events/event-editor";

const STATUS_STYLES: Record<string, string> = {
  published: "bg-green-100 text-green-700",
  draft: "bg-blush text-text-mid",
};

export default async function AdminEventsPage() {
  const events = await listEvents();

  return (
    <main>
      <div className="flex items-center justify-between mb-4">
        <h1 className="font-display text-xl font-bold text-text-dark">Events</h1>
        <Link
          href="/admin/events/new"
          className="px-4 py-2 rounded-pill bg-text-dark text-white text-sm font-semibold"
        >
          New event
        </Link>
      </div>

      {events.length === 0 ? (
        <p className="text-sm text-text-mid">
          No events yet. Create one and it will show up on the site when you
          publish it.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-coral/10 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-text-mid border-b border-coral/10">
                <th className="px-4 py-2">Title</th>
                <th className="px-4 py-2">Date</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Sessions</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {events.map((e) => {
                return (
                  <tr key={e.id} className="border-b border-coral/5 last:border-0">
                    <td className="px-4 py-2">
                      <Link
                        href={`/admin/events/${e.id}`}
                        className="underline hover:no-underline text-text-dark"
                      >
                        {e.title}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-text-mid">{e.date_label || "No date yet"}</td>
                    <td className="px-4 py-2">
                      <span
                        className={`px-2 py-0.5 rounded-pill text-xs font-semibold ${STATUS_STYLES[e.status] ?? ""}`}
                      >
                        {e.status}
                      </span>
                      {e.ended && e.status === "published" && (
                        <span className="ml-1 text-xs text-text-light">(past)</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-text-mid">{e.session_count}</td>
                    <td className="px-4 py-2 text-right">
                      <DuplicateButton eventId={e.id} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
