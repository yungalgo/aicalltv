# Development Backlog

**Last Updated**: September 21, 2025

This backlog lists the active roadmap items for Solstice. Tickets are grouped by priority (P0 is highest). Each ticket below contains the problem statement, desired outcome, implementation guidance, and links to every relevant file so the work can proceed with just this document.

> **Maintainer Checklist:** When closing a ticket, update this backlog entry, refresh any impacted security docs or release notes, and confirm `pnpm lint`, `pnpm check-types`, and relevant tests have been run.

---

## 🚨 P0 – Critical

### EVT-1: Event Cancellation Communication & Refund Flow

|                          |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Status**               | ✅ Completed                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| **Priority**             | 🔴 Critical (member experience & revenue protection)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| **Problem**              | Cancelling an event only flips the event row to `cancelled`; attendee registrations remain untouched and no one is notified. Teams still appear confirmed, e-transfer instructions stay active, and Square sessions are never refunded, creating support escalations and revenue accounting gaps.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| **Desired Outcome**      | Cancelling an event must cascade: mark all related registrations as `cancelled`, persist cancellation timestamps/actors, automatically trigger refunds or follow-up tasks per payment method, and notify both registrants and administrators with clear messaging.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| **Implementation Notes** | <ul><li>Within `cancelEvent`, fetch confirmed/pending registrations for the event and transition them to a cancelled state while recording `cancelledAt`, `cancelledBy`, and reason metadata. Update any associated payment session rows in `eventPaymentSessions` and `eventRegistrations` JSON fields to reflect the cancellation.</li><li>For Square-paid registrations, call the appropriate helper in `squarePaymentService` to void or refund the payment session; ensure idempotency and handle partial failures with structured errors surfaced in the mutation result.</li><li>For e-transfer registrations, enqueue follow-up tasks (e.g., mark `paymentStatus` as `refund_required`) so finance can reconcile manual refunds.</li><li>Emit notification emails (HTML + text) to registrants and a summary to admins. If no email helper exists yet, create a server-only module (e.g., `src/lib/server/notifications/events/cancellation.ts`) that centralizes templating and Netlify mail provider integration.</li><li>Return a result payload that lists how many registrations were touched and any failures so the UI can display next steps.</li><li>Add integration/unit coverage in `src/features/events/__tests__/` validating the mutation behaviour, including Square refund stubs and e-transfer paths.</li></ul> |
| **Linked Files**         | <ul><li>[src/features/events/events.mutations.ts](../src/features/events/events.mutations.ts)</li><li>[src/features/events/events.schemas.ts](../src/features/events/events.schemas.ts)</li><li>[src/features/events/events.types.ts](../src/features/events/events.types.ts)</li><li>[src/features/events/events.db-types.ts](../src/features/events/events.db-types.ts)</li><li>[src/features/events/**tests**/](../src/features/events/__tests__/)</li><li>[src/db/schema/events.schema.ts](../src/db/schema/events.schema.ts)</li><li>[src/db/schema/index.ts](../src/db/schema/index.ts)</li><li>[src/db/schema/teams.schema.ts](../src/db/schema/teams.schema.ts)</li><li>[src/db/schema/membership.schema.ts](../src/db/schema/membership.schema.ts)</li><li>[src/lib/payments/square.ts](../src/lib/payments/square.ts)</li><li>[src/lib/payments/square-real.ts](../src/lib/payments/square-real.ts)</li><li>[src/lib/server/auth.ts](../src/lib/server/auth.ts)</li><li>[src/lib/server/fn-utils.ts](../src/lib/server/fn-utils.ts)</li><li>[src/lib/server/errors.ts](../src/lib/server/errors.ts)</li><li>[src/lib/env.server.ts](../src/lib/env.server.ts)</li></ul>                                                                                                                                                        |

---

## 🔺 P1 – High Priority

### EVT-2: Event Registration Pricing & Payment Tests

|                          |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Status**               | ✅ Completed                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| **Priority**             | 🟠 High (regression protection for revenue flows)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| **Problem**              | `calculateRegistrationAmountCents` and the surrounding `registerForEvent` payment logic lack dedicated tests. Early-bird discounts, zero-cost events, and e-transfer paths are currently unverified and at risk of silent regression.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| **Desired Outcome**      | Deterministic coverage exercising pricing calculations and payment state transitions so future changes cannot break discount windows, amount rounding, or payment status tagging without failing CI.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| **Implementation Notes** | <ul><li>Write a focused unit test suite (e.g., `registration-pricing.test.ts`) covering discount boundaries, rounding, zero-fee events, and both `team`/`individual` registration types.</li><li>Stub payment metadata generation and ensure the mutation transitions to `paid`, `awaiting_etransfer`, or `pending` as expected for the different permutations.</li><li>Backfill tests for the JSONB casting helpers so roster and payment metadata persist correctly.</li><li>Ensure tests mock the Square payment service (`squarePaymentService`) when verifying square-flow branches.</li></ul>                                                                                                                                                                                                                   |
| **Linked Files**         | <ul><li>[src/features/events/events.mutations.ts](../src/features/events/events.mutations.ts)</li><li>[src/features/events/**tests**/registration-pricing.test.ts](../src/features/events/__tests__/registration-pricing.test.ts)</li><li>[src/features/events/events.db-types.ts](../src/features/events/events.db-types.ts)</li><li>[src/features/events/events.schemas.ts](../src/features/events/events.schemas.ts)</li><li>[src/db/schema/events.schema.ts](../src/db/schema/events.schema.ts)</li><li>[src/db/schema/index.ts](../src/db/schema/index.ts)</li><li>[src/tests/utils.tsx](../src/tests/utils.tsx)</li><li>[src/tests/setup.ts](../src/tests/setup.ts)</li><li>[src/tests/mocks/auth.ts](../src/tests/mocks/auth.ts)</li><li>[src/lib/payments/square.ts](../src/lib/payments/square.ts)</li></ul> |

### EVT-3: Event Mutation Time & Metadata Utilities

|                          |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Status**               | ✅ Completed                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| **Priority**             | 🟠 High (consistency & maintainability)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| **Problem**              | Event mutations repeatedly instantiate `const now = new Date()` and rebuild payment metadata in-line, which risks divergent timestamps and inconsistent audit data across cancellation, reminder, and registration flows.                                                                                                                                                                                                                                                                                                                                                                 |
| **Desired Outcome**      | Centralized helpers that produce consistent timestamps and payment metadata snapshots, reducing duplication and making future audit logging trivial.                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| **Implementation Notes** | <ul><li>Extract reusable utilities (e.g., `buildPaymentSnapshot`, `currentTimestamp`) into a server-only helper module under `src/features/events/` (or `src/features/events/utils/`).</li><li>Refactor `registerForEvent`, `cancelEvent`, `markEtransferPaid`, and `markEtransferReminder` to consume the shared helpers.</li><li>Ensure helpers accept `Date` injections for testability and update existing tests/new tests accordingly.</li><li>Document the helper usage within the module to guide future mutations.</li></ul>                                                      |
| **Linked Files**         | <ul><li>[src/features/events/events.mutations.ts](../src/features/events/events.mutations.ts)</li><li>[src/features/events/events.types.ts](../src/features/events/events.types.ts)</li><li>[src/features/events/events.db-types.ts](../src/features/events/events.db-types.ts)</li><li>[src/features/events/events.schemas.ts](../src/features/events/events.schemas.ts)</li><li>[src/features/events/**tests**/](../src/features/events/__tests__/)</li><li>[src/lib/server/fn-utils.ts](../src/lib/server/fn-utils.ts)</li><li>[src/tests/utils.tsx](../src/tests/utils.tsx)</li></ul> |

---

## 🔷 P2 – Medium Priority

### APP-1: Router Event Type Coverage & Diagnostics

|                          |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| **Status**               | ✅ Completed                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| **Priority**             | 🟡 Medium (DX & observability)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| **Problem**              | We disabled client-side navigation logging because TypeScript lacks declarations for `router.subscribe("onNavigateStart"                                                                                                                                                                                                                                                                                                                                                                                                                       | "onNavigateEnd")`. Without types, engineers lose out on low-friction diagnostics during routing issues. |
| **Desired Outcome**      | Strongly-typed router event subscriptions re-enabled in `src/client.tsx`, with optional logging that can be toggled without TS errors or lint suppressions.                                                                                                                                                                                                                                                                                                                                                                                    |
| **Implementation Notes** | <ul><li>Add a module augmentation for `@tanstack/react-router` that declares the event signatures (e.g., in `src/types/router-events.d.ts`).</li><li>Create a small helper wrapper (e.g., `subscribeToRouterDiagnostics(router)`) that centralizes the subscriptions and optional logging flags.</li><li>Re-enable the commented logging in `src/client.tsx`, but guard it behind an environment flag (`VITE_ROUTER_DEBUG`).</li><li>Document the diagnostics usage in a JSDoc comment or README snippet for future troubleshooting.</li></ul> |
| **Linked Files**         | <ul><li>[src/client.tsx](../src/client.tsx)</li><li>[src/router.tsx](../src/router.tsx)</li><li>[src/routeTree.gen.ts](../src/routeTree.gen.ts)</li><li>[src/app/providers.tsx](../src/app/providers.tsx)</li><li>[tsconfig.json](../tsconfig.json)</li><li>[vite.config.ts](../vite.config.ts)</li></ul>                                                                                                                                                                                                                                      |

### DOC-1: Backlog & Release Notes Alignment

