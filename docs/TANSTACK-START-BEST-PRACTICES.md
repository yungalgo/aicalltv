# TanStack Start Best Practices

This document outlines best practices for working with TanStack Start server functions and routing, based on lessons learned from migrations and production deployments.

## Table of Contents

1. [Routing Best Practices](#routing-best-practices)
2. [Server Function Best Practices](#server-function-best-practices)
3. [Type Safety Guidelines](#type-safety-guidelines)
4. [File Organization](#file-organization)
5. [Common Pitfalls](#common-pitfalls)
6. [Migration Guide](#migration-guide)

## Routing Best Practices

### Parent Routes Must Have Outlet Components

TanStack Router requires parent routes to render an `<Outlet />` component for child routes to display properly.

#### ✅ Good: Layout Route with Outlet

```typescript
// src/routes/events/$slug.tsx (parent route)
import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/events/$slug")({
  component: EventLayout,
});

function EventLayout() {
  return <Outlet />;  // REQUIRED for child routes to render
}
```

```typescript
// src/routes/events/$slug.index.tsx (index child route)
export const Route = createFileRoute("/events/$slug/")({
  component: EventDetailPage,
});

// src/routes/events/$slug.register.tsx (named child route)
export const Route = createFileRoute("/events/$slug/register")({
  component: EventRegistrationPage,
});
```

#### ❌ Bad: Parent Route Without Outlet

```typescript
// THIS WILL CAUSE CHILD ROUTES TO NOT RENDER
// src/routes/events/$slug.tsx
export const Route = createFileRoute("/events/$slug")({
  component: EventDetailPage, // No outlet = child routes won't show
});
```

**Symptoms of Missing Outlet**:

- URL changes but content doesn't update
- Parent route content shows instead of child route
- No routing errors in console
- Works in development but may fail in production

## Server Function Best Practices

### Always Use Zod Validation

The most important best practice is to use Zod schemas with the `.validator()` method instead of relying on TypeScript type annotations alone.

#### ✅ Good: Zod Validation

```typescript
import { z } from "zod";
import { createServerFn } from "@tanstack/react-start";

// 1. Define schema
const createTeamSchema = z.object({
  name: z.string().min(1, "Team name is required"),
  slug: z.string().regex(/^[a-z0-9-]+$/, "Invalid slug format"),
  description: z.string().optional(),
});

// 2. Use validator with schema.parse
export const createTeam = createServerFn({ method: "POST" })
  .validator(createTeamSchema.parse)
  .handler(async ({ data }) => {
    // data is properly typed from schema
    // Also validated at runtime!
    return { success: true, team: newTeam };
  });
```

#### ❌ Bad: Type Assertion

```typescript
// AVOID THIS PATTERN
export const createTeam = createServerFn({ method: "POST" }).handler(
  async ({ data }: { data: CreateTeamInput }) => {
    // No runtime validation
    // May need @ts-expect-error
    return { success: true, team: newTeam };
  },
);
```

### Benefits of Zod Validation

1. **Runtime Safety**: Validates inputs at runtime, not just compile time
2. **Better Error Messages**: Zod provides detailed validation errors
3. **Type Inference**: TypeScript types are automatically inferred from schemas
4. **No @ts-expect-error**: Eliminates most type inference issues
5. **Single Source of Truth**: Schema defines both validation and types

## Type Safety Guidelines

### Handling Database jsonb Fields

When working with Drizzle ORM's jsonb fields, create proper type definitions:

#### 1. Create Database Type Definitions

```typescript
// features/events/events.db-types.ts

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface EventMetadata {
  [key: string]: any;
}

export interface EventScheduleItem {
  time: string;
  activity: string;
  location?: string;
}

export interface EventSchedule {
  items?: EventScheduleItem[];
  [key: string]: any;
}
```

#### 2. Override Database Types

```typescript
// features/events/events.types.ts

import type { Event } from "~/db/schema";
import type { EventMetadata, EventSchedule } from "./events.db-types";

export interface EventWithDetails extends Omit<Event, "metadata" | "schedule"> {
  metadata: EventMetadata;
  schedule: EventSchedule;
  // ... other fields
}
```

### Error Handling Pattern

Define typed error responses for consistency:

```typescript
export type OperationResult<T> =
  | { success: true; data: T }
  | { success: false; errors: OperationError[] };

export type OperationError = {
  code: string;
  message: string;
  field?: string;
};
```

## File Organization

Organize server functions by feature with clear separation:

```
src/features/teams/
├── teams.schemas.ts      # All Zod schemas
├── teams.queries.ts      # GET operations (read)
├── teams.mutations.ts    # POST/PUT/DELETE operations (write)
├── teams.types.ts        # TypeScript types and interfaces
└── teams.db-types.ts     # Database-specific type overrides
```

### Example: teams.schemas.ts

```typescript
import { z } from "zod";

// Query schemas
export const getTeamSchema = z.object({
  teamId: z.string(),
});

export const listTeamsSchema = z
  .object({
    includeInactive: z.boolean().optional().default(false),
  })
  .optional()
  .default({ includeInactive: false });

// Mutation schemas
export const createTeamSchema = z.object({
  name: z.string().min(1),
  slug: z.string().regex(/^[a-z0-9-]+$/),
  // ... other fields
});

export const updateTeamSchema = z.object({
  teamId: z.string(),
  data: createTeamSchema.partial(),
});

// Export inferred types
export type GetTeamInput = z.infer<typeof getTeamSchema>;
export type CreateTeamInput = z.infer<typeof createTeamSchema>;
export type UpdateTeamInput = z.infer<typeof updateTeamSchema>;
```

## Common Pitfalls

### 1. Nested Data in Update Operations

When updating with partial data, structure it correctly:

```typescript
// ✅ Correct: Nested data structure
export const updateTeam = createServerFn({ method: "POST" })
  .validator(updateTeamSchema.parse)
  .handler(async ({ data }) => {
    // Access nested data
    const updates = data.data; // data.data contains the actual updates
    const teamId = data.teamId;

    await db.update(teams).set(updates).where(eq(teams.id, teamId));
  });

// Usage
await updateTeam({
  data: {
    teamId: "123",
    data: { name: "New Name" }, // Nested under 'data'
  },
});
```

### 2. Calling Server Functions

Match the call structure to your schema:

```typescript
// If schema expects { data: { ... } }
await myServerFn({ data: { field: "value" } });

// If schema expects direct object
await myServerFn({ field: "value" });

// If no input
await myServerFn();
```

### 3. Import Organization

Keep imports clean and avoid unused imports:

```typescript
// ✅ Good: Import only what you use
import type { EventOperationResult } from "./events.types";

// ❌ Bad: Importing unused types
import type {
  EventOperationResult,
  EventFilters, // unused
  CreateEventInput, // unused
} from "./events.types";
```

## Migration Guide

### Migrating from Type Assertions to Zod

1. **Identify Current Pattern**:

```typescript
// Old pattern with type assertion
.handler(async ({ data }: { data: TeamInput }) => {
```

2. **Create Zod Schema**:

```typescript
const teamInputSchema = z.object({
  name: z.string(),
  // ... other fields
});
```

3. **Update Server Function**:

```typescript
// New pattern with validator
.validator(teamInputSchema.parse)
.handler(async ({ data }) => {
```

4. **Update Call Sites**:

```typescript
// Ensure calls match schema structure
await createTeam({ data: teamData });
```

### Handling Existing @ts-expect-error

1. **Investigate the Root Cause**: Don't just remove it
2. **Try Zod Validation First**: Usually solves the issue
3. **Create Type Definitions**: For complex types like jsonb
4. **Document If Necessary**: If truly unavoidable, explain why

### Pre-commit Checks

Ensure your code passes these checks before committing:

- `pnpm lint` - No ESLint errors
- `pnpm check-types` - No TypeScript errors
- `pnpm test` - All tests pass

The pre-commit hook enforces these automatically.

## Summary

- **Always use Zod validation** for server functions
- **Create proper type definitions** for complex database fields
- **Organize code by feature** with clear schema/query/mutation separation
- **Avoid @ts-expect-error** - investigate and fix the root cause
- **Test your validation** to ensure it works as expected

Following these practices will result in more maintainable, type-safe code with better runtime validation and fewer TypeScript issues.
