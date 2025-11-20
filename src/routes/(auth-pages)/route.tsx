import { createFileRoute, redirect } from "@tanstack/react-router";
import { authQueryOptions } from "~/lib/auth/queries";

export const Route = createFileRoute("/(auth-pages)")({
  beforeLoad: async ({ context }) => {
    // Redirect all auth pages to home - we use modal instead
    throw redirect({
      to: "/",
    });
  },
});
