## Key files

src/db/schema/auth.schema.ts,
src/db/schema/index.ts,
src/lib/auth/types.ts,
src/lib/auth/index.ts,
src/features/auth/auth.queries.ts,
src/features/auth/auth.mutations.ts,
src/components/ui/admin-sidebar.tsx,
src/routes/dashboard/reports.tsx,
src/routes/dashboard/teams/$teamId.manage.tsx,
src/routes/dashboard/events/$eventId.manage.tsx,
src/routes/\_\_root.tsx,
src/lib/auth/middleware/auth-guard.ts,
src/features/profile/profile.guards.ts,
src/features/users/user-search.ts,
src/features/membership/membership.queries.ts,
src/db/migrations/,
src/app/providers.tsx,
docs/user-roles-and-permissions-v2.md,
src/db/connections.ts,
src/features/auth/useAuthGuard.tsx,
src/routes/dashboard/route.tsx

# User Roles, Tags, and Permissions System Design V2

## Overview

This document outlines a hybrid system combining:

- **Roles**: For access control and permissions
- **Tags**: For categorization, searching, and filtering users
- **Membership Status**: Tracked separately through the existing membership system

## System Architecture

### 1. Roles (Access Control)

Roles determine what users can do in the system. Users can have multiple roles.

#### Role Types

| Role                      | Scope          | Description                                                      |
| ------------------------- | -------------- | ---------------------------------------------------------------- |
| **Solstice Admin**        | Global         | Full system access, can manage infrastructure, all organizations |
| **Quadball Canada Admin** | Organization   | Manage all Quadball Canada operations (teams, events, members)   |
| **Team Admin**            | Team-specific  | Manage specific team(s) - roster, registration, team details     |
| **Event Admin**           | Event-specific | Manage specific event(s) - registration, scheduling, results     |

### 2. Tags (Categorization)

Tags are descriptive labels that don't affect permissions but enable:

- Searching and filtering users
- Automated communications (e.g., email all referees)
- Statistical reporting
- Event staffing assignments

#### Tag Categories

**Official Tags:**

- Head Referee
- Assistant Referee
- Flag Runner

**Team Tags:**

- Coach
- Captain

**Player Tags:**

- Adult
- Youth
- Full Contact Player
- Low Contact Player

**Custom Tags:**

- Can be added by admins for specific needs

### 3. Membership Status

Membership is tracked separately as it's time-bound and affects:

- Event registration eligibility
- Team roster eligibility
- Access to member benefits

This should remain in the existing membership system, not as a role or tag.

## Database Schema

### 1. Roles Schema

```sql
-- Global roles table
CREATE TABLE roles (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  permissions JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- User role assignments with optional scope
CREATE TABLE user_roles (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  role_id TEXT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  -- Scope fields (NULL for global roles)
  team_id TEXT REFERENCES teams(id) ON DELETE CASCADE,
  event_id TEXT REFERENCES events(id) ON DELETE CASCADE,
  -- Metadata
  assigned_by TEXT NOT NULL REFERENCES user(id),
  assigned_at TIMESTAMP NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMP,
  notes TEXT,
  -- Constraints
  CONSTRAINT valid_scope CHECK (
    (role_id IN (SELECT id FROM roles WHERE name IN ('Solstice Admin', 'Quadball Canada Admin'))
     AND team_id IS NULL AND event_id IS NULL)
    OR
    (role_id IN (SELECT id FROM roles WHERE name = 'Team Admin')
     AND team_id IS NOT NULL AND event_id IS NULL)
    OR
    (role_id IN (SELECT id FROM roles WHERE name = 'Event Admin')
     AND event_id IS NOT NULL AND team_id IS NULL)
  )
);

-- Indexes for performance
CREATE INDEX idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX idx_user_roles_team_id ON user_roles(team_id) WHERE team_id IS NOT NULL;
CREATE INDEX idx_user_roles_event_id ON user_roles(event_id) WHERE event_id IS NOT NULL;
```

### 2. Tags Schema

```sql
-- Tag definitions
CREATE TABLE tags (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL, -- 'official', 'team', 'player', 'custom'
  description TEXT,
  color TEXT, -- For UI display
  icon TEXT, -- Icon identifier
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- User tags (many-to-many)
CREATE TABLE user_tags (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  -- Optional metadata
  assigned_by TEXT REFERENCES user(id),
  assigned_at TIMESTAMP NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMP, -- For temporary tags
  notes TEXT,
  UNIQUE(user_id, tag_id)
);

-- Indexes
CREATE INDEX idx_user_tags_user_id ON user_tags(user_id);
CREATE INDEX idx_user_tags_tag_id ON user_tags(tag_id);
CREATE INDEX idx_user_tags_expires_at ON user_tags(expires_at) WHERE expires_at IS NOT NULL;
```

