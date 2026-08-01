import Link from "next/link";
import { listSubscribers, listTags, type SubscriberRow } from "@/lib/subscribers";
import { adminAddTag, adminRemoveTag, adminResubscribe } from "@/app/admin/actions";

const STATUSES = ["subscribed", "unsubscribed", "bounced", "complained"] as const;
const SOURCES = [
  "newsletter",
  "contact",
  "booking",
  "trips-waitlist",
  "import",
  "resend-migration",
  "event-registration",
] as const;

const STATUS_STYLES: Record<string, string> = {
  subscribed: "bg-green-100 text-green-700",
  unsubscribed: "bg-blush text-text-mid",
  bounced: "bg-golden/30 text-text-dark",
  complained: "bg-red-100 text-red-600",
};

type Params = {
  q?: string;
  status?: string;
  source?: string;
  tag?: string | string[];
  page?: string;
};

function tagList(tag: string | string[] | undefined): string[] {
  if (!tag) return [];
  return Array.isArray(tag) ? tag : [tag];
}

function queryString(params: Params, page: number): string {
  const qs = new URLSearchParams();
  if (params.q) qs.set("q", params.q);
  if (params.status) qs.set("status", params.status);
  if (params.source) qs.set("source", params.source);
  for (const t of tagList(params.tag)) qs.append("tag", t);
  if (page > 1) qs.set("page", String(page));
  const s = qs.toString();
  return s ? `?${s}` : "";
}

