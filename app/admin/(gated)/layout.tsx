import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { signOut } from "@/app/admin/actions";

export const metadata: Metadata = {
  title: "Admin | Rack in the Rockies",
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return (
    <div className="min-h-screen bg-warm-white">
      <header className="border-b border-coral/10 px-4 py-3 md:px-6">
        <div className="flex items-center justify-between">
          <Link href="/admin" className="font-display font-bold text-text-dark">
            RITR Admin
          </Link>
          <form action={signOut}>
            <button type="submit" className="text-xs text-text-mid underline hover:no-underline">
              Sign out
            </button>
          </form>
        </div>
        <nav className="mt-2 flex gap-4 overflow-x-auto whitespace-nowrap text-sm text-text-mid md:mt-1">
          <Link href="/admin" className="hover:text-text-dark">
            Subscribers
          </Link>
          <Link href="/admin/compose" className="hover:text-text-dark">
            Compose
          </Link>
          <Link href="/admin/events" className="hover:text-text-dark">
            Events
          </Link>
          <Link href="/admin/sends" className="hover:text-text-dark">
            Sends
          </Link>
        </nav>
      </header>
      <div className="px-4 py-5 md:px-6 md:py-6 max-w-5xl mx-auto">{children}</div>
    </div>
  );
}
