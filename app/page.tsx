import { stores } from "@/data/products";
import { events } from "@/data/events";
import { PrimaryButton, SecondaryButton } from "@/components/buttons";
import { SectionHeader } from "@/components/section-header";
import { ProductCard } from "@/components/product-card";
import { EventCard } from "@/components/event-card";
import { FloatingTiles } from "@/components/floating-tiles";
import { EventAnnouncementBar } from "@/components/event-announcement-bar";

// Re-render hourly so the event banner disappears on its own once it's over.
export const revalidate = 3600;

export default function Home() {
  return (
    <main>
      <EventAnnouncementBar />

      {/* Hero */}
      <section className="relative min-h-[60vh] flex items-center justify-center bg-cream overflow-hidden py-12 px-6">
        {/* Background blushes */}
        <div className="absolute inset-0 z-0">
          <div className="absolute -top-[20%] -right-[10%] w-[70%] h-[140%] bg-[radial-gradient(ellipse,rgba(255,142,83,0.15)_0%,transparent_70%)]" />
          <div className="absolute -bottom-[10%] -left-[5%] w-1/2 h-full bg-[radial-gradient(ellipse,rgba(255,107,107,0.12)_0%,transparent_70%)]" />
        </div>
        <FloatingTiles />
        <div className="relative z-10 max-w-2xl text-center">
          <span className="inline-block text-[11px] font-semibold tracking-[3px] uppercase text-tangerine bg-tangerine/10 px-3.5 py-1 rounded-full mb-4">
            Denver, Colorado
          </span>
          <h1 className="font-display text-5xl md:text-[56px] font-bold leading-[1.1] text-text-dark mb-1.5">
            Shuffle. Stack.
            <br />
            <em className="italic bg-gradient-to-r from-coral to-tangerine bg-clip-text text-transparent">
              Sip. Repeat.
            </em>
          </h1>
          <p className="text-base text-text-mid leading-relaxed mt-3 mb-6 max-w-md mx-auto">
            Elevated game nights, unforgettable experiences and curated mahjong
            recommendations&mdash; all with a side of mountain&#8209;town charm.
          </p>
          <div className="flex gap-3 justify-center flex-wrap">
            <PrimaryButton href="/shop">Shop My Favorites</PrimaryButton>
            <SecondaryButton href="/events#book">Book an Event</SecondaryButton>
          </div>
        </div>
      </section>

      {/* Gradient Divider */}
      <div className="h-[3px] bg-gradient-to-r from-coral via-tangerine to-golden opacity-30" />

      {/* What We Do */}
      <section className="py-12 px-6 md:px-12 bg-warm-white text-center">
        <SectionHeader tag="What We Do" title="Three ways to play" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto mt-6">
          {[
            { icon: "🀄", title: "Shop Favorites", desc: "Handpicked sets, mats, and accessories from brands I love. Plus exclusive discount codes.", bg: "from-blush to-[#FFD4C8]" },
            { icon: "🥂", title: "Book an Event", desc: "Private parties, charity events, and lessons that turn any gathering into the best night out.", bg: "from-[#FFF0D4] to-[#FFE4B8]" },
            { icon: "✈️", title: "Join a Trip", desc: "Girls trips to dreamy destinations. The only thing better than game night is game weekend.", bg: "from-[#FFD4D4] to-[#FFC4C4]" },
          ].map((p) => (
            <div key={p.title} className="bg-white rounded-2xl p-7 text-center border border-coral/[0.08] shadow-sm transition-all hover:-translate-y-1 hover:shadow-md hover:shadow-coral/10">
              <div className={`w-[52px] h-[52px] rounded-xl bg-gradient-to-br ${p.bg} flex items-center justify-center text-2xl mx-auto mb-3.5`}>
                {p.icon}
              </div>
              <h3 className="font-display text-lg mb-2">{p.title}</h3>
              <p className="text-sm text-text-mid leading-relaxed">{p.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Shop Preview */}
      <section className="py-12 px-6 md:px-12 bg-cream text-center">
        <SectionHeader
          tag="The Shop"
          title="Stores I love"
          subtitle="These are the brands I personally use and recommend. Browse their collections and find something you love."
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto mb-7">
          {stores.slice(0, 3).map((store) => (
            <ProductCard key={store.id} product={store} />
          ))}
        </div>
        <PrimaryButton href="/shop">View All Favorites</PrimaryButton>
      </section>

      {/* Events Preview */}
      <section className="py-12 px-6 md:px-12 bg-warm-white text-center">
        <SectionHeader
          tag="Events"
          title="Let's get together"
          subtitle="From intimate game nights to big charity events — every gathering is better with mahjong."
        />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto mb-7">
          {events.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
        <div className="flex gap-3 justify-center flex-wrap">
          <PrimaryButton href="/events">View Events</PrimaryButton>
          <SecondaryButton href="/events#book">Book a Private Event</SecondaryButton>
        </div>
      </section>

      {/* Learn + Trips Split */}
      <div id="trips" className="grid grid-cols-1 md:grid-cols-2">
        {/* Learn half */}
        <div className="bg-cream py-12 px-6 md:px-10 flex flex-col items-center justify-center text-center">
          <SectionHeader tag="Learn" title="New to mahjong?" />
          <p className="text-sm text-text-mid leading-relaxed max-w-sm mb-5 -mt-4">
            It looks intimidating, but once you learn the basics you'll wonder
            why you waited. Beginner-friendly resources and hands-on lessons that
            get you playing fast.
          </p>
          <PrimaryButton href="/learn">Get Started</PrimaryButton>
        </div>
        {/* Trips half */}
        <div className="bg-[#2D2424] py-12 px-6 md:px-10 flex flex-col items-center justify-center text-center relative overflow-hidden">
          <div className="absolute -top-[40%] -right-[20%] w-[60%] h-[180%] bg-[radial-gradient(ellipse,rgba(255,107,107,0.12)_0%,transparent_70%)]" />
          <div className="relative z-10">
            <SectionHeader tag="Coming Soon" title="Mahjong girls trips" light />
            <p className="text-sm text-white/70 leading-relaxed max-w-sm mb-5 -mt-4 mx-auto">
              Wine country weekends, mountain retreats, and beachside
              tournaments. Mahjong + travel + your best friends.
            </p>
            <a
              href="/trips"
              className="inline-block bg-gradient-to-r from-coral to-tangerine text-white px-7 py-3 rounded-pill text-sm font-semibold transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-coral/30"
            >
              Join the Waitlist
            </a>
          </div>
        </div>
      </div>

      {/* Final CTA */}
      <section className="py-12 px-6 md:px-12 bg-gradient-to-r from-coral to-tangerine text-center text-white">
        <h2 className="font-display text-3xl font-bold mb-2.5">Ready to play?</h2>
        <p className="text-sm opacity-95 max-w-lg mx-auto mb-6">
          Rack in the Rockies is all about curating the best products, hosting
          unforgettable events, and building a community of players who love the
          game as much as we do.
        </p>
        <div className="flex gap-3 justify-center flex-wrap">
          <a href="/shop" className="inline-block bg-white text-coral px-7 py-3 rounded-pill text-sm font-semibold transition-all hover:-translate-y-0.5 hover:shadow-lg">
            Shop Favorites
          </a>
          <a href="/events#book" className="inline-block border-2 border-white text-white px-7 py-2.5 rounded-pill text-sm font-semibold transition-all hover:bg-white hover:text-coral">
            Book an Event
          </a>
        </div>
      </section>
    </main>
  );
}