### 3. Seed Data

```sql
-- Insert default roles
INSERT INTO roles (name, description, permissions) VALUES
  ('Solstice Admin', 'Platform administrator with full system access', '{"*": true}'),
  ('Quadball Canada Admin', 'Quadball Canada organization administrator', '{"quadball_canada.*": true}'),
  ('Team Admin', 'Team-specific administrator', '{"team.*": true}'),
  ('Event Admin', 'Event-specific administrator', '{"event.*": true}');

-- Insert default tags
INSERT INTO tags (name, category, description, color) VALUES
  -- Officials
  ('Head Referee', 'official', 'Certified head referee', '#FF6B6B'),
  ('Assistant Referee', 'official', 'Certified assistant referee', '#4ECDC4'),
  ('Flag Runner', 'official', 'Certified flag runner', '#45B7D1'),
  -- Team roles
  ('Coach', 'team', 'Team coach', '#96CEB4'),
  ('Captain', 'team', 'Team captain', '#FECA57'),
  -- Player categories
  ('Adult', 'player', 'Adult player (18+)', '#6C5CE7'),
  ('Youth', 'player', 'Youth player (under 18)', '#A29BFE'),
  ('Full Contact Player', 'player', 'Plays full contact', '#EE5A24'),
  ('Low Contact Player', 'player', 'Plays low/no contact variant', '#F79F1F');
```

## Implementation

### 1. Types and Interfaces

```typescript
// src/lib/auth/roles.types.ts
export interface Role {
  id: string;
  name: "Solstice Admin" | "Quadball Canada Admin" | "Team Admin" | "Event Admin";
  description: string;
  permissions: Record<string, boolean>;
}

export interface UserRole {
  id: string;
  userId: string;
  roleId: string;
  role: Role;
  teamId?: string;
  team?: Team;
  eventId?: string;
  event?: Event;
  assignedBy: string;
  assignedAt: Date;
  expiresAt?: Date;
  notes?: string;
}

// src/lib/auth/tags.types.ts
export interface Tag {
  id: string;
  name: string;
  category: "official" | "team" | "player" | "custom";
  description?: string;
  color?: string;
  icon?: string;
  isActive: boolean;
}

export interface UserTag {
  id: string;
  userId: string;
  tagId: string;
  tag: Tag;
  assignedBy?: string;
  assignedAt: Date;
  expiresAt?: Date;
  notes?: string;
}
```

### 2. Permission Service

```typescript
// src/features/roles/permission.service.ts
export class PermissionService {
  static async canUserAccessTeam(userId: string, teamId: string): Promise<boolean> {
    // Check if user has global admin roles
    const globalAccess = await db
      .select()
      .from(userRoles)
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .where(
        and(
          eq(userRoles.userId, userId),
          inArray(roles.name, ["Solstice Admin", "Quadball Canada Admin"]),
        ),
      )
      .limit(1);

    if (globalAccess.length > 0) return true;

    // Check if user has team-specific admin role
    const teamAccess = await db
      .select()
      .from(userRoles)
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .where(
        and(
          eq(userRoles.userId, userId),
          eq(roles.name, "Team Admin"),
          eq(userRoles.teamId, teamId),
        ),
      )
      .limit(1);

    return teamAccess.length > 0;
  }

  static async canUserAccessEvent(userId: string, eventId: string): Promise<boolean> {
    // Similar logic for events
  }

  static async isGlobalAdmin(userId: string): Promise<boolean> {
    const adminRoles = await db
      .select()
      .from(userRoles)
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .where(
        and(
          eq(userRoles.userId, userId),
          inArray(roles.name, ["Solstice Admin", "Quadball Canada Admin"]),
        ),
      )
      .limit(1);

    return adminRoles.length > 0;
  }
}
```

### 3. Tag Service

