import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/(auth-pages)")({
  beforeLoad: async () => {
    // Redirect all auth pages to home - we use modal instead
    throw redirect({
      to: "/",
    });
  },
});
