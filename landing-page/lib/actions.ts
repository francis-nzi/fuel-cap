"use server";

import { redirect } from "next/navigation";
import { createDashboardSession, destroyDashboardSession } from "./session";

export type LoginState = { error?: string } | undefined;

export async function loginAction(_prevState: LoginState, formData: FormData): Promise<LoginState> {
  const password = formData.get("password");
  const expected = process.env.DASHBOARD_PASSWORD;

  if (!expected) {
    return { error: "Dashboard password is not configured on the server." };
  }

  if (typeof password !== "string" || password !== expected) {
    return { error: "Incorrect password." };
  }

  await createDashboardSession();
  redirect("/dashboard");
}

export async function logoutAction() {
  await destroyDashboardSession();
  redirect("/dashboard/login");
}
