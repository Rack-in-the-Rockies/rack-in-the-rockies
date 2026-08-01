import Link from "next/link";
import { listSends } from "@/lib/sends";

function audienceLabel(audience: { tags: string[] }): string {
  return audience.tags.length === 0 ? "All subscribed" : audience.tags.join(", ");
}

const STATUS_STYLES: Record<string, string> = {
  sent: "bg-green-100 text-green-700",
  sending: "bg-golden/20 text-text-mid",
  partial: "bg-golden/30 text-text-dark",
  failed: "bg-red-100 text-red-600",
};

export default async function SendsPage() {
  const sends = await listSends();

  return (
    <main>
      <div className="flex items-center justify-between mb-4">
        <h1 className="font-display text-xl font-bold text-text-dark">Sends</h1>
        <Link href="/admin/compose" className="text-sm text-tangerine underline hover:no-underline">
          Compose a new announcement
        </Link>
      </div>

      {sends.length === 0 ? (
        <p className="text-sm text-text-mid">
          Nothing sent yet. When you send your first announcement it will show up
          here with delivery results.
        </p>
      ) : (
        <>
        <div className="md:hidden space-y-2">
          {sends.map((s) => (
            <Link
              key={s.id}
              href={`/admin/sends/${s.id}`}
              className="block rounded-2xl border border-coral/10 bg-white p-3"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-semibold text-text-dark">{s.subject}</p>
                <span
                  className={`shrink-0 px-2 py-0.5 rounded-pill text-xs font-semibold ${STATUS_STYLES[s.status] ?? ""}`}
                >
                  {s.status}
                </span>
              </div>
              <p className="mt-1 text-xs text-text-mid">
                {s.created_at ? new Date(s.created_at).toLocaleDateString() : ""} &middot;{" "}
                {audienceLabel(s.audience)}
              </p>
              <p className="mt-1 text-xs text-text-light">
                {s.sent_count}/{s.total_count} sent &middot; {s.delivered_count} delivered &middot;{" "}
                {s.bounced_count} bounced &middot; {s.complained_count} complaints
              </p>
            </Link>
          ))}
        </div>
        <div className="hidden md:block overflow-x-auto rounded-2xl border border-coral/10 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-text-mid border-b border-coral/10">
                <th className="px-4 py-2">Date</th>
                <th className="px-4 py-2">Subject</th>
                <th className="px-4 py-2">Audience</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2 text-right">Sent</th>
                <th className="px-4 py-2 text-right">Delivered</th>
                <th className="px-4 py-2 text-right">Bounced</th>
                <th className="px-4 py-2 text-right">Complaints</th>
              </tr>
            </thead>
            <tbody>
              {sends.map((s) => (
                <tr key={s.id} className="border-b border-coral/5 last:border-0">
                  <td className="px-4 py-2 whitespace-nowrap">
                    {s.created_at ? new Date(s.created_at).toLocaleDateString() : ""}
                  </td>
                  <td className="px-4 py-2">
                    <Link
                      href={`/admin/sends/${s.id}`}
                      className="underline hover:no-underline text-text-dark"
                    >
                      {s.subject}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-xs text-text-mid">{audienceLabel(s.audience)}</td>
                  <td className="px-4 py-2">
                    <span
                      className={`px-2 py-0.5 rounded-pill text-xs font-semibold ${STATUS_STYLES[s.status] ?? ""}`}
                    >
                      {s.status}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right">
                    {s.sent_count}/{s.total_count}
                  </td>
                  <td className="px-4 py-2 text-right">{s.delivered_count}</td>
                  <td className="px-4 py-2 text-right">{s.bounced_count}</td>
                  <td className="px-4 py-2 text-right">{s.complained_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </>
      )}
    </main>
  );
}