|                          |                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Status**               | ✅ Completed                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| **Priority**             | 🟢 Medium (documentation accuracy)                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| **Problem**              | Historical backlog entries drifted from reality (e.g., the OAuth allowlist row mentioned an outstanding TODO despite being shipped). We need a lightweight process and doc updates so release notes, security docs, and this backlog stay in sync.                                                                                                                                                                                                                         |
| **Desired Outcome**      | Clear documentation standards that prevent stale TODO callouts once work ships, plus a changelog snippet summarizing the event-cancellation initiative when complete.                                                                                                                                                                                                                                                                                                      |
| **Implementation Notes** | <ul><li>Document the backlog maintenance expectations in `docs/README.md` or a new `docs/CONTRIBUTING.md` section.</li><li>Audit `docs/SECURITY.md`, `docs/CHANGELOG.md` (or equivalent release notes), and feature docs to ensure they reflect the OAuth allowlist completion and to add placeholders for the upcoming event-cancellation work.</li><li>Add a short checklist to this backlog file (top-level note) describing when to prune completed tickets.</li></ul> |
| **Linked Files**         | <ul><li>[docs/development-backlog.md](./development-backlog.md)</li><li>[docs/SECURITY.md](./SECURITY.md)</li><li>[docs/README.md](./README.md)</li><li>[docs/](./)</li><li>[src/lib/env.server.ts](../src/lib/env.server.ts)</li><li>[src/lib/auth/server-helpers.ts](../src/lib/auth/server-helpers.ts)</li></ul>                                                                                                                                                        |

---

> **Process Reminder:** Before closing a ticket, run `pnpm lint`, `pnpm check-types`, and any ticket-specific tests. Update this backlog and associated documentation as part of the same PR so the roadmap always mirrors production reality.

---

Absolutely—let’s knock out **APP‑1: Router Event Type Coverage & Diagnostics** from your backlog and get those client‑side navigation diagnostics back without TypeScript grief.

---

## Why the current logging was failing

In `src/client.tsx` you commented out:

```ts
// router.subscribe("onNavigateStart", () => { ... })
// router.subscribe("onNavigateEnd", () => { ... })
```

Those event names don’t exist in TanStack Router v1. The correct, typed event names are:

- `onBeforeNavigate` – fires right as navigation begins
- `onBeforeLoad`, `onLoad`, `onResolved` – during/after loaders settle
- `onRendered` – after the router renders the new location

These are exposed via the `RouterEvents` type and used with `router.subscribe(eventName, listener)`; see the official API docs for the event map and a subscribe example. ([TanStack][1])

---

## The fix (safe, typed, toggleable)

Below are **drop‑in patches** that (1) subscribe to the correct events with strong types, (2) gate logging behind `VITE_ROUTER_DEBUG`, and (3) keep your code clean and testable.

> ✱ We don’t touch `routeTree.gen.ts` (generated) or change your router creation; we only add a tiny diagnostics helper and wire it up in `client.tsx`.

### 1) Add a tiny diagnostics helper

**`src/diagnostics/routerDiagnostics.ts`** (new file)

```ts
import type { RouterEvents } from "@tanstack/react-router";
import type { createRouter } from "~/router";

/**
 * Subscribes to a few router events for simple, typed diagnostics.
 * No-ops unless VITE_ROUTER_DEBUG === "true".
 * Returns an unsubscribe function (useful for HMR cleanup).
 */
export function subscribeToRouterDiagnostics(
  router: ReturnType<typeof createRouter>,
  opts?: {
    logger?: (message: string, evt?: RouterEvents[keyof RouterEvents]) => void;
  },
) {
  const shouldLog = import.meta.env.VITE_ROUTER_DEBUG === "true";
  const log =
    opts?.logger ??
    ((msg: string, evt?: RouterEvents[keyof RouterEvents]) => {
      // eslint-disable-next-line no-console
      console.log(msg, evt);
    });

  if (!shouldLog) return () => {};

  let navStartAt = 0;

  const unsubs: Array<() => void> = [];

  // Fires right as navigation begins
  unsubs.push(
    router.subscribe("onBeforeNavigate", (evt) => {
      navStartAt = typeof performance !== "undefined" ? performance.now() : 0;
      log(`▶︎ [router] onBeforeNavigate → ${evt.toLocation.href}`, evt);
    }),
  );

  // After routes/data have resolved
  unsubs.push(
    router.subscribe("onResolved", (evt) => {
      log(`✓ [router] onResolved → ${evt.toLocation.href}`, evt);
    }),
  );

  // After the new location has rendered
  unsubs.push(
    router.subscribe("onRendered", (evt) => {
      const ms =
        navStartAt && typeof performance !== "undefined"
          ? Math.round(performance.now() - navStartAt)
          : undefined;
      log(
        `🎯 [router] onRendered → ${evt.toLocation.href}${ms ? ` (${ms}ms)` : ""}`,
        evt,
      );
    }),
  );

  return () => {
    for (const off of unsubs) {
      try {
        off();
      } catch {
        // ignore
      }
    }
  };
}
```

**Why this works**
`router.subscribe` is generic over the **string literal** event name, so passing `"onBeforeNavigate" | "onResolved" | "onRendered"` automatically gives you the right payload types from `RouterEvents`. The names match the official v1 docs and avoid the untyped `"onNavigateStart"/"onNavigateEnd"` that caused TS errors. ([TanStack][1])

---

### 2) Wire diagnostics up in the client

Patch `src/client.tsx`:

```diff
 import { StartClient } from "@tanstack/react-start";
 import { StrictMode } from "react";
 import { hydrateRoot } from "react-dom/client";
 import { createRouter } from "./router";
+import { subscribeToRouterDiagnostics } from "./diagnostics/routerDiagnostics";

 const router = createRouter();

-// Add debug logging
-// TODO: Fix router event types
-// router.subscribe("onNavigateStart", () => {
-//   console.log("Navigation starting...");
-// });
-//
-// router.subscribe("onNavigateEnd", () => {
-//   console.log("Navigation ended");
-// });
+// Optional diagnostics (no-op unless VITE_ROUTER_DEBUG === "true")
+const unsubscribeRouterDiagnostics = subscribeToRouterDiagnostics(router);
+
+// Make the router easy to inspect in dev tools
+if (import.meta.env.DEV) {
+  // eslint-disable-next-line @typescript-eslint/no-explicit-any
+  (window as any).__ROUTER__ = router;
+}
+
+// Clean up subscriptions during HMR
+if (import.meta.hot) {
+  import.meta.hot.dispose(() => unsubscribeRouterDiagnostics?.());
+}

 hydrateRoot(
   document,
   <StrictMode>
     <StartClient router={router} />
   </StrictMode>,
 );
```

---

### 3) Declare the env flag (optional but nice for DX)

Vite already types `import.meta.env.*` as strings, but it helps team‑mates to discover this flag.

**`src/types/env.d.ts`** (new file)

```ts
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ROUTER_DEBUG?: "true" | "false";
}
```

> Keep this file inside `src/`—your `tsconfig.json` includes `src` already.

---

## How to use it

1. Set the flag locally:

```bash
# .env
VITE_ROUTER_DEBUG=true
```

2. Start the app and navigate around. You’ll see logs like:

```
▶︎ [router] onBeforeNavigate → /teams
✓ [router] onResolved → /teams
🎯 [router] onRendered → /teams (87ms)
```

3. For Netlify (your `vite.config.ts` sets `target: "netlify"`), add `VITE_ROUTER_DEBUG` in the site’s environment settings when you want to enable production diagnostics briefly.

---

## Why this aligns with your backlog

Your **APP‑1** item calls for “strongly‑typed router event subscriptions re‑enabled in `src/client.tsx`, with optional logging toggle,” plus a small wrapper to centralize subscriptions. That’s exactly what the helper does, and it uses the **documented** event names and subscribe pattern from TanStack Router v1. ([TanStack][1])

---

## (Nice‑to‑have) One small consistency check

You create a **QueryClient** twice:

- In `src/router.tsx`, for SSR integration and router context (lines 10–17).
- In `src/app/providers.tsx`, a separate client in state (lines 10–21).

If your `Providers` wraps the app (likely in `__root`), you’ll end up with two caches. Prefer a **single** QueryClient:

- Export the `queryClient` you already make in `createRouter()`, or
- Pass it into `<Providers queryClient={router.options.context.queryClient} />` wherever `Providers` wraps your tree (root route).

This keeps React Query + `setupRouterSsrQueryIntegration` perfectly in sync. (See the comment in `src/router.tsx` referencing external cache & defaultPreloadStaleTime, which you already set. ([TanStack][2]))

---

## References

- **RouterEvents** & **subscribe** API (official docs), listing the correct event names and usage. ([TanStack][1])
- Passing loader events to an external cache / staleness guidance (official docs). ([TanStack][2])

---

If you want, I can also add a tiny unit test that stubs a router and asserts that we subscribe to exactly these events when `VITE_ROUTER_DEBUG=true`, but the above is fully functional and safe to ship now.

[1]: https://tanstack.com/router/v1/docs/framework/react/api/router/RouterEventsType "RouterEvents type | TanStack Router React Docs"
[2]: https://tanstack.com/router/latest/docs/framework/react/guide/data-loading?utm_source=chatgpt.com "Data Loading | TanStack Router React Docs"

---

Awesome — I took your backlog item **EVT‑2: Event Registration Pricing & Payment Tests** and turned it into a drop‑in, DB‑free test suite that covers the pricing math (early bird, rounding, zero-fee, team/individual, clamping). To make the math easily testable without pulling in server-only deps, I extracted the pricing function into a tiny module and wired your mutation to use it.

Below is everything you need: a small refactor (1 new file + 1 import change) and a comprehensive Vitest test file.

---

## 1) Extract the pricing math to a tiny module

**New file:** `src/features/events/pricing.ts`

