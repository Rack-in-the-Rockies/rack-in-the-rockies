import { describe, it, expect } from "vitest";
import {
  markBounced,
  markComplained,
  addTagById,
  removeTagById,
  type SubscriberDb,
  type SubscriberRow,
} from "@/lib/subscribers";
import { csvField, subscribersToCsv } from "@/lib/subscriber-rules";

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
        tags: [],
        first_name: null,
        last_name: null,
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

describe("markBounced", () => {
  it("moves subscribed to bounced, normalizing the email", async () => {
    const { db, rows } = memoryDb([row({})]);
    const result = await markBounced(" Annie@Example.com ", db);
    expect(result.outcome).toBe("bounced");
    expect(rows[0].status).toBe("bounced");
  });
  it("never touches unsubscribed or complained, and reports unknowns", async () => {
    for (const status of ["unsubscribed", "complained", "bounced"] as const) {
      const { db, rows } = memoryDb([row({ status })]);
      const result = await markBounced("annie@example.com", db);
      expect(result.outcome).toBe("skipped");
      expect(rows[0].status).toBe(status);
    }
    const { db } = memoryDb();
    expect((await markBounced("ghost@example.com", db)).outcome).toBe("not_found");
  });
});

describe("markComplained", () => {
  it("sets complained from every prior status", async () => {
    for (const status of ["subscribed", "unsubscribed", "bounced"] as const) {
      const { db, rows } = memoryDb([row({ status })]);
      const result = await markComplained("annie@example.com", db);
      expect(result.outcome).toBe("complained");
      expect(rows[0].status).toBe("complained");
    }
  });
  it("is idempotent on an already complained row", async () => {
    const { db } = memoryDb([row({ status: "complained" })]);
    expect((await markComplained("annie@example.com", db)).outcome).toBe("skipped");
  });
});

describe("tag editing", () => {
  it("adds without duplicating and trims", async () => {
    const { db, rows } = memoryDb([row({ tags: ["booking"] })]);
    await addTagById("id-1", "  trips ", db);
    await addTagById("id-1", "booking", db);
    expect(rows[0].tags).toEqual(["booking", "trips"]);
  });
  it("ignores empty tags", async () => {
    const { db, rows } = memoryDb([row({ tags: ["booking"] })]);
    const result = await addTagById("id-1", "   ", db);
    expect(result.outcome).toBe("invalid");
    expect(rows[0].tags).toEqual(["booking"]);
  });
  it("removes a tag", async () => {
    const { db, rows } = memoryDb([row({ tags: ["booking", "trips"] })]);
    await removeTagById("id-1", "booking", db);
    expect(rows[0].tags).toEqual(["trips"]);
  });
  it("reports unknown ids", async () => {
    const { db } = memoryDb();
    expect((await addTagById("nope", "x", db)).outcome).toBe("not_found");
    expect((await removeTagById("nope", "x", db)).outcome).toBe("not_found");
  });
});

describe("csv", () => {
  it("escapes commas, quotes, and newlines", () => {
    expect(csvField("plain")).toBe("plain");
    expect(csvField('a "b", c')).toBe('"a ""b"", c"');
    expect(csvField("line1\nline2")).toBe('"line1\nline2"');
    expect(csvField(null)).toBe("");
  });
  it("renders a header plus one line per subscriber", () => {
    const csv = subscribersToCsv([
      row({ tags: ["a", "b"], created_at: "2026-07-30T00:00:00Z" }),
    ]);
    const lines = csv.trimEnd().split("\n");
    expect(lines[0]).toBe("email,first_name,last_name,status,source,tags,created_at");
    expect(lines[1]).toBe('annie@example.com,Annie,,subscribed,newsletter,"a, b",2026-07-30T00:00:00Z');
  });
});
