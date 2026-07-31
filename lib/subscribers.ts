import {
  decideSubscribeAction,
  isValidEmail,
  normalizeEmail,
  unionTags,
  type SubscribeSource,
  type SubscriberStatus,
} from "@/lib/subscriber-rules";
import { supabaseAdmin } from "@/lib/supabase/admin";

export type SubscriberRow = {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  status: SubscriberStatus;
  source: string;
  tags: string[];
  unsubscribe_token: string;
  created_at?: string;
};

/** Small persistence interface so the rules are testable without Supabase. */
export type SubscriberDb = {
  findByEmail(email: string): Promise<SubscriberRow | null>;
  findByToken(token: string): Promise<SubscriberRow | null>;
  findById(id: string): Promise<SubscriberRow | null>;
  insert(row: {
    email: string;
    first_name: string | null;
    last_name: string | null;
    source: string;
    tags: string[];
  }): Promise<void>;
  updateById(id: string, patch: Partial<SubscriberRow>): Promise<void>;
};

export type SubscribeInput = {
  email: string;
  firstName?: string;
  lastName?: string;
  source: SubscribeSource;
  tags?: string[];
};

export type SubscribeResult = {
  outcome: "created" | "updated" | "resubscribed" | "blocked" | "invalid";
};
export type TokenResult = {
  outcome: "unsubscribed" | "resubscribed" | "blocked" | "not_found";
};

export async function subscribe(
  input: SubscribeInput,
  db: SubscriberDb = liveDb()
): Promise<SubscribeResult> {
  const email = normalizeEmail(input.email ?? "");
  if (!isValidEmail(email)) return { outcome: "invalid" };

  const existing = await db.findByEmail(email);
  const explicit = input.source === "newsletter";
  const action = decideSubscribeAction(existing?.status ?? null, explicit);

  switch (action) {
    case "create":
      await db.insert({
        email,
        first_name: input.firstName?.trim() || null,
        last_name: input.lastName?.trim() || null,
        source: input.source,
        tags: input.tags ?? [],
      });
      return { outcome: "created" };
    case "update":
    case "resubscribe": {
      const patch: Partial<SubscriberRow> = {
        tags: unionTags(existing!.tags, input.tags ?? []),
      };
      if (input.firstName?.trim()) patch.first_name = input.firstName.trim();
      if (input.lastName?.trim()) patch.last_name = input.lastName.trim();
      if (action === "resubscribe") patch.status = "subscribed";
      await db.updateById(existing!.id, patch);
      return { outcome: action === "resubscribe" ? "resubscribed" : "updated" };
    }
    case "blocked":
      return { outcome: "blocked" };
  }
}

export async function unsubscribeByToken(
  token: string,
  db: SubscriberDb = liveDb()
): Promise<TokenResult> {
  const row = await db.findByToken(token);
  if (!row) return { outcome: "not_found" };
  if (row.status !== "unsubscribed") {
    await db.updateById(row.id, { status: "unsubscribed" });
  }
  return { outcome: "unsubscribed" };
}

export async function resubscribeByToken(
  token: string,
  db: SubscriberDb = liveDb()
): Promise<TokenResult> {
  const row = await db.findByToken(token);
  if (!row) return { outcome: "not_found" };
  // Own-token resubscribe is explicit intent, but complained stays blocked:
  // a complaint followed by a token replay is indistinguishable from a bot.
  if (row.status === "complained") return { outcome: "blocked" };
  await db.updateById(row.id, { status: "subscribed" });
  return { outcome: "resubscribed" };
}

export async function resubscribeById(
  id: string,
  opts: { force: boolean },
  db: SubscriberDb = liveDb()
): Promise<TokenResult> {
  const row = await db.findById(id);
  if (!row) return { outcome: "not_found" };
  if (row.status === "complained" && !opts.force) return { outcome: "blocked" };
  await db.updateById(row.id, { status: "subscribed" });
  return { outcome: "resubscribed" };
}

export type MarkResult = { outcome: "bounced" | "complained" | "skipped" | "not_found" };
export type TagResult = { outcome: "updated" | "invalid" | "not_found" };

/**
 * Webhook write-back for permanent bounces. Only a currently subscribed
 * record moves to bounced: unsubscribed stays unsubscribed and complained
 * is never downgraded.
 */
export async function markBounced(
  email: string,
  db: SubscriberDb = liveDb()
): Promise<MarkResult> {
  const row = await db.findByEmail(normalizeEmail(email));
  if (!row) return { outcome: "not_found" };
  if (row.status !== "subscribed") return { outcome: "skipped" };
  await db.updateById(row.id, { status: "bounced" });
  return { outcome: "bounced" };
}

/** Webhook write-back for complaints. Complained outranks every status. */
export async function markComplained(
  email: string,
  db: SubscriberDb = liveDb()
): Promise<MarkResult> {
  const row = await db.findByEmail(normalizeEmail(email));
  if (!row) return { outcome: "not_found" };
  if (row.status === "complained") return { outcome: "skipped" };
  await db.updateById(row.id, { status: "complained" });
  return { outcome: "complained" };
}

// Admin tag editing. Add stays a union; remove is deliberately allowed for
// humans (the union-only rule protects automated write paths, not admins).
export async function addTagById(
  id: string,
  tag: string,
  db: SubscriberDb = liveDb()
): Promise<TagResult> {
  const clean = tag.trim();
  if (!clean) return { outcome: "invalid" };
  const row = await db.findById(id);
  if (!row) return { outcome: "not_found" };
  await db.updateById(id, { tags: unionTags(row.tags, [clean]) });
  return { outcome: "updated" };
}

