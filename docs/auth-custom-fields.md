# Authentication Custom Fields Documentation

## Overview

This document explains how custom user fields are handled in the Solstice application, which uses Better Auth for authentication with custom profile fields stored in the database.

## The Challenge

Better Auth's session only returns a subset of user fields by default:

- `id`
- `name`
- `email`
- `emailVerified`
- `createdAt`
- `updatedAt`
- `image`

However, our application requires additional custom fields for user profiles:

- `profileComplete` - Track if user has completed onboarding
- `dateOfBirth` - Required profile field
- `emergencyContact` - Required for sports leagues (JSON)
- `gender`, `pronouns`, `phone` - Optional profile fields
- `privacySettings` - User privacy preferences (JSON)
- `profileVersion`, `profileUpdatedAt` - Audit fields

## Solution Architecture

### 1. Database Schema (`src/db/schema/auth.schema.ts`)

The user table includes all custom fields with appropriate defaults:

```typescript
export const user = pgTable("user", {
  // Better Auth core fields
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  // ... other core fields ...

  // Custom profile fields
  profileComplete: boolean("profile_complete")
    .$defaultFn(() => false)
    .notNull(),
  dateOfBirth: timestamp("date_of_birth"),
  emergencyContact: text("emergency_contact"), // JSON string
  // ... other custom fields ...
});
```

### 2. Extended User Type (`src/lib/auth/types.ts`)

We define our own User interface that extends Better Auth's base User type:

```typescript
import type { User as BetterAuthUser } from "better-auth";

export interface User extends BetterAuthUser {
  profileComplete: boolean;
  dateOfBirth?: Date | null;
  emergencyContact?: string | null;
  // ... other custom fields ...
}
```

### 3. User Data Fetching (`src/features/auth/auth.queries.ts`)

A server function fetches the complete user data by:

1. Getting the session from Better Auth
2. Querying the database for the full user record
3. Mapping the database fields to our extended User type

```typescript
export const getCurrentUser = createServerFn({ method: "GET" }).handler(
  async (): Promise<User | null> => {
    const session = await auth.api.getSession({ headers });

    if (!session?.user) {
      return null;
    }

    // Fetch full user data from database
    const dbUser = await db()
      .select()
      .from(user)
      .where(eq(user.id, session.user.id))
      .limit(1);

    // Map to extended User type
    return {
      ...session.user,
      profileComplete: dbUser[0].profileComplete,
      // ... other custom fields ...
    };
  },
);
```

### 4. Route Context (`src/routes/__root.tsx`)

The root route uses `getCurrentUser` to provide the full user data to all child routes:

```typescript
beforeLoad: async ({ context }) => {
  const user = await getCurrentUser();
  return { user };
};
```

## Usage in Components

Components can now access all custom fields through the route context:

```typescript
// In route beforeLoad
const { user } = context;
if (!user.profileComplete) {
  throw redirect({ to: "/onboarding" });
}

// In components
const { user } = useRouteContext();
console.log(user.profileComplete); // ✅ TypeScript knows about this field
```

## Key Decisions

1. **No Type Augmentation**: We don't augment Better Auth's types directly, as this can cause type conflicts
2. **Database Query**: We accept the small overhead of an extra database query to get full user data
3. **Centralized Fetching**: All user data fetching goes through `getCurrentUser` for consistency
4. **Type Safety**: Our extended User type provides full type safety for custom fields

## Migration Notes

When adding new user fields:

1. Add the field to the database schema
2. Update the User interface in `src/lib/auth/types.ts`
3. Update the mapping in `getCurrentUser`
4. Run database migrations
