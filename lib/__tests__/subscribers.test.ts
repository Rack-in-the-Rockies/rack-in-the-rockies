import { describe, it, expect } from "vitest";
import {
  subscribe,
  unsubscribeByToken,
  resubscribeByToken,
  resubscribeById,
  type SubscriberDb,
  type SubscriberRow,
} from "@/lib/subscribers";

function memoryDb(seed: SubscriberRow[] = []) {
  const rows = [...seed];
  const db: SubscriberDb = {
    async findByEmail(email) {
      return rows.find((r) => r.email === email) ?? null;
    },
    async findByToken(token) {
      return rows.find((r) => r.unsubscribe_token === token) ?? null;
    },
    async findById(id) {
      return rows.find((r) => r.id === id) ?? null;
    },
    async insert(row) {
      rows.push({
        id: `id-${rows.length + 1}`,
        unsubscribe_token: `tok-${rows.length + 1}`,
        status: "subscribed",
        ...row,
      } as SubscriberRow);
    },
    async updateById(id, patch) {
      const row = rows.find((r) => r.id === id);
      if (row) Object.assign(row, patch);
    },
  };
  return { db, rows };
}

function row(overrides: Partial<SubscriberRow>): SubscriberRow {
  return {
    id: "id-1",
    email: "annie@example.com",
    first_name: "Annie",
    last_name: null,
    status: "subscribed",
    source: "newsletter",
    tags: [],
    unsubscribe_token: "tok-1",
    ...overrides,
  };
}

describe("subscribe", () => {
  it("creates a new subscriber with a normalized email", async () => {
    const { db, rows } = memoryDb();
    const result = await subscribe(
      { email: " Annie@Example.com ", source: "newsletter" },
      db
    );
    expect(result.outcome).toBe("created");
    expect(rows[0].email).toBe("annie@example.com");
    expect(rows[0].status).toBe("subscribed");
  });

  it("rejects an invalid email without touching the db", async () => {
    const { db, rows } = memoryDb();
    const result = await subscribe({ email: "nope", source: "newsletter" }, db);
    expect(result.outcome).toBe("invalid");
    expect(rows).toHaveLength(0);
  });

  it("updates names and unions tags on an existing subscribed record", async () => {
    const { db, rows } = memoryDb([row({ tags: ["beginner"] })]);
    const result = await subscribe(
      {
        email: "annie@example.com",
        lastName: "Chen",
        tags: ["booking"],
        source: "booking",
      },
      db
    );
    expect(result.outcome).toBe("updated");
    expect(rows[0].last_name).toBe("Chen");
    expect(rows[0].tags).toEqual(["beginner", "booking"]);
    // A later write must not erase the other path's tags: union, not replace.
  });

  it("resubscribes an unsubscribed record only via the newsletter source", async () => {
    const { db, rows } = memoryDb([row({ status: "unsubscribed" })]);
    const viaInquiry = await subscribe(
      { email: "annie@example.com", source: "contact" },
      db
    );
    expect(viaInquiry.outcome).toBe("blocked");
    expect(rows[0].status).toBe("unsubscribed");

    const viaSignup = await subscribe(
      { email: "annie@example.com", source: "newsletter" },
      db
    );
    expect(viaSignup.outcome).toBe("resubscribed");
    expect(rows[0].status).toBe("subscribed");
  });

  it("never resurrects a complained record, from any source", async () => {
    const { db, rows } = memoryDb([row({ status: "complained" })]);
    for (const source of ["newsletter", "contact", "booking", "trips-waitlist"] as const) {
      const result = await subscribe({ email: "annie@example.com", source }, db);
      expect(result.outcome).toBe("blocked");
    }
    expect(rows[0].status).toBe("complained");
  });
});

describe("unsubscribeByToken", () => {
  it("unsubscribes by token", async () => {
    const { db, rows } = memoryDb([row({})]);
    const result = await unsubscribeByToken("tok-1", db);
    expect(result.outcome).toBe("unsubscribed");
    expect(rows[0].status).toBe("unsubscribed");
  });
  it("reports unknown tokens without throwing", async () => {
    const { db } = memoryDb();
    const result = await unsubscribeByToken("nope", db);
    expect(result.outcome).toBe("not_found");
  });
});

describe("resubscribeByToken", () => {
  it("resubscribes an unsubscribed record", async () => {
    const { db, rows } = memoryDb([row({ status: "unsubscribed" })]);
    const result = await resubscribeByToken("tok-1", db);
    expect(result.outcome).toBe("resubscribed");
    expect(rows[0].status).toBe("subscribed");
  });
  it("stays blocked at complained, matching the matrix", async () => {
    const { db, rows } = memoryDb([row({ status: "complained" })]);
    const result = await resubscribeByToken("tok-1", db);
    expect(result.outcome).toBe("blocked");
    expect(rows[0].status).toBe("complained");
  });
});

describe("resubscribeById", () => {
  it("resubscribes unsubscribed without force", async () => {
    const { db, rows } = memoryDb([row({ status: "unsubscribed" })]);
    const result = await resubscribeById("id-1", { force: false }, db);
    expect(result.outcome).toBe("resubscribed");
    expect(rows[0].status).toBe("subscribed");
  });
  it("requires force for complained", async () => {
    const { db, rows } = memoryDb([row({ status: "complained" })]);
    const blocked = await resubscribeById("id-1", { force: false }, db);
    expect(blocked.outcome).toBe("blocked");
    expect(rows[0].status).toBe("complained");

    const forced = await resubscribeById("id-1", { force: true }, db);
    expect(forced.outcome).toBe("resubscribed");
    expect(rows[0].status).toBe("subscribed");
  });
});