```typescript
// src/features/tags/tag.service.ts
export class TagService {
  static async getUserTags(userId: string): Promise<Tag[]> {
    const tags = await db
      .select({
        id: tags.id,
        name: tags.name,
        category: tags.category,
        color: tags.color,
        icon: tags.icon,
      })
      .from(userTags)
      .innerJoin(tags, eq(userTags.tagId, tags.id))
      .where(
        and(
          eq(userTags.userId, userId),
          or(isNull(userTags.expiresAt), gte(userTags.expiresAt, new Date())),
        ),
      );

    return tags;
  }

  static async findUsersByTags(tagNames: string[]): Promise<User[]> {
    const users = await db
      .selectDistinct({ user })
      .from(userTags)
      .innerJoin(tags, eq(userTags.tagId, tags.id))
      .innerJoin(user, eq(userTags.userId, user.id))
      .where(inArray(tags.name, tagNames));

    return users.map((u) => u.user);
  }

  static async assignTag(
    userId: string,
    tagId: string,
    assignedBy: string,
    expiresAt?: Date,
  ): Promise<void> {
    await db.insert(userTags).values({
      userId,
      tagId,
      assignedBy,
      assignedAt: new Date(),
      expiresAt,
    });
  }

  // Programmatic tag updates
  static async updateRefereeTagsAfterCertification(userId: string, level: string) {
    // Remove old referee tags
    // Add new referee tag based on certification level
  }
}
```

### 4. Updated Auth Context

```typescript
// src/lib/auth/types.ts
export interface User extends BetterAuthUser {
  // ... existing fields ...
  roles?: UserRole[];
  tags?: Tag[];
  activeMembership?: {
    id: string;
    type: string;
    expiresAt: Date;
    year: number;
  };
}

// src/features/auth/auth.queries.ts
export const getCurrentUser = createServerFn({ method: "GET" }).handler(async () => {
  const session = await auth.api.getSession({ headers: await getHeaders() });

  if (!session?.user?.id) return null;

  const [dbUser] = await db
    .select()
    .from(user)
    .where(eq(user.id, session.user.id))
    .limit(1);

  if (!dbUser) return null;

  // Fetch roles with scope
  const userRoles = await db
    .select()
    .from(userRoles)
    .innerJoin(roles, eq(userRoles.roleId, roles.id))
    .leftJoin(teams, eq(userRoles.teamId, teams.id))
    .leftJoin(events, eq(userRoles.eventId, events.id))
    .where(eq(userRoles.userId, dbUser.id));

  // Fetch tags
  const userTags = await TagService.getUserTags(dbUser.id);

  // Fetch active membership
  const activeMembership = await db
    .select()
    .from(memberships)
    .where(
      and(
        eq(memberships.userId, dbUser.id),
        eq(memberships.status, "active"),
        gte(memberships.expiresAt, new Date()),
      ),
    )
    .orderBy(desc(memberships.expiresAt))
    .limit(1);

  return {
    ...dbUser,
    roles: userRoles,
    tags: userTags,
    activeMembership: activeMembership[0] || null,
  };
});
```

### 5. UI Components

```typescript
// User Profile Display
export function UserProfile({ user }: { user: User }) {
  return (
    <div>
      {/* Roles Section */}
      <div className="mb-6">
        <h3 className="font-semibold mb-2">Administrative Roles</h3>
        <div className="flex flex-wrap gap-2">
          {user.roles?.map(role => (
            <Badge key={role.id} variant="default">
              {role.role.name}
              {role.teamId && ` - ${role.team?.name}`}
              {role.eventId && ` - ${role.event?.name}`}
            </Badge>
          ))}
        </div>
      </div>

      {/* Tags Section */}
      <div className="mb-6">
        <h3 className="font-semibold mb-2">Tags & Certifications</h3>
        <div className="flex flex-wrap gap-2">
          {user.tags?.map(tag => (
            <Badge
              key={tag.id}
              style={{ backgroundColor: tag.color }}
              className="text-white"
            >
              {tag.icon && <Icon name={tag.icon} className="mr-1" />}
              {tag.name}
            </Badge>
          ))}
        </div>
      </div>

      {/* Membership Status */}
      <div>
        <h3 className="font-semibold mb-2">Membership Status</h3>
        {user.activeMembership ? (
          <p className="text-green-600">
            Active {user.activeMembership.type} Member
            (Expires: {formatDate(user.activeMembership.expiresAt)})
          </p>
        ) : (
          <p className="text-gray-500">No active membership</p>
        )}
      </div>
    </div>
  );
}
```

### 6. Search Implementation

