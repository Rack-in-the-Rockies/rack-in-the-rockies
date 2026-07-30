import type { Metadata } from "next";
import { BUSINESS_EMAIL, BUSINESS_LOCATION, BUSINESS_NAME } from "@/lib/business";

export const metadata: Metadata = {
  title: "Privacy Policy | Rack in the Rockies",
  description: "How Rack in the Rockies handles your information.",
};

export default function PrivacyPage() {
  return (
    <main className="max-w-2xl mx-auto px-6 py-12 space-y-6">
      <h1 className="font-display text-3xl font-bold text-text-dark">Privacy Policy</h1>
      <p className="text-xs text-text-light">Last updated: July 30, 2026</p>

      <section className="space-y-2">
        <h2 className="font-display text-lg font-bold text-text-dark">What we collect</h2>
        <p className="text-sm text-text-mid">
          When you sign up for news or send us an inquiry, we collect what you
          type into the form: your name, email address, and details about the
          event you are asking about. That is the extent of it. We do not buy
          data about you, and we do not use advertising trackers.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="font-display text-lg font-bold text-text-dark">What we do with it</h2>
        <p className="text-sm text-text-mid">
          We use your email address to reply to you and, if you agreed when
          submitting, to send occasional event announcements. We tag records
          with basics like how you found us and what you were interested in, so
          our announcements stay relevant.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="font-display text-lg font-bold text-text-dark">Who else sees it</h2>
        <p className="text-sm text-text-mid">
          Your information is stored with our database provider (Supabase) and
          our email delivery provider (Resend), which process it on our behalf.
          We never sell your information, and we never share it with anyone
          else.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="font-display text-lg font-bold text-text-dark">Your choices</h2>
        <p className="text-sm text-text-mid">
          Every announcement email includes a one-click unsubscribe link. If you
          would like your information corrected or deleted entirely, email us at{" "}
          {BUSINESS_EMAIL} and we will take care of it.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="font-display text-lg font-bold text-text-dark">Contact</h2>
        <p className="text-sm text-text-mid">
          {BUSINESS_NAME}, {BUSINESS_LOCATION}. {BUSINESS_EMAIL}.
        </p>
      </section>
    </main>
  );
}
