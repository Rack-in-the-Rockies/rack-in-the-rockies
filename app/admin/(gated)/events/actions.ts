"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import {
  parseEventInput,
  validateEventInput,
  duplicateTransform,
} from "@/lib/event-rules";
import {
  createEvent,
  updateEvent,
  setEventStatus,
  deleteDraftEvent,
  getEvent,
  toEventInput,
} from "@/lib/events";

export type EventActionResult = { id: string } | { errors: string[] } | { error: string };

const READ_FAIL = { error: "Could not read the form. Refresh and try again." } as const;

/**
 * Save without changing status. Draft saves are permissive; saving an event
 * that is already published enforces publish-level validation and flushes
 * the site cache, because the edit is live.
 */
export async function saveEventAction(
  eventId: string | null,
  raw: unknown
): Promise<EventActionResult> {
  const { userId } = await requireAdmin();
  const input = parseEventInput(raw);
  if (!input) return READ_FAIL;

  const existing = eventId ? await getEvent(eventId) : null;
  if (eventId && !existing) return { error: "Event not found." };
  const isLive = existing?.status === "published";

  const errors = validateEventInput(input, { forPublish: isLive });
  if (errors.length) return { errors };

  try {
    const id = existing ? existing.id : await createEvent(input, userId);
    if (existing) await updateEvent(id, input);
    if (isLive) revalidatePath("/", "layout");
    return { id };
  } catch (error) {
    console.error("saveEventAction failed", error);
    return { error: error instanceof Error ? error.message : "Something went wrong." };
  }
}

export async function publishEventAction(
  eventId: string,
  raw: unknown
): Promise<EventActionResult> {
  await requireAdmin();
  const input = parseEventInput(raw);
  if (!input) return READ_FAIL;
  const existing = await getEvent(eventId);
  if (!existing) return { error: "Event not found." };

  const errors = validateEventInput(input, { forPublish: true });
  if (errors.length) return { errors };

  try {
    await updateEvent(eventId, input);
    await setEventStatus(eventId, "published");
    revalidatePath("/", "layout");
    return { id: eventId };
  } catch (error) {
    console.error("publishEventAction failed", error);
    return { error: error instanceof Error ? error.message : "Something went wrong." };
  }
}

export async function unpublishEventAction(eventId: string): Promise<EventActionResult> {
  await requireAdmin();
  await setEventStatus(eventId, "draft");
  revalidatePath("/", "layout");
  return { id: eventId };
}

export async function duplicateEventAction(eventId: string): Promise<EventActionResult> {
  const { userId } = await requireAdmin();
  const source = await getEvent(eventId);
  if (!source) return { error: "Event not found." };
  const id = await createEvent(duplicateTransform(toEventInput(source)), userId);
  return { id };
}

export async function deleteDraftAction(eventId: string): Promise<EventActionResult> {
  await requireAdmin();
  try {
    await deleteDraftEvent(eventId);
    return { id: eventId };
  } catch (error) {
    console.error("deleteDraftAction failed", error);
    return { error: error instanceof Error ? error.message : "Something went wrong." };
  }
}
