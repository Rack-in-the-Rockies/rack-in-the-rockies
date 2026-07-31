import { requireAdmin } from "@/lib/auth";
import { exportSubscribers } from "@/lib/subscribers";
import { subscribersToCsv } from "@/lib/subscriber-rules";

/**
 * CSV of the current filtered view. Route handlers bypass layouts, so the
 * admin check lives here, not in any parent.
 */
export async function GET(req: Request) {
  await requireAdmin();
  const params = new URL(req.url).searchParams;
  const tags = params.getAll("tag").filter(Boolean);
  const rows = await exportSubscribers({
    search: params.get("q") ?? undefined,
    status: params.get("status") ?? undefined,
    source: params.get("source") ?? undefined,
    tags,
  });
  return new Response(subscribersToCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="subscribers.csv"',
    },
  });
}
