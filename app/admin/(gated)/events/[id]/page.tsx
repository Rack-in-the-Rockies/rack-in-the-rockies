import { notFound } from "next/navigation";
import { getEvent, toEventInput, type EventWithSessions } from "@/lib/events";
import { listRegistrants, sessionSeatCounts } from "@/lib/registrations";
import { EventEditor } from "@/app/admin/(gated)/events/event-editor";

export default async function EditEventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const event = await getEvent(id);
  if (!event) notFound();

  return (
    <main>
      <h1 className="font-display text-xl font-bold text-text-dark mb-4">Edit event</h1>
      <EventEditor eventId={event.id} status={event.status} initial={toEventInput(event)} />
      {!event.external_signup_url && <Registrants event={event} />}
    </main>
  );
}

async function Registrants({ event }: { event: EventWithSessions }) {
  const [registrants, counts] = await Promise.all([
    listRegistrants(event.id),
    sessionSeatCounts(event.id),
  ]);
  const sessionName = new Map(event.sessions.map((s) => [s.id, s.name]));

  return (
    <section className="mt-8">
      <div className="flex items-center justify-between mb-2">
        <h2 className="font-display text-lg font-bold text-text-dark">Registrations</h2>
        {registrants.length > 0 && (
          <a
            href={`/admin/events/${event.id}/registrants.csv`}
            className="text-xs text-text-mid underline hover:no-underline"
          >
            Download CSV
          </a>
        )}
      </div>
      <p className="text-xs text-text-mid mb-3">
        {event.sessions
          .map((s) => {
            const taken = counts.get(s.id) ?? 0;
            return `${s.name}: ${taken}${s.capacity ? ` of ${s.capacity}` : ""} seats`;
          })
          .join(" · ") || "No sessions"}
      </p>
      {registrants.length === 0 ? (
        <p className="text-sm text-text-mid">No registrations yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-coral/10 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-text-mid border-b border-coral/10">
                <th className="px-4 py-2">Name</th>
                <th className="px-4 py-2">Email</th>
                <th className="px-4 py-2">Session</th>
                <th className="px-4 py-2 text-right">Seats</th>
                <th className="px-4 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {registrants.map((r) => (
                <tr
                  key={r.id}
                  className={`border-b border-coral/5 last:border-0 ${
                    r.status === "cancelled" ? "text-text-light line-through" : ""
                  }`}
                >
                  <td className="px-4 py-2">
                    {[r.first_name, r.last_name].filter(Boolean).join(" ")}
                  </td>
                  <td className="px-4 py-2">{r.email}</td>
                  <td className="px-4 py-2">{sessionName.get(r.session_id) ?? ""}</td>
                  <td className="px-4 py-2 text-right">{r.seats}</td>
                  <td className="px-4 py-2 text-xs">{r.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
