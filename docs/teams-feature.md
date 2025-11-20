# Teams Feature Documentation

## Overview

The Teams feature allows Quadball Canada members to create and manage teams, invite members, and prepare for event registrations. This document covers the complete implementation including database schema, server functions, UI components, and known issues.

## Implementation Status

- **Status**: ✅ Complete (January 2025)
- **Database**: teams, team_members tables
- **Features**: Create, manage, browse teams; member invitations and roles
- **Known Issues**: TypeScript type inference with TanStack Start

## Database Schema

### Teams Table

```sql
CREATE TABLE teams (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  created_by TEXT NOT NULL REFERENCES user(id),
  city TEXT,
  province TEXT,
  primary_color TEXT DEFAULT '#000000',
  secondary_color TEXT DEFAULT '#ffffff',
  founded_year INTEGER,
  website TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Team Members Table

```sql
CREATE TABLE team_members (
  id TEXT PRIMARY KEY,
  team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES user(id),
  role TEXT NOT NULL DEFAULT 'player',
  jersey_number TEXT,
  position TEXT,
  status TEXT DEFAULT 'active',
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  invited_at TIMESTAMP,
  invited_by TEXT REFERENCES user(id),
  UNIQUE(team_id, user_id)
);
```

### Member Roles

- `captain` - Team leader with full management permissions
- `coach` - Can manage roster and team details
- `player` - Regular team member
- `substitute` - Backup player

## Server Functions

### Query Functions (`teams.queries.ts`)

```typescript
// Get single team with creator info
getTeam({ teamId: string }): Promise<TeamWithCreator>

// List teams for a user
listTeams({
  userId?: string,
  includeInactive?: boolean
}): Promise<TeamListItem[]>

// Get team members with user details
getTeamMembers({ teamId: string }): Promise<TeamMemberWithUser[]>

// Search teams by name or city
searchTeams({ query: string }): Promise<TeamSearchResult[]>

// Check if user can manage team
canUserManageTeam({
  teamId: string,
  userId: string
}): Promise<boolean>
```

### Mutation Functions (`teams.mutations.ts`)

```typescript
// Create new team
createTeam(data: CreateTeamInput): Promise<Team>

// Update team details
updateTeam(data: UpdateTeamInput): Promise<Team>

// Add member to team
addTeamMember(data: AddTeamMemberInput): Promise<TeamMember>

// Update member role/details
updateTeamMember(data: UpdateTeamMemberInput): Promise<TeamMember>

// Remove member from team
removeTeamMember({
  teamId: string,
  memberId: string
}): Promise<void>

// Deactivate team (soft delete)
deactivateTeam({ teamId: string }): Promise<void>
```

## UI Components

### Routes

- `/dashboard/teams` - List user's teams
- `/dashboard/teams/create` - Create new team form
- `/dashboard/teams/browse` - Browse all public teams
- `/dashboard/teams/$teamId` - Team detail page
- `/dashboard/teams/$teamId/manage` - Team settings
- `/dashboard/teams/$teamId/members` - Member management

### Key Features

1. **Team Creation**
   - Multi-field form with validation
   - Auto-generated URL slug
   - Color picker for team colors
   - Optional fields for location, website

2. **Team Management**
   - Edit team details
   - Deactivate team
   - Only captains and coaches can manage

3. **Member Management**

- Invite by email
- Assign roles and jersey numbers
- Remove members
- Role-based permissions
- Track pending invitations with email notifications and dashboard actions
- Support member-initiated "ask to join" requests for public teams

## Invitations Workflow

- Team managers invite members from the dashboard; invites trigger SendGrid emails using the
  `TEAM_INVITATION` template and are logged in development.
- Pending invitations surface on the Teams home page with accept/decline controls and status badges.
- Non-members can request to join a team directly from the team detail page using the "Ask to Join"
  button; requests are tracked alongside traditional invitations.
- Invitation metadata (invited/ requested timestamps, reminder counters, inviter) is recorded on
  the `team_members` table for auditing and reminder automation.

4. **Team Discovery**
   - Browse all active teams
   - Search by name or city
   - View team details and member count

## TypeScript Workaround

Due to TanStack Start's type inference limitations with server function validators, we use type assertions:

```typescript
// In route loaders and components
await getTeam({
  teamId: params.teamId,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any); // Type assertion workaround
```

See `/docs/teams-typescript-errors.md` for detailed explanation.

## Permissions Model

### Team Creation

- Any authenticated user with complete profile can create teams
- User becomes team captain automatically

### Team Management

- Captains: Full access to all features
- Coaches: Can manage team and members
- Players/Substitutes: View only

### Member Management

- Captains/Coaches can add/remove members
- Members can only remove themselves
- Email invitations require user to exist in system

## Usage Examples

### Creating a Team

```typescript
import { createTeam } from "~/features/teams/teams.mutations";

const team = await createTeam({
  name: "Toronto Titans",
  slug: "toronto-titans",
  description: "Competitive team based in Toronto",
  city: "Toronto",
  province: "ON",
  primaryColor: "#FF0000",
  secondaryColor: "#FFFFFF",
  foundedYear: 2024,
  website: "https://torontotitans.com",
});
```

### Adding a Member

```typescript
import { addTeamMember } from "~/features/teams/teams.mutations";

const member = await addTeamMember({
  teamId: "team-123",
  email: "player@example.com",
  role: "player",
  jerseyNumber: "42",
  position: "Chaser",
});
```

## Future Enhancements

1. **Invitation Reminders**: Automated follow-ups to pending invites
2. **Team Statistics**: Track game history and performance metrics
3. **Media Upload**: Team logos and photos via Cloudinary
4. **Event Registration**: Register teams for tournaments
5. **Team Announcements**: Internal team communication

## Testing

### Database Migrations

```bash
pnpm db:migrate
```

### Test Data

Create test teams in development:

```sql
INSERT INTO teams (id, name, slug, created_by, city, province)
VALUES
  ('test-1', 'Test Team 1', 'test-team-1', 'user-id', 'Toronto', 'ON'),
  ('test-2', 'Test Team 2', 'test-team-2', 'user-id', 'Vancouver', 'BC');
```

### UI Testing

1. Create team at `/dashboard/teams/create`
2. View team list at `/dashboard/teams`
3. Browse teams at `/dashboard/teams/browse`
4. Manage members at `/dashboard/teams/{id}/members`

## Known Issues

1. **TypeScript Errors**: False positives with server function calls
   - Workaround: Type assertions with eslint-disable
   - Tracking: TanStack Router Issue #2759

2. **Email Invitations**: Currently only validates email exists
   - Future: Send actual invitation emails
   - Current: User must be pre-registered

3. **Permissions UI**: Limited feedback on permission errors
   - Enhancement: Better error messages for unauthorized actions
