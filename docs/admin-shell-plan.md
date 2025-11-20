# Admin Shell and Navigation Plan

## Goals

- Provide a consistent authenticated experience that shares the same sidebar/header regardless of feature area.
- Centralize access control (auth vs. admin) in layout-level guards instead of scattering checks in page components.
- Deliver predictable navigation, breadcrumbs, and polish so admins and non-admins know where they are and what they can access.
- Improve DX by keeping route definitions, guards, and navigation config in one place, reducing duplication and easing testing.

## Information Architecture

- Consolidate all authenticated screens under a single layout tree:
  - `/dashboard/*` – general authenticated experience (teams, events, profile, etc.).
  - `/dashboard/admin/*` – admin-only tools (event review, roles, other future tools) nested beneath the same layout for UX alignment.
- Keep public/marketing pages separate with a lighter shell.

## Navigation & Layout

- Promote `AdminLayout` to serve both `/dashboard/*` and `/dashboard/admin/*` routes.
- Extract a typed navigation config describing items (label, icon, path, role visibility) so both desktop and mobile sidebars render from a single source.
- Add role filtering to hide admin-only links for non-admins while keeping the list order stable.
- Introduce breadcrumbs derived from the matched route segments to improve context and deep link UX.

## Access Control

- `/dashboard` layout `beforeLoad`: enforce `requireAuthAndProfile`.
- `/dashboard/admin` layout `beforeLoad`: enforce admin privileges (`isAdminClient`).
- Return a dedicated 403 Forbidden page when a non-admin attempts to access admin routes (instead of redirect looping).

## UX Enhancements

- Maintain consistent back-navigation (breadcrumbs + back buttons) from detail/manage screens.
- Ensure loading states reuse shared skeleton components.
- Toasts should appear within the layout so feedback is always visible regardless of nested route.
- Keep dev diagnostics optional (`VITE_ROUTER_DEBUG`) for routing instrumentation.

## DX & Testing

- Route path helpers / constants exported from a config file to avoid string drift.
- Unit tests covering layout guards and `isAdminClient` logic.
- Playwright smoke tests for admin navigation (sidebar, event review approval flows, access denial for non-admins).
- Code-split admin subtree (lazy routes) but prefetch on sidebar hover (`prefetch="intent"`) to balance perf with responsiveness.

## Migration Plan

1. **Restructure routes**
   - Move `src/routes/admin/*` to `src/routes/dashboard/admin/*` (e.g. `events-review.tsx`, `roles.tsx`).
   - Add redirects from old `/admin/...` paths to the new `/dashboard/admin/...` equivalents to preserve bookmarks.
2. **Layout hierarchy**
   - Create `src/routes/dashboard/admin/route.tsx` that renders `<AdminLayout />` and applies the admin-only guard.
   - Remove redundant guard logic from the page components once the layout guard is in place.
3. **Navigation config**
   - Introduce `src/features/layouts/admin-nav.ts` exporting a typed array of nav items.
   - Refactor `AdminSidebar` and mobile header to consume the config, filtering items by role.
4. **Breadcrumbs & 403**
   - Build a `Breadcrumbs` component reading matches from the router and mount it in `AdminLayout`.
   - Add `src/routes/dashboard/admin/forbidden.tsx` (or a shared route) to render a friendly 403 page.
5. **Validation**
   - Update Playwright flows to reflect new URLs and confirm sidebar remains in place across admin screens.
   - Verify redirects for old `/admin` links and non-admin access behavior.
6. **Documentation**
   - Update docs to describe the unified admin shell and new route structure.

---

# Next Steps

1. **Restructure routes**
   - [ ] Move `src/routes/admin/events-review.tsx` → `src/routes/dashboard/admin/events-review.tsx`.
   - [ ] Move `src/routes/admin/roles.tsx` → `src/routes/dashboard/admin/roles.tsx`.
   - [ ] Add redirect routes from `/admin/events-review` and `/admin/roles` to their new `/dashboard/admin/...` counterparts.

2. **Add admin layout guard**
   - [ ] Create `src/routes/dashboard/admin/route.tsx` that renders `AdminLayout` and enforces `isAdminClient` in `beforeLoad`.
   - [ ] Remove the now-redundant guard code from the moved page components, relying on the layout guard.

3. **Navigation config & role filtering**
   - [ ] Create `src/features/layouts/admin-nav.ts` exporting a typed list of nav items with role metadata.
   - [ ] Update `AdminSidebar` and `MobileAdminHeader` to render from that config and to filter admin-only links.

4. **Breadcrumbs & forbidden page**
   - [ ] Implement a breadcrumb component using TanStack Router matches and mount it in `AdminLayout`.
   - [ ] Add a shared `Forbidden` page route and use it for unauthorized access to `/dashboard/admin/*`.

5. **Testing updates**
   - [ ] Adjust Playwright/E2E scripts to use new paths and verify sidebar persistence on admin pages.
   - [ ] Add a regression test ensuring non-admin users see the forbidden page when visiting `/dashboard/admin/...`.

6. **Docs & cleanup**
   - [ ] Update internal docs (e.g., `docs/development-backlog.md` or relevant architectural notes) to record the new IA and guard structure.
   - [ ] Ensure no stale references to old `/admin` URLs remain in code or documentation.
