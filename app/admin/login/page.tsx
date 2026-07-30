import type { Metadata } from "next";
import { sendMagicLink } from "@/app/admin/login/actions";

export const metadata: Metadata = {
  title: "Admin Login | Rack in the Rockies",
  robots: { index: false, follow: false },
};

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; error?: string }>;
}) {
  const { sent, error } = await searchParams;

  return (
    <main className="min-h-[60vh] flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <h1 className="font-display text-2xl font-bold text-text-dark mb-1">Admin</h1>
        <p className="text-sm text-text-mid mb-4">
          Enter your email and we&apos;ll send you a sign-in link.
        </p>
        {sent ? (
          <p className="text-sm font-semibold text-tangerine">
            If that address has access, a link is on its way. Check your inbox.
          </p>
        ) : (
          <form action={sendMagicLink} className="space-y-3">
            <input
              name="email"
              type="email"
              required
              placeholder="you@email.com"
              aria-label="Email address"
              className="w-full px-4 py-2.5 rounded-xl border border-coral/10 bg-warm-white text-sm text-text-dark placeholder:text-text-light focus:outline-none focus:border-coral/30 focus:ring-1 focus:ring-coral/20"
            />
            <button
              type="submit"
              className="w-full bg-gradient-to-r from-coral to-tangerine text-white py-2.5 rounded-pill text-sm font-semibold transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-coral/30"
            >
              Send Link
            </button>
          </form>
        )}
        {error === "link" && (
          <p className="text-xs text-red-500 mt-2">
            That link didn&apos;t work. It may have expired, request a new one.
          </p>
        )}
        {error === "email" && (
          <p className="text-xs text-red-500 mt-2">Please enter a valid email.</p>
        )}
      </div>
    </main>
  );
}
