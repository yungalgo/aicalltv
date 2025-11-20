# Server Functions Guide

Server functions in TanStack Start provide type-safe communication between client and server code. They are the primary way to implement backend logic in this project.

## Overview

Server functions are wrapped with `serverOnly()` to ensure they only run on the server. They have full access to:

- Database operations via Drizzle ORM
- Authentication state via Better Auth
- External APIs and services
- Server-side environment variables

## When to Use What

| Use Case        | Solution                           | Example             |
| --------------- | ---------------------------------- | ------------------- |
| Data fetching   | Server function in `.queries.ts`   | `getProfile()`      |
| Data mutation   | Server function in `.mutations.ts` | `updateProfile()`   |
| Auth logic      | Better Auth utilities              | `auth.getSession()` |
| Edge middleware | Netlify Edge Functions             | Security headers    |
| Page data       | Route loaders                      | Initial page data   |

## Creating a Server Function

### Step 1: Create a Server Function File

Server functions should be organized in feature directories with naming conventions:

- `.queries.ts` - For data fetching operations
- `.mutations.ts` - For data modification operations

```typescript
// src/features/auth/auth.queries.ts
import { serverOnly } from "@tanstack/start";
import { db } from "~/db";
import { users } from "~/db/schema";
import { eq } from "drizzle-orm";
import { getAuthFromHeaders } from "~/lib/auth/utils";

export const getCurrentUser = serverOnly(async () => {
  const { user } = await getAuthFromHeaders();

  if (!user) {
    throw new Error("Not authenticated");
  }

  const dbUser = await db.query.users.findFirst({
    where: eq(users.id, user.id),
  });

  if (!dbUser) {
    throw new Error("User not found");
  }

  return dbUser;
});
```

### Step 2: Handle Authentication & Authorization

Use the auth context to check permissions:

```typescript
// src/features/auth/auth.mutations.ts
import { serverOnly } from "@tanstack/start";
import { getAuthFromHeaders } from "~/lib/auth/utils";
import { db } from "~/db";
import { users } from "~/db/schema";
import { eq } from "drizzle-orm";

export const updateProfile = serverOnly(async (data: UpdateProfileInput) => {
  // Get current user
  const { user } = await getAuthFromHeaders();
  if (!user) {
    throw new Error("Unauthorized");
  }

  // Update profile
  const [updated] = await db
    .update(users)
    .set({
      name: data.name,
      updatedAt: new Date(),
    })
    .where(eq(users.id, user.id))
    .returning();

  return updated;
});
```

### Step 3: Implement Error Handling

Always handle errors appropriately:

```typescript
import { z } from "zod";

const updateProfileSchema = z.object({
  name: z.string().min(1).max(100),
});

export const updateProfile = serverOnly(async (data: unknown) => {
  try {
    // Validate input
    const validated = updateProfileSchema.parse(data);

    // Get current user
    const { user } = await getAuthFromHeaders();
    if (!user) {
      throw new Error("Unauthorized");
    }

    // Update profile
    const [updated] = await db
      .update(users)
      .set({
        name: validated.name,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id))
      .returning();

    return updated;
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error("Invalid input: " + error.message);
    }

    // Log unexpected errors
    console.error("Update profile error:", error);
    throw new Error("Failed to update profile");
  }
});
```

### Step 4: Call from Client Components

Use TanStack Query to call server functions:

```tsx
// src/routes/dashboard/profile.tsx
import { useMutation, useQuery } from "@tanstack/react-query";
import { getCurrentUser, updateProfile } from "~/features/auth/auth.queries";

export default function ProfilePage() {
  // Fetch data
  const { data: user, isLoading } = useQuery({
    queryKey: ["currentUser"],
    queryFn: getCurrentUser,
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: updateProfile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["currentUser"] });
    },
  });

  // Use in component...
}
```

## Code Search Paths

To find existing server functions in the codebase:

```bash
# Find all query files
find src/features -name "*.queries.ts"

# Find all mutation files
find src/features -name "*.mutations.ts"

# Search for server functions
grep -r "serverOnly" src/features
```

## Best Practices

### 1. File Organization