```typescript
// src/features/users/user-search.ts
export const searchUsers = createServerFn({ method: "POST" })
  .validator(
    z.object({
      tags: z.array(z.string()).optional(),
      roles: z.array(z.string()).optional(),
      hasActiveMembership: z.boolean().optional(),
      teamId: z.string().optional(),
    }),
  )
  .handler(async ({ data }) => {
    let query = db.select().from(user);

    // Filter by tags
    if (data.tags?.length) {
      const taggedUsers = await TagService.findUsersByTags(data.tags);
      const userIds = taggedUsers.map((u) => u.id);
      query = query.where(inArray(user.id, userIds));
    }

    // Filter by active membership
    if (data.hasActiveMembership) {
      const memberUsers = await db
        .selectDistinct({ userId: memberships.userId })
        .from(memberships)
        .where(
          and(eq(memberships.status, "active"), gte(memberships.expiresAt, new Date())),
        );
      const userIds = memberUsers.map((m) => m.userId);
      query = query.where(inArray(user.id, userIds));
    }

    return query;
  });
```

## Usage Examples

### 0. Bootstrapping Roles and Global Admins

```bash
# Ensure default roles exist and assign global admins from CLI
pnpm tsx scripts/seed-global-admins.ts --solstice admin@example.com --quadball another.admin@example.com

# You can also drive assignments via environment variables:
#   SOLSTICE_ADMIN_EMAILS="alice@example.com,bob@example.com"
#   QUADBALL_ADMIN_EMAILS="carol@example.com"
```

### 1. Assigning Roles

```typescript
// Make someone a Team Admin
await assignRole(userId, "Team Admin", { teamId: "team-123" });

// Make someone a Quadball Canada Admin
await assignRole(userId, "Quadball Canada Admin");
```

### 2. Checking Permissions

```typescript
// Check if user can edit a team
const canEdit = await PermissionService.canUserAccessTeam(userId, teamId);

// Check if user is any kind of admin
const isAdmin = await PermissionService.isGlobalAdmin(userId);
```

### 3. Managing Tags

```typescript
// Tag someone as a Head Referee
await TagService.assignTag(userId, headRefereeTagId, adminUserId);

// Find all certified referees
const referees = await TagService.findUsersByTags(["Head Referee", "Assistant Referee"]);

// Automatically update tags after certification
await TagService.updateRefereeTagsAfterCertification(userId, "head");
```

### 4. Filtering UI Elements

```typescript
// Show Reports tab only for global admins
{user.roles?.some(r =>
  ['Solstice Admin', 'Quadball Canada Admin'].includes(r.role.name)
) && (
  <Link to="/reports">Reports</Link>
)}

// Show team management only for team admins
{user.roles?.some(r =>
  r.role.name === 'Team Admin' && r.teamId === currentTeamId
) && (
  <Button>Manage Team</Button>
)}
```

## Benefits of This Approach

1. **Clear Separation**: Roles control access, tags are for categorization
2. **Flexible Scoping**: Team/Event admins are scoped to specific resources
3. **Searchability**: Easy to find users by tags (e.g., all referees)
4. **Membership Independence**: Membership status remains in its own system
5. **Extensibility**: Easy to add new roles or tags without schema changes
6. **Performance**: Efficient queries with proper indexes

## Migration Strategy

1. **Phase 1**: Implement roles for access control
2. **Phase 2**: Add tags for categorization
3. **Phase 3**: Build search and filtering features
4. **Phase 4**: Create admin UI for managing roles/tags
5. **Phase 5**: Automated tag management (certifications, etc.)

This design provides the flexibility you need while keeping the concepts clearly separated and maintainable.

## Implementation Plan (Solo Dev Approach)

### Immediate Tasks (4-5 hours total)

1. **Create roles schema file with roles and user_roles tables** (~30 min)
   - Add Drizzle schema definitions for roles system
   - Include proper constraints and indexes

2. **Update schema index to include new roles schema** (~5 min)
   - Export new tables from schema index

3. **Create PermissionService for role-based access checks** (~60-90 min)
   - Simple service class with static methods
   - `isGlobalAdmin()`, `canManageTeam()`, `canManageEvent()`

4. **Update getCurrentUser to include roles data** (~30 min)
   - Fetch user roles with proper joins
   - Include role scope (team/event) information

5. **Hide Reports tab based on user roles** (~30 min)
   - Update admin sidebar to filter items based on permissions
   - Client-side helper for UI-only checks

6. **Add role guards to protected routes** (~30 min)
   - Apply guards to /dashboard/reports, team/event management
   - Use beforeLoad hooks in TanStack Router

7. **Create seed script for default roles** (~20 min)
   - CLI script to insert default roles
   - Assign yourself Solstice Admin role

8. **Write tests for PermissionService** (~45 min)
   - Unit tests with Vitest
   - Cover happy path and edge cases

### Deferred Tasks (Future Iterations)

- Full admin UI for role management (use CLI scripts for now)
- Tag system implementation
- Audit logging
- PostgreSQL RLS
- Caching layer for permission checks
