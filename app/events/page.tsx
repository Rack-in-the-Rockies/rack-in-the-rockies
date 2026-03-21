import { events } from "@/data/events";
import { EventCard } from "@/components/event-card";
import { SectionHeader } from "@/components/section-header";
import { BookingForm } from "@/components/booking-form";

export const metadata = {
  title: "Events | Rack in the Rockies",
  description:
    "Private mahjong parties, lessons, and charity events in Denver, Colorado.",
};

export default function EventsPage() {
  return (
    <main>
      <section className="py-12 px-6 md:px-12 text-center">
        <SectionHeader
          tag="Events"
          title="Let's get together"
          subtitle="From intimate game nights to big charity events — every gathering is better with mahjong."
        />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {events.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
      </section>

      <section id="book" className="py-12 px-6 md:px-12 bg-cream">
        <div className="max-w-xl mx-auto">
          <SectionHeader
            tag="Book"
            title="Plan your event"
            subtitle="Tell me what you're thinking and I'll make it happen."
          />
          <BookingForm />
        </div>
      </section>
    </main>
  );
}