export default async function AdminSubscribersPage({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  const params = await searchParams;
  const selectedTags = tagList(params.tag);
  const page = Math.max(1, Number(params.page) || 1);
  const [list, allTags] = await Promise.all([
    listSubscribers({
      search: params.q,
      status: params.status,
      source: params.source,
      tags: selectedTags,
      page,
    }),
    listTags(),
  ]);

  return (
    <main>
      <div className="flex items-center justify-between mb-1">
        <h1 className="font-display text-xl font-bold text-text-dark">Subscribers</h1>
        <a
          href={`/admin/export${queryString(params, 1)}`}
          className="text-xs text-text-mid underline hover:no-underline"
        >
          Download CSV
        </a>
      </div>
      <p className="text-xs text-text-mid mb-4">
        {list.total} {list.total === 1 ? "person" : "people"} match
        {list.pageCount > 1 && ` · page ${list.page} of ${list.pageCount}`}
      </p>

      <form className="flex flex-col gap-2 mb-3 sm:flex-row sm:flex-wrap sm:items-center" method="GET">
        <input
          name="q"
          defaultValue={params.q ?? ""}
          placeholder="Search email or name"
          className="w-full sm:w-auto px-3 py-2 rounded-xl border border-coral/10 bg-white text-sm"
        />
        <div className="grid grid-cols-2 gap-2 sm:contents">
          <select
            name="status"
            defaultValue={params.status ?? ""}
            className="px-3 py-2 rounded-xl border border-coral/10 bg-white text-sm"
          >
            <option value="">All statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <select
            name="source"
            defaultValue={params.source ?? ""}
            className="px-3 py-2 rounded-xl border border-coral/10 bg-white text-sm"
          >
            <option value="">All sources</option>
            {SOURCES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        {allTags.length > 0 && (
          <fieldset className="flex flex-wrap items-center gap-2 px-3 py-2 rounded-xl border border-coral/10 bg-white">
            <legend className="sr-only">Filter by tag</legend>
            {allTags.map((tag) => (
              <label key={tag} className="flex items-center gap-1 text-xs text-text-mid">
                <input
                  type="checkbox"
                  name="tag"
                  value={tag}
                  defaultChecked={selectedTags.includes(tag)}
                />
                {tag}
              </label>
            ))}
          </fieldset>
        )}
        <button
          type="submit"
          className="px-4 py-2 rounded-pill bg-text-dark text-white text-sm font-semibold"
        >
          Filter
        </button>
      </form>

      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto rounded-2xl border border-coral/10 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-text-mid border-b border-coral/10">
              <th className="px-4 py-2">Email</th>
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Source</th>
              <th className="px-4 py-2">Tags</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {list.rows.map((row) => (
              <tr key={row.id} className="border-b border-coral/5 last:border-0 align-top">
                <td className="px-4 py-2">{row.email}</td>
                <td className="px-4 py-2">
                  {[row.first_name, row.last_name].filter(Boolean).join(" ")}
                </td>
                <td className="px-4 py-2">
                  <StatusBadge status={row.status} />
                </td>
                <td className="px-4 py-2 text-xs text-text-mid">{row.source}</td>
                <td className="px-4 py-2">
                  <TagEditor row={row} />
                </td>
                <td className="px-4 py-2 text-right">
                  <ResubscribeControl row={row} />
                </td>
              </tr>
            ))}
            {list.rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-text-mid">
                  No subscribers match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-2">
        {list.rows.map((row) => (
          <div key={row.id} className="rounded-2xl border border-coral/10 bg-white p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-text-dark break-all">{row.email}</p>
                <p className="text-xs text-text-mid">
                  {[row.first_name, row.last_name].filter(Boolean).join(" ") || " "}
                </p>
              </div>
              <StatusBadge status={row.status} />
            </div>
            <div className="mt-2 flex items-center justify-between gap-2">
              <span className="text-[11px] text-text-light">{row.source}</span>
              <ResubscribeControl row={row} />
            </div>
            <div className="mt-2">
              <TagEditor row={row} />
            </div>
          </div>
        ))}
        {list.rows.length === 0 && (
          <p className="rounded-2xl border border-coral/10 bg-white p-4 text-center text-sm text-text-mid">
            No subscribers match these filters.
          </p>
        )}
      </div>

      {list.pageCount > 1 && (
        <div className="flex items-center gap-3 mt-3 text-sm">
          {page > 1 && (
            <Link
              href={`/admin${queryString(params, page - 1)}`}
              className="underline hover:no-underline text-text-mid"
            >
              Newer
            </Link>
          )}
          <span className="text-xs text-text-light">
            Page {list.page} of {list.pageCount}
          </span>
          {page < list.pageCount && (
            <Link
              href={`/admin${queryString(params, page + 1)}`}
              className="underline hover:no-underline text-text-mid"
            >
              Older
            </Link>
          )}
        </div>
      )}
    </main>
  );
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`shrink-0 px-2 py-0.5 rounded-pill text-xs font-semibold ${STATUS_STYLES[status] ?? ""}`}
    >
      {status}
    </span>
  );
}

function TagEditor({ row }: { row: SubscriberRow }) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      {row.tags.map((tag) => (
        <form key={tag} action={adminRemoveTag} className="inline">
          <input type="hidden" name="id" value={row.id} />
          <input type="hidden" name="tag" value={tag} />
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-pill bg-cream text-xs text-text-mid">
            {tag}
            <button
              type="submit"
              aria-label={`Remove tag ${tag}`}
              className="text-text-light hover:text-red-500"
            >
              &times;
            </button>
          </span>
        </form>
      ))}
      <form action={adminAddTag} className="inline-flex items-center gap-1">
        <input type="hidden" name="id" value={row.id} />
        <input
          name="tag"
          placeholder="+ tag"
          className="w-16 px-1.5 py-0.5 rounded border border-coral/10 text-xs"
        />
      </form>
    </div>
  );
}

function ResubscribeControl({ row }: { row: SubscriberRow }) {
  const canResubscribe = row.status === "unsubscribed" || row.status === "bounced";
  const isComplained = row.status === "complained";
  if (!canResubscribe && !isComplained) return null;
  return (
    <form action={adminResubscribe} className="inline">
      <input type="hidden" name="id" value={row.id} />
      <input type="hidden" name="force" value={isComplained ? "true" : "false"} />
      <button
        type="submit"
        className={`text-xs underline hover:no-underline ${
          isComplained ? "text-red-500" : "text-tangerine"
        }`}
        title={
          isComplained
            ? "This person reported our email as spam. Only resubscribe if they asked you to directly."
            : "Set status back to subscribed"
        }
      >
        {isComplained ? "Force resubscribe" : "Resubscribe"}
      </button>
    </form>
  );
}
