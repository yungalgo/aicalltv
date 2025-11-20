# TanStack Start RC Migration Tracker

This document tracks the migration work for upgrading the app to the Start RC + Vite 7 stack.

## ✅ Completed

- Updated Node/Pnpm engine requirements in `package.json`
- Bumped `@tanstack/react-*` packages to `1.132.2` and added `@tanstack/start-static-server-functions`
- Switched Vite config to explicit React plugin (no auto-detect), adopted `router` options, and removed deprecated `target`
- Refactored router export to `getRouter()` with client singleton + type alias
- Updated client entry to use `@tanstack/react-start/client` and implicit router
- Replaced `serverOnly` with `createServerOnlyFn` everywhere
- Renamed `.validator` usage to `.inputValidator`
- Ran `pnpm install` + `pnpm lint`
- Converted server routes to `createFileRoute(...){ server.handlers }` pattern
- Regenerated `routeTree.gen.ts` references for server routes (manual patch)
- Patched `TypedLink` Safari fallback to satisfy stricter typings
- Tightened loader data typings in team routes to appease TS RC changes
- Cleared `pnpm check-types` errors (route tree typings, loader data, TypedLink)
- Re-ran `pnpm lint` to confirm clean workspace
- Introduced explicit `src/server.ts` entry using new `{ fetch }` signature

## 🔄 In Progress

- Investigate `getCurrentUser` runtime error (`functionMiddleware` undefined) observed in dev; likely needs refreshed Start initialization once dev server restarts

## ⏭️ Next Steps

- Identify if more server route typings need manual declarations as RC evolves
- Verify runtime via `pnpm dev` + smoke navigation once type issues resolved
- Prepare final summary + recommended QA steps

_Last updated: 2025-09-23 23:14:47 PDT_