```
src/features/
└── auth/
    ├── auth.queries.ts      # getCurrentUser, getProfile
    └── auth.mutations.ts    # updateProfile, changePassword
```

### 2. Type Safety

Always define input and output types:

```typescript
// src/features/auth/auth.types.ts
export interface UpdateProfileInput {
  name?: string;
  pronouns?: string;
  birthDate?: string;
}

export interface UserProfile {
  id: string;
  email: string;
  name: string | null;
  createdAt: Date;
}

// Use in server function
export const updateProfile = serverOnly(
  async (input: UpdateProfileInput): Promise<UserProfile> => {
    // Implementation...
  },
);
```

### 3. Authentication Patterns

Create reusable auth utilities:

```typescript
// src/lib/auth/utils.ts
export async function requireAuth() {
  const { user } = await getAuthFromHeaders();
  if (!user) {
    throw new Error("Unauthorized");
  }
  return user;
}

// Use in server functions
export const myProtectedFunction = serverOnly(async () => {
  const user = await requireAuth();
  // User is guaranteed to be authenticated
});
```

### 4. Database Transactions

Use transactions for multi-step operations:

```typescript
export const deleteAccount = serverOnly(async () => {
  const user = await requireAuth();

  return await db.transaction(async (tx) => {
    // Delete user sessions
    await tx.delete(sessions).where(eq(sessions.userId, user.id));

    // Delete user accounts
    await tx.delete(accounts).where(eq(accounts.userId, user.id));

    // Delete user
    await tx.delete(users).where(eq(users.id, user.id));

    // Log the deletion
    console.log(`Deleted user account: ${user.id}`);
  });
});
```

### 5. Caching Strategy

Use React Query's caching effectively:

```typescript
// Define stable query keys
export const authKeys = {
  all: ["auth"] as const,
  user: () => [...authKeys.all, "user"] as const,
  session: () => [...authKeys.all, "session"] as const,
  profile: (id: string) => [...authKeys.all, "profile", id] as const,
};

// Use in components
const { data } = useQuery({
  queryKey: authKeys.user(),
  queryFn: getCurrentUser,
  staleTime: 5 * 60 * 1000, // 5 minutes
});
```

## Common Patterns

### Authentication Check

```typescript
export const getAuthStatus = serverOnly(async () => {
  const { user } = await getAuthFromHeaders();

  return {
    isAuthenticated: !!user,
    user: user || null,
  };
});
```

### Profile Update

```typescript
export const updateUserPreferences = serverOnly(async (preferences: UserPreferences) => {
  const user = await requireAuth();

  const [updated] = await db
    .update(users)
    .set({
      preferences: preferences,
      updatedAt: new Date(),
    })
    .where(eq(users.id, user.id))
    .returning();

  return updated;
});
```

### Session Management

```typescript
export const invalidateAllSessions = serverOnly(async () => {
  const user = await requireAuth();

  // Delete all sessions for user
  await db.delete(sessions).where(eq(sessions.userId, user.id));

  return { success: true };
});
```

## Testing Server Functions

Create unit tests for server functions:

```typescript
// src/features/auth/__tests__/auth.queries.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { getCurrentUser } from "../auth.queries";
import { mockAuth } from "~/tests/mocks/auth";

describe("getCurrentUser", () => {
  beforeEach(() => {
    mockAuth({ id: "user-1", email: "test@example.com" });
  });

  it("returns current user when authenticated", async () => {
    const user = await getCurrentUser();

    expect(user).toMatchObject({
      id: "user-1",
      email: "test@example.com",
    });
  });

  it("throws error when not authenticated", async () => {
    mockAuth(null);

    await expect(getCurrentUser()).rejects.toThrow("Not authenticated");
  });
});
```

## Migration from REST

If migrating from REST endpoints, map them to server functions:

| REST Endpoint            | Server Function       |
| ------------------------ | --------------------- |
| GET /api/auth/me         | `getCurrentUser()`    |
| PUT /api/auth/profile    | `updateProfile(data)` |
| POST /api/auth/logout    | `logout()`            |
| DELETE /api/auth/account | `deleteAccount()`     |

The key difference is that server functions are called directly from React components with full type safety, rather than using fetch() with manual type casting.
