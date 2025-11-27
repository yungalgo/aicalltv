import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { auth } from "~/lib/auth/auth";

export const $getUser = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const session = await auth.api.getSession({
      headers: getRequest().headers,
    });

    return session?.user || null;
  } catch (error) {
    console.error("[Auth] Error getting session:", error);
    return null;
  }
});