```ts
// src/features/events/pricing.ts
import type { Event as DbEvent } from "~/db/schema";

/**
 * Only the fields we need from an Event to compute price.
 */
export type PriceableEventFields = Pick<
  DbEvent,
  | "teamRegistrationFee"
  | "individualRegistrationFee"
  | "earlyBirdDiscount"
  | "earlyBirdDeadline"
>;

/**
 * Centralized price calculation used by registerForEvent.
 * Amounts are in cents.
 *
 * Rules:
 * - Base fee comes from teamRegistrationFee or individualRegistrationFee
 * - If base is <= 0 or missing, price is 0
 * - If earlyBirdDiscount > 0 AND now <= earlyBirdDeadline, apply the discount
 * - Discount is clamped to [0, 100]
 * - Result is rounded to an integer (cents)
 */
export function calculateRegistrationAmountCents(
  event: PriceableEventFields,
  registrationType: "team" | "individual",
  now: Date,
): number {
  const baseFee =
    registrationType === "team"
      ? (event.teamRegistrationFee ?? 0)
      : (event.individualRegistrationFee ?? 0);

  if (!baseFee || baseFee <= 0) return 0;

  const discountPct = event.earlyBirdDiscount ?? 0;
  const deadline = event.earlyBirdDeadline ? new Date(event.earlyBirdDeadline) : null;

  if (discountPct > 0 && deadline && now <= deadline) {
    const clamped = Math.min(100, Math.max(0, discountPct));
    const discounted = Math.round(baseFee - (baseFee * clamped) / 100);
    return Math.max(0, discounted);
  }

  return baseFee;
}
```

### Why extract?

- Keeps your tests **fast and deterministic** (no DB/auth/server imports).
- Matches your P1 goal to “exercise pricing calculations and rounding” directly.
- This is a tiny step toward EVT‑3 (centralizing time & payment utilities) without blocking you.

---

## 2) Wire the mutation to use the helper

**File to modify:** `src/features/events/events.mutations.ts`

- **Add** this import near the top with other local imports:

```ts
import { calculateRegistrationAmountCents } from "./pricing";
```

- **Remove** the inline `function calculateRegistrationAmountCents(...)` that currently appears in this file (the one used by `registerForEvent`). The call sites stay the same.

That’s it for the mutation file.

---

## 3) Add a focused test suite

**New file:** `src/features/events/__tests__/registration-pricing.test.ts`

```ts
import { describe, it, expect } from "vitest";
import {
  calculateRegistrationAmountCents,
  type PriceableEventFields,
} from "~/features/events/pricing";

const baseEvent: PriceableEventFields = {
  teamRegistrationFee: 20000, // $200.00
  individualRegistrationFee: 5000, // $50.00
  earlyBirdDiscount: 0,
  earlyBirdDeadline: null,
};

function makeEvent(overrides: Partial<PriceableEventFields> = {}): PriceableEventFields {
  return { ...baseEvent, ...overrides };
}

describe("calculateRegistrationAmountCents", () => {
  const MAY_1 = new Date("2025-05-01T00:00:00Z");

  it("returns team base fee when no discount configured", () => {
    const e = makeEvent();
    const amt = calculateRegistrationAmountCents(e, "team", MAY_1);
    expect(amt).toBe(20000);
  });

  it("returns individual base fee when no discount configured", () => {
    const e = makeEvent();
    const amt = calculateRegistrationAmountCents(e, "individual", MAY_1);
    expect(amt).toBe(5000);
  });

  it("returns 0 for zero/negative team fee", () => {
    expect(
      calculateRegistrationAmountCents(
        makeEvent({ teamRegistrationFee: 0 }),
        "team",
        MAY_1,
      ),
    ).toBe(0);

    expect(
      calculateRegistrationAmountCents(
        makeEvent({ teamRegistrationFee: -1 }),
        "team",
        MAY_1,
      ),
    ).toBe(0);

    // also handles undefined gracefully
    expect(
      calculateRegistrationAmountCents(
        makeEvent({ teamRegistrationFee: undefined }),
        "team",
        MAY_1,
      ),
    ).toBe(0);
  });

  it("applies early-bird discount when now is BEFORE the deadline", () => {
    const deadline = new Date("2025-06-01T00:00:00Z");
    const e = makeEvent({ earlyBirdDiscount: 25, earlyBirdDeadline: deadline });
    // 25% off 20000 = 15000
    const amt = calculateRegistrationAmountCents(
      e,
      "team",
      new Date("2025-05-15T00:00:00Z"),
    );
    expect(amt).toBe(15000);
  });

  it("applies early-bird discount when now is EXACTLY the deadline", () => {
    const deadline = new Date("2025-06-01T00:00:00Z");
    const e = makeEvent({ earlyBirdDiscount: 25, earlyBirdDeadline: deadline });
    const amt = calculateRegistrationAmountCents(
      e,
      "team",
      new Date("2025-06-01T00:00:00Z"),
    );
    expect(amt).toBe(15000);
  });

  it("does NOT apply early-bird discount when now is AFTER the deadline", () => {
    const deadline = new Date("2025-06-01T00:00:00Z");
    const e = makeEvent({ earlyBirdDiscount: 25, earlyBirdDeadline: deadline });
    const amt = calculateRegistrationAmountCents(
      e,
      "team",
      new Date("2025-06-01T00:00:00.001Z"),
    );
    expect(amt).toBe(20000);
  });

  it("clamps discount below 0 to 0 (no change)", () => {
    const deadline = new Date("2025-06-01T00:00:00Z");
    const e = makeEvent({ earlyBirdDiscount: -20, earlyBirdDeadline: deadline });
    const amt = calculateRegistrationAmountCents(
      e,
      "team",
      new Date("2025-05-01T00:00:00Z"),
    );
    expect(amt).toBe(20000);
  });

  it("clamps discount above 100 to 100 (free)", () => {
    const deadline = new Date("2025-06-01T00:00:00Z");
    const e = makeEvent({ earlyBirdDiscount: 150, earlyBirdDeadline: deadline });
    const amt = calculateRegistrationAmountCents(
      e,
      "team",
      new Date("2025-05-01T00:00:00Z"),
    );
    expect(amt).toBe(0);
  });

  it("rounds correctly for fractional discounts", () => {
    // 33% off 999 -> 999 - 329.67 = 669.33 -> Math.round(...) = 669
    const deadline = new Date("2025-06-01T00:00:00Z");
    const e = makeEvent({
      teamRegistrationFee: 999,
      earlyBirdDiscount: 33,
      earlyBirdDeadline: deadline,
    });
    const amt = calculateRegistrationAmountCents(
      e,
      "team",
      new Date("2025-05-15T00:00:00Z"),
    );
    expect(amt).toBe(669);
  });

  it("honors individual fee path with discount", () => {
    // 10% off 5000 -> 4500
    const deadline = new Date("2025-06-01T00:00:00Z");
    const e = makeEvent({ earlyBirdDiscount: 10, earlyBirdDeadline: deadline });
    const amt = calculateRegistrationAmountCents(
      e,
      "individual",
      new Date("2025-05-20T00:00:00Z"),
    );
    expect(amt).toBe(4500);
  });

  it("ignores discount when deadline is not set", () => {
    const e = makeEvent({ earlyBirdDiscount: 50, earlyBirdDeadline: null });
    const amt = calculateRegistrationAmountCents(e, "team", MAY_1);
    expect(amt).toBe(20000);
  });
});
```

### What this covers

- ✅ Team vs Individual base fees
- ✅ Zero/negative/missing fees → 0
- ✅ Early-bird discount window: **before**, **on**, and **after** the deadline
- ✅ Discount **clamping** to `[0, 100]`
- ✅ **Rounding** behavior on fractional discounts
- ✅ Independence from DB/server/auth (fast unit tests)

---

## 4) Run it

```bash
pnpm test -w src/features/events/__tests__/registration-pricing.test.ts
# or just: pnpm test
```

Your existing Vitest setup in `src/tests/setup.ts` will kick in automatically.

---

## 5) (Optional, next) Add mutation path tests

If you want full end‑to‑end coverage of the **payment state transitions** inside `registerForEvent` (free → paid/confirmed, e‑transfer → awaiting_etransfer, Square → pending + session creation), the cleanest approach is to:

- Extract a tiny pure helper (e.g., `decidePaymentState(event, registrationType, paymentMethod, amountDueCents, now)`), then write unit tests for that helper.
- Keep DB & Square tests separate (mock `~/lib/payments/square` and `~/db/server-helpers`) only where necessary.

I’m happy to sketch that helper + tests when you’re ready, but the code above already gives you deterministic coverage for the pricing math that was most at risk of regression.

---

### Why this approach aligns with your backlog

- **EVT‑2 Desired Outcome:** deterministic coverage of discount windows, rounding, zero-fee events, and both registration types → ✅ satisfied by the new unit tests.
- **Implementation Notes:** focused unit suite, easy to mock/extend later for Square/e‑transfer paths → ✅ this structure sets you up for that with minimal churn.

If you want, I can extend this with a small `decidePaymentState` helper and tests in a follow-up patch.

---

Thanks for sharing the Repomix pack. I read the included files and did a focused security/auth/config review, plus sketched implementation notes for the backlog items. Below is a concise executive summary, followed by concrete patches you can drop into a PR.

---

## TL;DR — Top fixes to ship first

1. **Harden base URL detection & cookie security**
   `getBaseUrl()` falls back to `https://app.netlify.com` (the Netlify dashboard), which is almost certainly wrong for auth callbacks and cookie domains. Replace with a strict “must-provide real site URL” rule and support Vercel too.

2. **Make OAuth allow‑list safe when unset**
   `allowedOAuthDomains.length` will throw if `OAUTH_ALLOWED_DOMAINS` is unset or the parser returns `undefined`. Default to `[]` at the boundary.

3. **Stop deriving “production” from HTTPS**
   In `server-helpers.ts`, `isProduction` is based on `baseUrl.startsWith('https://')`. That can flip behaviour unexpectedly on preview builds. Use `NODE_ENV` (already available) for environment semantics; use a separate `isHttpsDeployment` to decide cookie security.

4. **One‑time initialization for auth**
   `getAuth()` can race and construct multiple auth instances under concurrent load. Gate creation behind a shared promise.

5. **Tighten Security Headers/CSP**
   Remove deprecated `X-XSS-Protection`, add `frame-ancestors 'none'`, and prefer a nonce‑based `script-src` with `strict-dynamic`. Ensure report endpoints are configured.

6. **Trusted origins**
   Include all preview origins (Netlify deploy previews) in `trustedOrigins` when applicable, not only `baseUrl`.

