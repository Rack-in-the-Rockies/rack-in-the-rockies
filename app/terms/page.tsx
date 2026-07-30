import type { Metadata } from "next";
import { BUSINESS_EMAIL, BUSINESS_LOCATION, BUSINESS_NAME } from "@/lib/business";

export const metadata: Metadata = {
  title: "Terms of Use | Rack in the Rockies",
  description: "Terms of use for the Rack in the Rockies website.",
};

export default function TermsPage() {
  return (
    <main className="max-w-2xl mx-auto px-6 py-12 space-y-6">
      <h1 className="font-display text-3xl font-bold text-text-dark">Terms of Use</h1>
      <p className="text-xs text-text-light">Last updated: July 30, 2026</p>

      <section className="space-y-2">
        <h2 className="font-display text-lg font-bold text-text-dark">Who we are</h2>
        <p className="text-sm text-text-mid">
          {BUSINESS_NAME} is a mahjong events and retail business based in {BUSINESS_LOCATION}.
          You can reach us anytime at {BUSINESS_EMAIL}.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="font-display text-lg font-bold text-text-dark">Using this site</h2>
        <p className="text-sm text-text-mid">
          This site exists to share our events, products, and services. You agree
          to use it for its intended purpose and not to interfere with its
          operation, attempt to access non-public areas, or submit false
          information through our forms.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="font-display text-lg font-bold text-text-dark">Email communications</h2>
        <p className="text-sm text-text-mid">
          When you submit a form on this site, you agree to receive emails from
          us: event announcements, updates, and replies to your inquiries. Every
          announcement email we send includes an unsubscribe link, and
          unsubscribing takes one click. Requesting a booking or contacting us
          does not re-add you to our list if you have previously unsubscribed.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="font-display text-lg font-bold text-text-dark">Bookings and events</h2>
        <p className="text-sm text-text-mid">
          Booking inquiries submitted through this site are requests, not
          confirmed reservations. We confirm every booking personally by email.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="font-display text-lg font-bold text-text-dark">Changes</h2>
        <p className="text-sm text-text-mid">
          We may update these terms as the business grows. The date above tells
          you when they last changed. Questions? Write to {BUSINESS_EMAIL}.
        </p>
      </section>
    </main>
  );
}
