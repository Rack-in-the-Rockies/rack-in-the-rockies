import { events } from "@/data/events";
import { EventCard } from "@/components/event-card";
import { SectionHeader } from "@/components/section-header";
import { BookingForm } from "@/components/booking-form";
import { FeaturedEventHero } from "@/components/featured-event-hero";

export const metadata = {
  title: "Events | Rack in the Rockies",
  description:
    "Mahjong in Bloom — July 28, 2026 at Tee Lee Floral in Olde Town Arvada. Plus private mahjong parties, lessons, and charity events in Denver, Colorado.",
};

// Re-render hourly so the featured event disappears on its own once it's over.
export const revalidate = 3600;

export default function EventsPage() {
  return (
    <main>
      <FeaturedEventHero />

      {/* Gradient Divider */}
      <div className="h-[3px] bg-gradient-to-r from-coral via-tangerine to-golden opacity-30" />

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