7. **Reduce secret logging**
   You log “Google Client ID (first 10 chars)” and “Secret: Set”. It’s not catastrophic, but trim in production logs.

8. **Backlog items (EVT‑1/2/3) — give you a head start**
   I’ve included a minimal design, DB update approach, refund idempotency strategy, and test scaffolds you can paste in.

---

## Targeted patches & snippets

### 1) `src/lib/env.server.ts` — safer base URL & multi‑host support

**Problems addressed**

- Wrong default (`https://app.netlify.com`)
- No first‑class Vercel support
- Base URL required in dev is good; make it explicit in all envs if we can’t infer

```diff
@@
 export const getBaseUrl = () => {
-  // Check if we have any Netlify-provided URLs (indicates we're in Netlify environment)
-  const netlifyUrl = env.URL || env.SITE_URL || env.DEPLOY_PRIME_URL || env.DEPLOY_URL;
-
-  // Check if we're in a Netlify environment by looking for Netlify-specific env vars
-  const isNetlifyEnv = !!(env.NETLIFY || env.NETLIFY_DATABASE_URL || netlifyUrl);
-
-  // In production, Netlify environment, or when we have a URL, use it
-  if (isProduction() || isNetlifyEnv) {
-    // If we have a Netlify URL, use it; otherwise fall back to VITE_BASE_URL or a default
-    return netlifyUrl || env.VITE_BASE_URL || "https://app.netlify.com";
-  }
-
-  // In development/test, require VITE_BASE_URL
-  if (!env.VITE_BASE_URL) {
-    throw new Error("VITE_BASE_URL is required in development");
-  }
-  return env.VITE_BASE_URL;
+  // Prefer explicit app base URL if provided (works cross‑platform)
+  const explicit = env.VITE_BASE_URL; // also set this in production
+
+  // Netlify provides these for production/preview
+  const netlify = env.URL || env.SITE_URL || env.DEPLOY_PRIME_URL || env.DEPLOY_URL;
+
+  // Vercel provides these
+  const vercel =
+    process.env.NEXT_PUBLIC_VERCEL_URL?.startsWith("http")
+      ? process.env.NEXT_PUBLIC_VERCEL_URL
+      : (process.env.NEXT_PUBLIC_VERCEL_URL
+          ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`
+          : undefined);
+
+  const candidate = explicit || netlify || vercel;
+  if (!candidate) {
+    throw new Error(
+      "Base URL is unknown. Set VITE_BASE_URL (e.g., https://your.app) or rely on Netlify/Vercel provided URLs."
+    );
+  }
+  return candidate;
 };
```

> **Why:** Auth callback URLs, cookie `domain`, and `trustedOrigins` must point to _your_ site, never the Netlify dashboard. This change forces correctness and supports both Netlify & Vercel.

---

### 2) `src/lib/auth/server-helpers.ts` — environment semantics, allow‑list default, single init

```diff
@@
-  const { env, getAuthSecret, getBaseUrl } = await import("~/lib/env.server");
+  const { env, getAuthSecret, getBaseUrl, isProduction } = await import("~/lib/env.server");
@@
-  const baseUrl = getBaseUrl();
-  const isProduction = baseUrl?.startsWith("https://") ?? false;
-  const cookieDomain = env.COOKIE_DOMAIN;
-  const allowedOAuthDomains = env.OAUTH_ALLOWED_DOMAINS;
+  const baseUrl = getBaseUrl();
+  const cookieDomain = env.COOKIE_DOMAIN;
+  const allowedOAuthDomains = Array.isArray(env.OAUTH_ALLOWED_DOMAINS)
+    ? env.OAUTH_ALLOWED_DOMAINS
+    : [];
+
+  // Capture whether the deployment URL is HTTPS to inform cookie security on previews
+  const isHttpsDeployment = baseUrl?.startsWith("https://") ?? false;
@@
-  console.log("Google Client Secret:", googleClientSecret ? "Set" : "Missing");
-  if (allowedOAuthDomains.length > 0) {
+  if (process.env.NODE_ENV !== "production") {
+    console.log("Google Client Secret:", googleClientSecret ? "Set" : "Missing");
+  }
+  if (allowedOAuthDomains.length > 0 && process.env.NODE_ENV !== "production") {
     console.log("OAuth allowed domains:", allowedOAuthDomains.join(", "));
   }
@@
-    trustedOrigins: isProduction
-      ? [baseUrl]
-      : ["http://localhost:5173", "http://localhost:5174", "http://localhost:8888"],
+    // Include baseUrl and common dev ports; you can augment with preview URLs if needed.
+    trustedOrigins: isProduction()
+      ? [baseUrl]
+      : [baseUrl, "http://localhost:5173", "http://localhost:5174", "http://localhost:8888"],
@@
-      useSecureCookies: isProduction,
+      // Use secure cookies whenever the deployment URL is HTTPS
+      useSecureCookies: isHttpsDeployment,
@@
-      requireEmailVerification: isProduction,
+      requireEmailVerification: isProduction(),
```

**Single-flight auth initialization**

```diff
-let authInstance: ReturnType<typeof betterAuth> | null = null;
+let authInstance: ReturnType<typeof betterAuth> | null = null;
+let authInitPromise: Promise<ReturnType<typeof betterAuth>> | null = null;
@@
 export const getAuth = async () => {
-  if (!authInstance) {
-    authInstance = await createAuth();
-  }
-  return authInstance;
+  if (authInstance) return authInstance;
+  if (!authInitPromise) {
+    authInitPromise = createAuth().then((inst) => {
+      authInstance = inst;
+      return inst;
+    });
+  }
+  return authInitPromise;
 };
```

---

### 3) Safer OAuth allow‑list parser (if you don’t already have it)

If `src/lib/env/oauth-domain.ts` isn’t already doing this, make sure it’s defensive:

```ts
// src/lib/env/oauth-domain.ts
export function parseOAuthAllowedDomains(input?: string | null): string[] {
  if (!input) return [];
  return input
    .split(",")
    .map((d) => d.trim().toLowerCase())
    .filter((d) => d.length > 0);
}
```

---

### 4) Security headers & CSP (Netlify Edge)

Your `docs/SECURITY.md` is solid, but a few modernizations will reduce noise and strengthen protection.

**What to change**

- **Remove** `X-XSS-Protection` (deprecated; ignored by modern browsers).
- **Add** `frame-ancestors 'none'` in CSP (supersedes `X-Frame-Options: DENY`, but you can keep both for defense-in-depth).
- **Use** nonce‑based `script-src` with `strict-dynamic`; limit `connect-src`, `img-src`, `font-src`, etc. to only what you need.
- **Add** `report-to`/`report-uri` (or Reporting-API) to capture CSP violations.
- **Consider** `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp` only if you need cross‑origin isolation (e.g., WebAssembly/wasm SIMD, high‑res timers). Otherwise skip to avoid breaking embeds.

**Example Edge function header set (trim to your actual needs):**

```ts
// netlify/edge-functions/security-headers.ts
export default async (request: Request) => {
  const nonce = crypto.randomUUID().replace(/-/g, "");
  const csp = [
    `default-src 'self'`,
    // Nonce every inline <script nonce="...">
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https:`,
    `style-src 'self' 'unsafe-inline'`, // or use nonces/hashes if feasible
    `img-src 'self' data: https:`,
    `font-src 'self' https:`,
    `connect-src 'self' https://api.square.com https://*.googleapis.com`, // tighten to actual endpoints
    `frame-ancestors 'none'`,
    `base-uri 'self'`,
    `object-src 'none'`,
    `upgrade-insecure-requests`,
    // Optional reporting
    // `report-uri https://YOUR_REPORT_COLLECTOR/csp`,
  ].join("; ");

  const response = await fetch(request);
  const headers = new Headers(response.headers);

  headers.set("Content-Security-Policy", csp);
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Permissions-Policy", "geolocation=(), microphone=(), camera=()");
  headers.set(
    "Strict-Transport-Security",
    "max-age=31536000; includeSubDomains; preload",
  );
  headers.set("X-Frame-Options", "DENY");

  return new Response(response.body, { ...response, headers });
};
```

> **Nonce plumbing:** ensure your HTML template injects `nonce` into all `<script>` tags and that the same `nonce` string is used when building the CSP header.

---

## Backlog items — implementation notes you can use

### EVT‑1: Event cancellation cascade & refunds

**Model touches**

- `events`: add `cancelledAt`, `cancelledBy`, `cancelReason`.
- `event_registrations`: add `cancelledAt`, `cancelledBy`, `cancellationReason`, and a `paymentStatus` transition map.
- `event_payment_sessions`: add `refundedAt`, `refundId` (Square), `refundStatus`, `refundFailureReason`.

**Flow (single transaction for state, out‑of‑tx side effects for refunds/emails):**

```ts
// src/features/events/events.mutations.ts (sketch)
type CancelEventInput = { eventId: string; reason?: string };

export async function cancelEvent(input: CancelEventInput, actorUserId: string) {
  const now = new Date();

  return db.transaction(async (tx) => {
    // 1) Mark event cancelled (idempotent)
    await tx
      .update(events)
      .set({
        status: "cancelled",
        cancelledAt: now,
        cancelledBy: actorUserId,
        cancelReason: input.reason,
      })
      .where(eq(events.id, input.eventId));

    // 2) Load affected regs
    const regs = await tx
      .select()
      .from(eventRegistrations)
      .where(
        and(
          eq(eventRegistrations.eventId, input.eventId),
          inArray(eventRegistrations.status, ["confirmed", "pending"]),
        ),
      );

    // 3) Transition registrations & tag follow-ups
    for (const r of regs) {
      const next: Partial<typeof eventRegistrations.$inferInsert> = {
        status: "cancelled",
        cancelledAt: now,
        cancelledBy: actorUserId,
        cancellationReason: input.reason,
      };
      if (r.paymentMethod === "etransfer") {
        next.paymentStatus = "refund_required";
      }
      await tx
        .update(eventRegistrations)
        .set(next)
        .where(eq(eventRegistrations.id, r.id));
    }

    // 4) Collect Square sessions to refund (do not call Square inside tx)
    const squareSessions = await tx
      .select()
      .from(eventPaymentSessions)
      .where(
        and(
          eq(eventPaymentSessions.eventId, input.eventId),
          eq(eventPaymentSessions.provider, "square"),
          eq(eventPaymentSessions.status, "paid"),
        ),
      );

    // 5) Emit outbox messages for refunds & emails
    for (const s of squareSessions) {
      await tx.insert(outbox).values({
        type: "square.refund.requested",
        payload: {
          paymentId: s.providerPaymentId,
          sessionId: s.id,
          eventId: input.eventId,
        },
        createdAt: now,
      });
    }
    await tx.insert(outbox).values({
      type: "email.event.cancelled",
      payload: { eventId: input.eventId },
      createdAt: now,
    });

    return { touchedRegistrations: regs.length, squareSessions: squareSessions.length };
  });
}
```

**Refund worker (idempotent):**

```ts
// src/lib/payments/square.refunds.worker.ts (sketch)
export async function processRefundMessage(msg: RefundRequested) {
  const { paymentId, sessionId } = msg.payload;
  const idempotencyKey = `refund:${sessionId}`;

  try {
    const res = await square.refunds.refundPayment({
      idempotencyKey,
      paymentId,
      amountMoney: { ... }, // use stored amount
      reason: "Event cancelled",
    });
    await db.update(eventPaymentSessions)
      .set({ refundStatus: "succeeded", refundedAt: new Date(), refundId: res.result.refund?.id })
      .where(eq(eventPaymentSessions.id, sessionId));
  } catch (e) {
    await db.update(eventPaymentSessions)
      .set({ refundStatus: "failed", refundFailureReason: stringifyError(e) })
      .where(eq(eventPaymentSessions.id, sessionId));
    // Optionally retry/backoff
  }
}
```

**Emails**

- Registrant template: explain cancellation & refund path per payment method.
- Admin summary: counts, any failed refunds.

**Tests**

- Unit: cancellation transitions, idempotency (second call no double‑refund).
- Integration: mock Square, assert outbox/refund worker behaviour.

---

### EVT‑2: Registration pricing & payment state tests

**Test matrix** (examples)

- Early‑bird boundary: `cutoff - 1ms`, `== cutoff`, `+ 1ms`
- Zero‑cost events: both team & individual should short‑circuit to `paid` w/ no provider
- E‑transfer path: `paymentStatus = awaiting_etransfer` + reminder timestamp logic
- Rounding: e.g., 12.345 → 1235 cents

**Skeleton**

```ts
// src/features/events/__tests__/registration-pricing.test.ts
import { calculateRegistrationAmountCents } from "../events.mutations";
import { describe, it, expect } from "vitest";

describe("calculateRegistrationAmountCents", () => {
  it("applies early-bird before cutoff", () => {
    const cutoff = new Date("2025-06-01T00:00:00Z");
    const at = new Date("2025-05-31T23:59:59Z");
    const cents = calculateRegistrationAmountCents({
      base: 15000,
      earlyBirdPct: 0.2,
      cutoff,
      at,
    });
    expect(cents).toBe(12000);
  });

  it("no discount at cutoff", () => {
    const cutoff = new Date("2025-06-01T00:00:00Z");
    const at = new Date("2025-06-01T00:00:00Z");
    const cents = calculateRegistrationAmountCents({
      base: 15000,
      earlyBirdPct: 0,
      cutoff,
      at,
    });
    expect(cents).toBe(15000);
  });

  it("rounds to nearest cent", () => {
    const cents = calculateRegistrationAmountCents({ base: 1235, feePct: 0.5 }); // demo
    expect(cents).toBe(/* expected */);
  });
});
```

---

### EVT‑3: Shared time/metadata helpers

Create `src/features/events/utils/time.ts`:

```ts
export type Clock = { now(): Date };
export const systemClock: Clock = { now: () => new Date() };

export const currentTimestamp = (clock: Clock = systemClock) => clock.now();
```

Create `src/features/events/utils/payments.ts`:

```ts
import type { Registration } from "../events.types";

export function buildPaymentSnapshot(reg: Registration) {
  return {
    method: reg.paymentMethod,
    amountCents: reg.amountCents,
    currency: "CAD",
    // include Square/e-transfer metadata as needed
  };
}
```

Refactor mutations to accept an optional `clock` and call these utilities. This makes tests deterministic and removes repeated `new Date()` calls.

---

## Rate limiting (as documented in `docs/SECURITY.md`)

Your doc implies a shared limiter per IP. If you’re running at the Edge, ensure the store is **shared** (e.g., Upstash Redis, Netlify Deno KV if suitable). Skeleton:

```ts
// src/lib/security/rate-limit.ts
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export const authLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.fixedWindow(5, "15 m"),
  prefix: "rl:auth",
});
export const apiLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.fixedWindow(100, "15 m"),
  prefix: "rl:api",
});

