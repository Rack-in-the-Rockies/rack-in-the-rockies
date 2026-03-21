import type { Event } from "@/data/events";

export function EventCard({ event }: { event: Event }) {
  return (
    <div className="bg-white rounded-2xl p-6 text-left border border-coral/[0.08] relative overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-coral to-tangerine" />
      <p className="text-[10px] font-semibold tracking-widest uppercase text-tangerine mb-1.5">
        {event.typeLabel}
      </p>
      <h3 className="font-display text-lg text-text-dark mb-1.5">{event.title}</h3>
      <p className="text-sm text-text-mid leading-relaxed">{event.description}</p>
      <span className="inline-block mt-3 text-[11px] text-coral bg-coral/[0.08] px-2.5 py-0.5 rounded-full font-medium">
        {event.vibe.emoji} {event.vibe.label}
      </span>
    </div>
  );
}
