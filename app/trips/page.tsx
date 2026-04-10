import { SectionHeader } from "@/components/section-header";
import { WaitlistForm } from "@/components/waitlist-form";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Trips | Rack in the Rockies",
  description:
    "Join the waitlist for mahjong girls trips - wine country weekends, mountain retreats, and beachside tournaments.",
};

export default function TripsPage() {
  return (
    <main>
      {/* Hero */}
      <section className="relative min-h-[50vh] flex items-center justify-center bg-[#2D2424] overflow-hidden py-16 px-6">
        <div className="absolute inset-0">
          <div className="absolute -top-[30%] -right-[15%] w-[60%] h-[160%] bg-[radial-gradient(ellipse,rgba(255,107,107,0.15)_0%,transparent_70%)]" />
          <div className="absolute -bottom-[20%] -left-[10%] w-[50%] h-[120%] bg-[radial-gradient(ellipse,rgba(255,142,83,0.1)_0%,transparent_70%)]" />
        </div>
        <div className="relative z-10 max-w-2xl text-center">
          <SectionHeader tag="Coming Soon" title="Mahjong girls trips" light />
          <p className="text-base text-white/70 leading-relaxed max-w-lg mx-auto -mt-2 mb-8">
            Wine country weekends, mountain retreats, and beachside tournaments.
            Mahjong + travel + your best friends. We&apos;re planning our first
            trips now - join the waitlist to be the first to know.
          </p>
          <WaitlistForm />
        </div>
      </section>

      {/* What to Expect */}
      <section className="py-12 px-6 md:px-12 bg-warm-white text-center">
        <SectionHeader tag="What to Expect" title="More than a game night" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto mt-6">
          {[
            {
              icon: "🍷",
              title: "Wine Country Weekends",
              desc: "Napa, Sonoma, or Colorado wine country. Play between tastings, dine together, and unwind.",
            },
            {
              icon: "🏔️",
              title: "Mountain Retreats",
              desc: "Cozy cabins, mountain views, and marathon mahjong sessions with your favorite people.",
            },
            {
              icon: "🏖️",
              title: "Beachside Tournaments",
              desc: "Sun, sand, and tiles. Casual tournaments with a tropical twist.",
            },
          ].map((item) => (
            <div
              key={item.title}
              className="bg-white rounded-2xl p-7 text-center border border-coral/[0.08] shadow-sm"
            >
              <div className="w-[52px] h-[52px] rounded-xl bg-gradient-to-br from-blush to-[#FFD4C8] flex items-center justify-center text-2xl mx-auto mb-3.5">
                {item.icon}
              </div>
              <h3 className="font-display text-lg mb-2">{item.title}</h3>
              <p className="text-sm text-text-mid leading-relaxed">
                {item.desc}
              </p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
