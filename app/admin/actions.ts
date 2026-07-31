"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { resubscribeById } from "@/lib/subscribers";
import { supabaseServer } from "@/lib/supabase/server";

export async function adminResubscribe(formData: FormData) {
  // Re-verify here: server actions are invokable without the layout running.
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const force = formData.get("force") === "true";
  if (id) {
    await resubscribeById(id, { force });
  }
  revalidatePath("/admin");
}

export async function adminAddTag(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const tag = String(formData.get("tag") ?? "");
  if (id && tag.trim()) {
    const { addTagById } = await import("@/lib/subscribers");
    await addTagById(id, tag);
  }
  revalidatePath("/admin");
}

export async function adminRemoveTag(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const tag = String(formData.get("tag") ?? "");
  if (id && tag) {
    const { removeTagById } = await import("@/lib/subscribers");
    await removeTagById(id, tag);
  }
  revalidatePath("/admin");
}

export async function signOut() {
  const supabase = await supabaseServer();
  await supabase.auth.signOut();
  redirect("/admin/login");
}
