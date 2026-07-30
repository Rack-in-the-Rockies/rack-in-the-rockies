import type { Metadata } from "next";
import { resubscribeByToken } from "@/lib/subscribers";

export const metadata: Metadata = {
  title: "Resubscribe | Rack in the Rockies",
  robots: { index: false, follow: false },
};

export default async function ResubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const result = token
    ? await resubscribeByToken(token)
    : ({ outcome: "not_found" } as const);

  const copy =
    result.outcome === "resubscribed"
      ? {
          h: "Welcome back!",
          p: "You're on the list again. See you at the next event.",
        }
      : {
          h: "We couldn't resubscribe you",
          p: "The link may be incomplete, or this address needs a hand from us. Write to hello@rackintherockies.com and we'll sort it out.",
        };

  return (
    <main className="min-h-[60vh] flex items-center justify-center px-6">
      <div className="max-w-md text-center">
        <h1 className="font-display text-2xl font-bold text-text-dark mb-2">{copy.h}</h1>
        <p className="text-sm text-text-mid">{copy.p}</p>
      </div>
    </main>
  );
}
