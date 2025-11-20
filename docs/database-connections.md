# Database Connection Guide

This guide explains how to use Neon database connections with proper pooling in Solstice.

## Overview

Solstice uses [Neon](https://neon.tech) for PostgreSQL hosting and provides two types of database connections:

1. **Pooled Connection** - For serverless functions and API routes
2. **Unpooled Connection** - For migrations and long-running operations

## Connection Types

### Pooled Connection (via `pooledDb`)

The pooled connection uses Neon's connection pooler to efficiently handle concurrent requests in serverless environments.

**When to use:**

- API routes and serverless functions
- Short-lived queries (< 30 seconds)
- High-concurrency scenarios
- Netlify Functions or Vercel Edge Functions

**Example:**

```typescript
import { pooledDb } from "@/db";

export async function loader() {
  const users = await pooledDb.select().from(users);
  return { users };
}
```

### Unpooled Connection (via `unpooledDb`)

The unpooled connection creates a direct connection to the database, bypassing the pooler.

**When to use:**

- Database migrations
- Batch import/export operations
- Long-running queries (> 30 seconds)
- Operations requiring session-level features (prepared statements, advisory locks)
- Development and debugging

**Example:**

```typescript
import { unpooledDb } from "@/db";

// In a migration script
export async function runMigration() {
  await unpooledDb.transaction(async (tx) => {
    // Long-running migration logic
  });
}
```

### Automatic Connection Selection (via `db`)

The default `db` export automatically selects the appropriate connection type based on your environment:

```typescript
import { db } from "@/db";

// Automatically uses:
// - Pooled connection in serverless environments (Netlify/Vercel)
// - Unpooled connection in development or traditional servers
```

## Environment Variables

### Option 1: Netlify Automatic Setup

When you connect a Neon database through Netlify's dashboard, it automatically sets:

- `NETLIFY_DATABASE_URL` - Pooled connection URL
- `NETLIFY_DATABASE_URL_UNPOOLED` - Direct connection URL

### Option 2: Manual Configuration

For manual setup, configure these environment variables:

```bash
# Primary database URL (used as fallback for both types)
DATABASE_URL="postgresql://user:pass@host/db"

# Direct connection for migrations (optional)
DATABASE_URL_UNPOOLED="postgresql://user:pass@direct.host/db"
```

### Option 3: Custom Override

You can override the connection URLs with custom values:

```bash
# Override pooled connection
DATABASE_POOLED_URL="postgresql://user:pass@pooler.host/db"

# Override unpooled connection
DATABASE_UNPOOLED_URL="postgresql://user:pass@direct.host/db"
```

## Priority Order

The connection URLs are resolved in this priority order:

**For Pooled Connections:**

1. `DATABASE_POOLED_URL` (explicit override)
2. `NETLIFY_DATABASE_URL` (Netlify's automatic setup)
3. `DATABASE_URL` (fallback)

**For Unpooled Connections:**

1. `DATABASE_UNPOOLED_URL` (explicit override)
2. `DATABASE_URL_UNPOOLED` (manual setup)
3. `NETLIFY_DATABASE_URL_UNPOOLED` (Netlify's automatic setup)
4. `DATABASE_URL` (fallback)

## Best Practices

1. **Use the default `db` export** for most cases - it automatically selects the right connection type

2. **Explicitly use `pooledDb`** when you know you're in a serverless function:

   ```typescript
   import { pooledDb } from "@/db";

   export async function apiHandler() {
     // API route logic
   }
   ```

3. **Explicitly use `unpooledDb`** for migrations and maintenance:

   ```typescript
   import { unpooledDb } from "@/db";

   export async function migrate() {
     // Migration logic
   }
   ```

4. **Monitor connection usage** - Pooled connections have limits on concurrent connections

5. **Close connections properly** - The Drizzle ORM handles this automatically in most cases

## Troubleshooting

### "Too many connections" error

- You're likely using unpooled connections in a serverless environment
- Switch to `pooledDb` or the automatic `db` export

### "Connection timeout" in migrations

- Migrations should use `unpooledDb` for longer timeouts
- Pooled connections have a 30-second timeout

### Different behavior between environments

- Check which connection type is being used with the console logs
- Verify your environment variables are set correctly
