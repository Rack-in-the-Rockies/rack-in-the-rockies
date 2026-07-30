import type { Metadata } from "next";
import Link from "next/link";
import { unsubscribeByToken } from "@/lib/subscribers";

export const metadata: Metadata = {
  title: "Unsubscribe | Rack in the Rockies",
  robots: { index: false, follow: false },
};

export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const result = token
    ? await unsubscribeByToken(token)
    : ({ outcome: "not_found" } as const);

  return (
    <main className="min-h-[60vh] flex items-center justify-center px-6">
      <div className="max-w-md text-center">
        {result.outcome === "unsubscribed" ? (
          <>
            <h1 className="font-display text-2xl font-bold text-text-dark mb-2">
              You&apos;re unsubscribed
            </h1>
            <p className="text-sm text-text-mid mb-4">
              You won&apos;t hear from us again. No hard feelings, and thanks
              for playing.
            </p>
            <p className="text-xs text-text-light">
              Changed your mind?{" "}
              <Link
                href={`/resubscribe?token=${encodeURIComponent(token!)}`}
                className="underline hover:no-underline"
              >
                Resubscribe
              </Link>
            </p>
          </>
        ) : (
          <>
            <h1 className="font-display text-2xl font-bold text-text-dark mb-2">
              We couldn&apos;t find that subscription
            </h1>
            <p className="text-sm text-text-mid">
              The link may be incomplete. If you keep getting email you
              don&apos;t want, write to us and we&apos;ll take care of it.
            </p>
          </>
        )}
      </div>
    </main>
  );
}
