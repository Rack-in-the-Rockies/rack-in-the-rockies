import { SectionHeader } from "@/components/section-header";
import { PrimaryButton, SecondaryButton } from "@/components/buttons";

export const metadata = {
  title: "About | Rack in the Rockies",
  description: "Curated mahjong experiences and community from Denver, Colorado.",
};

const values = [
  {
    icon: "👯",
    title: "Community First",
    desc: "Every game night is a chance to connect. We build friendships one hand at a time.",
  },
  {
    icon: "✨",
    title: "Elevated Style",
    desc: "From curated sets to gorgeous events, we believe mahjong deserves to look and feel amazing.",
  },
  {
    icon: "🎉",
    title: "Unapologetic Fun",
    desc: "We take the game seriously and nothing else. Laughter, cocktails, and great company required.",
  },
];

export default function AboutPage() {
  return (
    <main>
      <section className="py-12 px-6 md:px-12 text-center">
        <SectionHeader tag="About" title="More than a game" />
        <div className="max-w-2xl mx-auto mb-10">
          <p className="text-base text-text-mid leading-relaxed mb-4">
            Rack in the Rockies started with a simple idea: mahjong is better
            when it brings people together. What began as casual game nights
            with friends in Denver grew into something bigger — a community of
            women who love the game, the style, and the social connection it
            creates.
          </p>
          <p className="text-base text-text-mid leading-relaxed">
            Today, we curate the best mahjong products, host unforgettable
            events, and bring players together across Colorado. Whether you're
            a seasoned player or just discovering the game, there's a seat at
            our table for you.
          </p>
        </div>
      </section>

      <section className="py-12 px-6 md:px-12 bg-cream text-center">
        <SectionHeader tag="Values" title="What we believe" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          {values.map((v) => (
            <div
              key={v.title}
              className="bg-white rounded-2xl p-6 text-center border border-coral/[0.08] shadow-sm"
            >
              <span className="text-3xl mb-3 block">{v.icon}</span>
              <h3 className="font-display text-lg text-text-dark mb-2">
                {v.title}
              </h3>
              <p className="text-sm text-text-mid leading-relaxed">{v.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="py-12 px-6 md:px-12 text-center">
        <div className="flex gap-3 justify-center flex-wrap">
          <PrimaryButton href="/events">See Events</PrimaryButton>
          <SecondaryButton href="/shop">Shop Favorites</SecondaryButton>
        </div>
      </section>
    </main>
  );
}
