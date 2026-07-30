"use server";

import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { isValidEmail, normalizeEmail } from "@/lib/subscriber-rules";

export async function sendMagicLink(formData: FormData) {
  const email = normalizeEmail(String(formData.get("email") ?? ""));
  if (!isValidEmail(email)) {
    redirect("/admin/login?error=email");
  }
  const supabase = await supabaseServer();
  // shouldCreateUser false: signups are closed; only invited users get links.
  await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: false },
  });
  // Always claim success: this page must not reveal which emails have accounts.
  redirect("/admin/login?sent=1");
}
