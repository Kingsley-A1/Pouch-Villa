"use server";

import { redirect } from "next/navigation";
import { clearStaffSession } from "@/server/session";

export async function logoutAction() {
  await clearStaffSession();
  redirect("/admin/login");
}
