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

export type ListFilters = {
  search?: string;
  status?: string;
  source?: string;
};

// Admin read path. Goes straight to Supabase rather than through SubscriberDb:
// it needs query composition (ilike, ordering) that a four-method interface
// should not grow, and no business rules live here.
export async function listSubscribers(filters: ListFilters): Promise<SubscriberRow[]> {
  const client = supabaseAdmin();
  let q = client
    .from("subscribers")
    .select(
      "id, email, first_name, last_name, status, source, tags, unsubscribe_token, created_at"
    )
    .order("created_at", { ascending: false })
    .limit(500);
  if (filters.status) q = q.eq("status", filters.status);
  if (filters.source) q = q.eq("source", filters.source);
  if (filters.search) {
    const s = filters.search.replaceAll("%", "").replaceAll(",", "");
    q = q.or(`email.ilike.%${s}%,first_name.ilike.%${s}%,last_name.ilike.%${s}%`);
  }
  const { data, error } = await q;
  if (error) throw error;
  return data as SubscriberRow[];
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
