import type { Metadata } from "next";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { cancelRegistration } from "@/app/cancel-registration/actions";

export const metadata: Metadata = {
  title: "Cancel Registration | Rack in the Rockies",
  robots: { index: false, follow: false },
};

type Row = {
  first_name: string;
  seats: number;
  status: string;
  events: { title: string; date_label: string } | null;
  event_sessions: { name: string; time_label: string } | null;
};

async function lookup(token: string): Promise<Row | null> {
  const { data, error } = await supabaseAdmin()
    .from("event_registrations")
    .select(
      "first_name, seats, status, events (title, date_label), event_sessions (name, time_label)"
    )
    .eq("cancel_token", token)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as Row) ?? null;
}

export default async function CancelRegistrationPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const row = token ? await lookup(token) : null;

  return (
    <main className="min-h-[60vh] flex items-center justify-center px-6">
      <div className="max-w-md text-center">
        {!row ? (
          <>
            <h1 className="font-display text-2xl font-bold text-text-dark mb-2">
              We couldn&apos;t find that registration
            </h1>
            <p className="text-sm text-text-mid">
              The link may be incomplete. If you need a hand, write to
              hello@rackintherockies.com.
            </p>
          </>
        ) : row.status === "cancelled" ? (
          <>
            <h1 className="font-display text-2xl font-bold text-text-dark mb-2">
              Registration cancelled
            </h1>
            <p className="text-sm text-text-mid">
              Your {row.seats === 1 ? "seat is" : "seats are"} released. We hope
              to see you at another event soon.
            </p>
          </>
        ) : (
          <>
            <h1 className="font-display text-2xl font-bold text-text-dark mb-2">
              Cancel your registration?
            </h1>
            <p className="text-sm text-text-mid mb-4">
              {row.first_name}, this releases {row.seats}{" "}
              {row.seats === 1 ? "seat" : "seats"} for {row.events?.title} (
              {row.event_sessions?.name}, {row.events?.date_label}).
            </p>
            <form action={cancelRegistration}>
              <input type="hidden" name="token" value={token} />
              <button
                type="submit"
                className="px-5 py-2.5 rounded-pill bg-text-dark text-white text-sm font-semibold"
              >
                Yes, cancel my registration
              </button>
            </form>
          </>
        )}
      </div>
    </main>
  );
}
