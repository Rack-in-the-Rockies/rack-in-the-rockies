import { EventEditor } from "@/app/admin/(gated)/events/event-editor";

// AI design generation runs as a server action on this page and can take
// up to a couple of minutes.
export const maxDuration = 180;

export default function NewEventPage() {
  return (
    <main>
      <h1 className="font-display text-xl font-bold text-text-dark mb-4">New event</h1>
      <EventEditor eventId={null} status="draft" initial={null} />
    </main>
  );
}
