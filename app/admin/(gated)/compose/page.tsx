import { listTags, countAudience } from "@/lib/subscribers";
import { featuredEvent } from "@/data/featured-event";
import { BUSINESS_MAILING_ADDRESS } from "@/lib/business";
import { Composer } from "@/app/admin/(gated)/compose/composer";

export default async function ComposePage() {
  const [tags, count] = await Promise.all([listTags(), countAudience([])]);

  return (
    <main>
      <h1 className="font-display text-xl font-bold text-text-dark mb-4">Compose</h1>
      <Composer
        existingTags={tags}
        initialCount={count}
        addressSet={BUSINESS_MAILING_ADDRESS !== null}
        prefill={{
          headline: featuredEvent.title,
          dateLabel: featuredEvent.dateLabel,
          location: featuredEvent.location,
          intro: featuredEvent.blurb,
          sessions: featuredEvent.sessions.map((s) => ({
            name: s.name,
            time: s.time,
            price: s.price,
          })),
          ctaUrl: featuredEvent.signupUrl,
          preheader: featuredEvent.bannerText,
        }}
      />
    </main>
  );
}
