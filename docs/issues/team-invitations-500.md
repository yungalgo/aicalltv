# Issue: `/dashboard/teams` 500 after HP-3 migrations

**Feature:** HP-3 – Team Invitations Experience  
**Environment:** Local TanStack Start dev server (`localhost:5173`) running with Playwright MCP browser tooling  
**Account used:** `team-join@example.com`

## Symptoms

- Navigating to `/dashboard/teams` immediately trips the default catch boundary (`Something went wrong!`).
- Network panel shows repeated `500 Internal Server Error` responses from the server functions:
  - `getPendingTeamInvites`
  - `getUserTeams`
- Console stack traces bubble a Postgres failure:

  ```text
  column team_members.invited_at does not exist
  Hint: Perhaps you meant to reference the column "team_members.invited_by".
  ```

## Root Cause (current theory)

The running dev server is still connected to a database instance that lacks the new invitation metadata columns introduced for HP-3. The loader queries now project `invited_at`, `requested_at`, `last_invitation_reminder_at`, etc.; when those columns are missing, Drizzle/Postgres aborts the request, which propagates to the client as a 500.

## Steps already taken

1. **Logout/login flow** – Signed in via the MCP browser as the pending-invite user; reproduced the 500 consistently.
2. **Local migration run** – Created and executed `0004_team_invitation_metadata.sql` with `pnpm db:migrate`. Verified via direct SQL against both pooled/unpooled URLs that the columns exist now.
3. **Manual seed sanity check** – Inserted a fresh pending invite row to confirm data would be available once the query works. The UI still fails, meaning the long-running server process needs to be pointed at the migrated DB (or restarted) to pick up the schema.

## Expected vs Actual

- **Expected:** `/dashboard/teams` renders the `TeamInvitationsSection` with accept/decline controls, pending invite badge, and success/error toasts.
- **Actual:** Catch boundary shows a generic error; backend logs emit the missing-column exception above.

## Next actions

1. Apply the new migration to the database the dev server is currently using (or restart the server after ensuring the schema is current).
2. Once `/dashboard/teams` loads successfully, re-run the manual acceptance checklist:
   - View pending invites for `team-join@example.com` and exercise **Accept**/**Decline**.
   - Visit a public team as a non-member and send an **Ask to Join** request.
   - Confirm roster views show pending status badges and timestamps.
3. If hot-reloading without restart is desired, consider adding a defensive guard that logs a clear message when invitation columns are absent, instead of surfacing a 500.

## Related files

- `scripts/seed-e2e-data.ts` – now seeds pending invite fixtures.
- `src/db/migrations/0004_team_invitation_metadata.sql` – adds the invitation metadata columns.
- `src/features/teams/teams.queries.ts` – `getPendingTeamInvites` projection introducing the new columns.
