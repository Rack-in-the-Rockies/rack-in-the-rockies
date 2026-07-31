import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * Verifies the session AND the admin role. Must be called by every admin
 * page AND every admin server action: the layout check only protects
 * rendering, actions are directly invokable via POST.
 *
 * Role comes from public.profiles, never from user_metadata (self-editable).
 */
export async function requireAdmin(): Promise<{ userId: string; email: string }> {
  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (error || !userId) redirect("/admin/login");

  const { data: profile } = await supabaseAdmin()
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();
  if (profile?.role !== "admin") redirect("/admin/login");

  return { userId, email: String(data?.claims?.email ?? "") };
}
