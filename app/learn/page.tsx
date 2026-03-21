import { SectionHeader } from "@/components/section-header";
import { PrimaryButton, SecondaryButton } from "@/components/buttons";

export const metadata = {
  title: "Learn Mahjong | Rack in the Rockies",
  description:
    "New to mahjong? Get started with beginner-friendly tips and hands-on lessons.",
};

const tips = [
  {
    icon: "🎯",
    title: "Learn the basics",
    desc: "American Mahjong uses 152 tiles and a yearly card from the National Mah Jongg League. The goal: match your hand to a pattern on the card.",
  },
  {
    icon: "👯",
    title: "Find your group",
    desc: "Mahjong is best with 4 players. Grab your friends, your neighbors, your book club — anyone who loves a good game night.",
  },
  {
    icon: "🃏",
    title: "Get a good set",
    desc: "A quality tile set makes all the difference. Check out my favorites in the shop — I've tested them all so you don't have to.",
  },
  {
    icon: "🎉",
    title: "Just start playing",
    desc: "Don't overthink it. The best way to learn is by playing. Make mistakes, ask questions, and have fun with it.",
  },
];

export default function LearnPage() {
  return (
    <main>
      <section className="py-12 px-6 md:px-12 text-center">
        <SectionHeader
          tag="Learn"
          title="New to mahjong?"
          subtitle="It looks intimidating, but once you learn the basics you'll wonder why you waited so long."
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto mb-8">
          {tips.map((tip) => (
            <div
              key={tip.title}
              className="bg-white rounded-2xl p-6 text-left border border-coral/[0.08] shadow-sm"
            >
              <span className="text-2xl mb-3 block">{tip.icon}</span>
              <h3 className="font-display text-lg text-text-dark mb-2">
                {tip.title}
              </h3>
              <p className="text-sm text-text-mid leading-relaxed">{tip.desc}</p>
            </div>
          ))}
        </div>
        <div className="flex gap-3 justify-center flex-wrap">
          <PrimaryButton href="/events#book">Book a Lesson</PrimaryButton>
          <SecondaryButton href="/shop">Browse Sets</SecondaryButton>
        </div>
      </section>
    </main>
  );
}
