# Event Payments & E-Transfer Delivery Plan

## Context

- Event registrations currently create pending records (`event_registrations`) without collecting payment.
- Membership purchases already rely on Square checkout sessions, membership payment session tracking, and webhook finalization.
- Product backlog calls for (a) full Square-backed payments for event registrations and (b) a manual e-transfer option that records intent and lets admins reconcile outstanding payments.

## Objectives

1. Collect Square payments for team/individual event registrations, mirroring the reliability and telemetry of membership purchases.
2. Offer e-transfer as an alternate payment method when enabled per event, recording the selection and exposing admin tooling to reconcile or remind registrants.
3. Preserve a clear audit trail for payment method, status, and amount due per registration, enabling revenue reporting and reminders.

## High-Level Scope

- **Data model**: Extend event and registration tables; add Square session tracking for events.
- **Server functions**: Orchestrate Square checkout creation/confirmation, record e-transfer intent, enable admin updates.
- **UI/UX**: Update event creation & registration flows, and expand the dashboard event management view with payment insights and e-transfer actions.
- **Automation**: Extend Square webhook/callback processing and add tests/docs that cover both payment paths.

## Data Model Changes

- `events`
  - `allow_etansfer` (`boolean`, default `false`) — toggle availability.
  - `etransfer_instructions` (`text`, nullable) — instructions shown to registrants.
  - `etransfer_recipient` (`varchar`) — email or name the payment should be sent to.
- `event_registrations`
  - `payment_method` (`varchar`, default `'square'`) — `'square' | 'etransfer'` (store as text for flexibility).
  - `amount_due_cents` (`integer`, default `0`).
  - `amount_paid_cents` (`integer`, nullable).
  - `payment_completed_at` (`timestamp`, nullable).
  - `payment_metadata` (`jsonb`, nullable) — reminders, notes, e-transfer references.
  - Normalize `payment_status` values (`pending`, `awaiting_etransfer`, `paid`, `refunded`, `cancelled`).
- New table `event_payment_sessions`
  - Similar to `membership_payment_sessions` but keyed by event registration ID (cuid PK, references registration & event, Square checkout info, status, metadata).
  - Index by `square_checkout_id`, `square_payment_id` for webhook lookups.

## Backend Changes

1. **Registration Flow**
   - Update `registerForEvent` schema to accept `paymentMethod` (`square` default, `etransfer`) and persist metadata.
   - Branch logic:
     - `square`: create registration (status `pending`, payment status `pending`), create `event_payment_sessions` record via new helper `createEventCheckoutSession`, return checkout URL/session ID to client.
     - `etransfer`: create registration (status `pending`, payment status `awaiting_etransfer`, method `etransfer`, set `amount_due_cents`), populate `payment_metadata` (instructions snapshot, optional due date), return success without checkout.
   - Ensure roster payload is cast safely.
2. **Square Verification**
   - Extend `squarePaymentService.createCheckoutSession` to accept a generic payload or wrap it with an event-specific helper that stores event context in metadata.
   - Add server fn `confirmEventPayment` (similar to membership) for manual polling fallback.
   - Update Square webhook (`/api/webhooks/square`) and callback handler to recognize event sessions:
     - Resolve owning registration via new session table.
     - On `payment.updated` / callback success: mark registration `payment_status='paid'`, `payment_method='square'`, set `amount_paid_cents`, `payment_completed_at`, update `status='confirmed'` (and roster if necessary).
     - Handle refunds by downgrading registration/payment status.
3. **Admin Mutations**
   - New server fn(s) for admins:
     - `markEventEtransferPaid` — sets `payment_status='paid'`, `payment_completed_at`, updates `status='confirmed'`.
     - `markEventEtransferReminded` — updates metadata (e.g., `lastReminderAt`) to track reminders.
     - Optional `cancelEventRegistrationPayment` for future parity.
   - Apply auth guards (event organizer or admin only) and audit metadata.
4. **Queries**
   - Expand `getEvent` and `getEventRegistrations` to expose new payment fields and outstanding counts.
   - Add helper query `getOutstandingEtransferRegistrations(eventId)` for admin tab.

## Frontend Updates

- **Event Creation/Edit**
  - Extend forms (`EventCreateForm`, dashboard edit settings) to configure Square + e-transfer options: toggle for e-transfer and input instructions/recipient.
  - Persist and validate new fields (e.g., require instructions if toggle is enabled).
- **Registration Page (`/events/$slug/register`)**
  - Introduce payment method selection UI (radio group) conditioned on event settings.
  - On submit:
    - `square`: call new mutation, handle redirect to checkout (show success screen awaiting redirection).
    - `etransfer`: show confirmation/instructions, possibly email follow-up (future), ensure UI communicates pending status.
- **Dashboard Event Management**
  - Update overview metrics (total revenue uses `amount_paid_cents`).
  - Registrations table shows payment method, outstanding badges.
  - Add tab/section “E-Transfer Queue” listing pending e-transfer registrations with actions: mark paid, send reminder, copy contact info.
  - Surface aggregated counts (pending vs paid) and totals.

## Testing Strategy

- **Unit/Integration**
  - Drizzle schema snapshot & migrations tests (if applicable).
  - Server fn tests for `registerForEvent` (Square & e-transfer branches), admin mutations, webhook/event finalization (mock Square responses).
  - Ensure Zod validators reject invalid payment combos (e.g., e-transfer disabled but selected).
- **E2E**
  - Add Playwright scenario: register with Square (mock) → follow callback flow (simulate by hitting confirm endpoint) → check dashboard status.
  - Add scenario for e-transfer selection → dashboard admin marks paid → registration status updates.
- **Manual**
  - Validate Square checkouts using mock service link.
  - Verify outstanding e-transfer list updates after actions.

## Docs & Ops

- Update `docs/development-backlog.md` entries for event payments/e-transfer once implemented.
- Add README/feature doc snippet summarizing payment configuration.
- Document manual reconciliation steps for admins (maybe under `docs/events/`).

## Assumptions / Open Questions

- Square itemization: single payment per registration suffices; no partial payments required.
- Integration reuses existing Square credentials/config (no new env vars needed).
- For MVP, reminder action simply timestamps metadata (no email send yet).
- Early bird discount is applied client-side now; backend will compute canonical amount (same logic) to avoid tampering.

## Implementation Steps (Suggested Order)

1. Write migrations + schema updates for events, event registrations, and new payment sessions table.
2. Extend Square helper(s) and create event payment session server utilities.
3. Update `registerForEvent` + new confirmation endpoints + queries.
4. Integrate webhook/callback logic for event payments.
5. Build frontend updates: registration page, event creation/edit, admin dashboard.
6. Implement admin mutations/actions for e-transfer reconciliation.
7. Add tests (unit + Playwright) and documentation updates.
8. Run `pnpm lint`, `pnpm check-types`, relevant tests; verify flows via MCP browser.
