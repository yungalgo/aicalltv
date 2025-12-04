import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/callers")({
  component: CallersLayout,
});

function CallersLayout() {
  return <Outlet />;
}