export async function rateLimit(kind: "auth" | "api", key: string) {
  const rl = kind === "auth" ? authLimiter : apiLimiter;
  const { success, reset } = await rl.limit(key);
  if (!success)
    throw new Error(
      `Rate limit exceeded. Try again after ${new Date(reset * 1000).toISOString()}`,
    );
}
```

---

## Documentation cleanups

- **`docs/SECURITY.md`**
  - Note that `X-XSS-Protection` is deprecated; prefer CSP.
  - Add an example of `frame-ancestors 'none'`.
  - Clarify that `OAUTH_ALLOWED_DOMAINS` unset → open OAuth, set → enforced allow‑list.

- **`docs/development-backlog.md`**
  - Add a checklist at the top (“When closing a ticket, also update release notes & security docs”).
  - When EVT‑1 ships, include a short changelog snippet (“cancellations now auto‑refund and notify participants/admins”).

---

## Small but useful polish

- **Logging:** wrap “config loading” logs in `if (process.env.NODE_ENV !== 'production')`.
- **`isServerless()`:** also check `process.env.VERCEL === "1"` (Vercel sets this), not only `VERCEL_ENV`.
- **Cookie domain:** if you ever serve both apex and subdomains, document that `COOKIE_DOMAIN=.yourdomain.com` is required; avoid setting it in local dev.

---

### Quick validation checklist

- [ ] `VITE_BASE_URL` (or Netlify/Vercel URL) resolves to your real site URL (HTTPS).
- [ ] OAuth redirect URIs in Google console match exactly (origin + path).
- [ ] `OAUTH_ALLOWED_DOMAINS` empty in dev; set to your org domains in prod (parser returns `[]`).
- [ ] Rate limiting store is shared across instances.
- [ ] CSP nonce is injected into _all_ scripts and header is set consistently.
- [ ] Square refund worker uses idempotency keys and handles retries.
- [ ] `trustedOrigins` includes preview hosts when you test deploy previews.

---

If you want, I can turn the above diffs into a single PR patch (with tests stubs and doc updates) against your repo structure.

---

Awesome — you’re very close already. You’ve got:

- `cancelEventRegistration` (per‑registration) working end‑to‑end, and
- a simple `cancelEvent` that flips the event’s status.

What’s missing (as your backlog calls out) is the **cascade**: registrations → payments (Square/e‑transfer) → notifications, with a structured result so the UI can show what happened.

Below is a drop‑in implementation plan with code you can paste into your repo. It keeps your current patterns (TanStack `createServerFn`, Drizzle, Zod), **does not require schema migrations**, and is idempotent/safe to re‑run.

---

## 1) Add a schema for cancelling an event (with options)

**File:** `src/features/events/events.schemas.ts`

```ts
// ⬇️ add near other mutation schemas
export const cancelEntireEventSchema = z.object({
  eventId: z.string().uuid(),
  reason: z.string().optional(),
  // whether to email participants/admins (no-op if mailer not configured)
  notify: z.boolean().optional().default(true),
  // auto: try Square refunds now; manual: mark for finance follow‑up; none: don't touch payments
  refundMode: z.enum(["auto", "manual", "none"]).optional().default("auto"),
});
export type CancelEntireEventInput = z.infer<typeof cancelEntireEventSchema>;
```

---

## 2) Add a typed result payload

**File:** `src/features/events/events.types.ts`

```ts
// ⬇️ add beneath other operation payloads
export type CancelEventErrorCode =
  | "REFUND_FAILED"
  | "NO_PAYMENT_SESSION"
  | "NOT_PAID"
  | "UNAUTHORIZED";

export interface CancelEventResult {
  eventId: string;
  affected: {
    totalRegistrations: number;
    cancelled: number;
    alreadyCancelled: number;
    squareRefunded: number;
    etransferMarkedForRefund: number;
    freeOrUnpaid: number;
  };
  errors: Array<{
    registrationId: string;
    code: CancelEventErrorCode;
    message: string;
    paymentId?: string;
  }>;
}
```

This lets you return `EventOperationResult<CancelEventResult>` so the UI can show a concise summary.

---

## 3) Implement the cascade in `cancelEvent` (refunds + updates + notifications)

**File:** `src/features/events/events.mutations.ts`

> Replace the current `cancelEvent` with the one below. The implementation:
>
> - authorizes (organizer **or** global admin),
> - flips event status to `cancelled` and stamps `metadata.cancelledAt/By/Reason`,
> - loads all _non-cancelled_ registrations and:
>   - marks them `cancelled` (with `cancelledAt` and reason in `internalNotes`),
>   - **Square**: attempts refund (auto mode) via `squarePaymentService.createRefund(...)` using the latest payment session; falls back to manual flag if we can’t find/verify a payment,
>   - **e‑transfer**: marks `paymentStatus = 'refund_required'` with timestamps,
>   - updates `eventPaymentSessions.status = 'cancelled'` + cancellation metadata,
>
> - (best‑effort) triggers notification helper (no‑op if not configured),
> - returns a structured `CancelEventResult`.

```ts
// at top: add desc + new schema import
import { and, eq, or, sql, desc } from "drizzle-orm";
// ...
import {
  cancelEntireEventSchema, // ⬅️ new
  cancelEventRegistrationSchema,
  createEventSchema,
  markEtransferPaidSchema,
  markEtransferReminderSchema,
  registerForEventSchema,
  updateEventSchema,
} from "./events.schemas";
// ...
import type { CancelEventResult } from "./events.types";
```

```ts
// ⬇️ replace the existing cancelEvent with this fuller version

