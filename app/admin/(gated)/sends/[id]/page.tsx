import Link from "next/link";
import { notFound } from "next/navigation";
import { getSendDetail } from "@/lib/sends";
import { resumeSend } from "@/app/admin/(gated)/sends/actions";

const RECIPIENT_STYLES: Record<string, string> = {
  pending: "text-text-light",
  sent: "text-text-mid",
  delivered: "text-green-700",
  failed: "text-red-600",
  bounced: "text-red-600",
  complained: "text-red-600 font-semibold",
};

export default async function SendDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const detail = await getSendDetail(id);
  if (!detail) notFound();
  const { send, recipients, resumable } = detail;

  const counts = new Map<string, number>();
  for (const r of recipients) counts.set(r.status, (counts.get(r.status) ?? 0) + 1);

  return (
    <main>
      <p className="text-xs mb-2">
        <Link href="/admin/sends" className="text-text-mid underline hover:no-underline">
          All sends
        </Link>
      </p>
      <h1 className="font-display text-xl font-bold text-text-dark mb-1">{send.subject}</h1>
      <p className="text-xs text-text-mid mb-4">
        {send.template} &middot; {send.status} &middot; {send.sent_count}/{send.total_count} sent
        {[...counts.entries()].map(([status, n]) => ` · ${n} ${status}`)}
      </p>

      {resumable && (
        <form action={resumeSend} className="mb-4">
          <input type="hidden" name="sendId" value={send.id} />
          <button
            type="submit"
            className="px-4 py-2 rounded-pill text-sm font-semibold bg-text-dark text-white"
          >
            Resume unfinished recipients
          </button>
        </form>
      )}

      <div className="overflow-x-auto rounded-2xl border border-coral/10 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-text-mid border-b border-coral/10">
              <th className="px-4 py-2">Email</th>
              <th className="px-4 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {recipients.map((r) => (
              <tr key={r.id} className="border-b border-coral/5 last:border-0">
                <td className="px-4 py-2">{r.email}</td>
                <td className={`px-4 py-2 ${RECIPIENT_STYLES[r.status] ?? ""}`}>{r.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
