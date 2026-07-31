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
      <header className="border-b border-coral/10 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/admin" className="font-display font-bold text-text-dark">
            RITR Admin
          </Link>
          <nav className="flex gap-3 text-sm text-text-mid">
            <Link href="/admin" className="hover:text-text-dark">
              Subscribers
            </Link>
            <Link href="/admin/compose" className="hover:text-text-dark">
              Compose
            </Link>
            <Link href="/admin/sends" className="hover:text-text-dark">
              Sends
            </Link>
          </nav>
        </div>
        <form action={signOut}>
          <button type="submit" className="text-xs text-text-mid underline hover:no-underline">
            Sign out
          </button>
        </form>
      </header>
      <div className="px-6 py-6 max-w-5xl mx-auto">{children}</div>
    </div>
  );
}