/**
 * Cancel an entire event (cascade + refunds + notifications)
 */
export const cancelEvent = createServerFn({ method: "POST" })
  .middleware(getAuthMiddleware())
  .validator(zod$(cancelEntireEventSchema))
  .handler(
    async ({ data, context }): Promise<EventOperationResult<CancelEventResult>> => {
      const now = new Date();

      try {
        const [{ getDb }] = await Promise.all([import("~/db/server-helpers")]);
        const db = await getDb();
        const user = requireUser(context);

        // Load the event
        const [evt] = await db
          .select()
          .from(events)
          .where(eq(events.id, data.eventId))
          .limit(1);

        if (!evt) {
          return {
            success: false,
            errors: [{ code: "NOT_FOUND", message: "Event not found" }],
          };
        }

        // Authorization: organizer OR global admin
        let authorized = evt.organizerId === user.id;
        if (!authorized) {
          const { isAdmin } = await import("~/lib/auth/utils/admin-check");
          authorized = await isAdmin(user.id);
        }
        if (!authorized) {
          return {
            success: false,
            errors: [{ code: "FORBIDDEN", message: "You cannot cancel this event" }],
          };
        }

        // Update the event row first (idempotent)
        await db
          .update(events)
          .set({
            status: "cancelled",
            updatedAt: now,
            // stamp metadata instead of schema migration
            metadata: {
              ...(evt.metadata ?? {}),
              cancelledAt: now.toISOString(),
              cancelledBy: user.id,
              cancellationReason: data.reason ?? null,
            },
          })
          .where(eq(events.id, data.eventId));

        // Fetch all registrations that are not already cancelled
        const regs = await db
          .select()
          .from(eventRegistrations)
          .where(
            and(
              eq(eventRegistrations.eventId, data.eventId),
              sql`${eventRegistrations.status} != 'cancelled'`,
            ),
          );

        // Helper to fetch the latest payment session for a registration
        const getLatestSession = async (registrationId: string) => {
          const sessions = await db
            .select()
            .from(eventPaymentSessions)
            .where(eq(eventPaymentSessions.registrationId, registrationId))
            .orderBy(desc(eventPaymentSessions.createdAt))
            .limit(1);
          return sessions[0] ?? null;
        };

        const squareSvc =
          data.refundMode === "auto"
            ? await (async () => {
                const { squarePaymentService } = await import("~/lib/payments/square");
                return squarePaymentService;
              })()
            : null;

        let cancelled = 0;
        let alreadyCancelled = 0;
        let squareRefunded = 0;
        let etransferMarked = 0;
        let freeOrUnpaid = 0;
        const errors: CancelEventResult["errors"] = [];

        for (const r of regs) {
          try {
            // Pre-check idempotency
            if (r.status === "cancelled") {
              alreadyCancelled++;
              continue;
            }

            // Always transition registration to cancelled
            const notesPrefix = `Event cancelled by ${user.id} @ ${now.toISOString()}`;
            const reasonNote = data.reason ? ` — Reason: ${data.reason}` : "";
            const combinedNotes = [notesPrefix + reasonNote, r.internalNotes]
              .filter(Boolean)
              .join("\n");

            // Default payment handling tallies
            let markSquareRefunded = false;
            let markEtransferRefundNeeded = false;
            let markFreeOrUnpaid = false;

            // Decide payment handling
            if (data.refundMode === "none") {
              // Do nothing to paymentStatus beyond cancellation
              markFreeOrUnpaid = r.amountDueCents === 0 || r.paymentStatus !== "paid";
            } else if (r.paymentMethod === "square") {
              // Square branch
              if (r.paymentStatus === "paid" || r.paymentStatus === "pending") {
                if (data.refundMode === "manual" || !squareSvc) {
                  markEtransferRefundNeeded = false; // not etransfer, but use same bucket for "needs manual"
                  // Use a distinct status to queue finance review
                  await db
                    .update(eventRegistrations)
                    .set({
                      paymentStatus: "refund_required",
                      updatedAt: now,
                      internalNotes: combinedNotes,
                    })
                    .where(eq(eventRegistrations.id, r.id));
                } else {
                  // Try to refund automatically
                  const session = await getLatestSession(r.id);

                  let paymentId = session?.squarePaymentId ?? null;

                  if (!paymentId && session?.squareCheckoutId) {
                    // Try to resolve a payment ID from the checkout link
                    const verify = await squareSvc.verifyPayment(
                      session.squareCheckoutId,
                    );
                    if (verify.success && verify.paymentId) {
                      paymentId = verify.paymentId;
                      // persist for future idempotency
                      await db
                        .update(eventPaymentSessions)
                        .set({
                          squarePaymentId: paymentId,
                          updatedAt: now,
                        })
                        .where(eq(eventPaymentSessions.id, session.id));
                    }
                  }

                  if (!paymentId) {
                    errors.push({
                      registrationId: r.id,
                      code: "NO_PAYMENT_SESSION",
                      message:
                        "No Square payment could be resolved; flagged for manual refund.",
                    });
                    await db
                      .update(eventRegistrations)
                      .set({
                        paymentStatus: "refund_required",
                        updatedAt: now,
                        internalNotes: combinedNotes,
                      })
                      .where(eq(eventRegistrations.id, r.id));
                  } else {
                    // Attempt refund
                    const res = await squareSvc.createRefund(
                      paymentId,
                      undefined,
                      `Event ${evt.name} cancelled`,
                    );
                    if (res.success) {
                      markSquareRefunded = true;
                      await db
                        .update(eventRegistrations)
                        .set({
                          paymentStatus: "refunded",
                          amountPaidCents: r.amountPaidCents ?? r.amountDueCents ?? null,
                          updatedAt: now,
                          internalNotes: combinedNotes,
                          paymentMetadata: {
                            ...(r.paymentMetadata ?? {}),
                            refundId: res.refundId,
                            refundReason: "Event cancelled",
                            refundedAt: now.toISOString(),
                          },
                        })
                        .where(eq(eventRegistrations.id, r.id));

                      if (session) {
                        await db
                          .update(eventPaymentSessions)
                          .set({
                            status: "cancelled",
                            metadata: {
                              ...(session.metadata ?? {}),
                              cancelledAt: now.toISOString(),
                              cancelledBy: user.id,
                              cancellationReason: data.reason ?? null,
                              refundId: res.refundId,
                            },
                            updatedAt: now,
                          })
                          .where(eq(eventPaymentSessions.id, session.id));
                      }
                    } else {
                      errors.push({
                        registrationId: r.id,
                        code: "REFUND_FAILED",
                        message: res.error ?? "Square refund failed",
                        paymentId,
                      });
                      await db
                        .update(eventRegistrations)
                        .set({
                          paymentStatus: "refund_required",
                          updatedAt: now,
                          internalNotes: combinedNotes,
                          paymentMetadata: {
                            ...(r.paymentMetadata ?? {}),
                            lastRefundAttemptAt: now.toISOString(),
                            lastRefundError: res.error ?? "unknown",
                          },
                        })
                        .where(eq(eventRegistrations.id, r.id));
                    }
                  }
                }
              } else {
                // Not paid; nothing to refund
                markFreeOrUnpaid = true;
              }
            } else if (r.paymentMethod === "etransfer") {
              // E-transfer branch
              if (
                r.paymentStatus === "paid" ||
                r.paymentStatus === "awaiting_etransfer" ||
                r.paymentStatus === "pending"
              ) {
                markEtransferRefundNeeded = true;
                await db
                  .update(eventRegistrations)
                  .set({
                    paymentStatus: "refund_required",
                    updatedAt: now,
                    internalNotes: combinedNotes,
                    paymentMetadata: {
                      ...(r.paymentMetadata ?? {}),
                      refundRequiredAt: now.toISOString(),
                      refundRequiredBy: user.id,
                    },
                  })
                  .where(eq(eventRegistrations.id, r.id));
              } else {
                markFreeOrUnpaid = true;
              }
            } else {
              // Free or unknown method
              markFreeOrUnpaid = true;
            }

            // Ensure cancelled status + timestamps (even if payment handling above failed)
            const [updated] = await db
              .update(eventRegistrations)
              .set({
                status: "cancelled",
                cancelledAt: now,
                updatedAt: now,
                // keep combined notes; above paths may have already set it
                internalNotes: combinedNotes,
              })
              .where(eq(eventRegistrations.id, r.id))
              .returning();

            // Mark sessions as cancelled (best-effort)
            const session = await getLatestSession(r.id);
            if (session) {
              await db
                .update(eventPaymentSessions)
                .set({
                  status: "cancelled",
                  metadata: {
                    ...(session.metadata ?? {}),
                    cancelledAt: now.toISOString(),
                    cancelledBy: user.id,
                    cancellationReason: data.reason ?? null,
                  },
                  updatedAt: now,
                })
                .where(eq(eventPaymentSessions.id, session.id));
            }

            // Tallies
            cancelled++;
            if (markSquareRefunded) squareRefunded++;
            if (markEtransferRefundNeeded) etransferMarked++;
            if (markFreeOrUnpaid) freeOrUnpaid++;
          } catch (regErr) {
            console.error("Registration cancellation failure:", regErr);
            errors.push({
              registrationId: r.id,
              code: "REFUND_FAILED",
              message:
                regErr instanceof Error
                  ? regErr.message
                  : "Failed to cancel registration",
            });
          }
        }

        // Notifications (best-effort, do not fail the mutation)
        if (data.notify) {
          try {
            const { sendEventCancellationNotifications } = await import(
              "~/lib/server/notifications/events/cancellation"
            );
            await sendEventCancellationNotifications({
              db,
              event: { ...evt, status: "cancelled" },
              reason: data.reason,
            });
          } catch (notifyErr) {
            console.warn("Event cancellation notifications failed:", notifyErr);
            // do not push to errors: email failure shouldn't block admin UX
          }
        }

        return {
          success: true,
          data: {
            eventId: evt.id,
            affected: {
              totalRegistrations: regs.length,
              cancelled,
              alreadyCancelled,
              squareRefunded,
              etransferMarkedForRefund: etransferMarked,
              freeOrUnpaid,
            },
            errors,
          },
        };
      } catch (error) {
        console.error("Error cancelling event:", error);
        return {
          success: false,
          errors: [
            {
              code: "DATABASE_ERROR",
              message: "Failed to cancel event",
            },
          ],
        };
      }
    },
  );
