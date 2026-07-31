import { EventEditor } from "@/app/admin/(gated)/events/event-editor";

export default function NewEventPage() {
  return (
    <main>
      <h1 className="font-display text-xl font-bold text-text-dark mb-4">New event</h1>
      <EventEditor eventId={null} status="draft" initial={null} />
    </main>
  );
}
