import Link from "next/link";
import type { EventWithSessions } from "@/lib/events";

export function EventAnnouncementBar({ event }: { event: EventWithSessions }) {
  return (
    <Link
      href="/events"
      className={`group block bg-gradient-to-r px-6 py-3 text-center text-white transition-opacity hover:opacity-95 ${
        event.decor === "winter" ? "from-winter-blue to-glacier" : "from-coral to-tangerine"
      }`}
    >
      <span className="text-sm font-semibold">
        <span className="mr-2" aria-hidden="true">
          {event.decor === "winter" ? "❄️" : "🀄"}
        </span>
        {event.banner_text}
        <span className="ml-2 inline-block underline underline-offset-4 transition-transform group-hover:translate-x-0.5">
          Reserve your seat →
        </span>
      </span>
    </Link>
  );
}
