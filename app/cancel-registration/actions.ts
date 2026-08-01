"use server";

import { cancelByToken } from "@/lib/registrations";

/**
 * Token-authorized, deliberately NOT admin-gated: the token from the
 * confirmation email is the credential, like unsubscribe tokens.
 */
export async function cancelRegistration(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  if (token) {
    await cancelByToken(token);
  }
}
