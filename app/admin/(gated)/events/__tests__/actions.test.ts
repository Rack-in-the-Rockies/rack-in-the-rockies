import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({
  requireAdmin: vi.fn(async () => ({ userId: "admin-1", email: "tyler@example.com" })),
}));
vi.mock("@/lib/events", () => ({
  createEvent: vi.fn(async () => "evt-1"),
  updateEvent: vi.fn(async () => {}),
  setEventStatus: vi.fn(async () => {}),
  deleteDraftEvent: vi.fn(async () => {}),
  getEvent: vi.fn(),
  toEventInput: vi.fn((e) => e.input),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => {
  const upload = vi.fn(async () => ({ data: { path: "abc.png" }, error: null }));
  const getPublicUrl = vi.fn(() => ({ data: { publicUrl: "https://cdn.example/abc.png" } }));
  return {
    supabaseAdmin: vi.fn(() => ({
      storage: { from: vi.fn(() => ({ upload, getPublicUrl })) },
    })),
  };
});

import {
  saveEventAction,
  publishEventAction,
  unpublishEventAction,
  duplicateEventAction,
  deleteDraftAction,
  uploadEventImageAction,
} from "@/app/admin/(gated)/events/actions";
import { requireAdmin } from "@/lib/auth";
import {
  createEvent,
  updateEvent,
  setEventStatus,
  deleteDraftEvent,
  getEvent,
} from "@/lib/events";
import { revalidatePath } from "next/cache";

const draftInput = { title: "Test Event", sessions: [] };
const fullInput = {
  title: "Test Event",
  partner: null,
  dateLabel: "October 1, 2026",
  endsAt: "2099-10-01T20:00:00-06:00",
  location: "Denver",
  blurb: "A blurb.",
  bannerText: "Test Event: October 1",
  externalSignupUrl: null,
  paymentInstructions: null,
  sessions: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  (getEvent as ReturnType<typeof vi.fn>).mockResolvedValue({
    id: "evt-1",
    status: "draft",
    input: fullInput,
  });
});

describe("event actions", () => {
  it("every action re-verifies the admin session", async () => {
    await saveEventAction(null, draftInput);
    await publishEventAction("evt-1", fullInput);
    await unpublishEventAction("evt-1");
    await duplicateEventAction("evt-1");
    await deleteDraftAction("evt-1");
    expect(requireAdmin).toHaveBeenCalledTimes(5);
  });

  it("creates a draft with loose validation", async () => {
    const result = await saveEventAction(null, draftInput);
    expect(createEvent).toHaveBeenCalled();
    expect("id" in result && result.id).toBe("evt-1");
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("rejects a titleless draft with plain-language errors", async () => {
    const result = await saveEventAction(null, { title: " ", sessions: [] });
    expect("errors" in result && result.errors.length).toBe(1);
    expect(createEvent).not.toHaveBeenCalled();
  });

  it("saving an already published event revalidates and validates fully", async () => {
    (getEvent as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "evt-1",
      status: "published",
      input: fullInput,
    });
    const bad = await saveEventAction("evt-1", { ...fullInput, bannerText: "" });
    expect("errors" in bad).toBe(true);
    const good = await saveEventAction("evt-1", fullInput);
    expect("id" in good).toBe(true);
    expect(updateEvent).toHaveBeenCalledTimes(1);
    expect(revalidatePath).toHaveBeenCalledWith("/", "layout");
  });

  it("publish saves, validates fully, sets status, and revalidates", async () => {
    const bad = await publishEventAction("evt-1", { ...fullInput, location: "" });
    expect("errors" in bad).toBe(true);
    expect(setEventStatus).not.toHaveBeenCalled();

    const good = await publishEventAction("evt-1", fullInput);
    expect("id" in good).toBe(true);
    expect(updateEvent).toHaveBeenCalled();
    expect(setEventStatus).toHaveBeenCalledWith("evt-1", "published");
    expect(revalidatePath).toHaveBeenCalledWith("/", "layout");
  });

  it("unpublish flips status and revalidates", async () => {
    await unpublishEventAction("evt-1");
    expect(setEventStatus).toHaveBeenCalledWith("evt-1", "draft");
    expect(revalidatePath).toHaveBeenCalledWith("/", "layout");
  });

  it("duplicate clears dates and creates a fresh draft", async () => {
    const result = await duplicateEventAction("evt-1");
    expect("id" in result && result.id).toBe("evt-1");
    const created = (createEvent as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(created.dateLabel).toBe("");
    expect(created.endsAt).toBe("");
  });

  it("delete only deletes drafts and reports on missing events", async () => {
    await deleteDraftAction("evt-1");
    expect(deleteDraftEvent).toHaveBeenCalledWith("evt-1");
    (getEvent as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const missing = await duplicateEventAction("nope");
    expect("error" in missing).toBe(true);
  });
});

describe("uploadEventImageAction", () => {
  function fileForm(type: string, size: number) {
    const form = new FormData();
    const file = new File([new Uint8Array(size)], "photo.png", { type });
    form.set("file", file);
    return form;
  }

  it("verifies the admin session and uploads valid images", async () => {
    const result = await uploadEventImageAction(fileForm("image/png", 1024));
    expect(requireAdmin).toHaveBeenCalled();
    expect("url" in result && result.url).toBe("https://cdn.example/abc.png");
  });

  it("rejects wrong types and oversize files", async () => {
    expect("error" in (await uploadEventImageAction(fileForm("image/gif", 10)))).toBe(true);
    expect("error" in (await uploadEventImageAction(fileForm("image/png", 6 * 1024 * 1024)))).toBe(true);
  });

  it("rejects a missing file", async () => {
    expect("error" in (await uploadEventImageAction(new FormData()))).toBe(true);
  });
});
