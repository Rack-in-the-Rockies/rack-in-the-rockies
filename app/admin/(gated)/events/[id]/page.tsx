import { notFound } from "next/navigation";
import { getEvent, toEventInput } from "@/lib/events";
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
    </main>
  );
}
