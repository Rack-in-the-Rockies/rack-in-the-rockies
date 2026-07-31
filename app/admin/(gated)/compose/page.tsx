import { listTags, countAudience } from "@/lib/subscribers";
import { getFeaturedEvent } from "@/lib/events";
import { BUSINESS_MAILING_ADDRESS } from "@/lib/business";
import { Composer } from "@/app/admin/(gated)/compose/composer";

export default async function ComposePage() {
  const [tags, count, featured] = await Promise.all([
    listTags(),
    countAudience([]),
    getFeaturedEvent(),
  ]);

  return (
    <main>
      <h1 className="font-display text-xl font-bold text-text-dark mb-4">Compose</h1>
      <Composer
        existingTags={tags}
        initialCount={count}
        addressSet={BUSINESS_MAILING_ADDRESS !== null}
        prefill={
          featured
            ? {
                headline: featured.title,
                dateLabel: featured.date_label,
                location: featured.location,
                intro: featured.blurb,
                sessions: featured.sessions.map((s) => ({
                  name: s.name,
                  time: s.time_label,
                  price: s.price_label,
                })),
                ctaUrl: featured.external_signup_url ?? "",
                preheader: featured.banner_text,
              }
            : null
        }
      />
    </main>
  );
}