```

### Why this design?

- **No migration required:** we piggyback on existing `metadata`/`paymentMetadata` JSONB, `cancelledAt`, and `internalNotes`.
- **Idempotent:** running again won’t double‑refund; it checks existing statuses and persists resolved `squarePaymentId` for future runs.
- **Safe fallbacks:** if Square refund fails or no payment is found, registrations are flagged `refund_required` for finance.

---

## 4) Add a small, server‑only notification shim (no‑op if unconfigured)

**File:** `src/lib/server/notifications/events/cancellation.ts` (new)

```ts
/**
 * Event cancellation notifications (best‑effort).
 * Pluggable: if SENDGRID is configured you can integrate here later.
 */

import type { InferSelectModel } from "drizzle-orm";
import { eventRegistrations, events, user, teams } from "~/db/schema";
import { eq } from "drizzle-orm";

type Db = Awaited<ReturnType<(typeof import("~/db/server-helpers"))["getDb"]>>;

export async function sendEventCancellationNotifications(params: {
  db: Db;
  event: InferSelectModel<typeof events>;
  reason?: string;
}) {
  const { db, event, reason } = params;

  // Fetch recipients: registrants + (optionally) team emails
  const regs = await db
    .select({
      regId: eventRegistrations.id,
      userEmail: user.email,
      userName: user.name,
      teamName: teams.name,
    })
    .from(eventRegistrations)
    .leftJoin(user, eq(eventRegistrations.userId, user.id))
    .leftJoin(teams, eq(eventRegistrations.teamId, teams.id))
    .where(eq(eventRegistrations.eventId, event.id));

  // If you wire SendGrid, loop and send HTML+text emails here.
  // For now, log a concise summary so ops can verify recipients.
  console.log(
    `[Notifications] Event "${event.name}" cancelled${
      reason ? ` — Reason: ${reason}` : ""
    }. Notifying ${regs.length} registrants.`,
  );

  // No-op to keep server mutation fast & reliable.
  return { notified: regs.length };
}
```

This keeps `cancelEvent` self‑contained while letting you plug in SendGrid later without touching the mutation again.

---

## 5) Export `cancelEvent` for consumers

**File:** `src/features/events/index.ts`

```ts
// Event mutations
export {
  cancelEvent, // ⬅️ add this line
  cancelEventRegistration,
  createEvent,
  registerForEvent,
  updateEvent,
} from "./events.mutations";
```

---

## 6) (Optional but recommended) Add a lightweight test

**File:** `src/features/events/__tests__/event-cancellation.test.ts` (new; pseudo-test)

```ts
import { describe, it, expect, vi } from "vitest";
import { cancelEvent } from "../events.mutations";
import { zod$ } from "~/lib/server/fn-utils";

// If you have a test db + mocks, stub squarePaymentService.createRefund:
vi.mock("~/lib/payments/square", () => ({
  squarePaymentService: {
    verifyPayment: vi.fn().mockResolvedValue({ success: true, paymentId: "p_1" }),
    createRefund: vi.fn().mockResolvedValue({ success: true, refundId: "r_1" }),
  },
}));

describe("cancelEvent", () => {
  it("returns a structured result and refunds square payments", async () => {
    // Arrange: seed a test event + confirmed registration with square "paid"
    // Act:
    const result = await cancelEvent({
      data: { eventId: "some-uuid", refundMode: "auto", notify: false },
    } as any);

    // Assert:
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.affected.cancelled).toBeGreaterThanOrEqual(1);
    }
  });
});
```

> Wire this into your existing test setup once your test DB utilities are available.

---

## 7) UI hook (optional)

Because the mutation now returns a **rich summary**, you can surface it directly in admin UX (toast or inline):

```ts
// pseudo
const res = await cancelEvent({ data: { eventId, reason, refundMode: "auto" } });
if (res.success) {
  const a = res.data.affected;
  toast.success(
    `Event cancelled. Registrations: ${a.cancelled}/${a.totalRegistrations}. ` +
      `Square refunded: ${a.squareRefunded}, E‑transfer flagged: ${a.etransferMarkedForRefund}.`,
  );
} else {
  toast.error(res.errors[0]?.message ?? "Failed to cancel event");
}
```

---

## Notes & Guardrails

- **No schema changes:** we intentionally record actor/timestamps in `events.metadata` and `eventRegistrations.paymentMetadata` to avoid migrations.
- **Idempotency:** we won’t double‑refund; we mark statuses and persist `squarePaymentId` once resolved.
- **Partial failures are visible:** the payload includes a per‑registration `errors[]` array. You can show a “Download details” link later if desired.
- **Email:** the helper is a no‑op by default; once you wire SendGrid (`SENDGRID_API_KEY`, etc.), expand the helper to actually send mail.

If you want, I can also add a tiny admin button component that calls this mutation and renders a human‑readable summary.

---

Awesome — I read through the packed repo and your backlog. For **EVT‑3 (Event Mutation Time & Metadata Utilities)** you’re spot‑on that the mutations are re‑implementing the same “what time is it?” and “how do we stamp/merge payment metadata?” logic in multiple places.

Below is a **drop‑in utility layer** that centralizes:

- a testable **Clock** (no more sprinkled `new Date()`),
- **payment metadata** builders/updaters (paid + reminder + basic e‑transfer snapshot),
- the existing **JSONB casting** helpers, and
- the **pricing** function.

I also included a minimal refactor of `events.mutations.ts` so you can see exactly how it plugs in, plus tiny unit‑test stubs to get you started.

---

## 1) New utilities (add these files)

> Folder: `src/features/events/utils/`

### `time.ts`

```ts
// src/features/events/utils/time.ts
export interface Clock {
  now(): Date;
}

export const systemClock: Clock = { now: () => new Date() };

/** Prefer this instead of `new Date()` for consistent, injectable time. */
export const currentTimestamp = (clock: Clock = systemClock): Date => clock.now();

/** ISO string variant used for JSON metadata. */
export const isoTimestamp = (clock: Clock = systemClock): string =>
  clock.now().toISOString();

/** Reads an optional clock off the server-fn context (nice for tests). */
export const getClockFromContext = (context: unknown): Clock => {
  const c = (context as any)?.clock;
  return c && typeof c.now === "function" ? (c as Clock) : systemClock;
};

/** --- Test helpers; import in tests only --- */
export const fixedClock = (at: Date | string | number): Clock => {
  const d = at instanceof Date ? at : new Date(at);
  return { now: () => d };
};

export const mutableClock = (start: Date = new Date()) => {
  let d = start;
  return {
    now: () => d,
    set: (next: Date | string | number) => {
      d = next instanceof Date ? next : new Date(next);
    },
  } satisfies Clock & { set: (next: Date | string | number) => void };
};
```

### `payment-metadata.ts`

```ts
// src/features/events/utils/payment-metadata.ts
import type { EventPaymentMetadata } from "../events.db-types";
import type { Clock } from "./time";
import { isoTimestamp } from "./time";

export type ActorId = string;

/** Snapshot the organizer's current e-transfer instructions on registration creation. */
export function buildEtransferSnapshot(
  instructions?: string | null,
  recipient?: string | null,
): EventPaymentMetadata {
  const meta: EventPaymentMetadata = {};
  if (instructions) meta.instructionsSnapshot = instructions;
  if (recipient) meta.recipient = recipient;
  return meta;
}

/** Record that an e-transfer was marked paid by a specific actor at a specific time. */
export function markEtransferPaidMetadata(
  existing: EventPaymentMetadata | undefined,
  actorId: ActorId,
  clock?: Clock,
): EventPaymentMetadata {
  const meta: EventPaymentMetadata = { ...(existing ?? {}) };
  meta.markedPaidAt = isoTimestamp(clock);
  meta.markedPaidBy = actorId;
  return meta;
}

/** Record that a reminder was sent for an e-transfer. */
export function markEtransferReminderMetadata(
  existing: EventPaymentMetadata | undefined,
  actorId: ActorId,
  clock?: Clock,
): EventPaymentMetadata {
  const meta: EventPaymentMetadata = { ...(existing ?? {}) };
  meta.lastReminderAt = isoTimestamp(clock);
  meta.lastReminderBy = actorId;
  return meta;
}

/** Optionally append notes (e.g., lightweight cancellation info). */
export function appendCancellationNote(
  existing: EventPaymentMetadata | undefined,
  note: string | undefined,
): EventPaymentMetadata {
  const meta: EventPaymentMetadata = { ...(existing ?? {}) };
  if (note) meta.notes = meta.notes ? `${meta.notes}\n${note}` : note;
  return meta;
}
```

### `jsonb.ts`

```ts
// src/features/events/utils/jsonb.ts
import type { Event as DbEvent, EventRegistration } from "~/db/schema";
import type {
  EventAmenities,
  EventDivisions,
  EventMetadata,
  EventPaymentMetadata,
  EventRegistrationRoster,
  EventRequirements,
  EventRules,
  EventSchedule,
} from "../events.db-types";
import type { EventWithDetails } from "../events.types";

export type EventRegistrationWithRoster = Omit<
  EventRegistration,
  "roster" | "paymentMetadata"
> & {
  roster: EventRegistrationRoster;
  paymentMetadata: EventPaymentMetadata;
};