export async function removeTagById(
  id: string,
  tag: string,
  db: SubscriberDb = liveDb()
): Promise<TagResult> {
  const row = await db.findById(id);
  if (!row) return { outcome: "not_found" };
  await db.updateById(id, { tags: row.tags.filter((t) => t !== tag) });
  return { outcome: "updated" };
}

export type ListFilters = {
  search?: string;
  status?: string;
  source?: string;
  tags?: string[];
  page?: number;
};

export const PAGE_SIZE = 100;

export type SubscriberList = {
  rows: SubscriberRow[];
  total: number;
  page: number;
  pageCount: number;
};

// Admin read path. Goes straight to Supabase rather than through SubscriberDb:
// it needs query composition (ilike, overlaps, ranges) that the small
// interface should not grow, and no business rules live here.
export async function listSubscribers(filters: ListFilters): Promise<SubscriberList> {
  const page = Math.max(1, filters.page ?? 1);
  const from = (page - 1) * PAGE_SIZE;
  const client = supabaseAdmin();
  let q = client
    .from("subscribers")
    .select(
      "id, email, first_name, last_name, status, source, tags, unsubscribe_token, created_at",
      { count: "exact" }
    )
    .order("created_at", { ascending: false })
    .range(from, from + PAGE_SIZE - 1);
  if (filters.status) q = q.eq("status", filters.status);
  if (filters.source) q = q.eq("source", filters.source);
  if (filters.tags && filters.tags.length > 0) q = q.overlaps("tags", filters.tags);
  if (filters.search) {
    const s = filters.search.replaceAll("%", "").replaceAll(",", "");
    q = q.or(`email.ilike.%${s}%,first_name.ilike.%${s}%,last_name.ilike.%${s}%`);
  }
  const { data, error, count } = await q;
  if (error) throw error;
  const total = count ?? 0;
  return {
    rows: data as SubscriberRow[],
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  };
}

/** Every distinct tag in use, for filter and audience pickers. */
export async function listTags(): Promise<string[]> {
  const { data, error } = await supabaseAdmin().from("subscribers").select("tags").limit(10000);
  if (error) throw error;
  const all = new Set<string>();
  for (const row of data as { tags: string[] }[]) {
    for (const tag of row.tags) all.add(tag);
  }
  return [...all].sort();
}

/** Recipient count for the composer. Empty tags means all subscribed. */
export async function countAudience(tags: string[]): Promise<number> {
  const client = supabaseAdmin();
  let q = client
    .from("subscribers")
    .select("id", { count: "exact", head: true })
    .eq("status", "subscribed");
  if (tags.length > 0) q = q.overlaps("tags", tags);
  const { count, error } = await q;
  if (error) throw error;
  return count ?? 0;
}

export type AudienceMember = {
  id: string;
  email: string;
  unsubscribe_token: string;
};

/**
 * The full audience snapshot for a send. Pages through Supabase's 1000-row
 * response cap; ordering by id keeps pages stable while iterating.
 */
export async function listAudience(tags: string[]): Promise<AudienceMember[]> {
  const client = supabaseAdmin();
  const members: AudienceMember[] = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    let q = client
      .from("subscribers")
      .select("id, email, unsubscribe_token")
      .eq("status", "subscribed")
      .order("id", { ascending: true })
      .range(from, from + pageSize - 1);
    if (tags.length > 0) q = q.overlaps("tags", tags);
    const { data, error } = await q;
    if (error) throw error;
    members.push(...(data as AudienceMember[]));
    if ((data?.length ?? 0) < pageSize) break;
  }
  return members;
}

/** All rows matching the filters, for CSV export. Same paging approach. */
export async function exportSubscribers(
  filters: Omit<ListFilters, "page">
): Promise<SubscriberRow[]> {
  const client = supabaseAdmin();
  const rows: SubscriberRow[] = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    let q = client
      .from("subscribers")
      .select("id, email, first_name, last_name, status, source, tags, unsubscribe_token, created_at")
      .order("created_at", { ascending: false })
      .range(from, from + pageSize - 1);
    if (filters.status) q = q.eq("status", filters.status);
    if (filters.source) q = q.eq("source", filters.source);
    if (filters.tags && filters.tags.length > 0) q = q.overlaps("tags", filters.tags);
    if (filters.search) {
      const s = filters.search.replaceAll("%", "").replaceAll(",", "");
      q = q.or(`email.ilike.%${s}%,first_name.ilike.%${s}%,last_name.ilike.%${s}%`);
    }
    const { data, error } = await q;
    if (error) throw error;
    rows.push(...(data as SubscriberRow[]));
    if ((data?.length ?? 0) < pageSize) break;
  }
  return rows;
}

const SELECT_COLUMNS =
  "id, email, first_name, last_name, status, source, tags, unsubscribe_token";

function liveDb(): SubscriberDb {
  const client = supabaseAdmin();
  async function findOne(column: string, value: string) {
    const { data, error } = await client
      .from("subscribers")
      .select(SELECT_COLUMNS)
      .eq(column, value)
      .maybeSingle();
    if (error) throw error;
    return (data as SubscriberRow) ?? null;
  }
  return {
    findByEmail: (email) => findOne("email", email),
    findByToken: (token) => findOne("unsubscribe_token", token),
    findById: (id) => findOne("id", id),
    async insert(row) {
      const { error } = await client.from("subscribers").insert(row);
      if (error) throw error;
    },
    async updateById(id, patch) {
      const { error } = await client.from("subscribers").update(patch).eq("id", id);
      if (error) throw error;
    },
  };
}
