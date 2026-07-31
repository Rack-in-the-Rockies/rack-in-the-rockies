"use server";

import { revalidatePath } from "next/cache";
import { resumeAction as resume } from "@/app/admin/(gated)/compose/actions";

export async function resumeSend(formData: FormData) {
  const sendId = String(formData.get("sendId") ?? "");
  if (sendId) {
    await resume(sendId);
    revalidatePath(`/admin/sends/${sendId}`);
    revalidatePath("/admin/sends");
  }
}
