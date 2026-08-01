import { requireAdmin } from "@/lib/auth";
import { listRegistrants } from "@/lib/registrations";
import { getEvent } from "@/lib/events";
import { csvField } from "@/lib/subscriber-rules";

/**
 * Registrant CSV for one event. Route handlers bypass layouts, so the admin
 * check lives here, not in any parent.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await requireAdmin();
  const { id } = await params;
  const event = await getEvent(id);
  if (!event) return new Response("Not found", { status: 404 });
  const sessionName = new Map(event.sessions.map((s) => [s.id, s.name]));
  const rows = await listRegistrants(id);
  const header = "first_name,last_name,email,session,seats,status,registered_at";
  const lines = rows.map((r) =>
    [
      csvField(r.first_name),
      csvField(r.last_name),
      csvField(r.email),
      csvField(sessionName.get(r.session_id) ?? ""),
      String(r.seats),
      csvField(r.status),
      csvField(r.created_at ?? ""),
    ].join(",")
  );
  return new Response([header, ...lines].join("\n") + "\n", {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="registrants.csv"`,
    },
  });
}