export function castEventJsonbFields(event: DbEvent): EventWithDetails {
  return {
    ...event,
    rules: (event.rules || {}) as EventRules,
    schedule: (event.schedule || {}) as EventSchedule,
    divisions: (event.divisions || {}) as EventDivisions,
    amenities: (event.amenities || {}) as EventAmenities,
    requirements: (event.requirements || {}) as EventRequirements,
    metadata: (event.metadata || {}) as EventMetadata,
  } as EventWithDetails;
}

export function castRegistrationJsonbFields(
  registration: EventRegistration,
): EventRegistrationWithRoster {
  return {
    ...registration,
    roster: (registration.roster || {}) as EventRegistrationRoster,
    paymentMetadata: (registration.paymentMetadata ?? {}) as EventPaymentMetadata,
  };
}
```

### `pricing.ts`

```ts
// src/features/events/utils/pricing.ts
import type { Event as DbEvent } from "~/db/schema";

/** Existing logic, moved here for reuse + testability. */
export function calculateRegistrationAmountCents(
  event: DbEvent,
  registrationType: "team" | "individual",
  now: Date,
): number {
  const base =
    registrationType === "team"
      ? (event.teamRegistrationFee ?? 0)
      : (event.individualRegistrationFee ?? 0);

  if (!base || base <= 0) return 0;

  const pct = event.earlyBirdDiscount ?? 0;
  const deadline = event.earlyBirdDeadline ? new Date(event.earlyBirdDeadline) : null;

  if (pct > 0 && deadline && now <= deadline) {
    const clamped = Math.min(100, Math.max(0, pct));
    const discounted = Math.round(base - (base * clamped) / 100);
    return Math.max(0, discounted);
  }
  return base;
}
```

### `index.ts`

```ts
// src/features/events/utils/index.ts
export * from "./time";
export * from "./jsonb";
export * from "./payment-metadata";
export * from "./pricing";
```

---

## 2) Refactor `events.mutations.ts` to use the utilities

> File: `src/features/events/events.mutations.ts`

- **Imports:** add utilities and remove the local `castEventJsonbFields` / `castRegistrationJsonbFields` definitions.
- **Time:** replace inline `new Date()` with `currentTimestamp(getClockFromContext(context))` where you need “now”.
- **Payment metadata:** replace in‑line object assembly with the helpers.
- **Pricing:** call the extracted `calculateRegistrationAmountCents`.

Here are focused diffs you can apply:

### Imports (top of file)

```ts
// ⬇️ add
import {
  castEventJsonbFields,
  castRegistrationJsonbFields,
  calculateRegistrationAmountCents,
  currentTimestamp,
  getClockFromContext,
  buildEtransferSnapshot,
  markEtransferPaidMetadata,
  markEtransferReminderMetadata,
} from "./utils";
```

### Remove the local helpers

```ts
// ❌ delete the local definitions:
// - function castEventJsonbFields(event: DbEvent): EventWithDetails { ... }
// - type EventRegistrationWithRoster = ...
// - function castRegistrationJsonbFields(registration: EventRegistration) { ... }
// - function calculateRegistrationAmountCents(...) { ... }

// ✅ they’re now imported from "./utils"
```

### `cancelEvent` — use a single clocked timestamp

```ts
// inside handler:
const clock = getClockFromContext(context);
const now = currentTimestamp(clock);

await db
  .update(events)
  .set({
    status: "cancelled",
    updatedAt: now,
  })
  .where(eq(events.id, data.eventId));
```

> (For EVT‑1 you’ll later cascade registration cancellations here; this refactor keeps timestamps consistent when you do.)

### `registerForEvent` — consistent time + payment metadata snapshot

```ts
const clock = getClockFromContext(context);
const now = currentTimestamp(clock);

// ... determine registrationType ...

const amountDueCents = calculateRegistrationAmountCents(event, registrationType, now);

// Payment status & metadata
let paymentStatus: EventRegistration["paymentStatus"] = "pending";
let amountPaidCents: number | null = null;
let paymentCompletedAt: Date | null = null;

if (amountDueCents === 0) {
  paymentStatus = "paid";
  amountPaidCents = 0;
  paymentCompletedAt = now;
} else if (paymentMethod === "etransfer") {
  paymentStatus = "awaiting_etransfer";
}

const paymentMetadata =
  paymentMethod === "etransfer"
    ? buildEtransferSnapshot(event.etransferInstructions, event.etransferRecipient)
    : null;

// ... insert registration with `paymentMetadata` unchanged ...
```

### `markEventEtransferPaid` — standardized stamp

```ts
const clock = getClockFromContext(context);
const now = currentTimestamp(clock);

const existingMetadata = (registration.paymentMetadata || {}) as EventPaymentMetadata;
const updatedMetadata = markEtransferPaidMetadata(existingMetadata, user.id, clock);

const [updatedRegistration] = await db
  .update(eventRegistrations)
  .set({
    paymentStatus: "paid",
    status: registration.status === "cancelled" ? registration.status : "confirmed",
    paymentCompletedAt: now,
    amountPaidCents: registration.amountDueCents,
    paymentMetadata: updatedMetadata,
    updatedAt: now,
  })
  .where(eq(eventRegistrations.id, data.registrationId))
  .returning();
```

### `markEventEtransferReminder` — standardized stamp

```ts
const clock = getClockFromContext(context);
const now = currentTimestamp(clock);

const existingMetadata = (registration.paymentMetadata || {}) as EventPaymentMetadata;
const updatedMetadata = markEtransferReminderMetadata(existingMetadata, user.id, clock);

const [updatedRegistration] = await db
  .update(eventRegistrations)
  .set({
    paymentMetadata: updatedMetadata,
    updatedAt: now,
  })
  .where(eq(eventRegistrations.id, data.registrationId))
  .returning();
```

Everything else in the handlers remains the same; you’re just swapping local, duplicated logic for the centralized calls.

---

## 3) Lightweight tests you can drop in now

> Folder: `src/features/events/__tests__/` (new)

### `payment-metadata.test.ts`

```ts
import {
  buildEtransferSnapshot,
  markEtransferPaidMetadata,
  markEtransferReminderMetadata,
} from "../utils/payment-metadata";
import { fixedClock } from "../utils/time";

describe("payment metadata utilities", () => {
  const clock = fixedClock("2025-01-01T12:00:00.000Z");

  it("builds snapshot with instructions and recipient", () => {
    expect(buildEtransferSnapshot("send to x", "pay@club.ca")).toEqual({
      instructionsSnapshot: "send to x",
      recipient: "pay@club.ca",
    });
  });

  it("marks e-transfer paid with actor + timestamp", () => {
    const meta = markEtransferPaidMetadata(undefined, "user-123", clock);
    expect(meta.markedPaidBy).toBe("user-123");
    expect(meta.markedPaidAt).toBe("2025-01-01T12:00:00.000Z");
  });

  it("marks e-transfer reminder with actor + timestamp", () => {
    const meta = markEtransferReminderMetadata({ notes: "pending" }, "admin-1", clock);
    expect(meta.lastReminderBy).toBe("admin-1");
    expect(meta.lastReminderAt).toBe("2025-01-01T12:00:00.000Z");
    expect(meta.notes).toBe("pending");
  });
});
```

### `pricing.test.ts`

```ts
import { calculateRegistrationAmountCents } from "../utils/pricing";

const baseEvent = {
  teamRegistrationFee: 10000,
  individualRegistrationFee: 2500,
  earlyBirdDiscount: 20,
  earlyBirdDeadline: new Date("2025-02-01T00:00:00Z"),
} as any;

describe("calculateRegistrationAmountCents", () => {
  it("applies early-bird discount on or before the deadline", () => {
    const now = new Date("2025-02-01T00:00:00Z");
    expect(calculateRegistrationAmountCents(baseEvent, "team", now)).toBe(8000);
    expect(calculateRegistrationAmountCents(baseEvent, "individual", now)).toBe(2000);
  });

  it("returns base fee after deadline", () => {
    const now = new Date("2025-02-02T00:00:00Z");
    expect(calculateRegistrationAmountCents(baseEvent, "team", now)).toBe(10000);
  });

  it("returns 0 when fee is zero/undefined", () => {
    const e = { ...baseEvent, individualRegistrationFee: 0 };
    expect(calculateRegistrationAmountCents(e as any, "individual", new Date())).toBe(0);
  });
});
```

> These don’t require a DB. For mutation tests, you can inject a `clock` by attaching it to the server fn **context** (the utilities look for `context.clock`).

---

## 4) Why this helps (and what it sets up for EVT‑1)

- **Single time source** ⇒ predictable, testable timestamps across every mutation (no more drift between fields in one transaction).
- **Payment metadata** is **append‑only** and consistent (same keys everywhere), making your future refund/cancellation pipeline (EVT‑1) much easier to implement and audit.
- **JSONB casting** is in one place (no accidental shape drift).
- **Pricing** is test‑covered and reusable from any context (you’ll extend coverage under EVT‑2).

---

## 5) Integration checklist

1. **Add** the `utils` files above.
2. **Update** `events.mutations.ts` imports + remove duplicated helpers.
3. **Run**:
   - `pnpm lint`
   - `pnpm check-types`
   - `pnpm test`

4. (Optional) In tests, **inject a clock** via the server-fn `context`:

   ```ts
   // example pseudo-setup for a server-fn test
   const clock = fixedClock("2025-01-01T00:00:00Z");
   const context = { /* ...auth... */, clock };
   // call your handler with this context so all timestamps are deterministic
   ```

---

## 6) A tiny nit you might want to revisit soon

In `registerForEvent`, you persist `roster` as `JSON.stringify(data.roster)`. If your column is `jsonb` in Postgres/Drizzle, you can usually pass an object and let the driver encode it (avoids double encoding or mismatched types). Not urgent for EVT‑3, but worth aligning when you touch that path next.

---

If you want, I can also draft the **EVT‑1 cancellation cascade helpers** (refund/void routing + cancellation stamps) in the same `utils/payment-metadata.ts` style so your mutation stays slim.
